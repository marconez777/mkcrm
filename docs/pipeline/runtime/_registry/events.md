---
title: "Registry — lead_events"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por lead_events.type: quem emite, shape do payload e a query certa. Os caminhos de payload aqui são os únicos verificados — docs antigos citavam caminhos que retornam vazio."
code_refs:
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
---

<!-- docs-verify:allow-stale-paths — este arquivo cita os caminhos errados de propósito, para avisar -->

# Registry — `lead_events`

⚠️ **Não existe `auto:maestro`.** Docs antigos mandavam consultar esse tipo em queries de
auditoria — retorna zero linhas e passa a impressão de que o sistema está parado. A telemetria
dos 5 agentes vai toda em **`auto:classifier`**.

## Tipos emitidos

| `type` | Emitido por | Payload |
|---|---|---|
| `auto:classifier` | `apply.ts::writeTelemetry` e `writeSkipTelemetry` | Telemetria completa — ver estrutura abaixo |
| `pipeline_move_attempted` | `pipelineMove` (G4) | `{idempotency_key, source, from_stage_id, to_stage_id, rule_key}` — é o que garante idempotência |
| `auto:summarize` | `runSummarize` | Resultado do resumidor |
| `auto:payment-confirmed` | `runPaymentConfirmed` | `{amount, ref, source}` — idempotente por `ref` |
| `pagamento_alegado` | `runPaymentAlleged` | `{due_at, source}` |
| `nf_solicitada` | `runNfTask` | `{due_at, source}` |
| `auto:judicializacao` | `runJudicializacao` | `{reasons, due_at}` |
| `auto:renovacao-receita` | `runRenovacaoReceita` | `{due_at}` |
| `auto:objection-suggest` | `runObjectionSuggest` | `{reasons}` |
| `auto:stage-bindings` | `applyStageBindings` | Sequências disparadas na entrada do stage |
| `pipeline_fallback_used` | classifier | Modelo primário falhou, usou fallback |
| `auto:novo-lead` · `auto:secretary-replied` · `auto:appointment-sync` · `auto:ciclo-concluido` · `auto:modality-guard` · `auto:followup-24h` · `auto:followup-3d` · `auto:followup-7d` · `auto:inactivity-paciente-antigo` · `auto:monthly-sweep` · `auto:reactivation` · `auto:human-reactor` | `pipeline-deterministic::logEvent` | `{res}` do `pipelineMove` + contexto da regra |
| `auto:reactivation-inbound` | `ruleReactivationInbound` | Lead saiu da geladeira ao responder |
| `auto:paciente-antigo-canonical` | `pipeline-deterministic` | Canonicalização para `Paciente antigo` |
| `auto:inactivity-paciente-antigo-nutricao-antigos` | `ruleInactivityTick` (SLA 60d) | Variante do evento de inatividade |
| `stage_changed_by_ai` | classifier | Move efetivado pela IA |
| `position_audit_ok` · `position_audit_disagreement` | `pipeline-position-auditor` (A1) | Auditor diário concorda / discorda da posição do lead. `disagreement` aplica tag `precisa_atencao_humana` |
| `duplicate_detected` | dedup de leads | Lead duplicado identificado |
| `form_submission` · `partial_form_capture` | captação | Submissão de formulário (completa / parcial) |
| `manual:unlock` | `unlockLeadManually` (UI) | `{previous_lock_until, by_user_id}` |

## Estrutura do `auto:classifier`

Caminhos **verificados** — use exatamente estes:

```
payload
├── version, mode
├── classification      { stage_suggestion, intent, confidence, is_b2b, reasons }
├── extractor           { mentioned_dates, mentioned_intents }
├── date_parser         [ { raw, anchor_iso, kind, resolved, rejected_reason } ]
├── first_consult       { allowFirstConsultTag, mustRemoveFirstConsultTag, reason }
├── applied
│   ├── tags                    { added, removed_computed, dropped_by_whitelist, low_confidence_tag_injected }
│   ├── custom_fields           { set, blocked_by_g10, rejected }
│   ├── stage_suggestion_only   { suggested, current_stage_name, would_move, path, reason, confidence }
│   ├── intent_effects
│   └── summarize
├── cost                { model, usage }
└── agents              { *_model, summary, summary_chars, latency_ms, ran }
```

⚠️ Caminhos de docs antigos que **retornam vazio**:
`applied.custom_fields_rejected` (falta o nível `custom_fields`) e qualquer coisa sob
`auto:maestro`.

## Queries de auditoria

```sql
-- últimas classificações de um lead
SELECT created_at,
       payload->'classification'                        AS veredicto,
       payload->'applied'->'stage_suggestion_only'      AS move
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 10;
```

```sql
-- por que os moves não estão acontecendo (últimas 24h)
SELECT payload->'applied'->'stage_suggestion_only'->>'reason' AS motivo, count(*)
FROM lead_events
WHERE type = 'auto:classifier' AND created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC;
```

```sql
-- skips do classifier (lead nem foi processado)
SELECT payload->>'skipped' AS motivo, count(*)
FROM lead_events
WHERE type = 'auto:classifier' AND payload ? 'skipped'
  AND created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC;
```

```sql
-- moves efetivados, por origem
SELECT source, count(*)
FROM lead_stage_history
WHERE moved_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;
```

## Nota sobre duas fontes de verdade

`ai_usage` (por chamada de modelo) e `pipeline_run_items` (por execução do runner) são
desacoplados. Um pode mostrar erro alto enquanto o outro mostra saúde — não é bug de UI.
Ver item de 2026-06-23 no `KNOWN_ISSUES.md`.
