# Visão Geral da Plataforma — CRM mkart

> **Quando ler:** primeiro contato com o projeto. Para detalhes profundos, siga os links no [`README.md`](./README.md) → `architecture/`, `database/`, `edge-functions/`, `frontend/`, `flows/`, `integrations/`, `operations/`.
>
> **Última atualização:** 2026-05-30.

---

## 1. O que é

CRM multi-tenant focado em **clínicas / negócios** que atendem leads via **WhatsApp**, com:

- **Pipeline / Kanban** de leads
- **Inbox unificado** de conversas WhatsApp (via Evolution API)
- **Agentes IA** com RAG, memória e ferramentas (auto-resposta opcional)
- **Sequências e automações** de mensagens
- **Disparo em massa (broadcasts)** com janelas de envio e rotação
- **Email marketing** (templates, campanhas, automações, domínios via Resend)
- **Tracking** de visitantes/sessões com identificação por lead
- **Tarefas** estilo board (Trello-like)
- **Multi-clínica** com papéis (super admin, clinic admin, professional)

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui (Radix), React Router v6, React Query v5 |
| Estado/Forms | TanStack Query, react-hook-form + zod |
| Editor | Tiptap (templates de email), DnD-kit (kanban/tasks) |
| Backend | Lovable Cloud (Supabase) — Postgres + RLS + Edge Functions (Deno) + Storage |
| IA | Lovable AI Gateway (Gemini, GPT-5, etc.), `pgvector` para embeddings |
| WhatsApp | Evolution API (externa) via webhook + REST |
| Email | Resend (com domínios próprios por clínica) |
| Realtime | Supabase Realtime nas tabelas `messages`, `leads` |

---

## 3. Arquitetura geral

```text
┌──────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│  Navegador   │────│  Vite/React (SPA)    │────│  Supabase Postgres │
│  (usuário)   │    │  src/                │    │  + RLS por clinic  │
└──────────────┘    └─────┬────────────────┘    └────────┬───────────┘
                          │                              │
                          │ supabase-js                  │ triggers
                          ▼                              ▼
                  ┌──────────────────┐         ┌────────────────────┐
                  │  Edge Functions  │◀────────│  Realtime / pgvec  │
                  │  (Deno)          │         └────────────────────┘
                  └─────┬────────────┘
                        │
        ┌───────────────┼───────────────┬──────────────┐
        ▼               ▼               ▼              ▼
   Evolution API     Resend         Lovable AI      Tracking pixel
   (WhatsApp)        (email)        Gateway         (sites externos)
```

**Multi-tenancy**: toda tabela "de negócio" tem `clinic_id` com default `current_clinic_id()` e policy RLS `clinic_id = current_clinic_id()`. Papéis (`user_roles` / `clinic_members`) controlam admin/super-admin.

---

## 4. Estrutura de pastas

```text
src/
├── App.tsx                # Rotas + providers globais
├── main.tsx
├── components/
│   ├── AppShell.tsx       # Layout + sidebar dinâmica por feature/role
│   ├── ProtectedRoute.tsx # Guarda auth
│   ├── FeatureRoute.tsx   # Guarda por feature flag
│   ├── CommandPalette.tsx # ⌘K
│   ├── ShortcutsDialog.tsx
│   ├── inbox/             # ChatPane, Composer, ContextRail, ConversationList, ...
│   ├── kanban/            # Pipeline, Sidebar, MoveLeadDialog, Importadores
│   ├── lead/              # LeadJourneyTab
│   ├── tasks/             # TaskDetailDialog (board Kanban)
│   ├── email/             # DnsWizard + editor de templates
│   ├── settings/          # WhatsAppQrDialog
│   ├── admin/             # Tabelas de domínios/keys/quota (super admin)
│   └── ui/                # shadcn primitives
├── pages/                 # uma página por rota top-level
├── hooks/                 # useAuth, useCrm, usePipelines, useDialogs, useHealth...
├── lib/                   # helpers puros: features, phone, drafts, delete-lead...
├── integrations/supabase/ # client.ts + types.ts (AUTO-GERADOS, não editar)
└── types/

supabase/
├── functions/             # ~50 edge functions (ver §7)
│   └── _shared/           # ai, evolution, email, rag, mcp, metrics, utils
├── migrations/            # 66 migrações SQL (histórico)
└── config.toml
```

---

## 5. Telas (rotas)

Todas as rotas (exceto `/auth`, `/invite/:token`, `/unsubscribe`, `/admin`, `/onboarding`) são envolvidas por `<ProtectedRoute>` + `<AppShell>`. As que dependem de feature flag também usam `<FeatureRoute feature="...">`.

### Públicas / fora do shell

| Rota | Componente | Função |
|---|---|---|
| `/auth` | `Auth.tsx` | Login/cadastro (email + Google) |
| `/invite/:token` | `Invite.tsx` | Aceitar convite para clínica |
| `/unsubscribe` | `Unsubscribe.tsx` | Descadastro de email (público) |
| `/onboarding` | `Onboarding.tsx` | Setup inicial da clínica |
| `/admin` | `Admin.tsx` | Painel **super admin** (clínicas, features, domínios, quotas, keys) |

### App principal

| Rota | Componente | O que faz |
|---|---|---|
| `/` | `Kanban.tsx` | **Pipeline** de leads (drag-and-drop por estágio, filtros, pesquisa) |
| `/inbox` `/inbox/:leadId` | `Inbox.tsx` | **Conversas WhatsApp**: lista, chat, composer, rail de contexto |
| `/tasks` | `Tasks.tsx` | **Tarefas** em board (colunas, labels, checklists, assignees, anexos) |
| `/team` | `Team.tsx` | Membros da clínica + convites |
| `/tracking` | `Tracking.tsx` | Sessões/visitantes de sites com pixel |
| `/tracking-debug` | `TrackingDebug.tsx` | Inspector de eventos do pixel |
| `/settings` | `Settings.tsx` | Conexão WhatsApp (QR), perfil, clínica |
| `/settings/fields` | `SettingsCustomFields.tsx` | Campos personalizados de lead |
| `/settings/email` | `SettingsEmailDomain.tsx` | Domínio de envio + DNS Wizard |

### Hub de IA (`/ai/*`)

Single page `AiHub` que troca de seção:

| Rota | Conteúdo |
|---|---|
| `/ai` ou `/ai/agents` | Lista/editor de **Agentes** (`ai_agents`): prompt, modelo, tools, RAG, memória |
| `/ai/memories` | `agent_memory` (notas semânticas por agente/lead) |
| `/ai/usage` ou `/metrics/ai-usage` | Custo/tokens/latência (`ai_usage`) |
| `/ai/automations` | **Automações** baseadas em gatilho → ação |
| `/ai/sequences` | **Sequências** (drip) de mensagens |
| `/ai/templates` | Quick replies / message templates |
| `/ai/broadcasts` `/ai/broadcasts/:id` | **Disparo em massa** WhatsApp |
| `/ai/messages` | Submenu (templates, sequences, automations) |

### Hub de Email (`/email/*`)

Single page `EmailHub` com sub-seções:

| Rota | Função |
|---|---|
| `/email/templates` | Lista e pastas; `/:id` abre `EmailTemplateEditor` (Tiptap) |
| `/email/campaigns` | Campanhas (segment + template + agendamento) |
| `/email/automations` | Drip por gatilho |
| `/email/segments` | Filtros salvos sobre `leads` |
| `/email/queue` | Fila de envio (`email_queue`) |
| `/email/logs` | `email_logs` com aberturas/cliques/bounces |
| `/email/unsubscribes` | Lista de descadastros |
| `/email/reports` | Métricas agregadas |
| `/email/sites` | Sites de tracking |

---

## 6. Banco de dados (75 tabelas, RLS por `clinic_id`)

Grupos principais:

### Multi-tenant / acesso
`clinics`, `clinic_members`, `clinic_invites`, `user_roles`, `profiles`, `attendants`, `app_settings`, `audit_log`, `data_access_log`.

Funções SQL centrais (em `public`):
- `current_clinic_id()` — clínica ativa do usuário
- `has_clinic_access(uuid)`, `is_clinic_admin()`, `is_super_admin()`
- `current_clinic_has_feature(text)` / `clinic_has_feature(uuid, text)`

### CRM / Inbox
`leads`, `messages`, `lead_events`, `lead_internal_notes`, `lead_tasks`, `lead_custom_fields`, `lead_ai_settings`, `lead_reply_counters`, `lead_stage_history`, `pipelines`, `pipeline_stages`, `stage_ai_defaults`, `scheduled_messages`, `quick_replies`, `message_templates`, **`deleted_leads`** (tombstones — ver §8).

### WhatsApp / Evolution
`whatsapp_instances`, `webhook_events`, `webhook_dedup`, `pending_replies`.

### IA / RAG / Agentes
`ai_agents`, `ai_threads`, `ai_messages`, `ai_usage`, `ai_documents`, `ai_chunks` (com `embedding vector` + `tsv tsvector` para híbrido), `agent_memory`, `agent_traces`, `agent_evals`, `agent_mcp_servers`, `embedding_cache`, `rag_cache`.

### Automações & sequências (WhatsApp)
`automations`, `automation_runs`, `message_sequences`, `message_sequence_steps`, `message_sequence_enrollments`, `message_sequence_runs`.

### Broadcasts (WhatsApp)
`broadcasts`, `broadcast_message_groups`, `broadcast_message_parts`, `broadcast_recipients`, `broadcast_events`.

### Email marketing
`email_domains`, `email_templates`, `email_template_folders`, `email_campaigns`, `email_segments`, `email_automations`, `email_queue`, `email_logs`, `email_send_state`, `email_unsubscribes`.

### Tracking
`tracking_visitors`, `tracking_sessions`, `tracking_events`, `tracking_identity_links`.

### Tarefas (board)
`task_boards`, `task_columns`, `tasks`, `task_assignees`, `task_labels`, `task_label_links`, `task_checklist_items`, `task_attachments`.

### Configurações
`settings` (chave/valor por clínica).

**Padrão geral de RLS**: `clinic_id = current_clinic_id()` para tabelas operacionais; tabelas administrativas exigem `is_clinic_admin()` ou `is_super_admin()`. Algumas (ex.: `audit_log`, `email_logs`, `data_access_log`, `email_send_state`) são read-only para o app.

---

## 7. Edge functions (Deno)

Cerca de 50 funções em `supabase/functions/`, agrupadas por domínio:

**WhatsApp / Evolution**
`evolution-webhook` (entrada de mensagens) · `evolution-send` / `evolution-send-media` · `evolution-provision` · `evolution-qr` · `evolution-restart` · `evolution-logout` · `evolution-delete-instance` · `evolution-health` · `evolution-test` · `evolution-sync-lead` · `evolution-collect-leads` · `evolution-backfill-all` · `evolution-delete-lead` · `evolution-delete-message` · `fetch-wa-avatar` · `transcribe-audio`.

**IA**
`ai-chat` · `ai-assist` · `ai-auto-reply` · `ai-embed` · `ai-eval-run` · `ai-ingest-document` · `ai-ingest-pdf` · `ai-ingest-url` · `ai-ingest-urls` · `agent-run-bulk`.

**Sequências / automações / broadcasts (cron)**
`automations-tick` · `sequence-enroll` · `sequence-tick` · `sequence-trigger` · `broadcast-control` · `broadcast-tick` · `dispatch-campaign` · `scheduled-dispatcher` · `watch-stale-leads` · `daily-summary`.

**Email**
`send-email` · `process-email-queue` · `process-scheduled-campaigns` · `email-domain-manage` · `email-unsubscribe` · `resend-webhook` · `backfill-resend-events`.

**Tracking** (públicas, sem JWT)
`tracking-pixel` · `tracking-event` · `tracking-identify` · `tracking-config`.

**Plataforma**
`clinic-create-user` · `clinic-invite` · `integrations-status`.

**Código compartilhado**: `supabase/functions/_shared/` contém `evolution.ts` (`ingestMessage`, dispatch), `ai.ts` (cliente LLM), `email.ts`, `rag.ts` (busca híbrida), `mcp.ts` (tools), `metrics.ts`, `utils.ts`, `types.ts`.

---

## 8. Fluxos importantes

### 8.1 Mensagem WhatsApp entrando
1. Evolution faz POST em `evolution-webhook`.
2. `webhook_dedup` evita reprocesso.
3. `_shared/evolution.ts` → `ingestMessage`:
   - Procura lead por `phone` + `clinic_id`.
   - **Verifica `deleted_leads`**: se há tombstone com `deleted_at >= messageTimestamp`, ignora (não recria lead a partir de histórico antigo).
   - Caso contrário, cria/atualiza lead e insere em `messages`, atualiza `last_message_at`, `unread_count`, `lead_reply_counters`.
4. Dispara realtime → UI atualiza `Inbox`/`Kanban`.
5. Se `lead_ai_settings.auto_reply = true` e debounce expirou, agenda `ai-auto-reply`.

### 8.2 Exclusão segura de lead
Frontend chama `src/lib/delete-lead.ts` → edge `evolution-delete-lead`:
1. Insere registro em `deleted_leads(clinic_id, phone, deleted_at)`.
2. `DELETE` do lead (cascade em messages/tasks/etc).
3. Em caso de falha no DELETE, rollback do tombstone.

Resultado: novas mensagens criam **lead novo, sem herança**; reprocessamentos de histórico são ignorados.

### 8.3 Agente IA respondendo
`ai-auto-reply` → carrega agente (`ai_agents`), histórico (`ai_threads/messages`), memória (`agent_memory`), RAG (`ai_chunks` via híbrido BM25 + vetor, opcional rerank/HyDE), executa loop com tools (`agent_mcp_servers`), grava `agent_traces` + `ai_usage`, envia via `evolution-send`.

### 8.4 Broadcast WhatsApp
1. Usuário cria `broadcasts` + `broadcast_message_groups/parts` + `broadcast_recipients` (de segmento ou upload).
2. `broadcast-control` congela audiência e ativa.
3. Cron `broadcast-tick` respeita `send_window` (TZ, dias, horários) e `throttle_seconds`, envia próxima parte rotacionada por destinatário, atualiza `totals` e `broadcast_events`.

### 8.5 Campanha de Email
1. Cria `email_templates` (Tiptap + variables) e `email_segments`.
2. `email_campaigns` → `process-scheduled-campaigns` resolve segmento e enfileira em `email_queue`.
3. `process-email-queue` chama Resend; respeita `email_send_state` (quota diária).
4. `resend-webhook` atualiza `email_logs` (delivered/open/click/bounce/complaint).
5. Links de `email-unsubscribe` gravam em `email_unsubscribes`.

### 8.6 Tracking
Site externo carrega `tracking-pixel`/`tracking-config`. Eventos → `tracking-event`. `tracking-identify` (chamado pelo formulário) liga `tracking_visitors` ↔ `leads` em `tracking_identity_links`, populando `landing_page`, `utm_*`, `gclid`, `fbclid` no lead.

---

## 9. Autenticação & papéis

- Auth via Supabase (`Auth.tsx`): email/senha + Google OAuth.
- `clinic_members.role` (`clinic_role` enum): `owner`, `admin`, `professional`.
- `user_roles` para super admin (escopo global).
- Convites: `clinic_invites` + edge `clinic-invite` / `clinic-create-user`.
- `AppShell` esconde itens da sidebar conforme `hasFeature(...)` + role.

---

## 10. Feature flags

Definidas em `src/lib/features.ts` e gravadas em `clinics.settings.features`. **Default = liberada** se chave ausente. Chaves atuais:

`inbox`, `tasks`, `agents`, `automations`, `sequences`, `templates`, `metrics`, `metrics_ai`, `metrics_ai_usage`, `custom_fields`, `team`, `email_marketing`, `broadcasts`.

Super admin altera em `/admin`. Rotas usam `<FeatureRoute feature="...">`, sidebar usa `hasFeature(...)`.

---

## 11. Convenções de código

- **Nunca editar**: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, `supabase/config.toml` (project-level).
- **Mudanças de schema**: sempre via migração (`supabase/migrations/*.sql`).
- **Cores/estilo**: tokens semânticos em `index.css` + `tailwind.config.ts` (HSL). Nunca usar cor crua em componentes.
- **Realtime**: tabelas relevantes já estão em `supabase_realtime` (mensagens/leads).
- **Telefones**: normalizar com `src/lib/phone.ts` (E.164) antes de qualquer lookup/insert.
- **Tarefas pesadas**: usar React Query com chaves estáveis (`['leads', clinicId, filters]`).

---

## 12. Onde começar (cheatsheet do dev)

| Tarefa | Arquivo de entrada |
|---|---|
| Adicionar rota | `src/App.tsx` + nova page em `src/pages/` |
| Mudar sidebar | `src/components/AppShell.tsx` |
| Nova feature flag | `src/lib/features.ts` |
| Lógica de inbox/chat | `src/components/inbox/*` + `src/pages/Inbox.tsx` |
| Lógica de pipeline | `src/components/kanban/*` + `src/pages/Kanban.tsx` |
| Novo agente/tool | `src/pages/ai/*` + `supabase/functions/_shared/mcp.ts` |
| Webhook WhatsApp | `supabase/functions/evolution-webhook` + `_shared/evolution.ts` |
| Envio de email | `supabase/functions/send-email` + `_shared/email.ts` |
| Schema | criar `supabase/migrations/<timestamp>_*.sql` |
