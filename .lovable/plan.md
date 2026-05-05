# Corrigir download de anexos do WhatsApp

## Diagnóstico

Confirmei no banco: a mensagem cuja imagem você baixou tem `media_url = https://mmg.whatsapp.net/...` — ou seja, **estamos salvando a URL bruta que vem dentro de `imageMessage.url` do payload da Evolution**.

Essas URLs do WhatsApp **não retornam o arquivo final**: o conteúdo é criptografado com a `mediaKey` da mensagem. Quando o navegador faz `fetch()` nessa URL, recebe bytes cifrados, salva como `.jpg`, e nenhum visualizador consegue abrir (foi exatamente o arquivo `AQMd5Ddo8_...` de 201 KB que apareceu nos seus downloads).

A função `downloadAndStoreMedia` (que usa `getBase64FromMediaMessage` e descriptografa do lado do servidor) existe e funciona — mas o "atalho de URL direta" que adicionamos antes está sobrescrevendo isso e impedindo o caminho correto de rodar.

## Mudanças

### `supabase/functions/_shared/evolution.ts`
- Em `extractText`, **parar de devolver `directUrl`** vindo de `imageMessage.url`/`videoMessage.url`/`audioMessage.url`/`documentMessage.url`/`stickerMessage.url`. Esses campos são sempre URLs criptografadas do WhatsApp.
- Em `ingestMessage`, **remover o atalho `isHttpUrl`** que gravava `media_url = directUrl` direto no insert/update. Toda mídia passa a depender do `downloadAndStoreMedia` em background.
- Manter `needs_media: isMediaType(type)` (sem o `&& !isHttpUrl`), garantindo que toda mensagem de mídia nova dispara o download via Evolution.

### Backfill das mensagens já quebradas
Migration única para limpar o estrago já gravado:
```sql
update messages
set media_url = null, media_mime = null
where media_url like 'https://mmg.whatsapp.net/%'
   or media_url like 'https://media-%.whatsapp.net/%';
```
Isso faz o `MediaBubble` voltar a mostrar `[Imagem]` como fallback (não pior que hoje, que mostra um link quebrado). Não dá para reprocessar automaticamente as antigas porque a Evolution só consegue decifrar mensagens recentes que ainda estão em cache no servidor — por isso só limpamos a URL inválida.

## Resultado esperado
- Mensagem nova de imagem chega → webhook salva linha sem `media_url` → em ~1–2 s, `downloadAndStoreMedia` baixa via Evolution, descriptografa, sobe pro bucket `chat-attachments` e atualiza `media_url` com a URL pública do nosso Storage.
- O botão de download passa a baixar um JPG/PDF/MP4 real, que abre normalmente.

## Fora de escopo
- Recuperar mídias antigas que já foram entregues e cujo cache na Evolution expirou (irrecuperáveis sem reenvio do contato).
