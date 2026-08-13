---
title: "F1 — Inventário da documentação"
topic: operations
kind: audit
audience: both
status: vigente
updated: 2026-08-11
summary: "Censo dos 131 arquivos .md de docs/. Uma linha por arquivo com data declarada, tipo, tenant, presença de frontmatter e validade dos code_refs. Entregável da Fase 1 do ROADMAP_ATUALIZACAO_DOCUMENTACAO."
related_docs:
  - docs/roadmap/ROADMAP_ATUALIZACAO_DOCUMENTACAO.md
  - docs/_audit/MAPA_CODIGO_PIPELINE.md
---

# F1 — Inventário da documentação

Gerado em 2026-08-11 por varredura de frontmatter + verificação de existência de
cada `code_refs`. **É censo, não julgamento** — a decisão sobre cada arquivo é da
Fase 3.

## Números

| Métrica | Valor | % |
|---|---|---|
| Total de arquivos `.md` | **131** | 100% |
| Sem frontmatter | **17** | 13% |
| `updated:` anterior a 01/07/2026 | **54** | 41% |
| Com `code_refs` quebrado | **9** | 7% |
| Com `tenant:` declarado | **6** | 5% |

> **O dado mais relevante:** apenas **6 de 131** arquivos declaram a qual tenant se referem.
> Pela regra R1 do roadmap, toda doc que descreve fluxo precisa declarar o tenant —
> hoje quase nenhuma declara, e é por isso que o fluxo da Clínica ÓR foi lido como
> se fosse o padrão do sistema.

## Caminhos quebrados em `code_refs`

| Caminho inexistente | Docs afetados | Nota |
|---|---|---|
| `supabase/functions/pipeline-inactivity-tick/` | 6 | Virou `pipeline-deterministic {action:'inactivity-tick'}`. Citado no **corpo** de outros 8 docs |
| `supabase/migrations/20260619_unique_index_leads.sql` | 1 | Migração inexistente |
| `src/locales/` | 1 | Caminho real é `src/i18n/locales/` |
| `src/utils/` | 1 | Não existe |

## Sem frontmatter (17)

Sem frontmatter não há `updated:`, `kind:` nem `tenant:` — são invisíveis para
qualquer triagem automática.

- `docs/_audit/EVOLUTION_WEBHOOK_BUGS.md`
- `docs/ai_agent_specification.md`
- `docs/archive/AUTOMATION_V5_ARCHITECTURE.md`
- `docs/archive/ROADMAP_AUTOMATION_V5.md`
- `docs/maps/BILLING.md`
- `docs/pipeline/erro-wordpress-credentials.md`
- `docs/pipeline/runtime/AGENT_MODELS.md`
- `docs/pipeline/runtime/CRON_JOBS.md`
- `docs/pipeline/runtime/GLOSSARY.md`
- `docs/pipeline/runtime/HELPERS.md`
- `docs/pipeline/runtime/lovable-handoff-agendamento-humano.md`
- `docs/roadmap/GEMINI_404_MODEL_DEPRECATION.md`
- `docs/tenants/clinica_or/CLASSIFIER_SEQUENCES.md`
- `docs/tenants/clinica_or/CLASSIFIER_WORKFLOW.md`
- `docs/tenants/clinica_or/RESPONSIBILITIES_MATRIX.md`
- `docs/tenants/clinica-or/auditoria-17-07-2026-1056.md`
- `docs/tenants/clinica-or/CLINICA_OR_CLASSIFIER.md`

## Ponto estrutural: diretório de tenant duplicado

| Diretório | Arquivos | Frontmatter |
|---|---|---|
| `docs/tenants/clinica-or/` (hífen) | 9 | 7 de 9 |
| `docs/tenants/clinica_or/` (underscore) | 3 | 0 de 3 |

Conteúdos diferentes, nenhum referencia o outro. **Decisão para a F3.**

---

## Inventário completo

Legenda: **velho** = `updated:` anterior a 01/07 · **sem-fm** = sem frontmatter ·
**refs❌** = `code_refs` apontando para caminho inexistente


### `docs/pipeline/runtime/` — 24 arquivos · 18 desatualizados

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `AGENT_MODELS.md` | — | — | — | sem-fm |
| `CRON_JOBS.md` | — | — | — | sem-fm |
| `GLOSSARY.md` | — | — | — | sem-fm |
| `HELPERS.md` | — | — | — | sem-fm |
| `lovable-handoff-agendamento-humano.md` | — | — | — | sem-fm |
| `AUDIT_CHECKLIST.md` | 2026-06-18 | troubleshooting | — | velho |
| `AUDITORS.md` | 2026-06-18 | reference | — | velho |
| `DATABASE_LIVE.md` | 2026-06-18 | reference | — | velho |
| `FIELDS_LIVE.md` | 2026-06-18 | reference | — | velho |
| `HUMAN_REACTOR.md` | 2026-06-18 | reference | — | velho |
| `GATES.md` | 2026-06-19 | reference | — | velho |
| `ARCHITECTURE.md` | 2026-06-20 | flow | — | velho |
| `EVENTS_TELEMETRY.md` | 2026-06-20 | reference | — | velho |
| `README.md` | 2026-06-20 | map | — | velho |
| `SUMMARIZER.md` | 2026-06-20 | reference | — | velho |
| `DETERMINISTIC_RULES.md` | 2026-06-22 | reference | — | velho |
| `KNOWN_ISSUES.md` | 2026-06-22 | troubleshooting | — | velho |
| `plan-correcoes.md` | 2026-06-22 | troubleshooting | — | velho |
| `STAGES_LIVE.md` | 2026-06-22 | reference | — | velho |
| `TAGS_LIVE.md` | 2026-06-22 | reference | — | velho |
| `TRIGGERS_AUDIT.md` | 2026-06-22 | audit | — | velho |
| `USER_AUTOMATIONS.md` | 2026-06-22 | reference | — | velho |
| `FLOW_MATRIX.md` | 2026-06-23 | reference | — | velho |
| `CLASSIFIER.md` | 2026-07-16 | reference | — | — |

### `docs/maps/` — 21 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `BILLING.md` | — | — | — | sem-fm |
| `ADMIN_CONSOLE.md` | 2026-07-01 | map | — | — |
| `AI_AGENTS.md` | 2026-07-01 | map | — | — |
| `AUTOMATIONS.md` | 2026-07-01 | map | — | — |
| `BROADCASTS.md` | 2026-07-01 | map | — | — |
| `EMAIL_MARKETING.md` | 2026-07-01 | map | — | — |
| `EXTERNAL_INTEGRATIONS.md` | 2026-07-01 | map | — | — |
| `FORMS.md` | 2026-07-01 | map | — | — |
| `FRONTEND_CORE.md` | 2026-07-01 | map | — | — |
| `I18N_MULTIREGION.md` | 2026-07-01 | map | — | — |
| `INBOX_KANBAN_LEADS.md` | 2026-07-01 | map | — | — |
| `METRICS.md` | 2026-07-01 | map | — | — |
| `PIPELINE_RUNTIME.md` | 2026-07-01 | map | — | — |
| `SEQUENCES.md` | 2026-07-01 | map | — | — |
| `STORAGE_UPLOADS.md` | 2026-07-01 | map | — | — |
| `TASKS.md` | 2026-07-01 | map | — | — |
| `TEMPLATES.md` | 2026-07-01 | map | — | — |
| `TRACKING.md` | 2026-07-01 | map | — | — |
| `I18N_AI_GUIDE.md` | 2026-07-03 | map | — | — |
| `HOOKS_UTILS.md` | 2026-07-13 | map | — | refs❌ |
| `UI_COMPONENTS.md` | 2026-07-13 | map | — | — |

### `docs/estudo/` — 17 arquivos · 17 desatualizados

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `00-leads-de-entrada.md` | 2026-06-16 | reference | — | velho |
| `01-paciente-antigo.md` | 2026-06-16 | reference | — | velho |
| `02-qualificação.md` | 2026-06-16 | reference | — | velho |
| `03-consulta-agendada.md` | 2026-06-16 | reference | — | velho |
| `05-consulta-finalizada.md` | 2026-06-16 | reference | — | velho |
| `06-fechamento-pendente-consulta.md` | 2026-06-16 | reference | — | velho |
| `07-lead-parou-de-responder.md` | 2026-06-16 | reference | — | velho |
| `08-lead-não-qualificado.md` | 2026-06-16 | reference | — | velho |
| `09-fechamento-pendente-procedimento.md` | 2026-06-16 | reference | — | velho |
| `10-procedimento-agendado.md` | 2026-06-16 | reference | — | velho |
| `11-procedimento-pago.md` | 2026-06-16 | reference | — | velho |
| `12-retorno-tratamento-finalizado.md` | 2026-06-16 | reference | — | velho |
| `13-antigo-consultaprocedimento-agendado.md` | 2026-06-16 | reference | — | velho |
| `14-nutrição-de-leads-inativos.md` | 2026-06-16 | reference | — | velho |
| `README.md` | 2026-06-16 | reference | — | velho |
| `STATUS.md` | 2026-06-16 | doc | — | velho |
| `clinica-or-fluxo-novo.md` | 2026-06-21 | flow | — | velho · refs❌ |

### `docs/pipeline/` — 12 arquivos · 8 desatualizados

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `erro-wordpress-credentials.md` | — | — | — | sem-fm |
| `AUTOMATION_PLAN.md` | 2026-06-18 | roadmap | — | velho |
| `CUSTOM_FIELDS_E_TAGS.md` | 2026-06-18 | reference | — | velho |
| `DATABASE.md` | 2026-06-18 | reference | — | velho |
| `LEAD_SAMPLES.md` | 2026-06-18 | reference | — | velho |
| `README.md` | 2026-06-18 | map | — | velho |
| `SCENARIOS.md` | 2026-06-18 | reference | — | velho |
| `CALENDAR_PLAN.md` | 2026-06-22 | roadmap | — | velho |
| `CALENDAR.md` | 2026-06-22 | map | — | velho |
| `MANUAL_CRIACAO_AGENTE.md` | 2026-07-10 | reference | — | — |
| `HOWTO_NOVO_AGENTE_TENANT.md` | 2026-07-16 | reference | — | — |
| `CLASSIFIER_MAP.md` | 2026-07-17 | reference | — | — |

### `docs/tenants/clinica-or/` — 9 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `auditoria-17-07-2026-1056.md` | — | — | — | sem-fm |
| `CLINICA_OR_CLASSIFIER.md` | — | — | — | sem-fm |
| `README.md` | 2026-07-10 | map | clinica-or | refs❌ |
| `tags-chips-e-campos.md` | 2026-07-10 | reference | clinica-or | refs❌ |
| `fluxo.md` | 2026-07-17 | flow | — | refs❌ |
| `glossario-e-bugs.md` | 2026-07-17 | reference | clinica-or | refs❌ |
| `agentes-e-modelos.md` | 2026-07-27 | feature | clinica-or | — |
| `gatilhos-e-automacoes.md` | 2026-07-27 | feature | clinica-or | refs❌ |
| `auditoria-11-08-2026.md` | 2026-08-11 | audit | clinica-or | — |

### `docs/evolution/` — 9 arquivos · 1 desatualizado

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `WEBHOOK_EVOLUTION.md` | 2026-06-19 | reference | — | velho · refs❌ |
| `EVOLUTION_EDGES.md` | 2026-07-01 | map | — | — |
| `WHATSAPP.md` | 2026-07-01 | map | — | — |
| `MULTI_INSTANCE_ROUTING.md` | 2026-07-08 | reference | — | — |
| `SETUP.md` | 2026-07-08 | guide | — | — |
| `TROUBLESHOOTING.md` | 2026-07-08 | guide | — | — |
| `USER_GUIDE.md` | 2026-07-08 | guide | — | — |
| `WEBHOOK_PAYLOADS.md` | 2026-07-08 | reference | — | — |
| `INBOUND_MISSING_PLAYBOOK.md` | 2026-07-18 | playbook | — | — |

### `docs/roadmap/` — 8 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `GEMINI_404_MODEL_DEPRECATION.md` | — | — | — | sem-fm |
| `FEBRACIS_SDR_GEMINI_INVESTIGATION.md` | 2026-07-10 | roadmap | — | — |
| `PIPELINE_TENANT_ROADMAP.md` | 2026-07-10 | roadmap | — | — |
| `CLASSIFIER_DOCS_ROADMAP.md` | 2026-07-17 | roadmap | — | — |
| `CLOUD_COST_REDUCTION.md` | 2026-07-30 | roadmap | — | — |
| `roadmap-automacao.md` | 2026-07-31 | roadmap | — | — |
| `RASCUNHO_SEPARACAO_FLUXO_TENANT.md` | 2026-08-11 | roadmap | — | — |
| `ROADMAP_ATUALIZACAO_DOCUMENTACAO.md` | 2026-08-11 | roadmap | — | — |

### `docs/` — 6 arquivos · 3 desatualizados

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `ai_agent_specification.md` | — | — | — | sem-fm |
| `estudo-geral.md` | 2026-06-16 | reference | — | velho |
| `Fluxo-atual.md` | 2026-06-25 | flow | — | velho |
| `skill-datas.md` | 2026-06-25 | reference | — | velho |
| `README.md` | 2026-07-01 | reference | — | — |
| `ai_customer_service_agent_spec.md` | 2026-07-02 | map | — | — |

### `docs/_audit/` — 5 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `EVOLUTION_WEBHOOK_BUGS.md` | — | — | — | sem-fm |
| `FINAL_REPORT.md` | 2026-07-01 | reference | — | — |
| `INVENTORY.md` | 2026-07-01 | reference | — | — |
| `PROGRESS.md` | 2026-07-01 | reference | — | — |
| `FEBRACIS_CLEANUP.md` | 2026-07-10 | reference | — | — |

### `docs/i18n/` — 5 arquivos · 5 desatualizados

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `COMPLIANCE.md` | 2026-06-30 | reference | — | velho |
| `IMPORT_TEMPLATES.md` | 2026-06-30 | reference | — | velho |
| `REGION_CONFIG.md` | 2026-06-30 | reference | — | velho |
| `ROADMAP.md` | 2026-06-30 | roadmap | — | velho |
| `TRANSLATION_PROCESS.md` | 2026-06-30 | reference | — | velho · refs❌ |

### `docs/archive/` — 3 arquivos · 1 desatualizado

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `AUTOMATION_V5_ARCHITECTURE.md` | — | — | — | sem-fm |
| `ROADMAP_AUTOMATION_V5.md` | — | — | — | sem-fm |
| `STAGES_PLAN.md` | 2026-06-19 | reference | — | velho |

### `docs/tenants/clinica_or/` — 3 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `CLASSIFIER_SEQUENCES.md` | — | — | — | sem-fm |
| `CLASSIFIER_WORKFLOW.md` | — | — | — | sem-fm |
| `RESPONSIBILITIES_MATRIX.md` | — | — | — | sem-fm |

### `docs/features/` — 2 arquivos

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `LEAD_ORIGIN.md` | 2026-07-31 | feature | — | — |
| `LEAD_TIMELINE.md` | 2026-08-05 | map | — | — |

### `docs/agents/` — 1 arquivo · 1 desatualizado

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `TRAINING_FRAMEWORK.md` | 2026-06-30 | reference | — | velho |

### `docs/clinics/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `COMPARATIVO.md` | 2026-07-01 | reference | — | — |

### `docs/ai/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `GEMINI_API_QUIRKS.md` | 2026-07-10 | troubleshooting | — | — |

### `docs/database/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `MIGRATIONS.md` | 2026-07-10 | map | — | — |

### `docs/tenants/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `README.md` | 2026-07-10 | map | — | — |

### `docs/edge-functions/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `INDEX.md` | 2026-07-13 | map | — | — |

### `docs/frontend/` — 1 arquivo

| Arquivo | `updated:` | `kind:` | `tenant:` | Situação |
|---|---|---|---|---|
| `PAGES.md` | 2026-07-13 | map | — | — |

---

## O que esta fase NÃO decidiu

Nada foi julgado como certo ou errado, nem marcado para deletar. A F1 responde
"o que existe e qual o estado formal de cada arquivo". O julgamento de conteúdo
depende da **F2** (mapa do código), e a decisão de destino é da **F3**.
