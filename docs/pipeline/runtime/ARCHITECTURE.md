---
title: "Arquitetura runtime do pipeline"
topic: kanban
kind: flow
audience: agent
updated: 2026-06-20
summary: "Diagrama end-to-end do pipeline da Clínica ÓR mostrando quem dispara quem: triggers Postgres, pg_net, crons, edge functions, helper pipelineMove e hook A2."
code_refs:
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
  - supabase/migrations/20260618024624_8bd1dfc0-03f0-41ae-83ac-e49ca377057f.sql
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/GATES.md
---

# Arquitetura runtime

## Diagrama

```text
                                ┌────────────────────────────────────┐
   Whatsapp inbound  ─────────► │ evolution-webhook                  │
                                │ • cria/atualiza lead+messages      │
                                │ • seta needs_ai_review=true        │
                                └─────────────┬──────────────────────┘
                                              │
                                              ▼
        ┌────────────────────────────────────────────────────────────────┐
        │ Postgres triggers (SECURITY DEFINER → pg_net http_post)        │
        │                                                                │
        │  tg_auto_novo_lead       leads INSERT      → action novo-lead  │
        │  tg_auto_secretary_replied messages INSERT → action secretary  │
        │  tg_auto_appointment_sync appointments I/U → action appt-sync  │
        │  tg_auto_field_changed   leads.custom_fields → action field    │
        └─────────────┬──────────────────────────────────────────────────┘
                      │ POST { action, ... }                Anon JWT
                      ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ pipeline-deterministic (router)                               │
        │   ruleNovoLead         → pipelineMove(...auto:novo-lead)      │
        │   ruleSecretaryReplied → pipelineMove(...auto:secretary)      │
        │   ruleAppointmentSync  → pipelineMove(...auto:appointment-…)  │
        │   ruleFieldChanged     → ciclo-concluido / modality-guard     │
        │   ruleInactivityTick   → tier 24h / 3d / 7d-nutricao          │
        │   ruleReactivationTick → tag reativacao                       │
        │   ruleHumanReactorTick → cria lead_task "Revisar travado"     │
        └─────────────┬──────────────────────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ _shared/pipeline-move.ts  ← TODO move passa por aqui          │
        │  Gates: G3 toggle, G4 idempotência, G1 lock manual,           │
        │         G2 destino lock_auto_move, D3 paciente antigo,        │
        │         G8 update mínimo, G5 history, G6/G7 fora deste módulo │
        │  Hooks async (waitUntil):                                     │
        │    1) pipeline-post-move-verifier  (A2)                       │
        │    2) applyStageBindings → message_sequence_enrollments       │
        └──────────────────────────────────────────────────────────────┘

  Cron pg_cron                          Cron pipeline-classify-tick (1/min)
  ────────────                          ──────────────────────────────────
   * * * * *    pipeline-classify-tick  ┐
   */15 * * * *  pipeline-inactivity     │
   0 6 * * *     pipeline-position-aud.  │
   0 7 * * *     pipeline-reactivation   │
   0 8 * * *     pipeline-human-reactor  │
   0 */3 * * *   classifier-daily-batch  ┘ tudo via net.http_post
                                          │
                                          ▼
   pipeline-classify  (V6 — 5 Agentes, até 5 chamadas LLM / execução)
     • lê fila: leads c/ needs_ai_review=true + reason 'pipeline-classifier'
     • monta LeadContext (idade, msgs, stage history, treated-before)
     • Fase 1 (serial)  — Resumidor (gpt-4o, fallback gpt-5-mini):
         extrai datas (anchor_iso) + gera summary
     • Fase 2 (paralela, Promise.all) — 3 agentes gpt-5-mini concorrentes:
         ├─ Agendador     → sinais de agendamento/reagendamento + datas cruas
         ├─ Tipificador   → tags_suggested + custom_fields_patch
         └─ Movimentador  → candidato a stage_suggestion (baseado no summary)
     • Fase 3 (serial)  — Maestro (gpt-5):
         recebe summary + 3 outputs paralelos → veredicto final
         { stage_suggestion, intent, confidence, is_b2b, reasons }
     • valida datas (date-parser) com bypass do G10 se alta confiança
     • aplica tags (whitelist + protegidas) e custom_fields_patch
     • intent → dispara hooks (runNfTask, etc)
     • Move por 2 caminhos:
         - B2B path (is_b2b + conf ≥ 0.95) → auto:classifier-b2b
         - Generic path (General Move) → auto:classifier-stage (lock em Paciente antigo)
     • Confidence < 0.6 → tag precisa_atencao_humana
     • Telemetria: 5 linhas em ai_usage (1 por agente) +
       1 lead_events 'auto:classifier' com payload.agents{...} + applied{}

   pipeline-position-auditor (A1, gpt-5-mini, cron diário 03h BRT)
     • Seleciona leads parados ≥7d, stage não excluído, sem appt futuro
     • Idempotência: 1 auditoria por lead a cada 14 dias
     • Discorda c/ conf ≥ 0.75 →
         tags precisa_atencao_humana + auditor_sugere_<canon>
         lead_task "Revisar posição..." (due +2d)
         lead_events position_audit_disagreement
     • Concorda → lead_events position_audit_ok
     • NUNCA move card

   pipeline-post-move-verifier (A2, gpt-5-nano, hook async)
     • Disparado por pipelineMove() para todo source auto:*
     • Verdict 'nao' c/ conf ≥ 0.8 →
         tags precisa_atencao_humana + post_move_warning
         lead_events post_move_disagreement
     • NUNCA reverte
```

## Pontos de invocação

| Cron / Trigger | Schedule | Função | Action |
|---|---|---|---|
| trigger `trg_leads_auto_novo_lead` | INSERT em `leads` | `pipeline-deterministic` | `novo-lead` |
| trigger `trg_messages_auto_secretary` | INSERT em `messages` | `pipeline-deterministic` | `secretary-replied` |
| trigger `trg_appointments_auto_sync` | INSERT/UPDATE status `appointments` | `pipeline-deterministic` | `appointment-sync` |
| trigger `trg_leads_auto_field_changed` | UPDATE de `leads.custom_fields` | `pipeline-deterministic` | `field-changed` |
| cron `pipeline-classify-tick` | `* * * * *` (1/min) | `pipeline-classify` | `tick` |
| cron `pipeline-inactivity-tick` | `*/15 * * * *` | `pipeline-deterministic` | `inactivity-tick` |
| cron `pipeline-reactivation-tick` | `0 7 * * *` | `pipeline-deterministic` | `reactivation-tick` |
| cron `pipeline-human-reactor-tick` | `0 8 * * *` | `pipeline-deterministic` | `human-reactor-tick` |
| cron `pipeline-position-auditor-daily` | `0 6 * * *` (03h BRT) | `pipeline-position-auditor` | `tick` |
| cron `classifier-daily-batch` | `0 */3 * * *` | `pipeline-run-executor` | batch via UI |
| hook async em `pipelineMove()` | quando move `source LIKE 'auto:%'` | `pipeline-post-move-verifier` | verify |
| webhook externo | HTTP POST | `pipeline-payment-webhook` | `runPaymentConfirmed` |

## Camadas (resumo)

1. **Captura** — `evolution-webhook` (whatsapp) e form submissions populam `leads` e `messages`.
2. **Roteamento determinístico** — triggers Postgres invocam `pipeline-deterministic` via `pg_net`. Decisões binárias (regras `auto:*`).
3. **Move centralizado** — toda regra que move card passa por `_shared/pipeline-move.ts`, que aplica os 7 gates síncronos + 2 hooks async (A2 verifier + stage bindings).
4. **Classificação LLM** — `pipeline-classify` consome a fila `needs_ai_review`, roda a linha de montagem **V6 de 5 Agentes** (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro) e devolve JSON estruturado, aplicando tags/fields/move-de-B2B/move-genérico. NUNCA toca `appointments`. Cada agente grava sua própria linha em `ai_usage` (operations `classifier:summarizer|agendador|typifier|movimentador|maestro`).
5. **Resumo** — O Agente 1 (Resumidor) é nativo ao processo de classificação, garantindo que o histórico e o momento atual estejam sempre sintetizados antes da fase paralela.
6. **Auditoria** — A1 (cron) e A2 (hook) sinalizam via tag, nunca alteram stage.
7. **Reator humano** — cron diário cria task "Revisar lead travado" para leads com tag `precisa_atencao_humana` parados ≥7d.
