---
title: "F3 — Plano de triagem da documentação"
topic: operations
kind: roadmap
audience: both
status: vigente
updated: 2026-08-11
summary: "Destino decidido para cada um dos 134 arquivos de docs/, com as 4 decisões estruturais travadas pelo cliente em 11/08. Entregável da Fase 3; insumo direto da Fase 4."
related_docs:
  - docs/roadmap/ROADMAP_ATUALIZACAO_DOCUMENTACAO.md
  - docs/_audit/INVENTARIO_DOCS.md
  - docs/_audit/MAPA_CODIGO_PIPELINE.md
---

# F3 — Plano de triagem da documentação

Baseado no censo da [F1](INVENTARIO_DOCS.md) e na verdade verificada da
[F2](MAPA_CODIGO_PIPELINE.md).

## Decisões estruturais travadas (11/08/2026)

| # | Questão | Decisão |
|---|---|---|
| 1 | `clinica-or` (hífen) vs `clinica_or` (underscore) | **Fica `clinica-or`** |
| 2 | `docs/pipeline/runtime/` — 24 arquivos congelados em 22/06 | **Reescrever** |
| 3 | `scripts/docs-sync.mjs` | **Remover** as referências |
| 4 | `PIPELINE_TENANT_ROADMAP.md` com ✅ falsos | **Reverificar cada um** |

## Distribuição

| Destino | Arquivos | Custo | O que significa |
|---|---|---|---|
| **MIGRAR+DELETAR** | 3 | baixo | mover conteúdo útil e apagar o diretório duplicado |
| **REVERIFICAR** | 5 | médio | confere cada afirmação contra a F2 antes de decidir |
| **REESCREVER** | 30 | alto | conteúdo estruturalmente errado |
| **CORRIGIR** | 12 | baixo | certo no geral, erro localizado |
| **MARCAR historico** | 20 | baixo | só adiciona `status: historico` no frontmatter |
| **MANTER** | 64 | zero | sem pendência detectada |

**84 dos 134 arquivos (63%) saem por custo quase zero.** O esforço real
está concentrado em 30 reescritas, das quais 24 são a camada `runtime/`.

---

## Decisão 1 — Diretório duplicado

Fica `docs/tenants/clinica-or/`. Os 3 arquivos de `docs/tenants/clinica_or/` não
têm frontmatter e não são referenciados por ninguém — migrar o conteúdo aproveitável
e apagar o diretório.

- `docs/tenants/clinica_or/CLASSIFIER_SEQUENCES.md`
- `docs/tenants/clinica_or/CLASSIFIER_WORKFLOW.md`
- `docs/tenants/clinica_or/RESPONSIBILITIES_MATRIX.md`

## Decisão 2 — Reescrever `docs/pipeline/runtime/`

24 arquivos congelados em 22/06 que contradizem a produção em vários pontos —
foram a origem das 3 conclusões refutadas na auditoria.

**Ordem sugerida**, do mais perigoso ao menos:

1. `EVENTS_TELEMETRY.md` — afirma que "toda movimentação passa por pipeline-move" (falso) e atribui `pipeline_changed` ao trigger errado
2. `STAGES_LIVE.md` — 2 nomes de coluna desatualizados; foi a fonte do erro do guard D3
3. `KNOWN_ISSUES.md` — congelado em 23/06; §7 tem o diagnóstico **invertido**
4. `TRIGGERS_AUDIT.md` — não conhece os triggers de julho
5. `DETERMINISTIC_RULES.md` · `FLOW_MATRIX.md` · `GATES.md` — regras e gates
6. Os demais 18

> A F2 já é a fonte de verdade para 1–5. A reescrita é transcrição, não pesquisa.

## Decisão 3 — Remover `docs-sync`

O arquivo não existe desde 18/06. **Instruem rodá-lo** (precisam de correção):

- `docs/pipeline/CALENDAR_PLAN.md`
- `docs/pipeline/runtime/plan-correcoes.md` *(já coberto pela Decisão 2)*

**Fora de `docs/`** — mesma decisão:

- `package.json` — remover os scripts `docs:sync` e `docs:check`
- `.agents/skills/docs-maintainer/SKILL.md` — remover a instrução e a referência a `src/pages/admin/AdminDocs.tsx` (que também não existe)

Documentos que apenas **mencionam** `docs-sync` como problema conhecido
(auditorias, roadmaps, este plano) **não** entram — a menção é correta.

> ✅ **Atualização 12/08 — a lacuna foi fechada.** Em paralelo a esta triagem, foi
> criado `scripts/docs-verify.mjs` (`npm run docs:verify`), que detecta drift entre
> o código do pipeline e os registries em `docs/pipeline/runtime/_registry/`. Ele
> nasceu do mesmo diagnóstico: *"três garantias de segurança falsas sobreviveram
> meses na documentação sem que nada quebrasse"*.
>
> Os scripts `docs:sync` / `docs:check` **foram removidos** — apontavam para um
> arquivo inexistente. O `docs:verify` **não** valida `code_refs`; para isso, a
> conferência segue manual (ver a skill `docs-maintainer` §5).

## Decisão 4 — Reverificar os ✅ do roadmap de tenant

Já sabemos que **G1, G2, G3 e G14 estão marcados como concluídos e não governam a
ÓR**. Cada ✅ precisa ser conferido contra a F2 e reclassificado como *feito*,
*feito-mas-não-ligado* ou *não-feito*.

---

## Documentos a CRIAR

| Doc | Por quê | Prioridade |
|---|---|---|
| Fluxo real da Clínica ÓR, coluna a coluna | Não existe versão correta. **É a Fase 1 do plano de separação** e bloqueia as alterações de negócio | **P0** |
| `trg_lead_needs_extraction` — motor de chips | Gera todos os chips e escreve 11 campos. **Não documentado em lugar nenhum** | **P0** |
| Campos virtuais de agendamento | `KNOWN_ISSUES §7` tem o diagnóstico **invertido** — sugere a ação errada | P1 |
| Motor vs fluxo (a fronteira) | Base do critério de aceite R4 | P1 |
| Configuração: lida vs. ignorada | 11 configurações preenchidas e nunca lidas | P1 |
| `GLOSSARIO.md` + `MAPA.md` | Fase 5 | P2 |

---

## Ordem de execução da F4

1. **`status:` em 20 arquivos** — 1 linha cada, elimina a maior parte do risco de decisão errada
2. **Decisão 1** — migrar e apagar o diretório duplicado
3. **Decisão 3** — remover `docs-sync` de docs, `package.json` e skill
4. **12 correções pontuais** — nomes de coluna, `code_refs`, frontmatter
5. **Os 2 docs P0** — o que não existe vale mais que o que está errado
6. **Decisão 4** — reverificar o roadmap de tenant
7. **Decisão 2** — reescrever `runtime/`, na ordem acima
8. **4 reverificações** restantes

---

## Execução — F4

### ✅ Passos 1–4 concluídos em 11/08/2026

| Passo | O que foi feito |
|---|---|
| **1** | `status: historico` em 20 arquivos (18 por edição de frontmatter, 2 com frontmatter criado do zero) |
| **2** | 3 arquivos migrados de `clinica_or/` → `clinica-or/` com frontmatter, `status: historico` e **aviso listando as afirmações refutadas**; diretório duplicado removido |
| **3** | `docs-sync` eliminado: scripts removidos do `package.json`, skill `docs-maintainer` **reescrita**, 3 docs corrigidos |
| **4** | 12 correções pontuais: 3 `code_refs` religados, 6 frontmatter criados, 3 notas de coluna renomeada |

**Critérios de pronto:**

| Critério | Estado |
|---|---|
| Zero `code_refs` quebrados | ✅ **0** (eram 9 docs / 4 caminhos) |
| Zero docs sem frontmatter | ⏳ 5 restantes — todas em `runtime/`, cobertas pelo passo 7 |
| Docs com `status:` | 34 (28 `historico`) |
| Docs com `tenant:` declarado | 11 (eram 6) |

### Descoberta durante a execução

A skill `.agents/skills/docs-maintainer/SKILL.md` **descrevia uma infraestrutura
inexistente quase por inteiro**. Nenhum destes existe no repositório:

`docs/INDEX.json` · `docs/DRIFT.md` · `docs/support/` · `public/docs-index.json` ·
`public/docs-content.json` · `scripts/docs-sync.mjs` ·
`scripts/gen-support-kb-manifest.mjs` · `src/pages/admin/AdminDocs.tsx` ·
`supabase/functions/_shared/support-kb/` · `docs/database/SCHEMA.md` ·
`docs/database/RLS_POLICIES.md`

Como é a skill que qualquer agente carrega ao receber "atualize a documentação",
ela estava ensinando um fluxo de trabalho ficcional — causa provável de parte do
apodrecimento. **Foi reescrita para descrever a realidade**, com a premissa de
tenant (§0) e a ordem de confiança banco → código → documentação (§1) no topo.

### Pendente

Passos 5 a 8: docs P0 (fluxo real da ÓR + `trg_lead_needs_extraction`),
reverificação do roadmap de tenant, reescrita de `runtime/`.

---

## Tabela completa


### MIGRAR+DELETAR — 3

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `tenants/clinica_or/CLASSIFIER_SEQUENCES.md` | — | diretório duplicado |
| `tenants/clinica_or/CLASSIFIER_WORKFLOW.md` | — | diretório duplicado |
| `tenants/clinica_or/RESPONSIBILITIES_MATRIX.md` | — | diretório duplicado |

### REVERIFICAR — 5

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `agents/TRAINING_FRAMEWORK.md` | 2026-06-30 | alega descrever produção e está velho |
| `pipeline/AUTOMATION_PLAN.md` | 2026-06-18 | alega descrever produção e está velho |
| `pipeline/LEAD_SAMPLES.md` | 2026-06-18 | alega descrever produção e está velho |
| `pipeline/README.md` | 2026-06-18 | alega descrever produção e está velho |
| `roadmap/PIPELINE_TENANT_ROADMAP.md` | 2026-07-10 | decisão: reverificar cada ✅ |

### REESCREVER — 30

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `pipeline/runtime/AGENT_MODELS.md` | — | decisão: reescrever a camada runtime |
| `pipeline/runtime/ARCHITECTURE.md` | 2026-06-20 | decisão: reescrever a camada runtime |
| `pipeline/runtime/AUDIT_CHECKLIST.md` | 2026-06-18 | decisão: reescrever a camada runtime |
| `pipeline/runtime/AUDITORS.md` | 2026-06-18 | decisão: reescrever a camada runtime |
| `pipeline/runtime/CLASSIFIER.md` | 2026-07-16 | decisão: reescrever a camada runtime |
| `pipeline/runtime/CRON_JOBS.md` | — | decisão: reescrever a camada runtime |
| `pipeline/runtime/DATABASE_LIVE.md` | 2026-06-18 | decisão: reescrever a camada runtime |
| `pipeline/runtime/DETERMINISTIC_RULES.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/EVENTS_TELEMETRY.md` | 2026-06-20 | decisão: reescrever a camada runtime |
| `pipeline/runtime/FIELDS_LIVE.md` | 2026-06-18 | decisão: reescrever a camada runtime |
| `pipeline/runtime/FLOW_MATRIX.md` | 2026-06-23 | decisão: reescrever a camada runtime |
| `pipeline/runtime/GATES.md` | 2026-06-19 | decisão: reescrever a camada runtime |
| `pipeline/runtime/GLOSSARY.md` | — | decisão: reescrever a camada runtime |
| `pipeline/runtime/HELPERS.md` | — | decisão: reescrever a camada runtime |
| `pipeline/runtime/HUMAN_REACTOR.md` | 2026-06-18 | decisão: reescrever a camada runtime |
| `pipeline/runtime/KNOWN_ISSUES.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/lovable-handoff-agendamento-humano.md` | — | decisão: reescrever a camada runtime |
| `pipeline/runtime/plan-correcoes.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/README.md` | 2026-06-20 | decisão: reescrever a camada runtime |
| `pipeline/runtime/STAGES_LIVE.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/SUMMARIZER.md` | 2026-06-20 | decisão: reescrever a camada runtime |
| `pipeline/runtime/TAGS_LIVE.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/TRIGGERS_AUDIT.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `pipeline/runtime/USER_AUTOMATIONS.md` | 2026-06-22 | decisão: reescrever a camada runtime |
| `skill-datas.md` | 2026-06-25 | 2 sinais de desatualização |
| `tenants/clinica-or/fluxo.md` | 2026-07-17 | 3 sinais de desatualização |
| `tenants/clinica-or/gatilhos-e-automacoes.md` | 2026-07-27 | 2 sinais de desatualização |
| `tenants/clinica-or/glossario-e-bugs.md` | 2026-07-17 | 2 sinais de desatualização |
| `tenants/clinica-or/README.md` | 2026-07-10 | 3 sinais de desatualização |
| `tenants/clinica-or/tags-chips-e-campos.md` | 2026-07-10 | 3 sinais de desatualização |

### CORRIGIR — 12

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `ai_agent_specification.md` | — | sem frontmatter |
| `evolution/WEBHOOK_EVOLUTION.md` | 2026-06-19 | erro localizado |
| `Fluxo-atual.md` | 2026-06-25 | erro localizado |
| `i18n/TRANSLATION_PROCESS.md` | 2026-06-30 | erro localizado |
| `maps/BILLING.md` | — | sem frontmatter |
| `maps/HOOKS_UTILS.md` | 2026-07-13 | erro localizado |
| `maps/PIPELINE_RUNTIME.md` | 2026-07-01 | erro localizado |
| `pipeline/CALENDAR_PLAN.md` | 2026-06-22 | erro localizado + instrui rodar docs-sync |
| `pipeline/erro-wordpress-credentials.md` | — | sem frontmatter |
| `roadmap/GEMINI_404_MODEL_DEPRECATION.md` | — | sem frontmatter |
| `tenants/clinica-or/auditoria-17-07-2026-1056.md` | — | sem frontmatter |
| `tenants/clinica-or/CLINICA_OR_CLASSIFIER.md` | — | erro localizado + sem frontmatter |

### MARCAR historico — 20

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `archive/AUTOMATION_V5_ARCHITECTURE.md` | — | já arquivado |
| `archive/ROADMAP_AUTOMATION_V5.md` | — | já arquivado |
| `archive/STAGES_PLAN.md` | 2026-06-19 | já arquivado |
| `estudo/00-leads-de-entrada.md` | 2026-06-16 | material de estudo |
| `estudo/01-paciente-antigo.md` | 2026-06-16 | material de estudo |
| `estudo/02-qualificação.md` | 2026-06-16 | material de estudo |
| `estudo/03-consulta-agendada.md` | 2026-06-16 | material de estudo |
| `estudo/05-consulta-finalizada.md` | 2026-06-16 | material de estudo |
| `estudo/06-fechamento-pendente-consulta.md` | 2026-06-16 | material de estudo |
| `estudo/07-lead-parou-de-responder.md` | 2026-06-16 | material de estudo |
| `estudo/08-lead-não-qualificado.md` | 2026-06-16 | material de estudo |
| `estudo/09-fechamento-pendente-procedimento.md` | 2026-06-16 | material de estudo |
| `estudo/10-procedimento-agendado.md` | 2026-06-16 | material de estudo |
| `estudo/11-procedimento-pago.md` | 2026-06-16 | material de estudo |
| `estudo/12-retorno-tratamento-finalizado.md` | 2026-06-16 | material de estudo |
| `estudo/13-antigo-consultaprocedimento-agendado.md` | 2026-06-16 | material de estudo |
| `estudo/14-nutrição-de-leads-inativos.md` | 2026-06-16 | material de estudo |
| `estudo/clinica-or-fluxo-novo.md` | 2026-06-21 | material de estudo |
| `estudo/README.md` | 2026-06-16 | material de estudo |
| `estudo/STATUS.md` | 2026-06-16 | material de estudo |

### MANTER — 64

| Arquivo | `updated:` | Motivo |
|---|---|---|
| `_audit/EVOLUTION_WEBHOOK_BUGS.md` | — | entregável de auditoria |
| `_audit/FEBRACIS_CLEANUP.md` | 2026-07-10 | entregável de auditoria |
| `_audit/FINAL_REPORT.md` | 2026-07-01 | entregável de auditoria |
| `_audit/INVENTARIO_DOCS.md` | 2026-08-11 | entregável de auditoria |
| `_audit/INVENTORY.md` | 2026-07-01 | entregável de auditoria |
| `_audit/MAPA_CODIGO_PIPELINE.md` | 2026-08-11 | entregável de auditoria |
| `_audit/PLANO_DOCS.md` | 2026-08-11 | entregável de auditoria |
| `_audit/PROGRESS.md` | 2026-07-01 | entregável de auditoria |
| `ai_customer_service_agent_spec.md` | 2026-07-02 | sem pendência |
| `ai/GEMINI_API_QUIRKS.md` | 2026-07-10 | sem pendência |
| `clinics/COMPARATIVO.md` | 2026-07-01 | sem pendência |
| `database/MIGRATIONS.md` | 2026-07-10 | sem pendência |
| `edge-functions/INDEX.md` | 2026-07-13 | sem pendência |
| `estudo-geral.md` | 2026-06-16 | velho, sem sinal de erro |
| `evolution/EVOLUTION_EDGES.md` | 2026-07-01 | sem pendência |
| `evolution/INBOUND_MISSING_PLAYBOOK.md` | 2026-07-18 | sem pendência |
| `evolution/MULTI_INSTANCE_ROUTING.md` | 2026-07-08 | sem pendência |
| `evolution/SETUP.md` | 2026-07-08 | sem pendência |
| `evolution/TROUBLESHOOTING.md` | 2026-07-08 | sem pendência |
| `evolution/USER_GUIDE.md` | 2026-07-08 | sem pendência |
| `evolution/WEBHOOK_PAYLOADS.md` | 2026-07-08 | sem pendência |
| `evolution/WHATSAPP.md` | 2026-07-01 | sem pendência |
| `features/LEAD_ORIGIN.md` | 2026-07-31 | sem pendência |
| `features/LEAD_TIMELINE.md` | 2026-08-05 | sem pendência |
| `frontend/PAGES.md` | 2026-07-13 | sem pendência |
| `i18n/COMPLIANCE.md` | 2026-06-30 | velho, sem sinal de erro |
| `i18n/IMPORT_TEMPLATES.md` | 2026-06-30 | velho, sem sinal de erro |
| `i18n/REGION_CONFIG.md` | 2026-06-30 | velho, sem sinal de erro |
| `i18n/ROADMAP.md` | 2026-06-30 | velho, sem sinal de erro |
| `maps/ADMIN_CONSOLE.md` | 2026-07-01 | sem pendência |
| `maps/AI_AGENTS.md` | 2026-07-01 | sem pendência |
| `maps/AUTOMATIONS.md` | 2026-07-01 | sem pendência |
| `maps/BROADCASTS.md` | 2026-07-01 | sem pendência |
| `maps/EMAIL_MARKETING.md` | 2026-07-01 | sem pendência |
| `maps/EXTERNAL_INTEGRATIONS.md` | 2026-07-01 | sem pendência |
| `maps/FORMS.md` | 2026-07-01 | sem pendência |
| `maps/FRONTEND_CORE.md` | 2026-07-01 | sem pendência |
| `maps/I18N_AI_GUIDE.md` | 2026-07-03 | sem pendência |
| `maps/I18N_MULTIREGION.md` | 2026-07-01 | sem pendência |
| `maps/INBOX_KANBAN_LEADS.md` | 2026-07-01 | sem pendência |
| `maps/METRICS.md` | 2026-07-01 | sem pendência |
| `maps/SEQUENCES.md` | 2026-07-01 | sem pendência |
| `maps/STORAGE_UPLOADS.md` | 2026-07-01 | sem pendência |
| `maps/TASKS.md` | 2026-07-01 | sem pendência |
| `maps/TEMPLATES.md` | 2026-07-01 | sem pendência |
| `maps/TRACKING.md` | 2026-07-01 | sem pendência |
| `maps/UI_COMPONENTS.md` | 2026-07-13 | sem pendência |
| `pipeline/CALENDAR.md` | 2026-06-22 | velho, sem sinal de erro |
| `pipeline/CLASSIFIER_MAP.md` | 2026-07-17 | sem pendência |
| `pipeline/CUSTOM_FIELDS_E_TAGS.md` | 2026-06-18 | velho, sem sinal de erro |
| `pipeline/DATABASE.md` | 2026-06-18 | velho, sem sinal de erro |
| `pipeline/HOWTO_NOVO_AGENTE_TENANT.md` | 2026-07-16 | sem pendência |
| `pipeline/MANUAL_CRIACAO_AGENTE.md` | 2026-07-10 | sem pendência |
| `pipeline/SCENARIOS.md` | 2026-06-18 | velho, sem sinal de erro |
| `README.md` | 2026-07-01 | sem pendência |
| `roadmap/CLASSIFIER_DOCS_ROADMAP.md` | 2026-07-17 | sem pendência |
| `roadmap/CLOUD_COST_REDUCTION.md` | 2026-07-30 | sem pendência |
| `roadmap/FEBRACIS_SDR_GEMINI_INVESTIGATION.md` | 2026-07-10 | sem pendência |
| `roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md` | 2026-08-11 | sem pendência |
| `roadmap/ROADMAP_ATUALIZACAO_DOCUMENTACAO.md` | 2026-08-11 | sem pendência |
| `roadmap/roadmap-automacao.md` | 2026-07-31 | sem pendência |
| `tenants/clinica-or/agentes-e-modelos.md` | 2026-07-27 | sem pendência |
| `tenants/clinica-or/auditoria-11-08-2026.md` | 2026-08-11 | sem pendência |
| `tenants/README.md` | 2026-07-10 | sem pendência |
