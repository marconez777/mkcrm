---
title: "Storage / Uploads / Assets"
topic: architecture
kind: map
audience: agent
updated: 2026-07-01
summary: "Mapa dos buckets Supabase Storage do Chat Funnel AI — chat-attachments, task-attachments, email-assets, estudo-cache — políticas RLS, uploads no frontend e assets estáticos servidos via CDN Lovable."
code_refs:
  - src/lib/tasks-board.ts
  - src/components/inbox/Composer.tsx
  - src/components/email/editor/Inspector.tsx
  - supabase/functions/transcribe-audio/
  - supabase/migrations/20260504190039_c9ff65b8-2d89-4c66-9b64-db43961111a2.sql
  - supabase/migrations/20260505224728_53f1b374-e275-41bd-bd4e-f1e57e059fc8.sql
  - supabase/migrations/20260507204807_180d94d4-cbe8-4e02-9c1e-74286524d667.sql
  - supabase/migrations/20260508154555_ddfb1530-b14f-40ab-9285-9588eac5735f.sql
  - supabase/migrations/20260508160352_fdeaf188-d1b9-4ee8-aa0b-211bc529e198.sql
  - supabase/migrations/20260508171715_e11aa0b3-e475-437d-b6a5-486e094479b8.sql
  - supabase/migrations/20260520200504_ca15962d-4e28-4bdc-a02f-27c881400e29.sql
  - supabase/migrations/20260527222206_ba34dac1-08b0-440b-81a6-cba2863be0f9.sql
  - supabase/migrations/20260701033909_eee2017e-ef9c-4538-bfef-1c59081cd249.sql
related_docs:
  - docs/maps/INBOX_KANBAN_LEADS.md
  - docs/maps/EMAIL_MARKETING.md
  - docs/maps/TASKS.md
---

# Storage / Uploads / Assets

Este mapa cobre **tudo que envolve arquivos binários** no projeto: buckets do
Supabase Storage, políticas RLS por bucket, sites de upload no frontend, uso
em edge functions e assets estáticos externalizados via CDN Lovable
(`/__l5e/assets-v1/...`).

## 1. Inventário de buckets

| Bucket             | Público | Criado em                                | Papel                                                               | Path convention                        |
| ------------------ | ------- | ---------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `chat-attachments` | ❌ priv | `20260504190039` (privado desde `20260507204807`) | Anexos WhatsApp/inbox (imagens, áudios, docs recebidos e enviados).  | `<message_id>/<filename>`              |
| `task-attachments` | ❌ priv | `20260505224728` (privado desde `20260507204807`) | Anexos de tarefas (Kanban de tarefas).                              | `<task_id>/<timestamp>_<safeName>`     |
| `email-assets`     | ✅ pub  | `20260520200504`                         | Imagens embutidas em templates/campanhas do e-mail marketing.        | `<user_id>/<filename>` (dono = auth.uid) |
| `estudo-cache`     | ❌ priv | (legado; sem policies via `20260701033909`) | Bucket residual; **acesso negado explicitamente** para authenticated e anon. Uso interno via service_role apenas. | n/a                                     |

Não existem outros buckets. `docs-index`/`docs-content` são JSONs em `public/`
servidos pelo Vite, não pelo Storage.

## 2. Políticas RLS (`storage.objects`) por bucket

### 2.1 `chat-attachments` (privado, escopo por clínica via `messages → leads`)

Migração vigente: `20260508171715_*.sql`

- **SELECT / INSERT / DELETE** `TO authenticated` filtram por:
  ```sql
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.leads l ON l.id = m.lead_id
    WHERE m.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
  ```
- O primeiro segmento do path **precisa ser um `message_id` válido** — quem gerar path fora desse formato é bloqueado.
- Não há política de UPDATE (rename/move não é usado; se necessário no futuro, copiar + delete).

### 2.2 `task-attachments` (privado, escopo por clínica via `tasks → clinic_id`)

Migração vigente: `20260508154555_*.sql`

- SELECT / INSERT / UPDATE / DELETE `TO authenticated` verificam que
  `split_part(objects.name, '/', 1)` é um `task_id` cujo `clinic_id` bate com
  `current_clinic_id()`.

### 2.3 `email-assets` (público read, escrita autenticada, mutação restrita ao dono)

Migrações: `20260520200504_*.sql` (criação) + `20260527222206_*.sql` (hardening).

- **SELECT**: público (`bucket_id = 'email-assets'`, sem filtro de role) — imagens embutidas em e-mails precisam ser acessíveis sem token.
- **INSERT**: `TO authenticated` (qualquer usuário logado; owner definido automaticamente pelo Storage).
- **UPDATE / DELETE**: apenas quando `owner = auth.uid()`. Impede que um usuário apague ou sobrescreva assets subidos por outro membro da clínica.

### 2.4 `estudo-cache` (deny-all para authenticated/anon)

Migração: `20260701033909_*.sql`

- Duas policies `FOR ALL` em `storage.objects` com `USING (bucket_id <> 'estudo-cache')` para `authenticated` e `anon`.
- Efeito: qualquer request de client (mesmo com token válido) que tocar em objetos deste bucket é rejeitado. Só `service_role` (edge functions com `SUPABASE_SERVICE_ROLE_KEY`) consegue ler/escrever.

## 3. Sites de upload no frontend

| Arquivo                                       | Bucket             | Path gerado                              | Observações                                                                                                       |
| --------------------------------------------- | ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/inbox/Composer.tsx:145`       | `chat-attachments` | `${messageId}/${filename}`               | Cria a mensagem no banco **antes** do upload para que o path bata com a RLS (o `message_id` precisa existir).      |
| `src/lib/tasks-board.ts:153` (`uploadAttachment`) | `task-attachments` | `${taskId}/${Date.now()}_${safeName}`    | Sanitiza nome com regex `[^\w.\-]+`. Registra metadata em `task_attachments`.                                     |
| `src/components/email/editor/Inspector.tsx:35`| `email-assets`     | escolhido pelo editor (`upsert: false`)  | Usado no builder de templates/campanhas. URL público colado direto no HTML.                                       |

Não há uploads em nenhuma outra tela — logos, avatares e assets de branding são estáticos (ver §5) ou hospedados externamente.

## 4. Uso em edge functions

- **`supabase/functions/transcribe-audio/index.ts`**: quando recebe uma URL Storage (`supabase://<bucket>/<path>` ou similar), gera um **signed URL de 10 min** via `supabase.storage.from(bucket).createSignedUrl(path, 600)` e envia para o Whisper. Roda com service_role, então acessa buckets privados sem depender da RLS.
- Nenhuma outra edge function faz upload direto para o Storage. Anexos recebidos via webhook do Evolution são baixados por URL pública do próprio WhatsApp e re-postados em `chat-attachments` pelo Composer/handlers do inbox (não pelas edges).

## 5. Assets estáticos (CDN Lovable, não Storage)

Assets binários pesados foram migrados para o CDN Lovable via `.asset.json`. Não confundir com Storage:

- Logos, favicons e imagens do site institucional/onboarding vivem em `src/assets/*.asset.json` e são servidos em `/__l5e/assets-v1/<asset_id>/<filename>` (imutável, cache agressivo).
- Uso típico:
  ```ts
  import logoAsset from "@/assets/chat-funnel-logo.png.asset.json";
  <img src={logoAsset.url} />
  ```
- Substituir/apagar via `lovable-assets create --file ...` e `lovable-assets delete --file ...`. Nunca reintroduzir binários grandes no repo.

## 6. Fluxos ponta-a-ponta

### 6.1 Anexo de inbox (envio outbound)

```text
Composer.tsx
  ├─ insert em messages (obtém message_id)
  ├─ storage.from("chat-attachments").upload(`${message_id}/${file.name}`)
  ├─ update em messages.media_url = signedUrl (renovado sob demanda)
  └─ envia via evolution-send-message; edge devolve chave do WhatsApp
```

RLS garante que somente membros da `clinic_id` dona do lead possam ler o objeto.

### 6.2 Áudio recebido → transcrição

```text
evolution-webhook  →  messages.media_url (link do WhatsApp ou storage://)
frontend           →  transcribe-audio (com body { message_id })
transcribe-audio   →  createSignedUrl (10 min) → Whisper → salva transcript em messages.transcription
```

### 6.3 Anexo de tarefa

```text
tasks-board.ts:uploadAttachment
  ├─ storage.from("task-attachments").upload(`${task_id}/...`)
  └─ insert em task_attachments (storage_path, file_name, mime_type, size_bytes)
```

Delete manual precisa **remover o objeto do bucket antes** de apagar a row (ordem inversa causa órfão).

### 6.4 Imagem em campanha de e-mail

```text
Inspector.tsx (editor)
  ├─ storage.from("email-assets").upload(path, { upsert: false })
  └─ getPublicUrl → cola no HTML da campanha
```

Como o bucket é público read, a URL final vai direto no e-mail sem transformação.

## 7. Invariantes (não quebrar sem ler antes)

1. **Path convention = contrato RLS.** Mudar o layout de path de `chat-attachments` ou `task-attachments` sem atualizar as policies quebra upload/download. As policies leem `split_part(objects.name, '/', 1)`.
2. **Criar mensagem antes de subir anexo em chat.** A RLS de INSERT exige que exista `messages.id` com `lead_id` da clínica atual. Inverter a ordem retorna `new row violates row-level security policy`.
3. **`email-assets` é público read intencionalmente.** Nunca marcar como `public = false` — quebraria todas as imagens embutidas em e-mails já enviados.
4. **`estudo-cache` continua deny-all.** Não adicione policies permissivas para authenticated/anon; se algum dia for necessário expor, criar bucket novo em vez de flexibilizar este.
5. **Nunca fazer `INSERT INTO storage.buckets` via migration em novos buckets.** Usar a tool `supabase--storage_create_bucket` (migrations legadas fizeram INSERT e ainda funcionam, mas o path atual é a tool).
6. **UPDATE/DELETE em `email-assets` só pelo owner.** Se algum fluxo precisar de admin apagar assets de outros usuários, criar edge function com service_role em vez de afrouxar a policy.
7. **Não confundir CDN Lovable (`/__l5e/assets-v1/`) com Storage.** Assets do CDN são imutáveis e não têm RLS — nunca subir dados de cliente por lá.

## 8. Dívidas técnicas

- **Órfãos em Storage**: não há job de limpeza que remova objetos cujo `message_id`/`task_id` foi deletado. Um `cleanup-storage-orphans` cron seria útil.
- **`estudo-cache` sem uso ativo mapeado**: candidato a remoção completa (bucket + objetos) após validar que nenhuma edge escreve nele.
- **Sem quota por clínica**: qualquer usuário pode subir arquivos sem limite de tamanho/quantidade. Considerar `size_bytes` cap no upload do Composer e `tasks-board`.
- **`email-assets` sem GC**: campanhas apagadas deixam imagens orfãs no bucket público. Adicionar limpeza no fluxo de `email-campaigns` delete.
- **Signed URL de áudio expira em 10 min**: se transcrição demorar (Whisper 429/timeout retry), pode falhar. Considerar re-signar dentro do worker.

---

**Fase 11 concluída.** Próxima: **Fase 12 (Integrações externas — Resend, Meta, Google, Stripe, Evolution)** ou seguir a ordem do roadmap `docs/roadmap/DOCS_MAINTENANCE.md`?
