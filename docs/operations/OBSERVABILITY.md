# Operações: Observabilidade

> **Quando ler:** antes de debugar bug em produção, ou de adicionar novo log/métrica.
> **Última atualização:** 2026-05-30

---

## Camadas de log

| Camada | Onde | Como acessar |
|---|---|---|
| Edge functions | stdout (Deno) | tool `supabase--edge_function_logs` ou painel Cloud |
| Postgres | `postgres_logs` | tool `supabase--analytics_query` |
| HTTP gateway | `function_edge_logs` | tool `supabase--analytics_query` (status, latency) |
| Auth | `auth_logs` | tool `supabase--analytics_query` |
| pg_net | `net._http_response` | SELECT direto |
| pg_cron | `cron.job_run_details` | SELECT direto |
| Frontend | console do browser | DevTools / `code--read_console_logs` |

---

## Convenções de log nas edge functions

- Prefixo entre colchetes com o nome da função: `[ai-auto-reply] start lead=...`.
- Eventos chave logam um JSON inline: `[broadcast-tick] tick done {"sent":12,"failed":1}`.
- Erros: `console.error('[fn] context', err)` — nunca silenciar.
- **Nunca** logar `service_role_key`, `apikey` do Evolution, conteúdo de mensagens privadas.

Helper recomendado: `_shared/logger.ts` (se existir) — adiciona `clinic_id`, `request_id`.

---

## Tabelas-trilha (audit / timeline)

| Tabela | Propósito | Retenção sugerida |
|---|---|---|
| `lead_events` | timeline do lead | indefinido (negócio) |
| `wa_messages` | histórico WhatsApp | indefinido |
| `email_events` | eventos Resend | 180 dias |
| `ai_runs` / `ai_tool_calls` | rastreio de IA | 90 dias |
| `tracking_events` | eventos web | 90 dias |
| `cron.job_run_details` | execuções cron | 14 dias (auto Supabase) |
| `net._http_response` | respostas pg_net | 7 dias (manual cleanup TODO) |

---

## Queries úteis (cole no SQL)

```sql
-- Edge function com mais erros nas últimas 24h
SELECT m.function_id, count(*) errors
FROM function_edge_logs
  cross join unnest(metadata) m
  cross join unnest(m.response) r
WHERE r.status_code >= 500
  AND timestamp > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC;

-- Latência p95 por função (1h)
SELECT m.function_id,
  approx_percentile(m.execution_time_ms, 0.95) p95
FROM function_edge_logs
  cross join unnest(metadata) m
WHERE timestamp > now() - interval '1 hour'
GROUP BY 1 ORDER BY 2 DESC;

-- Cron jobs falhos hoje
SELECT jobname, status, return_message, start_time
FROM cron.job_run_details
WHERE status != 'succeeded' AND start_time::date = current_date;

-- AI runs com custo > 0.05 USD (suspeito de loop)
SELECT id, lead_id, model, tokens_in, tokens_out, cost_usd, status
FROM ai_runs
WHERE cost_usd > 0.05 AND created_at > now() - interval '7 days'
ORDER BY cost_usd DESC LIMIT 50;
```

---

## Métricas sugeridas (TODO — sem implementação ainda)

- `wa_inbound_to_db_ms` (webhook → insert).
- `ai_run_duration_ms` por modelo.
- `broadcast_send_rate` (msg/s real vs configurado).
- `email_bounce_rate` por domínio/clínica.

Hoje tudo derivado por query ad-hoc. Sem dashboard.

---

## Pegadinhas

- **Logs de edge function retidos ~7 dias** (Supabase default). Para histórico maior, exportar.
- **`postgres_logs` tem ruído** (autovacuum, replication). Filtrar `error_severity IN ('ERROR','FATAL','PANIC')`.
- **Logs após `shutdown` (warm shutdown)** podem ser perdidos se acontecer mid-write. Sempre logar **antes** de async pesado.
- **PII em logs**: telefones/emails aparecem em muitas funções. Já mascaramos parcialmente, mas auditar antes de exportar.
- **Realtime não tem log próprio**: erros aparecem no console do browser, não no painel Supabase.

---

## Melhorias sugeridas

- Integrar Sentry no frontend (já tem libs, falta wire-up).
- Métricas Prometheus-like exportadas por uma edge function `/metrics`.
- Dashboard interno em `/admin/observability`.
- Alerta automático (Slack) para edge functions com taxa de 5xx > 5%.

---

## Arquivos-chave

- `supabase/functions/_shared/logger.ts`
- `operations/ERROR_HANDLING.md`
- `integrations/PG_NET_CRON.md`
