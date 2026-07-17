---
title: "Glossário de Funções e Mapeamento de Bugs — Clínica ÓR"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-17
summary: "Glossário das edge functions do pipeline da Clínica ÓR e bugs conhecidos."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-inactivity-tick/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/report-finalizados-mensal-or/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
---

# Glossário de Funções e Mapeamento de Bugs — Clínica ÓR

## Glossário de Edge Functions do Pipeline

| Edge Function / Arquivo Base | Propósito Principal | Onde encontrar nas Docs Originais |
|---|---|---|
| `pipeline-classify/index.ts` | O Dispatcher principal que gerencia as chamadas da fila para IA do pipeline (V6). | `CLASSIFIER.md` |
| `pipeline-classify/agent-core.ts` | O Orquestrador da Linha de Montagem de 5 Agentes (Resumidor, Agendador, Tipificador, Movimentador, Maestro). | `CLASSIFIER.md` |
| `pipeline-classify/apply.ts` | Aplica as decisões do classificador ao banco de dados e valida os gates estruturais (como G10 e locks). | `CLASSIFIER.md`, `GATES.md` |
| `automations-tick/index.ts` | CRON de um minuto que envia lembretes (ex: 24h/1h de consulta) predefinidos pelo frontend da Clínica ÓR. | `SCENARIOS.md` |
| `pipeline-inactivity-tick` | Trata as camadas de follow-up (24h e 3 dias) e a inserção dos inativos na Geladeira (Sem Resposta -> Nutrição). | `AUTOMATION_PLAN.md`, `SCENARIOS.md` |
| `report-finalizados-mensal-or` | Gera os relatórios mensais "Dia 1" baseando-se em eventos passados. | `clinica-or-fluxo-novo.md` |
| `_shared/pipeline-move.ts` | A camada bruta que efetua o Update de fase e injeta nos logs do `lead_stage_history`. Roda os 11 Gates de segurança. | `AUTOMATION_PLAN.md` |
| `pipeline-position-auditor` | Agente Auditor 1 (A1). Acorda de madrugada para avaliar leads com estagnação e sugerir intervenções para a equipe. | `AUTOMATION_PLAN.md` |
| `trg_set_b2b_on_stage_move` | Gatilho SQL que atua escutando mudanças de fase. "Carimba" leads movidos para estágios B2B com a chave `is_b2b=true`. | `CLINICA_OR_CLASSIFIER.md` |

## Mapeamento de Erros e Bugs Conhecidos (A serem avaliados/corrigidos)

Abaixo estão as inconsistências mapeadas que afetam direta ou indiretamente o funcionamento da Clínica ÓR:

1. **Bug do `stage_sequence_bindings` dormente**
   - **Descrição:** Existem configurações de binds (para iniciar sequências ao entrar num estágio), no entanto o trigger correspondente roda a cada movimento olhando para uma tabela quase vazia.
   - **Status:** Dívida operacional em análise de viabilidade (Avaliação reagendada para 2026-07-22).
   - **Ref:** `KNOWN_ISSUES.md` (item -10).

2. **Eventos `auto:*` sem registro no DB**
   - **Descrição:** Eventos fundamentais de acompanhamento (`auto:secretary-replied`, gatilhos de agendamento) pararam de registrar instâncias de `lead_events`, impossibilitando a auditoria posterior.
   - **Causa Raiz Avaliada:** A função interna `public.notify_pipeline_deterministic` estava órfã do disparador (pg_trigger apagado ou não linkado).
   - **Status:** Necessário linkar a Trigger correta na base de produção.

3. **Leads travados na Fila de IA (Dropping Silencioso)**
   - **Descrição:** Os leads antigos não estavam ativando a fila da IA quando enviavam novas mensagens se estivessem em inatividade.
   - **Status:** **[RESOLVIDO em 17/07/2026]** O culpado era o trigger legado `trg_lead_needs_extraction` que ignorava mensagens de leads que não contivessem palavras-chave. Ele foi atualizado para avisar a IA sempre que uma mensagem chega (`from_me = false`).

4. **Tags sem verificação em Whitelist em UI vs DB**
   - **Descrição:** O `agent-core.ts` usa uma Whitelist JSON no painel do banco (`app_settings`), mas essa lista não aparece amigável na UI. Tags da IA rejeitadas somem da vista do lead, porém as aplicadas convivem juntas no array sem divisão rigorosa entre "Tags de Sistema" e "Tags Injetadas".
   - **Ação:** Recomenda-se normalizar para as instâncias atuais.

5. **Loop Infinito em Automações (Cooldown Bypass)**
   - **Descrição:** Quando uma automação de `move_stage` esbarrava num Gate de segurança e falhava, ela entrava num loop infinito de retentativas a cada 5 minutos.
   - **Status:** **[RESOLVIDO em 17/07/2026]** A função `recentlyRan` da `automations-tick` foi atualizada para aplicar cooldown mesmo em caso de erro, matando o loop.
