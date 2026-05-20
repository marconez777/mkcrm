## Diagnóstico

Olhando os eventos da campanha:

```
14:58:37  g1 p1   ← contato A, parte 1
14:58:41  g2 p1   ← contato B, parte 1  (só 4s depois!)
14:58:44  g1 p2
14:58:47  g2 p2
14:58:50  g1 p3
14:58:53  g2 p3
14:58:55  done
```

Os dois contatos estão sendo enviados **em paralelo intercalado**, com ~3s entre eles, em vez de A terminar todas as partes e só então (após 15 min) começar B.

### Causa raiz

No `broadcast-tick`, o throttle de 15 min entre contatos só é empurrado para os demais pendentes **quando `allDone` é verdadeiro** (contato terminou todas as partes). Mas:

1. Tick 1 envia A parte 1, define `next_send_at = now+1s` para A, e dispara `triggerTick()`.
2. Tick 2 (encadeado) busca o próximo recipient com `next_send_at <= now`. Como B nunca foi empurrado, B está pendente com `next_send_at` antigo → tick pega B em vez de A.
3. Envia B parte 1, define B `next_send_at = now+1s`, dispara tick.
4. Tick 3 pega A (vencido há mais tempo), envia A parte 2… e assim por diante, intercalando.

O throttle entre contatos nunca é aplicado durante o envio das partes — só no final, quando já é tarde.

## Correção

### `supabase/functions/broadcast-tick/index.ts`

Aplicar o throttle de "intervalo entre contatos" assim que um contato **começa** (envia a primeira parte com sucesso), não só quando termina. Isso "reserva" o contato atual como o único ativo até ele completar.

Mudanças pontuais no bloco `if (ok)`:

1. Detectar início de contato: `const isFirstPart = partIndex === 0;`
2. **Se `isFirstPart && !allDone`** (contato começou e ainda tem mais partes): empurrar todos os **outros** destinatários pendentes (`.neq("id", r.id)`) por `throttleMs`, igual já é feito no `allDone`. Assim, enquanto A envia as partes 2 e 3 com intervalo de 1s, B fica travado em `next_send_at = agora + 15min`.
3. **No `allDone`** (último contato do batch ou contato de parte única): manter o push atual de `throttleMs` para os pendentes (mesmo comportamento de hoje), garantindo que mesmo após terminar o último contato o próximo só comece depois do intervalo.
4. Manter `triggerTick()` para encadear as próximas partes do mesmo contato.

Resultado esperado:

```
14:58:37  A p1
14:58:38  A p2   (1s)
14:58:39  A p3   (1s)
15:13:39  B p1   (15 min depois de A começar)
15:13:40  B p2
15:13:41  B p3
```

### Sem alterações em UI, banco ou outras funções.

## Observações

- O `triggerTick()` continua sendo chamado entre partes do mesmo contato (intervalo de 1s respeitado pelo filtro `lte("next_send_at", now)`).
- O push usa `.lt("next_send_at", pushUntil)` para nunca **adiantar** algo que já estava agendado para mais tarde.
- O claim atômico já existente impede que dois ticks concorrentes peguem o mesmo destinatário.
