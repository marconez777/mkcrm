## O que está acontecendo

A função de monitoramento `pipeline-queue-alert` (roda a cada 10 min) envia os alertas "MKCRM Alerta Cloud" por WhatsApp. Ela pega **a primeira instância WhatsApp conectada que encontrar no banco** — sem filtrar por clínica — e usa esse número para mandar a mensagem para o seu número pessoal.

Resultado: o alerta sai **do número do cliente** (no print, o número da Febracis +1 407 779-4061). Ou seja, ele aparece no WhatsApp do cliente como mensagem enviada por ele, expondo alertas internos de infraestrutura. Confirmado em `supabase/functions/pipeline-queue-alert/index.ts` (linhas 17-43: seleciona `whatsapp_instances` com `connection_state = 'open'`, `limit 1`, e envia para o número fixo do admin).

## Correção

1. **Desligar imediatamente o envio por instância aleatória.** A função só poderá enviar WhatsApp se existir uma instância explicitamente marcada como instância de alertas internos.
2. **Instância dedicada de alertas.** Ler o nome/ID da instância de um secret (`ALERT_WHATSAPP_INSTANCE`) e o destinatário de `ALERT_WHATSAPP_NUMBER`. Se qualquer um faltar, a função **não envia nada** — apenas registra em `error_events` e no log da função.
3. **Anti-spam.** Os alertas de "Pipeline saturado" e "Quota esgotada" estão repetindo a cada 10 min; aumentar a janela de dedup (pipeline: 30 min → 6 h; quota: 1 h → 12 h por clínica/provider) para não inundar o canal.
4. **Varredura.** Verificar se alguma outra edge function usa o mesmo padrão de "pegar qualquer instância aberta" para mandar mensagem administrativa e aplicar a mesma proteção.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/pipeline-queue-alert/index.ts`.
- `notifyWhatsApp` passa a resolver a instância por `evolution_instance = Deno.env.get("ALERT_WHATSAPP_INSTANCE")` em vez de `.eq("connection_state","open").limit(1)`.
- Sem os secrets configurados, o comportamento padrão vira "somente log em `error_events`" — nenhum cliente recebe nada.
- Deploy da função após a alteração.

Se preferir, posso simplesmente **remover o envio por WhatsApp** e deixar os alertas só no painel/`error_events` — me diga qual dos dois você quer que eu implemente.