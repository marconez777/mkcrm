# Corrigir avanço entre partes em disparo em massa

## Diagnóstico

Pelos eventos e pelo banco:
- Cron `broadcast-tick` roda a cada 1 minuto.
- Quando um grupo tem várias partes, o tick envia a parte 1, agenda `next_send_at = +3s` e termina. A parte 2 só é enviada no **próximo tick do cron** (até ~60s depois), deixando o destinatário travado em `sending` no painel.
- Quando uma recipiente "completa" (`allDone`), o tick faz `break` e também depende do cron para começar o próximo destinatário.

Resultado: campanhas com múltiplas partes ou múltiplos contatos parecem "paradas".

> Observação separada: só uma mensagem chegou no WhatsApp porque o número da Keila não existe no WhatsApp — a Evolution API retorna 200 mesmo quando o número não está cadastrado. Isso não é bug do nosso código; é uma limitação da resposta do `sendText`. Não trato nesse plano.

## Mudanças

### `supabase/functions/broadcast-tick/index.ts`

1. Adicionar helper `triggerTick()` (fire-and-forget POST para o próprio endpoint, igual ao já existente em `broadcast-control`).
2. **Após enviar uma parte intermediária com sucesso** (não-última do grupo): chamar `triggerTick()` antes de continuar/retornar. Como `next_send_at = now()+3s`, o próximo tick processa essa mesma recipiente em ~3s, sem esperar o cron.
3. **Após completar um destinatário (`allDone`)**: também chamar `triggerTick()`. Como o próximo `next_send_at` respeita `throttle_seconds`, o tick chegará "cedo" mas o filtro `lte("next_send_at", now)` ainda respeita o throttle (nada é enviado antes da hora). Isso só serve para encadear destinatários sem esperar o cron.
4. Manter `limit(3)` por tick para não saturar a Evolution.

### Sem alterações em UI ou banco.

## Resultado esperado

- Em um grupo de 2 partes, parte 2 sai ~3s depois da parte 1 (e o destinatário vira `sent` no painel).
- Próximo destinatário começa imediatamente após o throttle, sem esperar o minuto do cron.
- Cron continua existindo como rede de segurança caso um `triggerTick` falhe.
