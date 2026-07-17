---
title: "O Mapa do Maroto: Guia de Manutenção do Classifier"
topic: kanban
kind: reference
audience: developer
updated: 2026-07-17
summary: "Glossário e Mapa Arquitetural prático para desenvolvedores. Saiba exatamente ONDE alterar lógicas e o QUE quebra quando você altera algo no MKCRM."
code_refs:
  - supabase/functions/pipeline-classify/
---

# O Mapa do Maroto: Manutenção do Classifier

Este guia foi criado para que você não precise ler milhares de linhas de código quando precisar alterar o comportamento da Inteligência Artificial. Se você quer mudar uma regra, busque a seção correspondente abaixo.

## 1. Onde as coisas começam (O Gatilho)

Se a IA parou de ler as mensagens, o problema NÃO é no LLM. O problema é no banco de dados.

- **Arquivo Chave (Migrations):** `supabase/migrations/*` (Ex: `20260710182805_ab962afe-7a02-44df-b105-c6e5b9af6659.sql`)
- **Mecanismo:** Existem Triggers no Postgres (`tg_auto_secretary_replied`, `tg_auto_novo_lead`). 
- **O que eles fazem:** Toda vez que há um `INSERT` na tabela `messages` onde `from_me = false`, o trigger seta `leads.needs_ai_review = true` e agenda a leitura (`ai_review_queued_at = now() + 5 min`).
- **Se quiser parar a IA totalmente para debug:** Vá no DBeaver e rode `UPDATE leads SET needs_ai_review = false`.

## 2. Onde a IA toma decisões (O Cérebro)

A partir de Julho/2026 (V6 Multi-Tenant), **a IA não tira regras do código duro**, ela tira do Banco de Dados.

- **Se quiser mudar PROMPTS, Intenções ou Nomes de Estágios da IA:** Você DEVE alterar a tabela `pipeline_tenant_classifiers`.
- **A Interface de Leitura:** `supabase/functions/pipeline-classify/context.ts` é quem carrega esses dados do banco.
- **A Interface de Injeção:** `supabase/functions/pipeline-classify/agent-core.ts` substitui as variáveis `{{TAG_LIST}}`, `{{KEYS_BLOCK}}` pelos dados reais antes de mandar pro LLM.

**Atenção:** Mudar prompts diretamente na Edge Function só afeta instâncias sem tenant configurado, o que é quase nulo hoje.

## 3. Onde o Funil avança (As Travas e os Braços)

Se o LLM tomou a decisão certa mas o card NÃO se moveu no Kanban, o problema está nas travas de segurança.

- **Arquivo Chave:** `supabase/functions/pipeline-classify/apply.ts`
- **Por que quebra? (Gargalos Comuns):**
  1. **Conflito Humano de 24h:** O `apply.ts` barra silenciosamente qualquer General Move se um humano tiver movido o card nas últimas 24 horas.
  2. **Renomeação de Estágios:** Se o cliente renomeou "Qualificação" para "Em Atendimento" na UI, mas não atualizou no `pipeline_tenant_classifiers`, a IA vai sugerir "Qualificação". O `apply.ts` vai procurar "Qualificação" no banco, não vai achar, e vai falhar com `general_guard_failed`.
  3. **Estágios Restritos:** Se a IA tentar sugerir "Consulta agendada" (que tá no array de `locked_stages` no banco), o `apply.ts` bloqueia frontalmente.
  4. **Lock de D3 (Paciente Antigo):** Se o card estiver no estágio "Paciente antigo", o Auto-Move morre prematuramente (o `apply.ts` bloqueia e só deixa atualizar as tags).

## 4. Onde mora o Bot de WhatsApp (Automações)

A tela de "Inteligência Artificial" -> "Automações" na UI **NÃO é rodada pelo Classifier principal**.

- **A UI:** `src/pages/Automations.tsx` (aqui são configuradas as lógicas "Lembrete de consulta", "Lead parado", etc).
- **A Execução (Edge):** `supabase/functions/automations-tick/`
- **Como funciona:** O `automations-tick` roda de 5 em 5 minutos. Ele pega as configurações do frontend e executa as ações (mover estágio, enviar template via Meta, ou disparar um followup via LLM).
- **Manutenção:** Se os templates de lembretes não estiverem saindo, olhe para os logs do `automations-tick`, e NÃO para o `pipeline-classify`.

## 5. Cheat Sheet de Manutenção Rápida

| O que você quer fazer? | Onde ir? |
| :--- | :--- |
| Criar uma nova intenção (ex: "solicitou_orcamento") | Adicionar no array `allowed_intents` na tabela `pipeline_tenant_classifiers` |
| Bloquear a IA de mover para o estágio X | Adicionar o estágio X no array `locked_stages` da mesma tabela |
| Impedir que um campo customizado seja sobrescrito | É automático! Se um humano preencheu há menos de 7 dias, a Gate 10 (`apply.ts`) barra. Campos `origem` têm trava vitalícia. |
| Forçar a IA a enviar mensagem no WhatsApp após X horas | Criar uma regra na UI de Automações (`Automations.tsx`), não mexer no código do Agente. |
