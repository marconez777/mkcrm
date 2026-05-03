# Edge Functions

Localizadas em `supabase/functions/`. Todas em Deno + TypeScript. Helpers comuns em `_shared/evolution.ts`.

| Função | `verify_jwt` | Propósito |
|---|---|---|
| `evolution-webhook` | `false` | Recebe eventos do Evolution (autenticado por `?token=`). |
| `evolution-send` | `false` | Envia mensagem para um lead via Evolution. |
| `evolution-sync-lead` | `true` | Reconciliação sob demanda do histórico de um lead. |
| `evolution-health` | `true` | Health-check da instância. |
| `evolution-test` | `false` | Endpoint utilitário de debug. |

## `_shared/evolution.ts`

- `loadSettings()` → carrega `settings` (id=1).
- `evoFetch(settings, path, init)` → wrapper de `fetch` para Evolution.
- `phoneFromJid(jid)` → extrai telefone de `5511...@s.whatsapp.net`. Ignora grupos `@g.us`.
- `extractText(msg)` → normaliza tipo + conteúdo (texto, imagem, áudio, doc, sticker...).
- **`ingestMessage(item, source, { silent })`** — coração da ingestão:
  1. Resolve/cria lead pelo telefone.
  2. Faz `SELECT` por `(lead_id, external_id)`.
  3. Se existe e nada mudou → return.
  4. Se existe mas mudou (`content`, `status`, `reply_to_external_id`, `message_type`) → `UPDATE` parcial.
  5. Se é nova → `INSERT` + (se não `silent` e não `fromMe`) `increment_unread` + preview.

## `evolution-webhook`
- Valida `?token=` contra `settings.webhook_token`.
- Persiste evento em `webhook_events` (audit-first).
- Trata: `MESSAGES_UPSERT` (ingest), `MESSAGES_UPDATE` (delivery), `CONTACTS_UPSERT` (nome/avatar), `CONNECTION_UPDATE` (state).
- Em erro, grava `error` em `webhook_events`.

## `evolution-send`
Body esperado:
```json
{
  "lead_id": "uuid",
  "content": "texto",
  "client_message_id": "uuid",
  "reply_to_external_id": "string?"
}
```
- Insere localmente `status=pending`.
- `POST` em `/message/sendText/{instance}`.
- Atualiza `external_id` e `status=sent` na resposta. Em falha, `status=failed` + `last_error`.

## `evolution-sync-lead`
Body: `{ lead_id, silent?: boolean }`. Busca via `/chat/findMessages/{instance}`, filtra mensagens com `timestamp > max(local)` e chama `ingestMessage` com `silent` (não infla unread).

## `evolution-health`
Consulta status da instância e atualiza `connection_state` + `last_health_check`.

## Configuração de funções

`supabase/config.toml` define `verify_jwt = false` para `evolution-webhook`, `evolution-send` e `evolution-test`. Demais usam JWT padrão (chamadas via `supabase.functions.invoke` do cliente autenticado/anon).
