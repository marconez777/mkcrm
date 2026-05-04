
## Estado atual

No `Composer.tsx`, o botão de anexo (clipe) está **desabilitado** com tooltip "Anexos em breve". A função `evolution-send` envia apenas texto (`/message/sendText`). Não há bucket de storage configurado e o webhook já recebe mídias (renderiza `media_url`/`media_mime`), mas o envio CRM → WhatsApp de mídia não existe.

## O que vou implementar

### 1. Storage para anexos
Criar bucket público `chat-attachments` com policies para usuários autenticados fazerem upload. Mídias enviadas ficam acessíveis por URL pública (necessário para a Evolution API baixar e reenviar ao WhatsApp).

### 2. Nova edge function `evolution-send-media`
Espelha a lógica de `evolution-send` (idempotência por `client_message_id`, retries, atualização de `messages` e `leads`), mas chama o endpoint correto da Evolution:

- **Imagem/Vídeo/Documento** → `POST /message/sendMedia/{instance}` com body:
  ```json
  { "number": "...", "mediatype": "image|video|document",
    "mimetype": "...", "media": "<url pública>",
    "fileName": "...", "caption": "..." }
  ```
- **Áudio (PTT)** → `POST /message/sendWhatsAppAudio/{instance}` com `{ "number", "audio": "<url>" }`

Insere `messages` com `message_type` correto (image/video/document/audio), `media_url`, `media_mime`, e `content` = caption/filename.

### 3. UI no `Composer.tsx`
- Habilitar o botão clipe → abre `<input type="file">` (aceita `image/*,video/*,audio/*,application/pdf,...`, max 16MB — limite do WhatsApp).
- Após seleção, mostra um **preview compacto acima do textarea** (thumbnail para imagem, ícone+nome para outros) com botão X para cancelar.
- Textarea passa a servir de **caption** opcional.
- Ao clicar Enviar:
  1. Upload para `chat-attachments/{lead_id}/{uuid}-{filename}` via supabase storage.
  2. Pega `publicUrl`.
  3. Chama `supabase.functions.invoke("evolution-send-media", { body: { lead_id, media_url, mime, filename, caption, media_kind, client_message_id } })`.
- Indicador de upload (spinner no botão).

### 4. Renderização (já existe parcialmente em ChatPane)
Verificar/ajustar bubble para mostrar `<img>`, `<video controls>`, `<audio controls>` e link de download para documentos com base em `message_type` + `media_url`. Vou garantir que mensagens enviadas (`from_me=true`) com mídia também usem `media_url`.

## Detalhes técnicos

**Migration SQL:**
```sql
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true);

create policy "auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments');
create policy "public read" on storage.objects for select to public
  using (bucket_id = 'chat-attachments');
create policy "auth delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments');
```

**Limites:** 16MB por arquivo (limite WhatsApp); mostrar erro client-side se exceder.

**Detecção de tipo:**
```ts
const kind = mime.startsWith("image/") ? "image"
  : mime.startsWith("video/") ? "video"
  : mime.startsWith("audio/") ? "audio"
  : "document";
```

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — bucket + policies
- `supabase/functions/evolution-send-media/index.ts` — nova função
- `src/components/inbox/Composer.tsx` — habilitar clipe, upload, preview, envio
- `src/components/inbox/ChatPane.tsx` — confirmar render de mídia outbound (ajuste pequeno se necessário)

## Fora do escopo
- Gravação de áudio direto no navegador (mic) — pode ser próximo passo.
- Envio de múltiplos arquivos por vez — começamos com 1 por mensagem.
- Stickers/figurinhas.

Aprove para eu aplicar.
