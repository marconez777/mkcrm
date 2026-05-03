# Modelo de Dados

Todas as tabelas vivem no schema `public`. RLS habilitada com policy `public_all` (acesso total — projeto single-tenant).

## Tabelas

### `pipeline_stages`
Colunas do Kanban.
- `id uuid pk`, `name text`, `position int`, `color text`, `created_at`.

### `attendants`
Operadores do CRM.
- `id uuid pk`, `name text`, `color text`, `created_at`.

### `leads`
Contato/negócio (1:1 com telefone).
- `id uuid pk`, `phone text unique`, `name`, `email`, `company`, `deal_value numeric`, `notes`.
- `tags text[]`, `custom_fields jsonb`.
- `stage_id` → `pipeline_stages`, `attendant_id` → `attendants`, `position int`.
- `avatar_url`, `unread_count int`, `last_message_at`, `last_message_preview`.
- `stage_changed_at`, `created_at`, `updated_at`, `archived_at`.

### `messages`
- `id uuid pk`, `lead_id uuid` → `leads`.
- `external_id text` (id do Evolution), `client_message_id uuid` (idempotência no envio).
- `from_me bool`, `message_type text`, `content text`, `media_url`, `media_mime`.
- `status` (`pending|sent|received|failed`), `delivery_status` (`sent|delivered|read|...`).
- `reply_to_external_id text`, `raw jsonb` (payload bruto do Evolution).
- `timestamp`, `created_at`, `retry_count`, `last_error`.
- **Índice único** sugerido: `(lead_id, external_id)` para idempotência.

### `lead_events`
Auditoria de eventos do lead.
- `id`, `lead_id`, `type` (`stage_changed`, `attendant_changed`, ...), `payload jsonb`, `created_at`.

### `lead_custom_fields`
Definição de campos customizados exibidos no ContextRail.
- `id`, `field_key`, `label`, `field_type` (`text|number|select|...`), `options jsonb`, `position`.

### `quick_replies`
- `id`, `shortcut`, `content`, timestamps.

### `settings` (linha única, `id=1`)
- `evolution_url`, `evolution_api_key`, `evolution_instance`.
- `webhook_token` (gerado), `webhook_ok`, `webhook_last_set_at`, `webhook_last_error`.
- `connection_state`, `last_health_check`, `last_poll_at`.

### `webhook_events`
Auditoria de cada chamada recebida do Evolution.
- `id`, `event_type`, `source` (`webhook|sync|poll`), `payload jsonb`, `lead_id`.
- `received_at`, `processed_at`, `error`.

## Funções

| Função | Descrição |
|---|---|
| `set_updated_at()` | Trigger genérica para `updated_at`. |
| `set_stage_changed_at()` | Atualiza `stage_changed_at` ao trocar `stage_id`. |
| `increment_unread(lead_id, preview, ts)` | Atomic +1 em `unread_count` + atualização de preview. |
| `log_lead_changes()` | Grava `lead_events` ao mudar `stage_id`/`attendant_id`. |
| `cleanup_webhook_events()` | Remove eventos com mais de 14 dias (rodar via cron). |

## Realtime

Tabelas publicadas em `supabase_realtime`: `leads`, `messages`, `pipeline_stages`, `attendants`, `quick_replies`. Os hooks do frontend assinam por tabela.
