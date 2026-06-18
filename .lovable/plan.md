## Escopo confirmado

- **DROP** das 5 tabelas do Pipeline IA.
- Mexer **só no Pipeline IA** — `ai_agents`/Inbox/auto-reply ficam intactos.
- Deletar `/admin/docs` junto com a limpeza de docs.

---

## Fase 1 — Banco (migration única)

- `cron.unschedule()` em: `extractor-tick-10min`, `extractor-tick-cron`, `vision-tick-cron`, `field-rules-tick-cron`.
- `DELETE FROM automations` (12 linhas).
- `DROP TABLE` em cascata:
  - `pipeline_field_rules`
  - `stage_ai_defaults`
  - `lead_ai_settings`
  - `lead_reclassify_proposals`
  - `lead_reclassify_snapshot_2026_06`
  - `lead_ai_extraction_runs`

## Fase 2 — Remover edge functions

Deletar dirs + `delete_edge_functions`:
- `field-rules-tick`, `field-rules-suggest`
- `extractor-tick`
- `vision-tick`
- `lead-reclassify-deep`
- `pipeline-shadow-build`
- `admin-search-leads`

## Fase 3 — Remover UI do Pipeline IA

- Deletar: `src/pages/admin/AdminReclassify.tsx`, `src/components/settings/FieldRulesCard.tsx`, `src/components/settings/SuggestRulesDialog.tsx`, `src/components/settings/ExtractorHistoryCard.tsx`.
- `src/App.tsx` — remover rota `/admin/reclassify` + lazy import.
- `src/layouts/AdminShell.tsx` — remover item "Reclassificar Leads".
- `src/pages/Settings.tsx` — remover imports e os dois cards.
- `src/components/kanban/EditStageDialog.tsx` — remover leitura/gravação em `stage_ai_defaults`.
- `src/pages/Kanban.tsx` — remover invocações de `extractor-tick` e `field-rules-tick`.
- `src/lib/manual-stage-move.ts` — remover cálculo de `manual_lock_until` (já não tem cron pra respeitar).

## Fase 4 — Limpar `docs/` e `/admin/docs`

Manter:
- `docs/estudo/` (inteiro)
- `docs/estudo-geral.md`
- `docs/README.md` (reduzido a 2 linhas: "docs ativos vivem em `docs/estudo/`")

Deletar:
- Todos os outros dirs em `docs/` (`architecture/`, `conventions/`, `database/`, `edge-functions/`, `features/`, `flows/`, `frontend/`, `integracao/`, `integrations/`, `known-issues/`, `maps/`, `operations/`, `roadmap/`, `site/`, `support/`).
- Todos os `.md`/`.json` soltos: `AI.md`, `AUDIT_PHASE1.md`, `CHANGELOG.md`, `DRIFT.md`, `EMAIL.md`, `GLOSSARY.md`, `INDEX.json`, `MAP.md`, `OVERVIEW.md`, `TRACKING.md`, `copilot.md`.
- `scripts/docs-sync.mjs`, `scripts/gen-support-kb-manifest.mjs`.
- `public/docs-index.json`, `public/docs-content.json`.
- `src/pages/admin/AdminDocs.tsx` + rota em `App.tsx` + item no `AdminShell.tsx`.
- `supabase/functions/_shared/support-kb/` (se existir) + `support-kb-manifest.ts`.
- Memória `mem://docs/maintenance-progress` e a entrada Core no `mem://index.md`.

## Fase 5 — Verificação

- Tipos do Supabase regenerados (sem as 5 tabelas).
- Build limpo, sem imports quebrados.
- Smoke: Kanban move manual, Settings sem cards de Pipeline IA, /admin sem itens "Reclassificar Leads" e "Docs".
