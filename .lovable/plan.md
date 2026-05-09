# Plano revisado v2 — Pipeline Watcher (Fase 1)

Beleza, alinhado. Sem colunas por tratamento — interesse vira **campo customizado** (`tratamento_interesse`) + **tag**. Watcher é por instância de WhatsApp / pipeline. Cron 03:00. Botão "Revisar com IA" visível para todos.

## Etapas oficiais do pipeline (referência para o Watcher)

```text
1.  Leads de entrada
2.  Qualificação
3.  Consulta agendada
4.  Consulta paga
5.  Consulta finalizada
6.  Fechamento pendente — consulta
7.  Lead parou de responder
8.  Lead não qualificado
9.  Fechamento pendente — procedimento
10. Procedimento agendado
11. Procedimento pago
12. Retorno / Tratamento finalizado
13. Paciente antigo
14. Antigo — consulta/procedimento agendado
15. Nutrição de leads inativos
16. Administrativo
```

Regras de movimentação que o Watcher vai aplicar (resumo do que vai pro system prompt):

| Sinal observado na conversa | Ação |
|---|---|
| Lead respondeu uma mensagem da clínica e ainda está em "Leads de entrada" | mover para **Qualificação** + tag `quente` se houver indicador forte |
| Secretária/lead acordam horário de consulta ("dia X às Y", "marcado", "confirmado") | mover para **Consulta agendada** + preencher `data_agendamento` |
| Lead confirma pagamento da consulta ("paguei", "transferi", comprovante reconhecido) | mover para **Consulta paga** + `valor_pago` + `forma_pagamento` + tarefa "Confirmar dados" |
| Secretária registra consulta realizada / lead fala "fui na consulta" | mover para **Consulta finalizada** |
| Pós-consulta sem fechamento, lead ainda decidindo | mover para **Fechamento pendente — consulta** |
| Lead negociando procedimento/protocolo, sem pagamento | **Fechamento pendente — procedimento** |
| Procedimento marcado | **Procedimento agendado** + `data_procedimento` |
| Pagamento de procedimento confirmado | **Procedimento pago** + valor + tarefa |
| Tratamento concluído | **Retorno / Tratamento finalizado** |
| Lead claramente fora de perfil (psiq. infantil, terapia de casal, fora da região, spam) | **Lead não qualificado** + tag `fora-perfil` |
| Sem resposta do lead há ≥ 5 dias e fora de etapas pagas/agendadas | **Lead parou de responder** + tag `frio` |
| Lead frio voltou a responder | tirar tag `frio` + voltar para a etapa anterior (via histórico) |
| Pix sendo enviado pela secretária mas lead ainda não pagou | **só** tag `negociando-pagamento` (não move) |
| Risco clínico (ideação, automutilação, surto, gestante em crise) | tag `risco` + tarefa máxima + `transfer_to_human` |
| Contraindicação possível | tag `contraindicacao-possivel` + tarefa |
| Mensagem ambígua | tag `ambiguo` + tarefa baixa, **não move** |

Etapas **13, 14, 15, 16** são geridas manualmente — o Watcher **não** move leads para elas (evita falso positivo). Só anota se detectar sinais (ex.: "sou paciente antigo" → tag `paciente-antigo` + tarefa de revisão).

## Tags que vou criar (para você cadastrar/curar depois)

Operacionais (ciclo de vida):
- `quente`, `frio`, `negociando-pagamento`, `pagou`, `pronto-pra-agendar`, `ambiguo`, `fora-perfil`, `paciente-antigo`

Clínicas / risco:
- `risco`, `contraindicacao-possivel`

Interesse de tratamento (substituem as colunas):
- `interesse:cetamina`, `interesse:emt`, `interesse:hipnose`, `interesse:alcoolismo`

Origem (opcional, se já não vier de outro lugar):
- `origem:instagram`, `origem:google`, `origem:indicacao`

Você cadastra/renomeia depois — eu só preencho via Watcher conforme cair na conversa.

## Campos customizados que o Watcher vai preencher

Já vou usar a estrutura existente (`lead_custom_fields` + `leads.custom_fields`). Sugestão de chaves (você confirma os nomes finais antes):

- `queixa_principal` (text)
- `tempo_sintoma` (text)
- `tratamentos_previos` (textarea)
- `idade` (number)
- `cidade` (text)
- `tratamento_interesse` (select: cetamina, emt, hipnose, alcoolismo, indefinido)
- `valor_pago` (currency)
- `forma_pagamento` (select: pix, cartao, boleto, dinheiro)
- `data_agendamento` (datetime)
- `data_procedimento` (datetime)
- `data_resfriou` (date)

Watcher só preenche o que estiver **explícito** na conversa.

## Watcher por instância de WhatsApp / pipeline

Cada instância de WhatsApp oficial terá **seu próprio Watcher**, configurável em **Configurações → WhatsApp → [instância] → Watcher de IA**.

- Nova coluna em `whatsapp_instances`: `watcher_agent_id uuid` (referência a `ai_agents.id`).
- Ao receber webhook do Evolution, `ai-auto-reply` carrega o lead, descobre a instância → enfileira o `watcher_agent_id` daquela instância (em paralelo ao auto-reply normal de venda, quando este existir).
- Como cada pipeline já tem `whatsapp_instance_id`, na prática cada pipeline oficial ganha seu Watcher dedicado. Funis sem instância (kanbans internos) não disparam Watcher.
- O system prompt fica o mesmo; o que muda por instância pode ser o nome da clínica e a base de conhecimento (RAG escopado por `agent_id`).

## Mudanças concretas

### Banco

Migração:
- `ALTER TABLE ai_agents ADD COLUMN silent boolean NOT NULL DEFAULT false;`
- `ALTER TABLE whatsapp_instances ADD COLUMN watcher_agent_id uuid;`
- Tabela `lead_stage_history (id, lead_id, stage_id, moved_at, moved_by_agent_id)` — para o Watcher saber "voltar pra etapa anterior" quando o lead frio responder. Trigger preenche em update de `leads.stage_id`.

### Tools novas no `ai-chat`

- `add_lead_tag(tag)` — append em `leads.tags`.
- `remove_lead_tag(tag)` — remove do array.
- `get_lead_state()` — retorna `{stage_name, tags, custom_fields, last_message_at, previous_stage_name}`.

`schedule_message` fica **fora** da lista de tools do Watcher (impede acidente de envio).

### Modo silencioso (`scheduled-dispatcher`)

- Carrega `agent.silent`. Se `true`, descarta texto e nunca chama `evolution-send`. Continua gravando `ai_usage` e traces.

### Botão "Revisar com IA"

- `LeadDrawer.tsx` (header) e menu de ações do card no Kanban: botão pequeno com ícone `Sparkles` → invoca `ai-chat` passando `agent_id` (Watcher da instância do lead) + `lead_id` sem `messages`.
- Edge function: quando `messages` vier vazio + `lead_id` presente → busca últimas 30 mensagens reais (`messages` table), formata `[remetente HH:mm] conteúdo`, manda como turno único do `user`.
- Visível para todos os papéis (`owner`, `admin`, `professional`).

### Cron `watch-stale-leads` (03:00 BRT)

Edge function nova + agendamento via `pg_cron`/`pg_net`:
- `SELECT id, whatsapp_instance_id FROM leads WHERE archived_at IS NULL AND last_message_at < now() - interval '5 days' AND NOT ('frio' = ANY(tags));`
- Para cada lead, descobre o `watcher_agent_id` da instância e enfileira em `pending_replies`.
- O Watcher recebe estado e move pra **"Lead parou de responder"** + tag `frio`.

### Agente Watcher — registro

Para cada instância:
- `name`: "Pipeline Watcher — {nome da instância}"
- `silent: true`, `model: google/gemini-3-flash-preview`, `temperature: 0.2`
- `use_hybrid_search: true`, `use_hyde: false`, `use_memory: false`
- `rag_top_k: 5`, `debounce_seconds: 20`, `max_iterations: 4`
- `tools`: `move_lead_stage`, `set_lead_field`, `add_lead_note`, `add_lead_tag`, `remove_lead_tag`, `assign_attendant`, `create_task`, `transfer_to_human`, `search_knowledge_base`, `get_lead_state`
- `system_prompt`: o seu, com placeholders trocados pelas 16 etapas oficiais e tags acima

### Base de conhecimento (RAG do Watcher)

5–7 docs curtos:
1. `mapa-etapas.md` — quando mover para cada uma das 16, com exemplos.
2. `red-flags.md` — risco clínico.
3. `padroes-pagamento.md` — pix vs pago, extração de valor.
4. `contraindicacoes.md` — pares (tratamento × condição).
5. `fora-de-perfil.md`.
6. `glossario-sintomas.md`.
7. `tom-secretarias.md` — para distinguir voz.

### Evals

10–15 casos cobrindo os 7 exemplos do seu prompt + 3 específicos das etapas novas (consulta agendada, consulta paga, procedimento pago).

## O que NÃO entra agora

- Auto-reply de venda (cetamina/EMT/hipnose/alcoolismo) — fica como Fase 2.
- Reativação automática de leads frios — Fase 3 (outro agente).
- Mover para etapas 13–16 automaticamente.

## Próximo passo

Se aprovar, eu já começo pela migração (silent + watcher_agent_id + lead_stage_history) e pelas 3 tools novas no `ai-chat`. As tags e campos customizados eu deixo um script de seed para você revisar antes de rodar.
