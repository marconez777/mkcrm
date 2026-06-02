## Causa raiz

As automações de email têm **dois caminhos paralelos** enfileirando o mesmo email:

1. **Trigger no banco** (`trg_email_on_lead_created` e `trg_email_on_stage_change` na tabela `leads`) — enfileira com `related_lead_table = 'auto_<automation_id>'` e delays **não cumulativos** (todos os steps com mesmo `delay_days`).
2. **Edge function** `email-automations-tick` (cron 5 min) — enfileira com `related_lead_table = 'automation_<automation_id>'` e delays **cumulativos**.

O índice único de dedup em `email_queue` inclui `related_lead_table` na chave, então os dois jobs convivem (prefixos diferentes = chaves diferentes) e ambos são enviados — gerando os duplicados que você vê (4 min ou 24 h de diferença) e estourando o rate limit do Resend (5 req/s) com erro `Too many requests`.

Confirmado em produção: para `allmorais88@gmail.com` / template `pare-de-trocar-de-remedio` existem 2 jobs em `email_queue`, um com prefixo `auto_` e outro com `automation_`, ambos enviados.

## Correção

A fonte da verdade é a edge function `email-automations-tick` (mais nova, tem dedup por `email_automation_enrollments`, suporta segmentos, multi-trigger e delays cumulativos). Os triggers no banco são legado e devem ser removidos.

### 1. Migration

- `DROP TRIGGER trg_email_on_lead_created ON public.leads`
- `DROP TRIGGER trg_email_on_stage_change ON public.leads`
- `DROP FUNCTION public.tg_email_on_lead_created()`
- `DROP FUNCTION public.tg_email_on_stage_change()`
- Limpeza one-shot: `UPDATE email_queue SET status='cancelled' WHERE status='pending' AND related_lead_table LIKE 'auto\_%'` (hoje retorna 0, mas fica como guarda).

### 2. Validação pós-deploy

- Após 1 ciclo do cron (5 min), conferir que novos leads/mudanças de etapa geram **apenas** registros com prefixo `automation_` em `email_queue` e em `email_logs`.
- Re-rodar a query de duplicados (`GROUP BY recipient_email, template_slug HAVING COUNT(*) > 1`) e confirmar que não há novos duplicados após a migration.

### Fora de escopo

- Não vou tocar na fila atual de jobs `automation_*` que já estão enfileirados — eles seguem o fluxo normal.
- Não vou alterar o índice de dedup (continua útil para diferenciar contextos legítimos como `campaign_*`).
- Erros antigos de "Too many requests" nos `email_logs` históricos ficam como estão (são fato histórico).

## Entregáveis

- 1 migration removendo os 2 triggers e as 2 funções, com o cancel defensivo.