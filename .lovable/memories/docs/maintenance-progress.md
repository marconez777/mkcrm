# Memory: docs/maintenance-progress
---
name: Docs maintenance progress
description: Snapshot do que está documentado em docs/pipeline/runtime/ + estado da refatoração do Classifier V2 (2026-06-18)
type: feature
---

## docs/pipeline/runtime/ — atualizado 2026-06-18

Espelho do código deployado. 14+ arquivos cobrindo arquitetura, stages, classifier, regras determinísticas, auditores, summarizer, human reactor, fields, tags, db, eventos, gates, known issues, checklist.

## Classifier V2 — DEPLOYADO (2026-06-18)

`supabase/functions/pipeline-classify/` agora é modular:
- `index.ts` dispatcher v1/v2 (flag `automation.classifier.version`, default `'v1'`)
- `index.v1.ts` fallback (handleV1 exportado, sem Deno.serve)
- `schema.ts`, `context.ts`, `agent-core.ts`, `date-parser.ts`, `apply.ts`
- `rules/first-consult.ts`, `rules/intent-effects.ts`
- Testes Deno: `date-parser_test.ts` (4), `first-consult_test.ts` (5) — todos passam

**1 chamada gpt-5-mini** (Extrator+Router fundidos). Datas 100% determinísticas via `parseFutureDateInTZ`. Strict no-move (apenas B2B com guards rígidos: conf≥0.95, tag b2b, sem histórico tratado).

**Gate G10 IMPLEMENTADO**:
- Migration `20260618...g10_human_edits.sql`: coluna `leads.custom_fields_last_human_edit jsonb`, trigger `track_custom_fields_human_edits`, RPC `apply_lead_automation_patch`.
- Apply.ts checa `last_human_edit[key]` < 7d → descarta sugestão IA.

**Telemetria v2**: `lead_events.payload.version=2` com `extractor`, `date_parser`, `first_consult`, `applied.{tags, custom_fields.blocked_by_g10, stage_suggestion_only}`, `cost`.

**Rollout**: cron ativo, mas dispatcher ainda em v1. Para ativar V2: `UPDATE app_settings SET value='"v2"' WHERE key='automation.classifier.version'` (criar se não existir). Smoke via `{action:'lead', lead_id, force_version:'v2'}`.

**Cards strict-no-move**: vão acumular em Qualificação até Fase 2 (SumUp + appointment-extractor). Conhecido e aceito.

Não há scripts/docs-sync.mjs neste projeto.
