# Roadmap — Classificador de Pipeline por Tenant (revisado após auditoria do código)

Objetivo: cada conta pode ter um agente de classificação **hardcoded, isolado, opcional** — sem colidir com o classificador genérico, sem duplicar cron/telemetria, sem "vazar" lógica entre tenants.

A auditoria confirmou que o problema é maior do que parecia: hoje temos **um classificador único (`pipeline-classify`) que é ÓR-específico disfarçado de genérico**, com Febracis injetado inline por `if clinic_id === "…"`, mais uma cópia standalone (`pipeline-classify-febracis`) **byte-idêntica e sem cron atrelado**, e vários consumidores (executor, auditors, gates) assumindo tanto o nome da edge function quanto o vocabulário de stages da ÓR.

Riscos concretos incorporados abaixo com localização `arquivo:linha`.

---

## Fase 0 — Diagnóstico e trava de sangria (1 dia)

- **F0.1** Confirmar via SQL contra o banco vivo:
  - `SELECT * FROM cron.job` (checar se algum cron ad-hoc dispara `pipeline-classify-febracis` — migrations não listam nenhum).
  - `SELECT * FROM pipeline_automation_allowlist` (Febracis nunca foi seed-inserted; migration `20260618032209_*.sql:22-23` só tem ÓR).
- **F0.2** Diff `pipeline-classify/febracis/*` vs `pipeline-classify-febracis/*` (auditoria confirma: idênticos exceto import paths). Escolher a versão standalone como canônica e **deletar a aninhada** — a nested viola isolamento e cria drift trap para bugfixes.
- **F0.3** Inventário completo de `clinic_id` literal (`ab2f4484…` Febracis, `cf038458…` ÓR) — auditoria já mapeou 30+ ocorrências:
  - código: `pipeline-classify/index.ts:117,260-262`, `pipeline-classify-febracis/index.ts:26`, `pipeline-monthly-cycle-or/index.ts:11`, `report-finalizados-mensal-or/index.ts:12`, `src/pages/TrackingDebug.tsx:72`.
  - migrations: `20260630004105/004312/004405/014034/023437`, `20260709161813/163124/164105/164614`, `20260613170406`, `20260615005830`, `20260616150624/659`.
  - registrar em `docs/tenants/_DEBT.md` com nível (produção crítica vs doc/scratch).
- **F0.4** Congelar `pipeline-classify` genérico para novas regras de tenant até Fase 2.

---

## Fase 1 — Contrato do "Tenant Classifier" (2–3 dias)

- **F1.1** Spec `TenantClassifier` em `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`:
  - Input: `{ action: "tick" | "lead", lead_id?, force? }`.
  - Guards obrigatórios: allowlist → `try_classify_lock` RPC → watermark → G10 → G11 → Guard D3.
  - Movimentação **apenas** via `pipelineMove()` (`_shared/pipeline-move.ts`).
  - Telemetria: `ai_usage` (por sub-agente) + `pipeline_run_items`.
  - Tags: whitelist hardcoded em memória (padrão Febracis `apply.ts:8-13`) — **nunca** ler `automation.v42.allowed_tags` (chave global, ÓR-específica).
- **F1.2** Helper `supabase/functions/_shared/tenant-classifier.ts`:
  - `runTenantTick({ tenantSlug, clinicId, classifyOne })` — encapsula fila `needs_ai_review`, backoff 2/5/30min, concorrência 5.
  - `assertTenantGuards(ctx, { oldPatientStageName, nutritionStageName })` — **parametriza** os nomes de stage do D3 (hoje `"Paciente antigo"` / `"Nutrição inativa"` estão hardcoded em `pipeline-move.ts:66,185-186`, silenciando o guard para qualquer tenant com taxonomia diferente).
  - `assertSameTenant(ctx, expectedClinicId)` — aborta com `wrong_tenant` se o lead não é do clinic_id esperado.
- **F1.3** Testes de contrato em `scripts/tenant-classifier-contract.test.ts`.

---

## Fase 2 — Registry de tenants + dispatcher (2–3 dias)

- **F2.1** Migration `pipeline_tenant_classifiers`:
  - `clinic_id` UNIQUE, `edge_function_name`, `enabled`, `priority`, `max_batch_per_tick`, `notes`.
  - Grants + RLS: leitura só `authenticated` via `has_role(admin)`, escrita só `service_role`.
- **F2.2** Seed com ÓR (aponta para a futura `pipeline-classify-clinica-or` — ver F6.2) e Febracis (`pipeline-classify-febracis`).
- **F2.3** Refatorar `tickQueueV2` em `pipeline-classify/index.ts`:
  - Remover o `push("ab2f4484…")` hardcoded (linhas 260-262).
  - Remover o `if clinic_id === "ab2f4484…"` dinâmico (linha 117).
  - Cada lead na fila: consultar registry → se tem edge function própria, `supabase.functions.invoke(edgeFn, { action:"lead", lead_id })`; senão roda pipeline genérico legado.
- **F2.4** Cron único: manter apenas `pipeline-classify-tick` → `pipeline-classify`. Dispatcher fan-out via invoke. Elimina o risco (F0.1) de alguém ligar cron para `pipeline-classify-febracis` e criar double-processing na mesma fila.
- **F2.5** Consertar `pipeline-run-executor/index.ts` (`callClassify` faz `fetch(…/pipeline-classify)` hardcoded): resolver dinamicamente via registry antes do fetch, senão manual re-run pelo UI `/pipeline-runs` sempre bate na função errada para tenants não-ÓR.

---

## Fase 3 — Isolamento operacional (2 dias)

- **F3.1** `idempotencyKey` do `pipelineMove` sempre prefixada por `<tenant-slug>:` (Febracis já faz em `apply.ts`; padronizar via helper).
- **F3.2** Adicionar coluna `tenant_slug` (nullable) em `pipeline_run_items` — hoje o schema (migration `20260618032209:79-96`) não tem como distinguir origem por tenant sem parse de string.
- **F3.3** **Kill-switch por tenant**: hoje `automation.classifier.enabled` (checado em `pipeline-classify/index.ts:253` e `pipeline-classify-febracis/index.ts:122`) é global — desligar em incidente da ÓR mata a Febracis. Introduzir chave `automation.classifier.<tenant_slug>.enabled` com fallback para a global. Depende do F4.1.
- **F3.4** **Circuit breaker por tenant**: se um `edge_function_name` retorna 5xx em >30% do batch em 5min, marcar `enabled=false` no registry e inserir alerta em `email_operational_alerts`.
- **F3.5** Cap de leads por tenant por tick (`max_batch_per_tick` do registry) — sem isso, uma clínica com fila grande engole o `BATCH_LIMIT=50` compartilhado.
- **F3.6** Reafirmar que `try_classify_lock` RPC (advisory lock keyed por `lead_id`) já é seguro contra double-processing entre funções distintas — **não precisa ser reescrito**, mas documentar como invariante.

---

## Fase 4 — Governança de settings, gates e allowlist (2 dias)

- **F4.1** Coluna `clinic_id` (nullable) em `app_settings`; adaptar `_shared/app-settings.ts` (`getSettingString/getToggle/getSettingJSON/getSettingNumber`) para aceitar `clinicId?` com fallback para linha global. Sem isso F3.3 e overrides por tenant (allowed_tags, b2b_move, nurture_move) não funcionam.
- **F4.2** **Namespace por tenant** para toggles ÓR-específicos hoje globais: `automation.b2b_move.enabled` e `automation.nurture_move.enabled` (`pipeline-classify/apply.ts:322,387`) — quando o dispatcher rodar Febracis, esses toggles não devem sequer ser lidos.
- **F4.3** Formalizar a allowlist:
  - Inserir seed row para Febracis em `pipeline_automation_allowlist` **antes** de remover o hack F2.3, senão `pipeline-move.ts` (gate Allowlist, `GATES.md:37`), `pipeline-run-executor:76` (`assertAllowlisted`) e `pipeline-position-auditor` param de aceitar Febracis silenciosamente — três superfícies dependendo dessa linha.
- **F4.4** Rodar `supabase--linter` após F2.1/F4.1; garantir `pipeline_tenant_classifiers` sem leitura `anon`.

---

## Fase 5 — Auditors e gates tenant-aware (2 dias)

Achado crítico da auditoria: os auditors rodam contra qualquer clínica allowlistada **usando a taxonomia canônica da ÓR**.

- **F5.1** `pipeline-position-auditor/index.ts`:
  - `EXCLUDED_CANONICALS` (linhas 40-47: `"Paciente antigo"`, `"B2B / Stakeholders"`, `"Nutrição inativa"`) é ÓR-only.
  - Prompt embute stages canônicos v4.2 (`CLASSIFIER.md`).
  - Refatorar: buscar taxonomia do tenant via registry OU pular tenants sem `canonical_stages_ref` definido. Documentar em `AUDITORS.md`.
- **F5.2** `pipeline-post-move-verifier` (Hook A2): auditar se assume nomes de stage ÓR; parametrizar se sim.
- **F5.3** Guard D3 em `_shared/pipeline-move.ts:66,185-186`: aceitar `oldPatientStageName`/`nutritionStageName` como parâmetro (via registry ou helper `assertTenantGuards`) — hoje é silent no-op para qualquer tenant que não use exatamente esses strings.
- **F5.4** Adicionar em `docs/pipeline/runtime/KNOWN_ISSUES.md` a categoria "cross-tenant stage-name assumptions" — hoje só há entradas para `automations-tick` e `leads.pipeline_id/stage_id`.

---

## Fase 6 — Migração dos tenants atuais (2–3 dias)

- **F6.1 Febracis**: já isolada. Ordem: (a) seed `pipeline_automation_allowlist` [F4.3], (b) seed `pipeline_tenant_classifiers`, (c) refatorar dispatcher [F2.3] atrás de feature-flag `tenant_dispatch.enabled`, (d) validar 48h de execução paralela via telemetria (F3.2), (e) deletar `pipeline-classify/febracis/` [F0.2].
- **F6.2 Clínica ÓR**: extrair `agent-core.ts`, `apply.ts`, `context.ts`, `rules/`, `date-parser.ts`, `schema.ts` para `supabase/functions/pipeline-classify-clinica-or/`. `pipeline-classify` vira dispatcher puro. Idem feature-flag.
- **F6.3** Deprecar `index.v1.ts` só depois de 7 dias sem tráfego (checar `ai_usage.operation`).
- **F6.4** Precedente já existente: `pipeline-monthly-cycle-or` e `report-finalizados-mensal-or` são standalone por tenant via `CLINIC_ID` const — considerar se devem entrar no registry também (fora do escopo do classifier, mas padrão idêntico).

---

## Fase 7 — DX (1 dia)

- **F7.1** Template `supabase/functions/_templates/pipeline-classify-tenant/` (index.ts/agent.ts/apply.ts já plugados em `runTenantTick`).
- **F7.2** Script `scripts/new-tenant-classifier.mjs <slug> <clinic_id>` — copia template, cria `docs/tenants/<slug>/`, gera SQL de seed para revisão.
- **F7.3** Checklist final no HOWTO com 12 passos (F0.1 → F5 mapeados).

---

## Fase 8 — Observabilidade e docs (1 dia)

- **F8.1** Página admin `/admin/pipeline-tenants`: registry + últimas 100 execuções por tenant + custo médio/lead + botão pausar (usa F3.3).
- **F8.2** Atualizar `docs/maps/PIPELINE_RUNTIME.md`, `docs/pipeline/runtime/CLASSIFIER.md`, `docs/pipeline/runtime/GATES.md` (documentar que allowlist deixa de ter bypass hardcoded), `docs/pipeline/runtime/AUDITORS.md` (tenant-awareness), `docs/tenants/README.md`.
- **F8.3** Runbook `docs/pipeline/runtime/TENANT_CLASSIFIER_RUNBOOK.md`: como debugar quando um tenant específico para de classificar (checar registry.enabled → circuit-breaker → tenant kill-switch → cron do dispatcher → advisory lock).

---

## Arquitetura alvo

```text
cron (1/min) ─► pipeline-classify { action: "tick" } ─┐
                                                       │
                          ┌─── SELECT registry ────────┘
                          ▼
              ┌──────────────────────────────┐
              │ para cada lead na fila:       │
              │  registry[clinic_id]?         │
              │   ├─ sim → invoke edge fn X   │
              │   └─ não → classifier legacy  │
              └──────────────────────────────┘

Cada edge fn de tenant usa runTenantTick({
  tenantSlug, clinicId,
  allowedTags: [...],           // hardcoded no arquivo
  oldPatientStageName, nutritionStageName,
  classifyOne(ctx) { ... }      // agentes específicos do tenant
})
```

## Fora de escopo

- Redesign dos micro-agentes atuais da ÓR (Resumidor/Tipificador/Maestro/Agendador/Movimentador).
- UI para usuário final configurar o próprio agente (por design, permanece serviço interno).
- Troca de LLM/modelos default.

## Riscos residuais

- **Dispatcher vira gargalo** → invoke assíncrono (`EdgeRuntime.waitUntil`) + cap F3.5.
- **Registry desatualizado** → circuit breaker F3.4 + alerta.
- **Rollout gera billing duplicado** → feature-flag `tenant_dispatch.enabled` (F6.1/F6.2) + coluna `tenant_slug` (F3.2) para reconciliar `ai_usage`.
- **Auditor legacy (F5.1) já roda hoje contra Febracis com stages errados** → correção crítica, não pode ficar para o fim; subir em paralelo com F2.

## Ordem recomendada

F0 → F1 → F4.1 (paralelo) → F2 → F5 (paralelo com F3, é correção de bug ativo) → F3 → F6 → F7 → F8. Estimativa: **12–14 dias** focados.
