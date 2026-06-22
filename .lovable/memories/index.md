# Memory: index.md
Updated: today

# Project Memory

## Core
Pipeline Clínica ÓR está em v4.2 (11 colunas) — fonte de verdade do ESTADO REAL: `docs/pipeline/runtime/`. `docs/pipeline/` raiz documenta o PLANO v4.2 (D1–D8). Sem coluna "Procedimento pago" (virou campo `status_financeiro`). "Procedimento agendado" foi renomeado para "Tratamento agendado".
Plano de correções `docs/pipeline/runtime/plan-correcoes.md` (Fases A–E) ENCERRADO em 2026-06-22 — qualquer nova correção abre seção nova ou novo documento.
Whitelist de tags do classifier é DINÂMICA via `app_settings.automation.v42.allowed_tags` (44 tags) — não hardcoded. Adicionar tag = UPDATE em `app_settings`, sem deploy.
Lembretes vivem em `/automations` (UI), não em código. Reator humano = cron diário criando task "Revisar lead travado" para leads com tag `precisa_atencao_humana` parados ≥7d.
Classifier roda 1/min, valida datas via sanitizeDateField (anchor=última msg), PROTECTED_TAGS, advisory lock `try_classify_lock`, backoff 2/5/30min + 429 exp em `withSchemaRetry`. **Provider controlado por env `CLASSIFIER_PROVIDER` (default `lovable` = Gemini via Lovable AI Gateway; `openai` = BYOK legado).** Mapeamento em `supabase/functions/_shared/classifier-ai.ts`: Summarizer/Typifier/Maestro → `google/gemini-2.5-flash`; Agendador/Movimentador/post-move-verifier → `google/gemini-2.5-flash-lite`; A1 auditor → `google/gemini-2.5-flash`. Pricing Gemini já em `_shared/ai-pricing.ts`. Para rollback: set `CLASSIFIER_PROVIDER=openai` no secret.
Auditores A1 (cron 03h BRT) e A2 (hook pós-move, whitelist `["auto:b2b-move"]`) só sinalizam via tag — nunca movem card.
Não existe scripts/docs-sync.mjs neste projeto.
**Triggers e crons de pipeline DEVEM usar `net.http_post` (pg_net) — NUNCA `extensions.http_post` (extensão `http` não está instalada). Em 2026-06-19 isso travou todas as automações por horas.**

## Memories
- [Pipeline v4.2 decisions](mem://docs/pipeline-v4-2) — D1–D8, gates G1–G11, fases incluindo Fase 2.5 (A1/A2/A3)
- [Docs maintenance progress](mem://docs/maintenance-progress) — pasta runtime/ criada em 2026-06-18 com 14 docs espelhando o estado deployado; USER_AUTOMATIONS.md adicionado 2026-06-22 (Fase E)
