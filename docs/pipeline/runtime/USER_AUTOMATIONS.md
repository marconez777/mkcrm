---
title: "User automations — regras configuráveis por clínica"
topic: automations
kind: reference
audience: agent
updated: 2026-06-22
summary: "Tabela public.automations + edge function automations-tick: regras de automação configuráveis por clínica via UI /automations. Distintas das regras determinísticas hardcoded em pipeline-move.ts. Documenta schema, fluxo de execução, toggles e isolamento multi-tenant."
code_refs:
  - supabase/functions/automations-tick/index.ts
  - src/pages/Automations.tsx
related_docs:
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
---

# User Automations

Regras configuráveis pela clínica na UI `/automations`. **Não confundir** com as *deterministic rules* hardcoded em `_shared/pipeline-move.ts` (que rodam para todas as clínicas allowlistadas).

## Tabela `public.automations`

| Coluna | Tipo | Uso |
|---|---|---|
| `id` | uuid | PK |
| `clinic_id` | uuid | FK — isolamento multi-tenant |
| `name` | text | Rótulo da regra |
| `trigger` | text | `no_reply_after` · `stage_idle` · `before_appointment` |
| `conditions` | jsonb | Parâmetros do trigger (ex.: `{minutes: 1440, stage_id: '…'}`) |
| `action` | text | `send_template` · `add_tag` · `move_stage` |
| `action_payload` | jsonb | Parâmetros da ação |
| `enabled` | bool | Toggle por regra |
| `created_at` / `updated_at` | timestamptz | |

Cada execução grava uma linha em `automation_runs (automation_id, lead_id, status, error, created_at)`.

## Fluxo de execução

```text
cron pg_cron `automations-tick-every-5-min` (*/5 min)
  └─> POST automations-tick
        └─> SELECT * FROM automations WHERE enabled
              └─> para cada regra: findCandidates(rule)
                    ├─ trigger=no_reply_after  → leads sem msg de paciente há N min
                    ├─ trigger=stage_idle      → leads na stage X há N min
                    └─ trigger=before_appointment → leads com appointment em N min
              └─> para cada candidato: executeAction(rule, lead)
                    └─> INSERT INTO automation_runs (...)
```

**Invariante multi-tenant** (KNOWN_ISSUES §-4): todo `findCandidates` **DEVE** filtrar `leads.clinic_id = automation.clinic_id`. O trigger `trg_automation_runs_clinic_coherence` é a última linha de defesa e levanta `EXCEPTION` se a coerência for violada.

## Diferença vs Deterministic Rules

| Aspecto | User Automation | Deterministic Rule |
|---|---|---|
| Quem configura | Clínica via `/automations` | Código (`pipeline-move.ts`) |
| Escopo | 1 clínica | Todas allowlistadas |
| Toggle | Coluna `enabled` na linha | `app_settings.automation.<rule>.enabled` |
| Trigger | `automations-tick` (cron 5min) | `pipeline-deterministic` (event-driven via triggers PG) |
| Exemplos | "Mandar template X se sem resposta 24h" | `auto:novo-lead`, `auto:secretary-replied`, `auto:followup-7d` |

## Toggles em `app_settings` que afetam user automations

A tabela `automations` tem seu próprio `enabled` por linha, então **não há toggle global** para desligar todas. Para parar o tick inteiro, desabilite o cron:

```sql
SELECT cron.unschedule('automations-tick-every-5-min');
```

## Como verificar saúde

```sql
-- Top 10 regras mais executadas (7d)
SELECT a.name, count(*) n, count(*) FILTER (WHERE ar.status='ok') ok_count
FROM automation_runs ar JOIN automations a ON a.id = ar.automation_id
WHERE ar.created_at > now() - interval '7 days'
GROUP BY a.id, a.name ORDER BY n DESC LIMIT 10;

-- Cross-clinic detectado (deve ser 0)
SELECT count(*) FROM automation_runs ar
  JOIN automations a ON a.id = ar.automation_id
  JOIN leads l ON l.id = ar.lead_id
 WHERE a.clinic_id <> l.clinic_id AND ar.status <> 'failed_cross_clinic';
```

## Gap conhecido

`stage_sequence_bindings` (3 bindings ativos em todo o projeto) é uma feature paralela, dormente. Ver `KNOWN_ISSUES.md §-10`.

### Critério de revisão — 2026-07-22 (Fase 10)

Reavaliar nessa data. Se `SELECT count(*) FROM stage_sequence_bindings` ainda for `< 10`:

1. `DROP TRIGGER trg_enroll_on_stage_change ON public.leads;` (ou equivalente).
2. Arquivar UI `message_sequences` (esconder rota, manter migrations).
3. Manter tabela `stage_sequence_bindings` por mais 90d antes de droppar (compatibilidade com leads em flight).

Se `≥ 10`, manter como está e reagendar revisão por mais 30d.

