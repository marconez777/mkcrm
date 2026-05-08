## Diagnóstico

A migração de segurança tornou o bucket `chat-attachments` privado e criou políticas RLS que assumem que cada arquivo está sob `<lead_id>/<arquivo>`. Mas o webhook salva como `<message_id>/<arquivo>`. Resultado: ao tentar gerar signed URL no cliente, o storage responde **404 "Object not found"** (404 mascarado de RLS deny). Daí imagens não carregam, áudio não toca e PDF não abre.

Confirmado nos logs de rede: `POST /storage/v1/object/sign/chat-attachments/<message_id>/...` → `404 not_found`. E em `storage.objects` os arquivos existem exatamente com esse path.

Há também uma política duplicada bugada que compara `l.id` com `split_part(l.name, '/', 1)` (compara o id do lead com o nome da pessoa) — inútil.

## Solução

Migração SQL para reescrever as políticas de `storage.objects` do bucket `chat-attachments`:

1. Dropar todas as 6 políticas atuais do bucket (`chat-attachments clinic read/insert/delete` + `chat_attachments_clinic_read/insert/delete`).
2. Criar 3 novas políticas (SELECT/INSERT/DELETE) para `authenticated` que validam via `messages` → `leads`:

```sql
EXISTS (
  SELECT 1
  FROM public.messages m
  JOIN public.leads l ON l.id = m.lead_id
  WHERE m.id::text = split_part(objects.name, '/', 1)
    AND l.clinic_id = public.current_clinic_id()
)
```

3. Manter o bucket privado (não regredir segurança).

Sem mudanças de código frontend — o `useSignedMediaUrl` já está correto e passará a funcionar assim que o RLS deixar a assinatura acontecer.

## Fora de escopo

- Não mexer nas políticas de `task-attachments` (estrutura `<task_id>/...` está correta).
- Não rodar backfill nem mudar webhook.
