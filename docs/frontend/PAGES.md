# Frontend — Páginas

> Catálogo de páginas (`src/pages/**`) com responsabilidade, hooks que
> consomem e edge functions invocadas.
>
> Última atualização: 2026-05-25

---

## 1. Páginas standalone (sem AppShell)

| Página | Path | Responsabilidade |
|---|---|---|
| `Auth.tsx` | `/auth` | Login (email/senha + Google OAuth via Supabase). Sem signup público — só convite. |
| `Invite.tsx` | `/invite/:token` | Aceita convite, cria conta e vincula `clinic_members`. Usa edge `clinic-invite`. |
| `Unsubscribe.tsx` | `/unsubscribe` | Página pública de descadastro de email (chama `email-unsubscribe`). |
| `Onboarding.tsx` | `/onboarding` | Wizard pós-criação de conta: nomeia clínica, conecta WhatsApp (QR), seleciona features iniciais. |
| `Admin.tsx` | `/admin` | Super Admin: lista de clínicas, toggle de features, AI spend limits, integrações globais, quotas. |

---

## 2. Páginas dentro do AppShell

### 2.1 Pipeline (Kanban)
**`Kanban.tsx`** — `/` (rota raiz).
- Renderiza colunas por `pipeline_stages`, cards por `leads`.
- Hooks: `useStages`, `useLeads`, `usePipelines`, `useAttendants`, `useLeadsPaginated`.
- Drag & drop: atualiza `leads.stage_id` + `position` via update parcial.
- Subcomponentes em `components/kanban/*`: `PipelineSidebar`,
  `PipelineSwitcher`, `StagesManager`, `MoveLeadDialog`, `EditStageDialog`,
  `EditPipelineDialog`, `NewPipelineDialog`, `KommoImportDialog`,
  `ImportPipelineDialog`, `PipelineDateFilter`, `PipelineOverview`,
  `TopScrollbar`.
- Realtime: `useStages`/`useLeads` assinam `postgres_changes` —
  cards movem-se ao vivo entre clientes.

### 2.2 Conversas (Inbox)
**`Inbox.tsx`** — `/inbox`, `/inbox/:leadId`.
- Layout 3 colunas: lista de conversas / chat / contexto.
- Subcomponentes em `components/inbox/*`: `ConversationList`,
  `ChatPane`, `Composer`, `ContextRail`, `MediaBubbles`,
  `CustomFieldsPanel`, `LeadTasksPanel`, `ScheduledMessagesPanel`,
  `ScheduleMessageDialog`, `ForwardDialog`, `NewConversationDialog`,
  `TaskDialog`.
- Edge functions: `evolution-send`, `evolution-send-media`,
  `transcribe-audio`, `ai-assist`, `ai-auto-reply` (toggle por lead).
- Realtime: `messages` table + `leads.unread_count`/`last_message_*`.

### 2.3 IA (AiHub)
**`pages/ai/AiHub.tsx`** — hub que sub-roteia por `useLocation` para
renderizar todas as abas de IA. A ordem das abas (todas dentro de `/ai`):

1. **Dashboard** (`/ai`) — `AiDashboard`
2. **Agentes IA** (`/ai/agents`) — `Agents`
3. **Mensagens** (`/ai/messages`) — `Messages` (Sequences / Automations / Templates)
4. **Disparo em massa** (`/ai/broadcasts`) — `Broadcasts`
5. **Relatórios agendados** (`/ai/reports`) — `ScheduledReports`
6. **Engajamento** (`/ai/engagement`, aliases `/metrics/engagement`, `/metrics`) — `MetricsEngagement`
7. **Memórias IA** (`/ai/memories`) — `AgentMemories`
8. **Insights** (`/ai/insights`) — `AiInsights`
9. **Custos** (`/ai/usage`, alias `/metrics/ai-usage`) — `MetricsAiUsage`

> Nota: "Engajamento" vive **como aba dentro de `/ai`**, não como item separado
> no menu lateral. O sidebar só expõe o item "IA" (sem submenu).

Páginas filhas relevantes:
- **`Agents.tsx`** — CRUD de agentes IA (modelo, prompt, tools, RAG sources).
- **`AgentMemories.tsx`** — memories embarcadas (`agent_memories`).
- **`AiInsights.tsx`** — `ai-analyst-run` resultados, alertas.
- **`ScheduledReports.tsx`** — relatórios agendados (`scheduled-report-tick`).
- **`MetricsEngagement.tsx`** — respostas de broadcasts/sequências
  (`engagement_*` RPCs). Acessada via aba **Engajamento** do AiHub.
- **`MetricsAiUsage.tsx`** — gráfico de gasto por agente/modelo/dia
  (`ai_usage_daily` + `ai-pricing`).
- **`Sequences.tsx`** — drip campaigns. Ver `features/SEQUENCES_AUTOMATIONS.md`.
- **`Automations.tsx`** — regras event-driven. Idem.
- **`Templates.tsx`** — `message_templates` (texto/imagem/áudio).
- **`Broadcasts.tsx`** — disparo em massa WhatsApp. Ver `features/BROADCASTS.md`.

### 2.4 Email Marketing
**`pages/email/EmailHub.tsx`** — hub análogo ao AiHub para 10 sub-rotas:
`EmailDashboard`, `EmailTemplates`, `EmailAutomations`, `EmailCampaigns`,
`EmailQueue`, `EmailLogs`, `EmailSegments`, `EmailContacts`,
`EmailUnsubscribes`, `EmailReports`.
**`EmailTemplateEditor.tsx`** — editor blocks→html (TipTap) com
`Canvas`, `Inspector`, `Palette` em `components/email/editor/*`.
**`SettingsEmailDomain.tsx`** — wizard DNS (`DnsWizard`) para Resend.
Ver `edge-functions/EMAIL.md`.

### 2.5 Tracking
- **`Tracking.tsx`** — `/tracking`. Lista visitantes, sessões, eventos,
  funnels. Sub-aba `AttributionTab.tsx`.
- **`TrackingDebug.tsx`** — `/tracking-debug`. Console em tempo real do
  `tracking-event`. Só super_admin ou flag `debug_enabled`.
- Ver `edge-functions/TRACKING.md` e `features/FORMS.md` (formulários
  alimentam a mesma timeline).

### 2.6 Tarefas
**`Tasks.tsx`** — board Kanban (`tasks-board.ts`) de tarefas pessoais
e da equipe. `TaskDetailDialog`. Origem das tarefas pode ser
`lead-tasks.ts` (tarefas vinculadas a um lead).

### 2.7 Equipe
**`Team.tsx`** — convites (`clinic-invite`), criação direta
(`clinic-create-user`), edição de role. Restrito a `owner|admin`.

### 2.8 Configurações
- **`Settings.tsx`** — geral (clínica, instâncias WA, integrações,
  notificações, IA defaults). Query `?qr=1` abre `WhatsAppQrDialog`.
- **`SettingsCustomFields.tsx`** — schema de `custom_fields` por clínica.
- **`SettingsForms.tsx`** — integrações de forms externos. Ver
  `features/FORMS.md`.

### 2.9 Lead Drawer (não é rota, mas merece menção)
**`LeadDrawer.tsx`** + `components/lead/*` (`LeadJourneyTab`,
`LeadTimelineTab`, `timeline/TimelineFilters`, `TimelineItemRow`).
Aberto via `useDialogs` de qualquer página (Kanban, Inbox, Tasks).
Mostra perfil, timeline (mensagens + eventos + form_submissions),
tags, custom fields, jornada de tracking, tarefas, agendamentos.

### 2.10 Métricas
- **`Metrics.tsx`** — overview operacional.
- **`MetricsOps.tsx`** — WhatsApp/IA performance.
- **`MetricsAiUsage.tsx`** — citado acima.

### 2.11 NotFound / Index
- **`NotFound.tsx`** — 404 dentro do shell.
- **`Index.tsx`** — legado, não está roteada (Kanban virou raiz). Manter
  por compat até confirmar que nada importa dela.

---

## 3. Convenções por página

- **Layout**: cada página é responsável pelo próprio container; o shell
  fornece apenas sidebar + bg. Usar `flex flex-col h-full` para evitar
  scroll duplo (o shell tem `overflow-hidden`).
- **Loading**: `Loader2` (lucide) + texto `text-muted-foreground`.
- **Empty state**: card centralizado com CTA. Não deixar tela em branco.
- **Toast de erro**: `import { toast } from "sonner"` (não usar o
  `useToast` legado para erros novos).
- **Mutations**: invalidar TanStack Query keys manualmente quando o
  realtime não cobrir.

---

## 4. Pegadinhas

- `AiHub` e `EmailHub` precisam ter **um caso por rota** dentro do switch
  interno. Esquecer = tela em branco no path.
- `Kanban` consome `useLeads()` que carrega **2000 leads**. Acima disso,
  o hook avisa no console e cards extra ficam fora. Usar
  `useLeadsPaginated` para volumes grandes.
- `LeadDrawer` mantém estado global em `useDialogs`. Fechar via tecla
  Esc não cancela mutations em andamento — sempre `await` no save antes
  de `setOpen(false)`.

---

## 5. Melhorias sugeridas

- Quebrar `AiHub` e `EmailHub` em rotas reais (cada filha vira `<Route>`).
- Lazy-load das páginas pesadas (`EmailTemplateEditor`, `Broadcasts`,
  `Tracking`) com `lazy()`.
- Padronizar empty/loading/error states em componentes
  `<PageLoading/>`, `<PageEmpty/>`, `<PageError/>`.
