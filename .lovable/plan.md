## Problema

Os ticks de status no chat (`StatusTicks` em `ChatPane.tsx`) já existem e renderizam corretamente baseado em `messages.delivery_status`. O frontend está OK.

O bug está no backend: a Evolution está enviando os eventos `MESSAGES_UPDATE` com payload **achatado** (campos `keyId`, `messageId`, `status` no nível raiz), mas o webhook `evolution-webhook` lê `it.key.id` (estrutura aninhada que nunca existe nesses eventos). Resultado: `externalId` fica `undefined` e o `UPDATE` nunca acontece — todas as mensagens enviadas ficam para sempre com `delivery_status = null` (apenas um ✓ cinza).

Verificado nos `webhook_events` reais:
```
data: { keyId: "3EB007...", messageId: "...", status: "READ", fromMe: true }
```
e na tabela `messages` essas linhas estão com `delivery_status = null`.

## Correção

### 1. `supabase/functions/evolution-webhook/index.ts` — bloco `MESSAGES_UPDATE`

- Aceitar as duas formas de payload: `it.keyId` (achatado, formato atual da Evolution v2) **ou** `it.key?.id` (formato Baileys clássico).
- Normalizar status da Evolution para os valores que o frontend já entende:
  - `SERVER_ACK` → `sent`
  - `DELIVERY_ACK` → `delivered`
  - `READ` → `read`
  - `PLAYED` → `read` (áudios ouvidos)
  - outros → lowercase do valor original
- **Precedência**: nunca regredir o status (não sobrescrever `read` com `delivered`, nem `delivered` com `sent`). Implementar com um `UPDATE ... WHERE` que só aplica se o novo status tem rank maior, usando uma única query parametrizada.

```ts
const RANK = { sent: 1, delivered: 2, read: 3 };
// after computing newStatus:
const { data: cur } = await supabase
  .from("messages")
  .select("id, delivery_status")
  .eq("external_id", externalId)
  .maybeSingle();
if (cur) {
  const curRank = RANK[(cur.delivery_status ?? "").toLowerCase()] ?? 0;
  const newRank = RANK[newStatus] ?? 0;
  if (newRank > curRank) {
    await supabase.from("messages")
      .update({ delivery_status: newStatus })
      .eq("id", cur.id);
  }
}
```

### 2. Garantir que o webhook na Evolution está inscrito em `MESSAGES_UPDATE`

Já está documentado em `docs/EVOLUTION.md` e no fluxo de salvar webhook. Sem mudanças.

### 3. Realtime

A tabela `messages` já está no Realtime e o `ChatPane` já faz merge de `delivery_status` via `MERGE_KEYS`. Nenhuma alteração necessária — assim que o webhook gravar o valor, o tick atualiza ao vivo.

## Resultado

- ✓ cinza: enviado (`status='sent'`, sem delivery)
- ✓✓ cinza: entregue no aparelho (`delivery_status='delivered'`)
- ✓✓ azul: lido pelo contato (`delivery_status='read'`, inclusive áudios "played")
- ⏱ relógio: pendente
- ⚠ vermelho: falhou

Após o deploy, novas mensagens enviadas passarão a refletir corretamente entrega e leitura. Mensagens antigas continuarão com o status que tinham (não há como reconstituir histórico de ACK).