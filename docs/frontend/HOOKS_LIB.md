---
title: Frontend — Hooks e Lib
topic: auth
kind: reference
audience: agent
updated: 2026-06-07
summary: "Detalhe importante: assina `onAuthStateChange`, e também renova a sessão em `visibilitychange` / `focus` / a cada 4min. Isso evita \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"token expired\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\" depois do computador dormir. **Não substituir** por um hook simples."
---
# Frontend — Hooks e Lib

> Hooks customizados (`src/hooks/**`) e utilitários (`src/lib/**`).
>
> Última atualização: 2026-06-03

---

## 1. Hooks

### Sessão e contexto

**`useAuth()`** (`hooks/useAuth.tsx`) — context provider montado em
`App.tsx`. Expõe:
- `session`, `user`, `loading`
- `membership` (clinic_id + role + clinic.settings)
- `isSuperAdmin` (lookup em `user_roles`)
- `hasFeature(key)` (combina `features.ts` + settings da clínica)
- `refreshMembership()`

Detalhe importante: assina `onAuthStateChange`, e também renova a
sessão em `visibilitychange` / `focus` / a cada 4min. Isso evita
"token expired" depois do computador dormir. **Não substituir** por um
hook simples.

**`useDialogs()`** (`hooks/useDialogs.tsx`) — store global de diálogos
(`LeadDrawer`, confirm, prompt) acessível de qualquer página via
`useDialogs().openLead(id)`, `confirm({...})`, `prompt({...})`.

### Realtime / dados

**`useStages()` / `useLeads()`** (`hooks/useCrm.ts`) — wrappers sobre
`useRealtimeList<T>(table, orderBy, renderKeys)`. Carrega uma vez
(stages: `limit: 500`; leads: paginação completa via
`fetchAllPaged` em páginas de 1000), assina `postgres_changes`,
patcha estado in-place. `renderKeys` filtra updates ruidosos (ex.:
`updated_at`) para evitar re-render storms.

**`usePipelines()`** — lista de pipelines da clínica + helper de
seleção/persistência da escolha em localStorage.

**`useLeadsPaginated()`** — alternativa paginada para listagens grandes
(usada na Inbox e em algumas tabs do drawer).

**`useAttendants()`** — `clinic_members` com filtro por role.

**`useQuickReplies()`** — atalhos de mensagem do attendant.

**`useHealth()`** — agrega `evolution-health` (WhatsApp) + integrations
status; expõe `overall: "ok"|"warn"|"down"` para a sidebar.

**`useWaAvatar()`** — busca/cacheia avatar do WhatsApp para um phone via
`fetch-wa-avatar`. Memoiza por número.

**`useEmailMetrics()`** (`hooks/useEmailMetrics.ts`) — lê a view/tabela agregada `email_metrics_daily` (por clinic+day+template_slug: sent/delivered/opened/clicked/bounced/complained/failed). Use para janelas grandes (>7 dias) — evita o teto de 1000 linhas em `email_logs`. Consumido por `EmailReports` e `EmailDashboard`.

**`useCustomFieldDefs()`** — definições de campos customizados (`custom_fields`) por clínica, com cache em React Query.

**`useCountUp()`** — animação de contagem numérica para KPIs (dashboards de IA e Email).

**`useWhatsappInstances()`** — lista `whatsapp_instances` da clínica + status agregado; consumido por `Settings` e `WhatsAppQrDialog`.

### UI

**`useUnreadTitle()`** — soma `leads.unread_count`, atualiza
`document.title` com `(N) MK-CRM`. Roda em `<TitleSync/>` no App.

**`useHorizontalScroll()`** — sincroniza dois containers de scroll
horizontal (usado pelo `TopScrollbar` do Kanban).

**`use-mobile.tsx`** — breakpoint `md` via matchMedia.

**`use-toast.ts`** — toast legado (shadcn). Para código novo, importar
`toast` direto de `sonner`.

---

## 2. Lib (utilitários puros)

### Geral
- **`utils.ts`** — `cn()` (clsx + tailwind-merge). Único util realmente
  usado em todo lugar.
- **`supabase-env.ts`** — leitura tipada de `import.meta.env.VITE_*`.
- **`app-url.ts`** — base URL da app (preview/published) para gerar links absolutos (emails, convites).
- **`phone.ts`** — `normalizePhoneBR(raw)` → string só dígitos com `55`
  prefix quando aplicável. Usar SEMPRE antes de salvar/comparar phones.
- **`fetch-all.ts`** — `fetchAllPaged<T>(queryFn, pageSize)`: pagina chamadas Supabase para escapar do teto de 1000 rows. Usado por `useCrm` (leads) e exports.
- **`csv.ts`** — helpers de export CSV (escape, BOM UTF-8) usados em tracking/leads/email logs.
- **`diff-lines.ts`** — diff linha-a-linha para `PromptDiff` (Agentes IA).
- **`template-vars.ts`** — render de variáveis `{{...}}` em strings (compartilhado entre templates de WhatsApp e prévia de mensagens).
- **`quality-ladder.ts`** — escada de qualidade (cores/labels) para scores 0–100 em métricas de IA/email.

### Leads / pipeline
- **`delete-lead.ts`** — soft delete (`archived_at`) e hard delete
  com cascata (mensagens, eventos). Mostra confirm via `useDialogs`.
- **`drafts.ts`** — drafts de mensagem por lead em localStorage (chave
  `mk:draft:<leadId>`).
- **`internal-notes.ts`** — CRUD de notas internas do lead.
- **`lead-tasks.ts`** — tarefas vinculadas a lead, com lembrete.
- **`saved-views.ts`** — filtros salvos do kanban/inbox.
- **`tasks-board.ts`** — agrupamento de tasks por status para o
  board de `/tasks`.

### Mensagens
- **`scheduled-messages.ts`** — CRUD em `scheduled_messages` (consumido
  por `scheduled-dispatcher` cron).
- **`media-url.ts`** — resolve URL pública/signed para mídia
  WhatsApp/email.

### Email
- **`email/types.ts`** — shape dos blocks.
- **`email/blocksToHtml.ts`** — render para HTML inline (CSS embebido).
- **`email/htmlToBlocks.ts`** — parser reverso (importar template HTML).
- **`email/sanitize.ts`** — DOMPurify wrapper.
- **`email/variables.ts`** — catálogo `{{nome}}`, `{{empresa}}` etc.
  com renderização preview.

### Tracking
- **`tracking-identify.ts`** — helper para chamar `tracking-identify`
  ligando o visitor atual ao usuário logado.

### Broadcasts
- **`broadcast-template.ts`** — download/parse de XLSX para audiência
  (`downloadBroadcastTemplate`, `parseContactsFile`). Usa `xlsx` e
  `normalizePhoneBR`.

### IA
- **`ai-pricing.ts`** — tabela de preços por modelo + helper
  `computeCost(model, tokens)` espelhando `_shared/ai-pricing.ts` da
  edge. Mantenha os dois em sincronia.
- **`agent-tools.ts`** — catálogo declarativo de tools (function-calling) disponíveis para os agentes — labels, descrições e schema usado pelo painel `Agents` e pela edge `ai-assist`.
- **`builder-errors.ts`** — mapeamento de códigos de erro do Builder Agent para mensagens user-friendly.
- **`builder-tooltips.ts`** — copy compartilhada dos tooltips do Builder Setup.

### Features
- **`features.ts`** — `FeatureKey`, catálogo `FEATURES[]`,
  `isFeatureEnabled(features, key)`. Default-on quando a key não está
  presente. Usado pelo `useAuth.hasFeature`.

### Admin (jun/2026)
- **`admin-plans.ts`** — definições compartilhadas pelo painel `/admin`:
  - `LIMIT_DEFS: { key, label, unit }[]` — catálogo de limites numéricos por plano (`max_users`, `max_leads`, `max_whatsapp_instances`, `max_messages_month`, `max_broadcasts_month`, `max_emails_month`, `max_email_domains`, `ai_monthly_usd_cap`, `max_ai_agents`, `max_kb_documents`, `storage_mb`). Renderizado em `PlanEditorDialog` e `UsageLimitsPanel`.
  - `USAGE_KEY_MAP: Record<limitKey, usageKey>` — mapa do limite para a métrica de uso correspondente (ex.: `max_users → members`). Detalhes do modelo em `architecture/PLANS_LIMITS.md`.

---

## 3. Convenções

- **Tipagem completa** — `any` só em `payload as any` de realtime ou
  joins do Supabase. Evite em código novo.
- **Hooks devem ser puros React** — sem efeitos colaterais fora do
  `useEffect`. Side effects de longo prazo (intervals, channels) sempre
  com cleanup.
- **Lib é stateless** — funções utilitárias sem React, fácil de testar.
- **Cuidado com closures stale** em realtime: `setItems(prev => ...)`
  sempre via callback.
- **localStorage**: prefixar chaves com `mk:` para evitar colisão.

---

## 4. Pegadinhas

- `useRealtimeList` (`useCrm.ts`) **não** re-fetcha em
  `visibilitychange`. Se ficar offline e voltar, mudanças perdidas no
  websocket não são reconciliadas — usuário precisa F5. Ver `DEBT.md`.
- `useAuth.loadCtx` roda em `setTimeout(_, 0)` dentro do
  `onAuthStateChange` para evitar deadlock recomendado pelo Supabase.
  **Não inline.**
- `normalizePhoneBR` retorna `null` para strings inválidas; sempre testar
  antes de gravar.
- `ai-pricing.ts` no frontend não tem acesso a `gateway_pricing` da
  Lovable AI atualizada em runtime — pode mostrar custo levemente
  diferente da edge se a tabela mudar. Atualizar manualmente.

---

## 5. Melhorias sugeridas

- Wrapper `useSupabaseQuery<T>(table, filter)` padronizando loading/error
  e revalidação on focus.
- Reconciliação no `useRealtimeList` ao voltar de offline (refetch
  diff por `updated_at > last_seen`).
- Mover `ai-pricing` para uma view materializada e consultar via single
  source of truth.
- Testes unitários em `lib/*` puros (vitest já está configurado).
