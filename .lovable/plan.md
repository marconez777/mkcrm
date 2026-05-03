# Estabilizar abertura de conversas (sem piscar)

## Causa raiz

Ao abrir qualquer conversa, o `ChatPane` dispara em background `evolution-sync-lead`, que **re-ingere as últimas 50 mensagens** do Evolution. O `ingestMessage` compartilhado:

1. Faz `upsert` em `messages` com `ignoreDuplicates: false` → cada linha existente recebe UPDATE → realtime envia evento UPDATE para todas as 50 → o `ChatPane` aplica `mergeMessage` 50 vezes (mesmo com guarda de "changed", o objeto `raw` é referência nova → sempre marca como changed).
2. Para cada mensagem `!fromMe` chama `increment_unread` → **a contagem de não lidas sobe artificialmente** a cada abertura, e logo depois o `ChatPane` reseta para 0 → daí o "piscar" do badge na lista lateral.
3. Atualiza `last_message_at`/`preview` em `leads` → dispara UPDATE em leads → re-render da lista.

Resumo: abrir o chat = tempestade de eventos realtime, mesmo quando nada novo chegou.

## Mudanças

### 1. `supabase/functions/_shared/evolution.ts` — `ingestMessage` idempotente
- Antes do `upsert`, fazer `select id, content, status, raw` em `messages` por `(lead_id, external_id)`.
- Se já existe e nada relevante mudou (`content`, `status`, `reply_to_external_id`) → **return early**, sem tocar em `messages` nem em `leads`.
- Se existe mas mudou (ex.: status ack/read), fazer `update` apenas dos campos alterados (não reescrever `raw` se igual estruturalmente).
- Só chamar `increment_unread` / atualizar `last_message_*` quando a mensagem é **realmente nova** (não existia).
- Mesma lógica vale para o caminho do webhook — corrige duplicação de unread se webhook + sync chegarem juntos.

### 2. `supabase/functions/evolution-sync-lead/index.ts` — sync manual
- Adicionar parâmetro `silent: boolean` (default `true` quando vindo do auto-open). No modo silent, passar uma flag para `ingestMessage` que **nunca** incrementa unread nem atualiza preview do lead — apenas insere mensagens faltantes.
- Buscar timestamp da última mensagem local (`select max(timestamp) where lead_id`) e enviar para o Evolution como filtro (quando suportado) ou filtrar localmente após receber, ingerindo só itens com `timestamp > last_local`.

### 3. `src/components/inbox/ChatPane.tsx` — não auto-sincronizar
- Remover a chamada automática a `evolution-sync-lead` no mount. O webhook já mantém a conversa em tempo real; sync é redundante.
- Manter o botão de refresh manual no header (esse continua chamando sem `silent`, com toast).
- Opcional: chamar sync **uma vez por sessão por lead** usando um `Set<string>` em ref no componente pai, e somente se a última mensagem local for mais antiga que ~5min.

### 4. `src/hooks/useCrm.ts` — guarda mais estrita no UPDATE de leads
- Comparar apenas as chaves que a UI realmente exibe (`name, last_message_at, last_message_preview, unread_count, stage_id, attendant_id, tags, archived_at, position`). Ignorar diferenças em `updated_at`/`raw` que não afetam render. Isso evita re-sort/re-render quando só timestamps internos mudam.

### 5. `src/components/inbox/ChatPane.tsx` — `mergeMessage` mais estrito
- Ao comparar `row` vs `cur`, ignorar a chave `raw` (sempre referência nova vinda do realtime). Comparar somente: `content, status, delivery_status, reply_to_external_id, timestamp, message_type`.

## Resultado esperado
- Abrir uma conversa: carrega histórico uma vez, sem disparar sync nem eventos realtime em massa.
- Badge de não lidas: desce para 0 e fica estável (sem subir/descer).
- Lista lateral: sem flicker; só re-renderiza quando uma mensagem **nova de verdade** chega via webhook.
- Botão de refresh manual continua funcionando para quem quiser forçar reconciliação.
