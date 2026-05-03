# Arquitetura

## Visão geral

```
┌────────────┐   WhatsApp    ┌──────────────┐   webhook    ┌──────────────────┐
│   Cliente  │ ────────────► │ Evolution API│ ───────────► │ evolution-webhook│
└────────────┘               └──────────────┘              │  (Edge Function) │
                                    ▲                     └────────┬─────────┘
                                    │ REST                          │ insert/update
                                    │                               ▼
                              ┌────────────┐   send         ┌──────────────┐
                              │evolution-  │ ◄───────────── │  Postgres    │
                              │   send     │                │  (Supabase)  │
                              └────────────┘                └──────┬───────┘
                                                                   │ Realtime
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  React UI   │
                                                            │ (Inbox/Kbn) │
                                                            └─────────────┘
```

## Camadas

### Frontend (`src/`)
- **Roteamento** (`App.tsx`): `/` Kanban, `/inbox[/:leadId]`, `/settings`.
- **Estado de servidor**: hooks customizados (`useCrm`, `useAttendants`, `useQuickReplies`) abrem listeners Realtime e mantêm cache local incremental — sem refetch.
- **TanStack Query**: usado pontualmente; a maior parte do estado vem dos hooks Realtime.
- **Design system**: tokens HSL em `src/index.css` + `tailwind.config.ts`. Componentes shadcn/ui.

### Backend (Lovable Cloud / Supabase)
- **Postgres**: tabelas em [DATABASE.md](DATABASE.md). RLS aberta (`public_all`) — projeto é single-tenant interno.
- **Edge Functions** (Deno): ver [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md).
- **Realtime**: replica `INSERT/UPDATE/DELETE` para clientes via WebSocket.

## Fluxos críticos

### Recebimento de mensagem
1. Evolution chama `POST /functions/v1/evolution-webhook?token=...` com evento `MESSAGES_UPSERT`.
2. `evolution-webhook` valida o token, registra em `webhook_events` e chama `ingestMessage` (em `_shared/evolution.ts`).
3. `ingestMessage`:
   - Resolve/cria o `lead` pelo telefone.
   - **SELECT** a mensagem por `(lead_id, external_id)` antes de gravar.
   - Se já existe e nada relevante mudou → **return early** (idempotente).
   - Se é nova → `INSERT` + `increment_unread` + atualiza preview.
4. Postgres dispara Realtime → UI insere a nova mensagem no chat / atualiza badge.

### Envio de mensagem
1. UI chama `evolution-send` com `lead_id` + `content` (+ `client_message_id` UUID).
2. Função insere localmente como `status='pending'` e dispara `POST` à Evolution.
3. Evolution responde com o `external_id`; função atualiza a linha local.
4. Quando a Evolution confirmar entrega/leitura, manda `MESSAGES_UPDATE` → `delivery_status` é atualizado.

### Reconciliação manual
- Botão de refresh no chat chama `evolution-sync-lead` com `silent: true`.
- Função busca histórico do contato e ingere apenas itens com `timestamp > max(local)`.

### Abertura de conversa (sem flicker)
- `ChatPane` **não** dispara sync automático ao abrir. Apenas carrega o histórico uma vez.
- `mergeMessage` ignora a chave `raw` (sempre nova referência) e compara só campos visíveis.
- `useRealtimeList` ignora UPDATEs de leads que não mudam campos de UI (`LEAD_RENDER_KEYS`).

## Decisões de design

- **Idempotência no servidor**: simplifica o cliente e evita ping-pong de eventos Realtime.
- **Realtime incremental no cliente**: nada de `refetch` global — patches em memória.
- **RLS aberta**: o produto é um CRM interno; auth ainda não foi adicionada. Para multi-tenant será preciso introduzir `auth.users`, `user_roles` e RLS por organização.
