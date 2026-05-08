## Problema

Após a migração de segurança, o bucket `chat-attachments` virou **privado**. Mas as mensagens antigas têm `media_url` salvo como URL pública (`/storage/v1/object/public/chat-attachments/...`), que agora retorna 403. Resultado: imagens não carregam, áudios não tocam, PDFs não abrem.

Também os signed URLs gerados pelo webhook expiram em 7 dias, então mesmo mídia nova vai quebrar com o tempo.

## Solução

Resolver a URL no **cliente**, sob demanda, transformando o caminho do storage em um signed URL fresco (1h) toda vez que renderiza a bolha de mídia.

### Mudanças

1. **Novo helper `src/lib/media-url.ts`**
   - `extractStoragePath(url)`: detecta URLs de `chat-attachments` (públicas ou assinadas) e extrai o `path`.
   - `useSignedMediaUrl(url)`: hook que retorna `{ url: signedOrOriginal, loading }`. Faz `supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)` com cache em memória por path (evita re-assinar a cada render). Se a URL não for do bucket privado, retorna como está.

2. **`src/components/inbox/MediaBubbles.tsx`**
   - `WhatsAppImage`, `WhatsAppAudio`, `WhatsAppVideo`, `WhatsAppDocument`: trocar uso direto de `m.media_url` por `useSignedMediaUrl(m.media_url)`. Mostrar skeleton enquanto resolve.
   - `downloadFile` também passa a usar a URL resolvida.

3. **`src/pages/LeadDrawer.tsx`** (se renderizar mídia direto — verificar). Sem mudança se só mostra texto.

### Detalhes técnicos

- O path é extraído via regex tolerante a `/object/public/chat-attachments/<path>` e `/object/sign/chat-attachments/<path>?token=...`.
- Cache simples `Map<path, {url, exp}>`; reassina quando faltam <5min.
- Sem mudança no schema nem nos edge functions — o webhook continua salvando signed URL (que serve como fallback / contém o path).
- Sem migração SQL.

## Fora de escopo

- Não vou tornar o bucket público de novo (regrediria a segurança aprovada).
- Não vou rodar backfill para reescrever `media_url` — o cliente resolve dinamicamente, então URLs antigas funcionam imediatamente.
- O segundo bug ("erro ao abrir janela esquerda") fica para próxima mensagem — preciso saber qual painel e qual erro exato (não há runtime error capturado no momento).
