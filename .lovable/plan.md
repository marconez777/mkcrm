# Varredura completa — pontos onde o limite de 1000 do PostgREST ainda machuca

Fiz uma varredura em todo `src/`. Abaixo, agrupado por área, o que **precisa** virar `fetchAllPaged`/chunked-IN e o que **não precisa** (já é paginação visual ou top-N intencional).

## E-mails — ainda pendentes

### `src/components/email/AutomationReportDialog.tsx`
- **`fetchLeadNames(ids)`** (linha 744) — `.in("id", ids)` com até milhares de ids; PostgREST devolve no máx. 1000 nomes, então a coluna "Nome" fica em branco em relatórios grandes. → quebrar em chunks de 500 e agregar no `Map`.
- **`fetchContactNames(emails)`** (linha 754) — mesmo problema com `email_segment_contacts.in("email", …)`. → mesmo chunking.

### `src/pages/email/EmailSegments.tsx`
- Linha 125 — `leads.select("form_source, tags, utm_campaign").limit(2000)` usado para popular sugestões de chips de filtro. Em clínicas com >2000 leads as sugestões ficam parciais. → `fetchAllPaged` com `hardCap` 20.000 (sugestões só precisam de cobertura, não exatidão).
- Linha 390 — `leads.select("form_source").limit(5000)` (mesmo caso, outra aba). → idem.

### `src/pages/email/EmailTemplates.tsx`
- Linha 80 — `email_templates.select("*").order("updated_at")` sem range. Clínicas com >1000 templates não veem os mais antigos. → `fetchAllPaged`.

### `src/pages/email/EmailAutomations.tsx`
- Linha 70 — `email_automations.select("*")` sem range. → `fetchAllPaged`.

### `src/pages/email/EmailCampaigns.tsx`
- Linhas 85-86 — `email_templates` e `email_segments` para popular o dropdown do dialog de campanha. → `fetchAllPaged` (mesmo padrão do EmailReports).

## E-mails — NÃO mexer (intencional ou já correto)

- `EmailLogs.tsx`, `EmailQueue.tsx`, `EmailUnsubscribes.tsx`, `EmailContacts.tsx`, lista principal do `EmailSegments.tsx` — paginação visual com `count: exact` + `.range(from,to)`.
- `CampaignLiveDialog.tsx:89` — `limit(20)` é "últimos 20 itens da fila", proposital.
- RPCs (`report_template_stats`, `report_campaign_stats`, `resolve_email_segment`, `campaign_throughput`, `email_metrics_daily`) — agregam no servidor.
- `EmailDashboard.tsx`, `CampaignReportDialog.tsx`, `AutomationReportDialog.load()` e `loadLeadsForBucket()`, `CampaignRecipientsPreview.tsx` — já corrigidos na rodada anterior.

## Fora do módulo de e-mail (resto da ferramenta)

### Alta prioridade (dados de cliente que crescem para sempre)

- **`src/hooks/useUnreadTitle.ts`** linha 16 — `leads.select("unread_count")` sem paginação. O contador de "não lidas" no `<title>` da aba para em 1000 leads, então clínicas grandes mostram número errado. → `fetchAllPaged` com hardCap alto.
- **`src/pages/Admin.tsx`** linha 49 — `clinics.select("*")` sem range. Em produção, a tela admin pode esconder clínicas. → `fetchAllPaged`.
- **`src/pages/SettingsForms.tsx`** linha 75 — `form_integrations.select("*")` (sem range). → `fetchAllPaged`.
- **`src/pages/Broadcasts.tsx`** linha 56 — `broadcasts.select("*")` (sem range). → `fetchAllPaged`.
- **`src/pages/Automations.tsx`** linha 51 — `automations.select("*")` (sem range). → `fetchAllPaged`.
- **`src/pages/Templates.tsx`** linha 31 — `message_templates.select("*")` (sem range). → `fetchAllPaged`.
- **`src/pages/Sequences.tsx`** linha 64 — `message_sequences.select("*")`. → `fetchAllPaged`.
- **`src/pages/ScheduledReports.tsx`** linha 55 — `scheduled_reports.select("*")`. → `fetchAllPaged`.
- **`src/pages/Agents.tsx`** linhas 220/241/260/364 — `ai_documents.select(...)` sem range e usado em listas. → `fetchAllPaged`.

### Média prioridade — `.in(...)` que podem estourar 1000

- `src/pages/Team.tsx:46` — `profiles.in("user_id", ids)`. → chunking se equipes grandes.
- `src/pages/AgentMemories.tsx:54,57` — `ai_agents`/`leads` por id; agente pode ter milhares de leads referenciados. → chunking.
- `src/pages/AiInsights.tsx:78,81` — mesmo padrão. → chunking.
- `src/pages/MetricsAiUsage.tsx:79,80` — mesmo padrão. → chunking.
- `src/components/inbox/ConversationList.tsx:103` — `leads.update().in("id", ids)`: o update funciona mas a resposta retorna no máx 1000 (ok, o efeito acontece). Não precisa mexer, mas observar.
- `src/components/lead/LeadTimelineTab.tsx:127,135,154` — `.in("visitor_id", …)` / `.in("id", …)`. → chunking se o lead acumular muitos visitantes.
- `src/components/email/CampaignRecipientsPreview.tsx:81` — JÁ chunked na rodada anterior.

### Caps intencionais que vou DEIXAR como estão

- `MetricsOps.tsx:25-26` (messages 5000, leads 2000) — dashboards de janela curta; cap intencional para custo.
- `Tracking.tsx:287,300,450,451` e `TrackingDebug.tsx:117,132,140,176,177` — top-N de eventos/sessões recentes.
- `LeadTimelineTab.tsx:80-120` — timeline de UM lead, 200 eventos por tipo é janela.
- `ContextRail.tsx`, `ChatPane.tsx`, `useLeadsPaginated.ts` — paginação ou top-N de chat.
- `Broadcasts.tsx:170` (broadcast_events 100), `Automations.tsx:72,131` (logs 20), `ScheduledReports.tsx:73` (15), `AiInsights.tsx:61` (200), `AgentMemories.tsx:44` (500), `MetricsAiUsage.tsx:71` (5000), `AiDashboard.tsx:96,103` (5000), `Metrics.tsx:48` (1000), `CommandPalette.tsx:59` (top 8), `SettingsForms.tsx:182` (200) — todos são "últimos N" ou janelas de métrica, não listas de domínio.
- Dropdowns/configs pequenas: `attendants`, `quick_replies`, `pipelines`, `pipeline_stages`, `whatsapp_instances`, `task_boards`, `clinic_members` — domínio inerentemente <1000.

## Como implementar

1. Trocar cada select listado em "Alta prioridade" e os dois do `AutomationReportDialog` por `fetchAllPaged(() => supabase.from(...).select(...)...)`, mantendo `order` e filtros.
2. Para os `.in(...)` listados em "Média prioridade": utilitário inline `chunkedIn(table, column, values, select)` que parte em 500, concatena resultados.
3. `useUnreadTitle`: `fetchAllPaged` na carga inicial; a subscription realtime já mantém o contador atualizado depois.
4. Sem mudanças de schema, RLS, ou edge functions.

## Esperado depois

Nenhum select de domínio (leads, clinics, campanhas, integrações, templates, etc.) trunca silenciosamente em 1000. Top-N e janelas de métrica continuam com cap, mas isso é decisão de produto, não bug.
