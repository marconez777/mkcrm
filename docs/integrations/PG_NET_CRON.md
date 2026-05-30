# Integração: pg_net + pg_cron

> **Quando ler:** antes de criar/alterar job agendado, ou debugar trigger que dispara edge function via HTTP.
> **Última atualização:** 2026-05-30

---

## O que são

- **`pg_net`**: extensão Postgres que permite `net.http_post()` / `net.http_get()` direto do banco. Usado para invocar edge functions a partir de triggers, sem o frontend.
- **`pg_cron`**: scheduler estilo cron dentro do banco. Roda funções/SQL em horário fixo.

Ambas habilitadas no schema `extensions` (padrão Supabase).

---

## Jobs cron ativos

| Nome do job | Frequência | O que faz |
|---|---|---|
| `broadcast-tick` | a cada 1 min | processa broadcasts running |
| `sequence-tick` | a cada 1 min | avança sequences |
| `automations-tick` | a cada 1 min | avalia regras agendadas (before_appointment, no_reply_after) |
| `email-automations-tick` | a cada 1 min | mesma ideia, lado email |
| `process-scheduled-campaigns` | a cada 1 min | inicia campanhas com schedule_at vencido |
| `process-email-queue` | a cada 30 s | drena fila de emails transacionais |
| `evolution-health` | a cada 5 min | confere status de cada instância |
| `classifier-daily-batch` | diário (03:00 BRT) | classificação IA em lote |
| `daily-summary` | diário (08:00 BRT) | envia resumo por email para cada user |
| `ai-spend-notify` | de hora em hora | checa budget, notifica/pausa |
| `scheduled-dispatcher` | a cada 1 min | utilitário genérico (futuro) |

Listar tudo: `SELECT * FROM cron.job;`
Histórico: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;`

---

## Padrão de invocação via pg_net

Helper SQL (em `_shared` migrations):

```sql
CREATE OR REPLACE FUNCTION public.invoke_edge_fn(
  fn_name text,
  payload jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  req_id bigint;
BEGIN
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := payload
  ) INTO req_id;
  RETURN req_id;
END;
$$;
```

Configs `app.supabase_url` e `app.service_role_key` são setadas via `ALTER DATABASE ... SET` na migration inicial.

Uso em trigger:
```sql
CREATE TRIGGER tg_lead_after_insert
AFTER INSERT ON leads
FOR EACH ROW EXECUTE FUNCTION fn_after_lead_insert();

-- dentro de fn_after_lead_insert():
PERFORM invoke_edge_fn('sequence-enroll', jsonb_build_object('lead_id', NEW.id));
```

---

## Idempotência e locks

- Ticks usam `pg_try_advisory_xact_lock(<key>)` para evitar dupla execução se o cron atrasar.
- Workers (broadcast/sequence) implementam claims atômicos (`UPDATE ... WHERE status='pending' RETURNING ...`).

---

## Monitoramento

```sql
-- jobs que falharam nas últimas 24h
SELECT jobname, status, return_message, start_time
FROM cron.job_run_details
WHERE status != 'succeeded'
  AND start_time > now() - interval '24 hours'
ORDER BY start_time DESC;

-- requisições pg_net pendentes/falhas
SELECT * FROM net._http_response
WHERE created < now() - interval '5 minutes'
ORDER BY created DESC LIMIT 50;
```

---

## Pegadinhas

- **`net.http_post` é assíncrono**: retorna `request_id` imediatamente; resposta só aparece depois em `net._http_response`. Não use o retorno como sinal de sucesso.
- **`pg_net` engole erros**: edge function 500 não aborta o trigger. Sempre logar do lado da edge function.
- **`pg_cron` em UTC**: schedules são UTC. `08:00 BRT` = `11:00 UTC`. Documentar no comentário do job.
- **Cron job duplicado**: ao redeclarar, usar `cron.unschedule(jobname)` antes de `cron.schedule(...)` — senão dois jobs com mesmo nome.
- **Atraso de cron**: sob carga, jobs de 1min podem disparar a cada ~70s. Workers precisam tolerar (advisory lock).
- **`SECURITY DEFINER` em invoke_edge_fn**: necessário para acessar `current_setting('app.service_role_key')`. Limitar GRANT EXECUTE.
- **service_role_key vazando em log**: nunca logar `headers` do net.http_post. Já mascarado nos helpers, mas cuidado em SQL ad-hoc.

---

## Melhorias sugeridas

- Tabela `cron_failures` populada por trigger em `cron.job_run_details` para alertar via email.
- Limpeza periódica de `net._http_response` (cresce indefinidamente).
- Wrapper síncrono opcional (`net.http_post` + poll) para testes.

---

## Arquivos-chave

- `supabase/migrations/*_pgnet_pgcron_setup.sql`
- `database/FUNCTIONS_TRIGGERS.md`
- `database/MIGRATIONS.md`
- `operations/OBSERVABILITY.md`
