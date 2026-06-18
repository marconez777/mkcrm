# Memory: docs/maintenance-progress
---
name: Docs maintenance progress
description: Snapshot do que está documentado em docs/pipeline/runtime/ (espelho do estado deployado em 2026-06-18) e relação com docs/pipeline/ raiz (planejamento v4.2)
type: feature
---

## docs/pipeline/runtime/ — criado 2026-06-18

Espelho do código deployado. 14 arquivos cobrindo:
- README.md (hub + status de cada componente)
- ARCHITECTURE.md (diagrama end-to-end, crons, triggers pg_net)
- STAGES_LIVE.md (11 stages reais com UUIDs)
- CLASSIFIER.md (pipeline-classify completo: prompt literal, schema Zod, sanitizeDateField, tool A3)
- DETERMINISTIC_RULES.md (regras auto:* do pipeline-deterministic)
- AUDITORS.md (A1 cron + A2 hook async)
- SUMMARIZER.md (runSummarize ≤800 chars)
- HUMAN_REACTOR.md (lock manual 7d, botão Destravar, ruleHumanReactorTick cron)
- FIELDS_LIVE.md (23 custom_fields reais da clínica)
- TAGS_LIVE.md (tags em uso real + whitelist documental + protegidas)
- DATABASE_LIVE.md (tabelas, triggers, crons pg_cron)
- EVENTS_TELEMETRY.md (tipos de lead_events com volume real 30d)
- GATES.md (G1–G11 + D3 com arquivo:linha)
- KNOWN_ISSUES.md (8 bugs/gaps: 1ª consulta fixed, data BRT fixed, lock manual fixed, G10 ausente, etc.)
- AUDIT_CHECKLIST.md (30 perguntas que outro agente deve responder)

docs/pipeline/README.md raiz atualizado com banner apontando para runtime/ como fonte de verdade.

Não há scripts/docs-sync.mjs neste projeto — não gerar INDEX.json.
