# Correção definitiva da duplicação de conversas

## Causa raiz (confirmada nos dados)

A Evolution API está entregando mensagens com **endereçamento LID** (WhatsApp Multi-Device). Exemplo real do banco:

```json
"key": {
  "addressingMode": "lid",
  "remoteJid":    "222041840046305@lid",          // ID interno, NÃO é telefone
  "remoteJidAlt": "5511915142236@s.whatsapp.net", // telefone real
  "id": "2A1847E7D7E26055EC3D"
}
```

Hoje:
- `phoneFromJid` recebe só `remoteJid` e, ao ver `@lid`, **descarta a mensagem** (perda de dados).
- Para mensagens antigas que ainda não eram filtradas, criou-se um lead com o LID como "telefone" (`222041840046305`, `108933356196036`, etc.) — daí as conversas duplicadas com perfil/nome diferentes do real.
- A migration anterior só consolidou parte do histórico; novas mensagens continuam chegando e:
  - ou são silenciosamente puladas,
  - ou (em endpoints como `chat/findMessages` do health-poll) recriam o lead duplicado, gerando `duplicate key value violates unique constraint "leads_phone_key"` no log.

A informação correta **já vem na própria payload** em `key.remoteJidAlt` — só não estava sendo usada.

## Solução

### 1. Resolver telefone a partir do objeto `key` inteiro

Em `supabase/functions/_shared/evolution.ts`:

- Nova função `phoneFromKey(key)` que escolhe o JID na ordem:
  1. Se `addressingMode === "lid"` ou `remoteJid` termina em `@lid` → usa `remoteJidAlt`.
  2. Senão usa `remoteJid`.
  3. Para grupos (`@g.us`), considera `participantAlt`/`participant` para identificar o remetente individual (apenas se quisermos tratar grupos depois — por ora continua retornando null para grupos).
- Mantém validação 8–15 dígitos.
- `phoneFromJid` continua exportada (compatibilidade), mas chama a nova lógica.

### 2. Atualizar callers

- `ingestMessage` (`_shared/evolution.ts`): trocar `phoneFromJid(item.key.remoteJid)` por `phoneFromKey(item.key)`. Também passar `pushName` e tentar capturar avatar do `profilePicUrl` se vier.
- `evolution-webhook` `CONTACTS_UPSERT`: contatos LID vêm com `id: "...@lid"` e às vezes campo `jid` ou `remoteJidAlt`. Resolver usando o mesmo helper, e em último caso ignorar (não dá pra "atualizar nome" sem telefone real).

### 3. Migration de consolidação (idempotente)

Para cada lead "duplicado por LID" (heurística: `length(phone) > 13` ou phone que aparece como `remoteJid` LID em `messages.raw`):

1. Descobrir o telefone real via `messages.raw->'key'->>'remoteJidAlt'` do próprio lead.
2. Garantir que existe um lead canônico com esse telefone (criar se faltar, copiando nome/avatar).
3. Repointar tudo para o canônico:
   - `messages` (deduplicando por `external_id` antes de mover, para não bater na unique key)
   - `lead_internal_notes`, `lead_tasks`, `lead_events`, `scheduled_messages`, `lead_ai_settings`, `ai_threads`, `automation_runs`
4. Apagar o lead LID.
5. Recalcular `last_message_at`, `last_message_preview`, `unread_count` no canônico.

Constraint `leads_phone_key` (única) é mantida — ela é o que garante que não voltem duplicatas.

### 4. Endurecer o poll

`evolution-health/pollRecentMessages` hoje engole o erro `23505` só no log. Como o ingest novo já vai usar o telefone real, o erro some. Adicionar tratamento explícito: se `error.code === '23505'`, contar como `skipped` em vez de `error` (defesa em profundidade contra payloads sem `remoteJidAlt`).

### 5. Verificação pós-deploy

- Rodar `select count(*) from leads where length(phone) > 13;` → deve voltar 0.
- Selecionar uma conversa e confirmar que não há mais entrada duplicada na lista do Inbox.
- Observar logs do `evolution-health` por alguns minutos: sem `duplicate key` novos.

## Arquivos

- `supabase/functions/_shared/evolution.ts` — nova `phoneFromKey`, ajuste do `ingestMessage`.
- `supabase/functions/evolution-webhook/index.ts` — usar helper para CONTACTS_UPSERT e MESSAGES_UPSERT path direto.
- `supabase/functions/evolution-health/index.ts` — tratamento defensivo do 23505.
- `supabase/migrations/<novo>.sql` — consolidação dos LIDs remanescentes.

## Por que isso resolve de verdade

A correção anterior tratava o LID como "lixo a descartar". Mas o WhatsApp Business com Multi-Device passou a usar LID como modo padrão de endereçamento — descartar = perder mensagens E ainda assim criar duplicatas em paths que não filtravam. A solução correta é **traduzir LID → telefone real** usando o `remoteJidAlt` que a própria Evolution já fornece, fazendo com que toda mensagem do mesmo contato caia sempre no mesmo lead.
