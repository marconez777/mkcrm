---
title: "Inbox, Kanban e Leads — mapa completo"
topic: inbox
kind: map
audience: agent
updated: 2026-07-01
summary: "Como Inbox (`/inbox`), Kanban (`/`) e a entidade Lead se compõem: hooks Realtime, pipelines, drag-and-drop, drawer, timeline, notas internas, tarefas e mensagens agendadas. Fase 2 do F-DOC-FULL."
code_refs:
  - src/pages/Inbox.tsx
  - src/pages/Kanban.tsx
  - src/pages/LeadDrawer.tsx
  - src/hooks/useCrm.ts
  - src/hooks/useLeadsPaginated.ts
  - src/hooks/useLeadSearch.ts
  - src/hooks/useCustomFieldDefs.ts
  - src/hooks/useAttendants.ts
  - src/hooks/usePipelines.ts
  - src/hooks/useWhatsappInstances.ts
  - src/hooks/useQuickReplies.ts
  - src/hooks/useHorizontalScroll.ts
  - src/hooks/useWaAvatar.ts
  - src/components/inbox/
  - src/components/kanban/
  - src/components/lead/
  - src/components/leads/LeadAttributionCard.tsx
  - src/lib/manual-stage-move.ts
  - src/lib/delete-lead.ts
  - src/lib/internal-notes.ts
  - src/lib/lead-tasks.ts
  - src/lib/scheduled-messages.ts
  - src/lib/drafts.ts
  - src/lib/pipeline-skip-reasons.ts
  - src/lib/saved-views.ts
  - src/types/crm.ts
related_docs:
  - docs/maps/FRONTEND_CORE.md
  - docs/pipeline/README.md
  - docs/pipeline/runtime/README.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Inbox, Kanban & Leads

Este é o "coração operacional" do app: onde a atendente vê e trabalha os leads. Cobre três superfícies visuais que compartilham as mesmas tabelas (`leads`, `messages`, `pipeline_stages`, `pipelines`, `lead_custom_fields`, `lead_internal_notes`, `lead_tasks`) e hooks Realtime.

## 1. Entidade Lead (`src/types/crm.ts`)

`leads` — 48 colunas. Chaves usadas na UI (subset):

- Identidade: `id`, `phone`, `name`, `email`, `company`, `avatar_url`, `notes`.
- Pipeline: `pipeline_id`, `stage_id`, `position`, `attendant_id`, `whatsapp_instance_id`, `tags[]`, `archived_at`, `pinned_at`, `marked_unread`.
- Mensagens: `last_message_at`, `last_message_preview`, `unread_count`.
- Comercial: `deal_value`.
- IA/pipeline runtime: `ai_summary`, `needs_ai_review`, `ai_review_reasons[]`, `custom_fields` (jsonb — usado como projeção rápida dos `lead_custom_fields`).
- Flags estruturais: `is_internal_contact` (sincronizado ao entrar/sair de stage com `lock_auto_move=true`).
- Timestamps: `created_at`, `updated_at`.

Tabelas relacionadas:

| Tabela | Uso |
|---|---|
| `messages` | histórico de conversa (in/out/notes) |
| `lead_custom_fields` | valores dos campos personalizados (fonte da verdade — `leads.custom_fields` é projeção) |
| `lead_internal_notes` | notas privadas da equipe |
| `lead_tasks` | tarefas atreladas ao lead (mini-CRM, ver §7.3) |
| `lead_events` | timeline de eventos (view/rail) |
| `lead_stage_history` | histórico de movimentações entre stages |
| `lead_thread_classifications` | classificações do pipeline-classify |
| `lead_ai_settings` | overrides IA por lead |
| `lead_reply_counters` | contadores para follow-ups |
| `scheduled_messages` | envios agendados |
| `deleted_leads` | tombstones (excluídos via `evolution-delete-lead`) |

## 2. Hooks Realtime

### 2.1 `useCrm` (`src/hooks/useCrm.ts`)
Wrapper genérico `useRealtimeList<T>()` — carrega uma vez (`fetchAllPaged` em `leads`, `.limit(500)` em `pipeline_stages`) e depois só aplica patches INSERT/UPDATE/DELETE via `postgres_changes`.

Otimizações críticas:
- **`LEAD_RENDER_KEYS`**: whitelist de campos que disparam re-render. UPDATEs que só tocam `updated_at`, telemetria interna, etc. são descartados — evita re-render storm sob volume alto.
- **Sort estável** por `orderBy` (`position` para stages e leads). Só re-ordena se a chave de sort mudou.
- Exposição pública: `useStages()` (sort por `position`) e `useLeads()` (sort por `position`, usado por Kanban).

### 2.2 `useLeadsPaginated(instanceId?)` (`src/hooks/useLeadsPaginated.ts`)
Fonte do Inbox. Cursor pagination em `last_message_at desc`, `PAGE_SIZE = 50`. Filtro por `whatsapp_instance_id` (Inbox força **uma** instância — nunca "todas").

Comportamento Realtime:
- INSERT: prepend se casa com o filtro de instância.
- UPDATE: se saiu do filtro → remove; se entrou ou "bubbled in" (pinned OR `last_message_at > cursor`) → adiciona ao topo.
- DELETE: remove.
- **Auto-refresh**: se a aba ficou oculta por >2min, `refresh()` ao voltar.

Sort combinado: `pinned_at` DESC → `last_message_at` DESC.

### 2.3 `useLeadSearch(pipelineId, query)` (`src/hooks/useLeadSearch.ts`)
Autocomplete leve (`.ilike` em `name`, limit 20, debounce 200ms). Usado por dialogs que precisam achar um lead pelo nome (ex.: `ForwardDialog`).

### 2.4 Auxiliares
- `usePipelines`: lista `pipelines` + `pipeline_stages` da empresa.
- `useWhatsappInstances`: instâncias + `defaultInstance`.
- `useAttendants`: usuários da empresa que atendem.
- `useCustomFieldDefs`: definições dos campos personalizados (por pipeline).
- `useQuickReplies` + `applyVariables`: templates rápidos com variáveis (`{{lead.name}}`, custom fields, etc.).
- `useWaAvatar`: cache de avatares do WhatsApp (`fetch-wa-avatar`).
- `useHorizontalScroll`: pan horizontal (mouse-drag) do board Kanban.

## 3. Página `/inbox` (`src/pages/Inbox.tsx`)

Layout tri-coluna: **ConversationList** (esquerda, 320px) | **ChatPane** (centro, flexível) | **ContextRail** (direita, 320px, colapsável).

Fluxo:

1. Lê `?inst=` ou `localStorage["inbox:instanceId"]` para escolher a instância WhatsApp. Se inválida, cai no `defaultInstance`.
2. Chama `useLeadsPaginated(instanceId)` — nunca `null` enquanto existirem instâncias (invariante: "exatamente uma instância selecionada").
3. Filtro cliente: `all|unread|mine|unassigned|archived` + tag/stage + busca (`name`/`phone`/`last_message_preview`).
4. Sort: `recent` (default), `unread`, `oldest`. Pinneds sempre no topo (segunda passada).
5. Realtime "ping" adicional: canal separado que só toca som (`playPing()`) em INSERT de `messages` com `from_me=false` quando `document.hidden` e não é o lead aberto.

Atalhos de teclado:
- `/` → foca busca (`#inbox-search`).
- `Esc` → volta para `/inbox` (fecha chat).
- `j`/`k` → próximo/anterior na lista filtrada.

Eventos globais escutados:
- `open-new-conversation` (do CommandPalette) → abre `NewConversationDialog`.

Sub-componentes:

| Componente | Responsabilidade |
|---|---|
| `ConversationList` | lista virtualizada, filtros/sort, seleção múltipla, ações em lote (pin/unpin/mark-unread/archive/assign/move-stage/delete/save-view), collapse. |
| `ChatPane` | histórico paginado (50/página), scroll infinito, dedup por `external_id`/`client_message_id`, "load older" via `evolution-sync-lead`, edit/delete de mensagens, reply-to, forward, busca in-thread com date-jump, notas internas inline, avatar WA. |
| `Composer` | textarea multi-linha, quick replies com variáveis, emojis, anexos (16MB, 10 arquivos, tipos WA), gravação de áudio com timer, agendamento (`ScheduleMessageDialog`), draft persistido por lead em localStorage. |
| `ContextRail` | edição rápida de campos do lead (nome/email/company/tags/stage/atendente/deal_value/notes), pin/archive/delete, geração de `ai_summary` via `ai-assist`, painéis colapsáveis: CustomFieldsPanel, LeadTasksPanel, ScheduledMessagesPanel, histórico de eventos. |
| `NewConversationDialog` | cria lead + inicia conversa vinculada à instância. |
| `ForwardDialog` | encaminha mensagem para outro lead (usa `useLeadSearch`). |
| `ScheduleMessageDialog` + `ScheduledMessagesPanel` | agenda mensagem (grava em `scheduled_messages`, processada por `scheduled-dispatcher`). |
| `TaskDialog` + `LeadTasksPanel` | CRUD de `lead_tasks` inline. |
| `CustomFieldsPanel` | edita `lead_custom_fields` usando defs de `useCustomFieldDefs`. Layout adaptativo com `ResizableTextareaField`. |
| `MediaBubbles` | render de imagem/vídeo/áudio/doc com fallback e download. |

## 4. Página `/` — Kanban (`src/pages/Kanban.tsx`)

1049 linhas, o arquivo mais denso do app. Estrutura:

### 4.1 Data
- `useStages()` → todos os stages da empresa.
- `useLeads()` → todos os leads da empresa.
- `usePipelines()` → pipelines + stage bindings.
- Filtragem por `currentId` (pipeline ativo, persistido em `localStorage`).
- Filtro adicional por data (`PipelineDateFilter`, preset ou mês específico) e busca (`name`/`phone` normalizado).
- Pré-agrupamento `leadsByStage: Map<stage_id, Lead[]>` (memoizado) — ordena por `pinned_at` DESC → `last_message_at` DESC → `created_at` DESC.

### 4.2 Layout
- Header: `PipelineSwitcher`, contagem "N de M leads · X etapas", busca, `PipelineDateFilter`, toggle compact, botão `Calendar` (`CalendarSheet`), edit-pipeline, add-column, add-lead.
- Board: scroll horizontal (`kanban-scroll`) com botões chevron e `useHorizontalScroll` (pan mouse). Snap-to-column via classe `kanban-snap`.
- Cada `Column` (280px) tem header com cor, nome (rename por double-click), contador, badge `🤖 IA` (se stage tem `stage_ai_defaults` com auto_reply), soma monetária (`fmtMoney` via `useRegion().currency`), menu (Edit/Configurar IA/Move all/Delete), e corpo virtualizado.
- `VirtualizedColumnBody` — `@tanstack/react-virtual` (estimativa 62/112px), `overscan: 8`, `SortableContext` do dnd-kit.

### 4.3 Drag-and-drop
- `DndContext` com `closestCorners`, sensor customizado `CardOnlyPointerSensor` que só ativa em `[data-kanban-card]` e ignora cliques em `button/a/input/textarea/select/[role=menuitem]`.
- `autoScroll: { threshold: { x: 0.1, y: 0.15 }, acceleration: 15 }`.
- `onEnd`: calcula `newPosition = max(position) + 1` na coluna destino, otimista → `supabase.from("leads").update(patch)`. `patch` inclui:
  - `stage_id`, `position`.
  - `is_internal_contact` se cruzou stage com `lock_auto_move` (via `computeInternalContactSync`).
  - `custom_fields` mesclado (via `customFieldsPatchForStage`) se destino é "não qualificado" — auto-preenche `qualificacao=desqualificado` + `motivo_desqualificacao=outro` se ausente.
- Toast com ação `Desfazer` (6s) — reverte stage/position e a flag.

### 4.4 Move alternativo
- `MoveLeadDialog` (menu do card → "Mover para outro pipeline"): permite mover cross-pipeline.
- `MoveColumnLeadsDialog` (menu da coluna → "Mover todos os leads").
- `moveLeadToStage` (menu do card → "Mover para coluna X"): mesma lógica de `onEnd` sem drag.

### 4.5 AIBadges
Chips derivados de `lead.custom_fields`:
- `qualificacao` (desqualificado/interessado/em_negociacao)
- `procedimento_interesse` → `REASON_LABEL[proc_*]`
- `tentou_pagamento`, `pagamento_confirmado`
- `tentou_agendar`, `consulta_agendada_em`, `procedimento_agendado_em` (>agora−12h)
- `needs_ai_review` → chip "IA em fila"
- `ai_review_reasons[]` — filtrado por `HIDDEN_REASONS` e por redundância com chips estruturais.

### 4.6 Sub-componentes Kanban
| Componente | Uso |
|---|---|
| `PipelineSwitcher` | dropdown com lista + contagem por pipeline, badge de instância WA. |
| `NewPipelineDialog` / `EditPipelineDialog` | CRUD de `pipelines` (kind `sales|internal`, WA vinculado). |
| `EditStageDialog` | tabs "Geral" e "IA" — na aba IA cria/edita `stage_ai_defaults` + `stage_sequence_bindings`. |
| `StagesManager` | reordenação e cores em massa. |
| `PipelineDateFilter` | presets + mês específico + custom range, persiste em `pipeline:ui:v1`. |
| `PipelineSidebar` / `PipelineOverview` | painel lateral resumo (usado em rotas dedicadas). |
| `ImportPipelineDialog` / `KommoImportDialog` | importação de leads/pipelines de CSV/Kommo. |
| `TopScrollbar` | scrollbar horizontal secundária no topo. |
| `calendar/CalendarSheet` | visão de calendário derivada de `custom_fields.consulta_agendada_em` / `procedimento_agendado_em`. |

### 4.7 Persistência UI (localStorage)
`pipeline:ui:v1`: `{ collapsed: string[], compact: boolean, dateFilterPreset, dateFilterCustom }`.

## 5. LeadDrawer (`src/pages/LeadDrawer.tsx`)

Sheet lateral aberto pelo Kanban. 3 abas:
- **Chat** → `ChatPane` (reusa o do Inbox).
- **Detalhes** → `ContextRail` + `LeadAttributionCard` (tracking/atribuição).
- **Jornada** → `LeadTimelineTab`.

Ações no header:
- "Revisar com IA" → busca `whatsapp_instances.watcher_agent_id` e invoca `ai-chat` com esse agente.
- "Sincronizar histórico" → `evolution-sync-lead` (importa mensagens perdidas da Evolution).
- "Excluir" → `useConfirm` com `requireTyping: "EXCLUIR"` → `deleteLead()` → edge `evolution-delete-lead`.

## 6. Timeline & Journey (`src/components/lead/`)

- **`LeadTimelineTab`**: agrega em ordem cronológica descendente eventos de `lead_events`, `lead_stage_history`, `messages` marcantes, `lead_thread_classifications`, `automation_runs`, `pipeline_run_items`. Filtros por tipo em `TimelineFilters.tsx`. Items renderizados por `TimelineItemRow.tsx` (types em `types.ts`).
- **`LeadJourneyTab`**: visão condensada da jornada comercial (funnel visual — stage por stage com timestamps).

## 7. Bibliotecas de suporte (`src/lib/`)

### 7.1 `manual-stage-move.ts`
- `isDisqualifiedStage(stage)`: match por normalize+includes `"nao qualificado"`.
- `customFieldsPatchForStage(current, target)`: retorna patch de `custom_fields` se destino é desqualificação e o lead ainda não tem `qualificacao=desqualificado` + `motivo_desqualificacao`. Usado tanto no `onEnd` do drag como em `moveLeadToStage`.
- **Nota histórica (PR4)**: `manual_lock_until` foi removido; não há mais lock temporal em move manual.

### 7.2 `internal-notes.ts`
Cache in-memory (`Map<leadId, InternalNote[]>`) + canal Realtime por lead (`filter: lead_id=eq.<id>`). API:
- `subscribeNotes(leadId, cb) → unsubscribe`
- `getNotes(leadId)` (sync do cache)
- `addNote(leadId, text, author?)` (insere + optimistic)
- `removeNote(leadId, noteId)` (optimistic delete)

Canal é liberado quando o último listener sai.

### 7.3 `lead-tasks.ts`
CRUD simples de `lead_tasks` (`due_at`, `done_at`). Sem Realtime — a `LeadTasksPanel` refetcha ao mutar.

### 7.4 `delete-lead.ts`
Wrapper que chama a edge `evolution-delete-lead`. Nunca deletar direto via `.from("leads").delete()` — a edge cuida de cascatas (messages, media, tombstone em `deleted_leads`, cancelamento de agendamentos, sinal para Evolution).

### 7.5 Auxiliares
- `drafts.ts`: rascunhos do Composer por lead em localStorage.
- `scheduled-messages.ts`: helpers para `scheduled_messages`.
- `pipeline-skip-reasons.ts`: dicionário de motivos de skip usados em badges/timeline.
- `saved-views.ts`: views salvas da ConversationList.
- `template-vars.ts` / `broadcast-template.ts`: expansão de variáveis (`{{lead.name}}`, custom fields, região, etc.).
- `format.ts` + `phone.ts`: money/date/phone formatting sensível a `useRegion()`.

## 8. Realtime — canais em uso

Todos os canais desta área usam `postgres_changes`. Nomes gerados com sufixo aleatório para evitar colisão.

| Canal | Filtro | Consumidor |
|---|---|---|
| `leads-rt-*` | `leads.*` | `useCrm.useLeads` (Kanban) |
| `pipeline_stages-rt-*` | `pipeline_stages.*` | `useCrm.useStages` |
| `leads-pg-*` | `leads.*` (filtro app-side por instância) | `useLeadsPaginated` (Inbox) |
| `inbox-ping-*` | `messages` INSERT `from_me=eq.false` | `Inbox` (ping sonoro) |
| `sidebar-unread-*` | `leads.*` (só delta de unread) | `AppShell.useUnreadTotal` |
| `notes-<leadId>-*` | `lead_internal_notes` filtered | `internal-notes.ts` |
| Canais internos ChatPane | `messages` filtered por `lead_id` | `ChatPane` |

## 9. Invariantes (não quebrar)

1. **Inbox = uma instância só**. Nunca permitir `instanceId=null` enquanto houver instâncias — o filtro app-side depende disso e a busca faria fetch full-table.
2. **`leads.custom_fields` é projeção**, não source of truth. Sempre gravar via `lead_custom_fields` + trigger, exceto quando o patch já é feito no mesmo `update()` do drag (auto-desqualificação). Se editar aqui, revisar `recompute_lead_appointment_summary` e o 7-day manual edit lock.
3. **Drag-and-drop só a partir de `[data-kanban-card]`**. `CardOnlyPointerSensor` protege o pan horizontal. Não remover o atributo dos cards nem envolver interactive children fora do whitelist.
4. **`is_internal_contact` deve refletir localização em stage com `lock_auto_move`**. `computeInternalContactSync` roda em toda movimentação — não pular.
5. **Delete de lead sempre pela edge**. `deleteLead()` → `evolution-delete-lead`. Nunca `.delete()` direto (perde tombstone e trigger de cascata).
6. **`LEAD_RENDER_KEYS` / `STAGE_RENDER_KEYS`**: adicionar campo aqui só se de fato afeta render. Adicionar campo "quente" (ex.: contador que muda a cada mensagem) causa re-render storm.
7. **Pinneds sempre no topo** — todo sort de leads deve terminar com o second-pass de pin.
8. **Reuso ChatPane/ContextRail**: LeadDrawer e Inbox montam os mesmos componentes. Qualquer mudança precisa passar smoke em ambos.
9. **Ações em lote da ConversationList** operam sobre IDs selecionados — não sobre o array filtrado atual. Não confundir.
10. **Auto-desqualificação em drag** só dispara se o stage destino match `"nao qualificado"` (normalize). Renomear stages para outra convenção quebra essa automação.

## 10. Bugs conhecidos / dívidas

- `AIBadges` tem strings hardcoded em `REASON_LABEL` (Cetamina, EMT, etc.) — específicas do domínio Clínica OR. Não estão em i18n e não são configuráveis por empresa. Ver `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` para o mapeamento.
- `timeAgo` em `Kanban.tsx` é hardcoded PT ("agora"/"m"/"h"/"d") — não usa i18n.
- `useCrm.useLeads()` faz `select("*")` de **todos** os leads da empresa. Escala mal acima de ~5k leads. Kanban depende disso hoje; migrar para paginação por pipeline é dívida técnica registrada.
- `Kanban.tsx` com 1049 linhas concentra muitas responsabilidades — candidato a split (LeadCard, AIBadges, Column, VirtualizedColumnBody, main).
- `ContextRail` (491 linhas) e `ChatPane` (967 linhas) também são candidatos a split.

## 11. Gaps de doc identificados

Cobertos aqui pela primeira vez: todos os componentes de `src/components/inbox/`, `src/components/kanban/`, `src/components/lead/`, `LeadDrawer.tsx`, `Inbox.tsx`, `Kanban.tsx`, hooks Realtime relacionados, e as libs `manual-stage-move`, `internal-notes`, `lead-tasks`, `delete-lead`, `drafts`, `scheduled-messages`, `pipeline-skip-reasons`, `saved-views`.

Não coberto (Fase 3+): pipeline runtime (edges `pipeline-*`, agentes classifier/deterministic), automações que operam sobre estes leads (Fase 6), tracking/atribuição (`LeadAttributionCard` só citado — detalhar em Fase 8).
