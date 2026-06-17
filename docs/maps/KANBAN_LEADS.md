---
title: "Mapa: Kanban + Leads"
topic: kanban
kind: map
audience: agent
updated: 2026-06-17
summary: Pipeline visual (kanban) de leads. Múltiplos pipelines por clínica, stages com cor + agente IA default, drag & drop, importação (Kommo/CSV), campos personalizados por lead, drawer de detalhes, journey/timeline. Em clínicas com Pipeline IA, stage é DERIVADO de `custom_fields` via `pipeline_field_rules` — não escolha manual.
related_docs:
  - docs/flows/PIPELINE_DERIVED.md
  - docs/maps/CUSTOM_FIELDS_CONTRACT.md
  - docs/maps/AI_RUNTIME.md
---
# Mapa: Kanban + Leads

> **Para localizar edições.** Para entender *por quê*, leia [`docs/flows/LEAD_LIFECYCLE.md`](../flows/LEAD_LIFECYCLE.md) (ciclo geral) e [`docs/flows/PIPELINE_DERIVED.md`](../flows/PIPELINE_DERIVED.md) (movimentação automática via Pipeline IA).
> **Última atualização:** 2026-06-17

---

## 0. Pipeline derivado por campos (Pipeline IA)

Em clínicas com Pipeline IA habilitado, o stage do lead **não é escolhido manualmente**. É resultado de:

1. `extractor-tick` (cron 2 min) preenche `leads.custom_fields`.
2. `field-rules-tick` (cron 2 min) avalia `pipeline_field_rules` em ordem de `priority DESC`.
3. Primeira regra que casa move o card via UPDATE em `leads.stage_id`.

> Caso de referência atual: **Clínica ÓR** — 11 stages, ~1.638 leads, reestruturação 15→11 concluída em 2026-06-17 (`docs/roadmap/_done/PIPELINE_RESTRUCTURE_2026_06.md`).

Detalhe completo: [`docs/flows/PIPELINE_DERIVED.md`](../flows/PIPELINE_DERIVED.md).
Catálogo dos campos: [`docs/maps/CUSTOM_FIELDS_CONTRACT.md`](./CUSTOM_FIELDS_CONTRACT.md).

Componentes específicos do Pipeline IA:
- `src/components/kanban/AIBadges.tsx` — chips no `LeadCard` (qualificacao, procedimento, pagamento, IA na fila, lock manual).
- `src/components/settings/FieldRulesCard.tsx` — CRUD de regras.
- `src/components/settings/ExtractorHistoryCard.tsx` — observabilidade.

Tabela `pipeline_field_rules` (`clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions jsonb`).
Operadores: `equals, not_equals, is_true, is_false, is_empty, not_empty, in, contains, gte, lte, is_future, is_past`.

---

## 1. O que é

Pipeline visual (kanban) de leads. Múltiplos pipelines por clínica, stages com cor + agente IA default, drag & drop, importação (Kommo/CSV), campos personalizados por lead, drawer de detalhes, journey/timeline.

## 2. Rotas / pontos de entrada

| Rota | Componente |
|---|---|
| `/kanban` | `src/pages/Kanban.tsx` |
| `/lead/:id` (drawer) | `src/pages/LeadDrawer.tsx` |
| `/settings/custom-fields` | `src/pages/SettingsCustomFields.tsx` |

## 3. Frontend

### Componentes (`src/components/kanban/`)
| Arquivo | Função |
|---|---|
| `PipelineSwitcher.tsx` | Seletor de pipeline ativo |
| `PipelineSidebar.tsx` | Lista de pipelines |
| `PipelineOverview.tsx` | Métricas do pipeline |
| `PipelineDateFilter.tsx` | Filtro temporal |
| `NewPipelineDialog.tsx` / `EditPipelineDialog.tsx` | CRUD pipeline |
| `StagesManager.tsx` | Reordenar/criar stages |
| `EditStageDialog.tsx` | Editar stage (nome, cor, **agente IA default**, auto_reply) |
| `MoveLeadDialog.tsx` | Mover lead manualmente |
| `ImportPipelineDialog.tsx` / `KommoImportDialog.tsx` | Importação |
| `TopScrollbar.tsx` | Scrollbar horizontal sincronizada |

### Lead drawer (`src/components/lead/`)
- `LeadJourneyTab.tsx` — jornada (entrou → moveu → resposta…).
- `LeadTimelineTab.tsx` + `timeline/TimelineFilters.tsx`, `TimelineItemRow.tsx`, `types.ts`.
- `LeadAttributionCard.tsx` (em `src/components/leads/`) — atribuição UTM/source.

### Hooks
- `src/hooks/useCrm.ts` — query agregada de leads + realtime.
- `src/hooks/useLeadsPaginated.ts` — paginação.
- `src/hooks/usePipelines.ts` — pipelines da clínica.
- `src/hooks/useCustomFieldDefs.ts` — definições de campos customizados.

### Libs
- `src/lib/csv.ts` — export/import.
- `src/lib/delete-lead.ts` — exclusão cascata.
- `src/lib/saved-views.ts` — views salvas do kanban.
- `src/lib/fetch-all.ts` — paginação manual sem limite.

### Types
- `src/types/crm.ts` — `Lead`, `Stage`, `Pipeline`.

## 4. Edge functions

- `external-lead-capture/index.ts` — API pública para criar lead via webhook externo.
- (Outros leads chegam via `evolution-webhook` ou `forms-ingest` — ver mapas correspondentes.)

## 5. Banco de dados

### Tabelas
| Tabela | Colunas-chave |
|---|---|
| `pipelines` | `id`, `clinic_id`, `name`, `position` |
| `pipeline_stages` | `id`, `pipeline_id`, `name`, `color`, `position` |
| `stage_ai_defaults` | `stage_id`, `agent_id`, `auto_reply` |
| `leads` | `id`, `clinic_id`, `pipeline_id`, `stage_id`, `phone`, `name`, `email`, `attendant_id`, `tags[]`, `custom_fields` (jsonb), `ai_paused`, `source`, `utm_*`, `last_message_at` |
| `custom_field_defs` | definição (key, label, type, options) |
| `lead_internal_notes`, `lead_tasks` | anexos |
| `saved_views` | filtros do usuário |

### RLS
- Tudo por `clinic_id = current_user_clinic()`.
- `external-lead-capture` usa service_role + valida `clinic_id` via API key da clínica.

### Triggers
- Mudança de `stage_id` em `leads` → trigger aplica `stage_ai_defaults` (atribui agente + liga `ai_paused`/`auto_reply` conforme config).
- `set_updated_at` padrão.

## 6. Integrações externas

- **Kommo** — importação one-shot via `KommoImportDialog`.
- CSV genérico.

## 7. Invariantes — "não toque sem ler"

1. **`leads.clinic_id` obrigatório.** Toda inserção tem que setar — sem isso RLS bloqueia.
2. **Stage tem `position` único dentro do pipeline.** Reorder atualiza em lote.
3. **`stage_ai_defaults` é opcional por stage.** Se existe, dispara atribuição automática no move.
4. **`custom_fields` é jsonb** — keys vêm de `custom_field_defs`. Não criar key ad-hoc sem definição (UI quebra).
5. **`phone` em E.164.** `src/lib/phone.ts` normaliza.
6. **Realtime ligado** em `leads` e `messages` — verificar `ALTER PUBLICATION supabase_realtime ADD TABLE` quando criar tabela nova relacionada.
7. **Delete de lead cascata** em `messages`, `lead_tasks`, `lead_internal_notes`, `scheduled_messages` — usar `src/lib/delete-lead.ts`, não DELETE direto.

## 8. Pegadinhas

- Drag & drop não persiste se `clinic_id` da nova stage diferir (caso de import quebrado).
- `useCrm` é caro — paginar com `useLeadsPaginated` em listas grandes.
- Mudança de pipeline do lead força reset de stage para o primeiro do novo pipeline.
- Custom field type "select" precisa de `options[]` em `custom_field_defs.config`.
- Import Kommo: respeitar rate limit, não chamar duas vezes em paralelo.

## 9. Receitas

### Adicionar novo tipo de custom field
1. `custom_field_defs.type` — adicionar valor permitido (CHECK ou enum).
2. UI render: `src/components/inbox/CustomFieldsPanel.tsx` + `src/pages/SettingsCustomFields.tsx`.
3. Validação no save (ex: tipo "date" → ISO).

### Adicionar campo nativo ao lead
1. Migration: `ALTER TABLE leads ADD COLUMN ...` + RLS continua válida.
2. Types: `src/types/crm.ts`.
3. UI: `LeadDrawer.tsx` + drawer tabs.
4. Se editável por agente IA: adicionar à tool `set_lead_field` em [AI_RUNTIME](./AI_RUNTIME.md).

### Vincular agente IA default a um stage
1. UI: `EditStageDialog.tsx` → seletor de agente + switch auto_reply.
2. Persistência: `stage_ai_defaults` upsert.
3. Trigger no banco aplica em `leads.ai_paused` / `leads.attendant_id` quando lead entra.

### Adicionar fonte nova de lead
1. Edge function `external-lead-capture` aceita `source` no body — sem mudança necessária se for string nova.
2. Atribuição UTM: garantir que `utm_source/medium/campaign` chegam.
3. Métricas em `MetricsOps.tsx` agregam por `source`.
