## Diagnóstico

O erro "API key is invalid" vem da clínica **OR**, que no `clinic_email_integrations` está apontada para o secret **`RESEND_API_KEY_OR`**. Nós atualizamos antes a `RESEND_API_KEY` global (e a `RESEND_API_KEY_MKART` continua válida) — mas a chave usada pelos envios da clínica OR é a `RESEND_API_KEY_OR`, e essa está inválida.

Não é limite diário do Resend: o erro de quota seria `rate_limit_exceeded` / `daily_quota_exceeded`.

## Plano

1. **Atualizar o secret `RESEND_API_KEY_OR`** com uma chave válida do Resend, gerada na conta/dominio da clínica OR (Settings → API Keys → Create API Key, com permissão de envio no domínio verificado dessa clínica).
2. Depois da atualização, **reprocessar** os itens `failed` na fila (`/email/queue` → botão Reprocessar) ou esperar o cron consumir os `pending`.
3. Validar pelo `email_send_log` / eventos do webhook que `delivered`/`opened`/`clicked` chegam.

## Observação sobre o "duplicate key violates email_queue_dedup_idx"

Esse toast aparece quando você clica em **Reprocessar** num item que ainda tem registro de dedup ativo — não é o motivo do email não chegar, é só a UI tentando criar um novo enfileiramento ao invés de resetar o existente. Posso, se quiser, em paralelo ajustar o botão "Reprocessar" pra fazer `UPDATE status='pending', attempts=0` em vez de tentar inserir novo registro. Me diz se quer essa correção junto.
