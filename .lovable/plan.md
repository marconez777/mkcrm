# Receber anexos das conversas

## Diagnóstico
Hoje o webhook (`evolution-webhook`) só salva o tipo da mensagem (`image`, `audio`, etc.) e o caption. **Nunca baixa o arquivo binário**, então `messages.media_url` fica `null` e o `MediaBubble` no chat não exibe nada.

Verifiquei no banco: as mensagens recentes do tipo `image` têm `media_url = null`, embora o payload Evolution traga `directPath`/`mediaKey` em `raw.message.imageMessage`.

## Solução
Após persistir uma mensagem nova de mídia, baixar o binário via endpoint da Evolution e subir para o bucket público `chat-attachments`, gravando `media_url` + `media_mime` na linha. Trabalho feito em segundo plano com `EdgeRuntime.waitUntil` para não atrasar a resposta do webhook.

## Mudanças

### `supabase/functions/_shared/evolution.ts`
- Em `extractText`, devolver também `mime` e `fileName` extraídos de `imageMessage`/`videoMessage`/`audioMessage`/`documentMessage`/`stickerMessage`.
- Nova função `downloadAndStoreMedia(messageId, instance, item)`:
  1. `POST {evolution_url}/chat/getBase64FromMediaMessage/{instance}` com `{ message: { key, message } }`.
  2. Decodifica `base64`, infere extensão pelo `mimetype`.
  3. `supabase.storage.from('chat-attachments').upload(\`${messageId}/${external_id}.${ext}\`, bytes, { contentType, upsert:true })`.
  4. `update messages set media_url=publicUrl, media_mime=mime where id=messageId`.
- Helper `shouldFetchMedia(type)` cobrindo image/video/audio/document/sticker.

### `supabase/functions/evolution-webhook/index.ts`
- Após cada `ingestMessage` em `MESSAGES_UPSERT`, se `res.isNew` e o tipo for de mídia, disparar `EdgeRuntime.waitUntil(downloadAndStoreMedia(res.message_id, instance, item))`.

### `supabase/functions/_shared/evolution.ts` — `ingestMessage`
- Retornar também `message_id` (id na tabela `messages`) para permitir o passo acima.
- Quando o item já tem `mediaUrl`/`url` direto no payload da Evolution (alguns webhooks entregam URL pública), usar essa URL como atalho — gravar imediatamente em `media_url`/`media_mime` no insert/update, evitando uma chamada à API.

### Bucket
`chat-attachments` já existe e é público (`Composer.tsx` o usa para envio). Sem migração necessária.

## Comportamento esperado
- Mensagem chega → linha em `messages` salva → poucos segundos depois `media_url` aparece e o cliente já carregando via realtime exibe o preview.
- Falhas no download não bloqueiam o webhook (logado, mensagem fica como texto-placeholder até reprocessar).
- Idempotente: `upsert:true` no Storage; updates só sobrescrevem se a coluna estiver vazia (proteção opcional para não pisar em mídia já enviada por nós).

## Fora de escopo
- Backfill retroativo de mensagens antigas sem mídia (posso fazer em seguida se quiser).
- Reenvio automático em falha (logs já permitem reprocessar manualmente via `evolution-backfill-all`).
