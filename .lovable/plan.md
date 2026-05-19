# Agentes padrão permanentes do CRM

Objetivo: os 3 agentes da clínica ÓR (Classificador de Pipeline, Analista de Conversas, Resumo IA) viram **templates de sistema**. Eles passam a existir em toda clínica nova ou já existente, podem ser ligados/desligados e editados, mas **não podem ser excluídos**.

## 1. Marcar agentes como "de sistema"

Adicionar 2 colunas em `ai_agents`:

- `is_system boolean not null default false` — quando `true`, o agente é gerenciado pela plataforma.
- `system_key text` — identifica o template (`classifier`, `analyst`, `summary`). Único por clínica.

Índice único parcial: `(clinic_id, system_key) where system_key is not null`, pra garantir 1 instância de cada template por clínica.

## 2. Bloquear exclusão no banco

Trigger `BEFORE DELETE ON ai_agents`:
- se `OLD.is_system = true` → `RAISE EXCEPTION 'system_agent_cannot_be_deleted'`.

Assim, mesmo que alguém chame `delete` pelo Supabase JS ou direto no SQL, o registro é protegido. Edições normais (system_prompt, model, enabled, tools, etc.) continuam permitidas.

## 3. Bloquear exclusão na UI

Em `src/pages/Agents.tsx`:
- na função `remove()` (linha 330) e no botão `Trash2` (linha 437): só mostrar/permitir se `!selected.is_system`.
- quando o agente for de sistema, mostrar um pequeno chip "Padrão do sistema" ao lado do nome, e um tooltip dizendo que pode ser desativado mas não excluído.

O toggle `enabled` continua funcionando normalmente.

## 4. Definir os 3 templates canônicos

Os templates ficam num bloco SQL que extrai a config exata dos agentes atuais da clínica ÓR (`cf038458-457d-4c1a-9ac4-c88c3c8353a1`):

| system_key | Nome             | Modelo     | role       | Ferramentas atuais |
|------------|------------------|------------|------------|-------------------|
| classifier | Classificador de Pipeline | o4-mini | classifier | move_lead_stage, add_lead_note, update_custom_field, remember_fact, get_lead_history, search_knowledge_base, set_lead_field |
| analyst    | Analista de Conversas     | gpt-5-mini | analyst | remember_fact, add_lead_note, generate_insight_report, get_lead_state, get_lead_history, search_knowledge_base |
| summary    | Resumo IA                 | gpt-5-nano | summary | remember_fact, get_lead_history, search_knowledge_base |

A migration promove os 3 agentes existentes da ÓR a `is_system=true` setando `system_key` correspondente (sem duplicar).

## 5. Propagar para todas as clínicas existentes

Na mesma migration, para **cada clínica em `clinics`** que ainda não tem o `system_key` correspondente, fazer `INSERT` clonando os campos do template, com `enabled = false` (sua escolha: admin liga quando quiser).

Clínicas como MKart, que já têm um "Classificador de Pipeline" próprio (não-system), **não são tocadas** — o novo agente padrão é inserido ao lado, e o admin decide o que fazer com o antigo. Assim ninguém perde configuração customizada.

## 6. Auto-criar nas clínicas novas

Trigger `AFTER INSERT ON clinics` chamando uma função `seed_system_agents(clinic_id uuid)` que insere os 3 templates (com `enabled=false`). A função usa `ON CONFLICT (clinic_id, system_key) DO NOTHING` pra ser idempotente.

## Detalhes técnicos

- A função `seed_system_agents` é `SECURITY DEFINER` com `search_path=public` — necessária porque o trigger roda no momento da criação da clínica, antes do `current_clinic_id()` estar definido pro usuário.
- O índice único parcial em `(clinic_id, system_key)` garante que rodar a seed várias vezes não duplica.
- A coluna `is_system` aparece em `src/integrations/supabase/types.ts` automaticamente após a migration; o código TS lê com fallback `agent.is_system ?? false`.
- Nenhuma mudança em RLS — as policies existentes (`ai_agents_admin_write`, `ai_agents_select`) continuam valendo. A proteção contra exclusão fica no trigger, não no RLS, pra que o erro seja explícito ("system_agent_cannot_be_deleted") em vez de um silencioso "0 rows affected".

## O que NÃO está no escopo

- Não vou sincronizar mudanças do template-mestre para as cópias. Cada clínica pode editar seu próprio Classificador, Analista e Resumo livremente — o que protegemos é só a existência deles.
- Não vou migrar/excluir os agentes antigos da MKart automaticamente. Você decide depois se quer apagar manualmente os duplicados não-system.
- Não vou criar templates separados por nicho ainda (ex: imobiliária, marketing). Quando quiser, a gente adiciona uma coluna `vertical` no template e seleciona qual nicho cada clínica usa.
