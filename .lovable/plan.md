# Corrigir erro ao enviar mensagem na conversa

## Causa raiz

A edge function `evolution-send` faz:
```ts
.upsert({ ..., client_message_id: cid, ... }, { onConflict: "client_message_id" })
```

Mas a tabela `public.messages` **não possui** constraint/índice único em `client_message_id`. O Postgres responde com `42P10` e a função retorna 500 — a UI exibe "Falha ao enviar: Edge Function returned a non-2xx status code".

## Mudança (1 migration, sem alterações de código)

Criar índice único parcial em `messages.client_message_id` (parcial porque mensagens recebidas via webhook não têm `client_message_id` e há histórico com NULL):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_id_uidx
  ON public.messages (client_message_id)
  WHERE client_message_id IS NOT NULL;
```

Isto:
- Habilita o `ON CONFLICT (client_message_id)` usado por `evolution-send`.
- Garante idempotência real (mesmo `client_message_id` enviado 2x não duplica).
- Não conflita com mensagens existentes que tenham `client_message_id NULL`.

## Validação pós-deploy

1. Enviar uma mensagem de teste pela inbox → deve sair sem erro, status `sent`.
2. Conferir nos logs de `evolution-send` que o `42P10` parou de aparecer.
3. (Opcional) Re-disparar a mesma chamada com o mesmo `client_message_id` → deve retornar `{ ok: true, deduped: true }`.

## Não incluso

- Nenhuma mudança em código TS/edge functions.
- Nenhuma mudança em RLS, types ou UI.
