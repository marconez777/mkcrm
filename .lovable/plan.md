## Escopo

"Legado do agente de pipeline Febracis" = artefatos residuais do **classificador de pipeline** (edge `pipeline-classify-febracis`, dispatch inline, docs, config, cron, DB) que foi removido em 2026‑07‑10. **Fora do escopo**: a clínica FEBRACIS-PRI, o agente de atendimento "Atendimento Febracis"/"Agente SDR 3.0", a instância WhatsApp "Lucia" e os 198 leads — tudo isso é atendimento live e permanece intocado.

## Baseline já observado

- Código de edge functions: `pipeline-classify-febracis/` e `pipeline-classify/febracis/` deletados; dispatch inline em `pipeline-classify/index.ts` removido; hack no `tickQueueV2` (`allowedClinicIds.push`) removido.
- Docs: menções a Febracis já limpas em `docs/tenants/README.md`, `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`, `docs/maps/AI_AGENTS.md`, `docs/agents/TRAINING_FRAMEWORK.md`, `docs/_audit/INVENTORY.md`. Arquivos `docs/agents/FEBRACIS_*` já deletados.
- Cron `pipeline-classify-febracis-tick` já desagendado.
- **DB (verificado agora)**: `pipeline_automation_allowlist`, `app_settings.automation.febracis.*`, `pipeline_run_items`, `pipeline_runs`, `lead_events` (auto:classifier), `stage_sequence_bindings` e `stage_canonical_aliases` — **todos com 0 linhas** para o `clinic_id` da Febracis. Nada do classificador sobrou no banco.

Falta: uma varredura sistemática que dê carimbo de "limpo" e cubra os pontos abaixo, mais a decisão sobre uma edge function órfã e sobre 12 migrations históricas.

## Fase 1 — Varredura de código

Objetivo: garantir zero import/string/constante do classificador Febracis em `src/**` e `supabase/functions/**`.

- `rg -n -i "febracis|pipeline-classify-febracis|ab2f4484-886c-48f2-bfc6-0651d062c575"` em `src/` e `supabase/functions/` (excluindo `migrations/`).
- Conferir `_shared/pipeline-allowlist.ts`, `_shared/pipeline-move.ts`, `_shared/stage-bindings.ts`, `_shared/agent-flags.ts`, `_shared/metrics.ts`, `pipeline-classify/index.ts` (agent-core, tickQueueV2, `getLoaded`).
- Conferir `pipeline-deterministic/`, `pipeline-position-auditor/`, `pipeline-post-move-verifier/`, `pipeline-run-executor/`, `pipeline-auto-retry/`, `pipeline-queue-alert/`, `pipeline-summarize/`.
- Front: `src/pages/admin/AdminPipelineAutomations.tsx`, `AdminPipelineHealth.tsx`, `PipelineRuns.tsx`, `MetricsAiUsage.tsx`, `MetricsOps.tsx`.
- Confirmar que nenhum arquivo referencia `ai-pipeline-filter.ts` com hack específico da Febracis.

Saída: registrar em `docs/_audit/FEBRACIS_CLEANUP.md` a lista de arquivos varridos e hits residuais (esperado: zero).

## Fase 2 — Edge function órfã na Cloud

O `delete_edge_functions` falhou 3× em turnos anteriores para `pipeline-classify-febracis`. A função continua listada na Cloud sem cron/gateway apontando para ela (portanto inerte).

- Reexecutar `supabase--delete_edge_functions` para `pipeline-classify-febracis`.
- Se falhar novamente, deployar um `index.ts` stub que retorna 410 Gone e documentar como "aguardando purge manual".

## Fase 3 — Cron / triggers / RPC

Objetivo: garantir que nenhum job agendado ou trigger de banco chame ou dependa do classificador Febracis.

- `SELECT jobname, schedule, active, command FROM cron.job WHERE command ILIKE '%febracis%' OR command ILIKE '%ab2f4484%';` — esperar zero.
- `pg_trigger` / `pg_proc`: `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%febracis%' OR prosrc ILIKE '%ab2f4484-886c-48f2-bfc6-0651d062c575%';` — mapear se algum RPC hardcoda o clinic_id.
- Conferir `try_classify_lock`, `enqueue_classifier_review`, `pipeline_move` RPCs — não devem citar Febracis.

## Fase 4 — DB config residual

Objetivo: revalidar que o classificador Febracis não deixou linhas dispersas.

- `pipeline_automation_allowlist`, `app_settings` (`automation.febracis.*`, `automation.v42.allowed_tags`), `stage_ai_defaults`, `stage_canonical_aliases`, `stage_sequence_bindings`, `lead_ai_settings`, `whatsapp_intents` (para clinic Febracis, kind pipeline), `pipeline_provider_health`, `pipeline_tick_stats`, `pipeline_runs` com `run_type='classifier'`, `pipeline_run_items`, `lead_events` (`type IN ('auto:classifier','position_audit_disagreement','post_move_disagreement')`), `ai_usage` (nome/tipo indicando classifier — checar schema real primeiro).
- Para cada tabela: contar linhas Febracis + amostrar 3 linhas. Se aparecer algo, decidir com o usuário: manter como histórico, arquivar ou purgar via migration.

## Fase 5 — Migrations históricas

Existem 12 arquivos SQL em `supabase/migrations/` mencionando Febracis. Precisam ser **categorizados** (não removidos — migrations são imutáveis):

- **Grupo A — Atendimento (SDR 2.0/3.0)**: `20260709*` (5 arquivos). Criam/atualizam o agente de atendimento na tabela `ai_agents`. Não são do classificador de pipeline. **Manter sem tocar.**
- **Grupo B — Setup inicial Febracis clinic/pipeline** (`20260630*`, 7 arquivos): criaram clínica, pipeline, stages e provavelmente allowlist. Precisam ser lidos linha a linha para decidir se algum criou linha em `pipeline_automation_allowlist` ou `app_settings.automation.febracis.*` que já não existe mais (Fase 4 confirma).

Saída: seção "Migrations Febracis" em `docs/_audit/FEBRACIS_CLEANUP.md` classificando cada arquivo (A vs B) com uma linha do que faz. Nenhum arquivo `.sql` é editado.

## Fase 6 — Scripts / utilitários soltos

Verificar arquivos na raiz do repo (`fetch_leads.py`, `test_query.py`, `check_ai.py`, `trigger_ai.py`, `generate_pdf.py`, `mermaid_pdf.ts`, `scratch.mjs`, `scratch.ts`, `check-logs.ts`, `scripts/pipeline-replay.ts`, `dry-run-pr2/**`) e `.env*` por hardcode de `ab2f4484…` ou string "febracis".

Se encontrado: mover para `.lovable/scratch/` ou remover com anotação.

## Fase 7 — Plan e memória

- Reler `.lovable/plan.md` e remover blocos que ainda descrevam Febracis como tenant ativo (mantendo a menção "será reconstruído sobre `pipeline_tenant_classifiers`").
- Atualizar `mem://index.md` / `mem://docs/maintenance-progress` se referenciarem o classificador Febracis.
- Atualizar `docs/_audit/PROGRESS.md` com a data desta limpeza.

## Fase 8 — Registro final

Criar `docs/_audit/FEBRACIS_CLEANUP.md` como relatório único da revisão:

- Data, escopo, checklist por fase.
- Tabela "Onde estava × ação × status".
- Lista de arquivos migrations categorizados.
- Snapshot dos counts de DB (Fase 4).
- Ponto de rearranque quando as Fases 1–6 do roadmap `pipeline_tenant_classifiers` forem executadas.

## Detalhes técnicos

- Todos os `rg` rodam com `--glob '!node_modules'`, `--glob '!.git'`, `--glob '!package-lock.json'`, `--glob '!*.tsbuildinfo'` para evitar ruído.
- Toda contagem de DB usa `supabase--read_query` (leitura). Qualquer purge de linhas residuais (Fase 4) só entra por `supabase--migration` após o usuário aprovar caso a caso.
- `supabase--delete_edge_functions` (Fase 2) pode falhar silenciosamente — fallback é stub 410 com deploy.
- Nenhuma alteração toca clínica FEBRACIS-PRI, agente "Atendimento Febracis", agente "SDR 3.0", instância WhatsApp "Lucia" ou os leads dessa clínica.

## Não escopo

- Reconstrução do classificador Febracis (aguarda Fases 1–6 do roadmap `pipeline_tenant_classifiers` em `.lovable/plan.md`).
- Remoção de migrations históricas.
- Qualquer mudança no agente de atendimento SDR 3.0 ou na copy do prompt.
