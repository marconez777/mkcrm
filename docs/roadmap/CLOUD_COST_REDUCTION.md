---
title: "Redução de custo Cloud (sem perder performance)"
topic: infra
kind: roadmap
audience: agent
updated: 2026-08-17
status: em-execucao
---

# Roadmap — Redução de custo Cloud

Contexto: no ciclo 13/jul–13/ago o projeto consumiu **23,27 créditos de Cloud**
(~48% de todo o Cloud da workspace): compute micro 9,59 / egress 8,01 /
edge functions 4,69. O compute já está no menor tier (piso fixo) → o custo
atacável é **egress + edge functions (~12,7 créditos)** e manter o disco
pequeno para nunca precisar subir de tier.

Em **2026-08-17** a análise foi refeita com dados reais do SQL Editor.
Conclusão central: **IA não é o dreno** — o gasto visível em `ai_usage` é
~US$ 7,9/30d (classifier US$ 6,65 + chat BYOK US$ 1,23). O dreno é infra:
logs nunca purgados e frequência de crons.

## Números medidos (2026-08-17)

| Item | Valor | Nota |
|---|---|---|
| `cron.job_run_details` | **2,7 GB** | maior tabela do banco — log de execução dos 31 crons, cada linha carrega o comando com JWTs (~1 KB); nunca purgado |
| `messages` | 1,2 GB | dado de negócio (histórico WhatsApp) — mantém |
| `webhook_events` | 828 MB | ~10-11k eventos/dia, 25–95 MB/dia de payload bruto (~1,5 GB/mês entrando; retenção 14d segurava em ~800 MB) |
| `net._http_response` | 147 MB | resposta de cada `http_post` do pg_net (crons + triggers), sem purge |
| Crons ativos | 31 jobs | 8 edges a cada 1 min + `process-email-queue` a cada **10 s** ≈ ~650k invocações edge/mês, maioria com fila vazia |
| Classifier 30d | US$ 6,65 | summarizer 3,47 + typifier 2,12 + maestro 0,87 + flash-lite 0,19 (Lovable AI) |
| Chat BYOK 30d | US$ 1,23 | gpt-4o-mini (854 calls) |

Achados qualitativos:

- **Agendador e Movimentador ainda rodam na ÓR** (2.240 calls cada, igual ao
  typifier); só o Maestro é pulado (801 ran / 1.439 skipped na janela de 30d).
  Custam ~US$ 0,16/30d — irrelevante, mas contradiz o doc V7
  (`docs/tenants/clinica-or/agentes-e-modelos.md`).
- `runSummarize` (`_shared/pipeline-summarize-core.ts`, gpt-5-mini via chave
  OpenAI da clínica) **não loga em `ai_usage`** → custo invisível estimado
  US$ 5–8/mês, duplicando o resumo que o Resumidor V7 já produz.
- A1 `position-auditor`: toggle **ligado** mas zero linhas de telemetria →
  morto em silêncio ou gastando sem logar. Redundante no V7.
- A2 `post-move-verifier`: já restrito a `rules_enabled=["auto:b2b-move"]` — ok.
- Cron `classifier-daily-batch` (`0 */3 * * *`) invoca edge
  `classifier-daily-batch` que **não existe no repositório** (possível 404 8×/dia).
- `pipeline-dispatcher-tick` (1/min) roda `dispatch_pipeline_classifiers()` →
  dispara `_template_pipeline_classify` por tenant habilitado em
  `pipeline_tenant_classifiers`, **em paralelo** ao `pipeline-classify-tick`
  do mesmo minuto.
- `gemini-flash-latest` (195 calls de chat) sem preço em `ai-pricing.ts` →
  `cost_usd` fica null.

## Fase 1 — SQL puro, sem deploy (entregue 2026-08-17)

SQL pronto no §Apêndice. Estimativa: banco ~5,5 GB → ~2,5 GB (backup/egress
caem junto), invocações de edge −~40%, crescimento dos 3 logs estancado.

| # | Ação | Status |
|---|---|---|
| F1.1 | Purge `cron.job_run_details` >7d + cron diário `purge-cron-job-run-details` 03:15 | pendente |
| F1.2 | Purge `net._http_response` >1d + cron diário `purge-pg-net-responses` 03:20 | pendente |
| F1.3 | `cleanup_webhook_events()`: retenção 14d → **7d (30d p/ linhas com erro)** (era o C4 do roadmap original; o cron `cleanup-webhook-events-daily` já existia) | pendente |
| F1.4 | Desligar A1: `automation.position_auditor.enabled=false` | pendente |
| F1.5 | Frequências: `process-email-queue` 10s→60s; `scheduled-report-tick` 1→15min; `evolution-health` 1→3min (thresholds de surdez são 30–240min, nada quebra) | pendente |
| F1.6 | Diagnóstico: tenants habilitados no dispatcher + status HTTP 24h do pg_net (404 = edge morto) | pendente |

## Fase 2 — precisa de deploy (agente Lovable)

- **C2 — `webhook_events` sem payload bruto** (`evolution-webhook/index.ts`):
  gravar só resumo (tipo, instância, remote_jid, message_id); payload completo
  apenas quando erro. Corta ~1,5 GB/mês de escrita e o principal crescimento
  de disco/backup. Risco baixo (perde replay de eventos OK, quase nunca usado).
- **C3 — cache in-memory de `whatsapp_instances`** no webhook (TTL 60s,
  invalidação em `CONNECTION_UPDATE`). −~1,6M queries/mês.
- **N1 — Unificar resumos**: persistir o output do Resumidor V7 (Gemini via
  Lovable) em `leads.ai_summary` e aposentar o `runSummarize` gpt-5-mini.
  Elimina 1 chamada LLM por classificação e a dependência da chave OpenAI
  nesse caminho. Enquanto existir, `runSummarize` deve logar em `ai_usage`.
- **N2 — Pricing**: adicionar `gemini-flash-latest` em `_shared/ai-pricing.ts`
  (e espelho `src/lib/ai-pricing.ts`).
- **N3 — Pós-F1.6**: se o edge `classifier-daily-batch` estiver 404, remover o
  cron (`cron.unschedule`); avaliar fundir `pipeline-dispatcher-tick` e
  `pipeline-classify-tick` num caminho só.

## Fase 3 — maior retorno estrutural, maior risco (exige regressão de inbound)

- **C1 — RPC `resolve_inbound_context(instance, remote_jid)`** consolidando as
  leituras sequenciais do webhook (instância, pipeline, lead, mensagens) em um
  round-trip. −~5M queries/mês, egress −30-40%. Manter fallback para o caminho
  antigo por 1 semana.
- **N4 — Debounce de classificação**: quiet period de 3–5 min (lead sem
  mensagem nova) antes de processar `needs_ai_review`, com teto de espera.
  Hoje o trigger marca a cada mensagem e o tick de 1 min só coalesce dentro do
  minuto → conversa ativa gera várias execuções re-lendo o histórico inteiro.
  −60-80% das execuções em conversa ativa.

## Histórico

- 2026-07-30 — roadmap original C1–C4 criado; nada executado.
- 2026-08-17 — análise refeita com dados reais (tamanhos de tabela, `cron.job`,
  toggles, `ai_usage` 30d, volume de `webhook_events`). C4 virou F1.3; novos
  itens F1.1–F1.6 e N1–N4. Prioridade invertida: infra/logs antes de IA.

## Apêndice — SQL da Fase 1

Diagnóstico (F1.6), rodar antes:

```sql
SELECT
  (SELECT jsonb_agg(to_jsonb(t)) FROM (
     SELECT clinic_id, classifier_version, enabled
     FROM pipeline_tenant_classifiers) t)               AS dispatcher_tenants,
  (SELECT jsonb_object_agg(status_code::text, cnt) FROM (
     SELECT status_code, count(*) cnt
     FROM net._http_response
     WHERE created > now() - interval '24 hours'
     GROUP BY 1) s)                                     AS http_status_24h;
```

Execução (F1.1–F1.5) — limpezas pesadas por último de propósito: se a última
der timeout no editor, os agendamentos já ficaram e o cron das 03:15 termina o
serviço à noite:

```sql
SELECT cron.schedule('purge-cron-job-run-details', '15 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);

SELECT cron.schedule('purge-pg-net-responses', '20 3 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '1 day'$$);

CREATE OR REPLACE FUNCTION public.cleanup_webhook_events()
RETURNS void LANGUAGE sql SET search_path = public AS $$
  DELETE FROM public.webhook_events
  WHERE received_at < now() - interval '30 days'
     OR (received_at < now() - interval '7 days' AND error IS NULL);
$$;

UPDATE app_settings SET value = 'false'
WHERE key = 'automation.position_auditor.enabled';

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='process-email-queue-every-minute'), schedule => '* * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='scheduled-report-tick'), schedule => '*/15 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='evolution-health-every-minute'), schedule => '*/3 * * * *');

SELECT public.cleanup_webhook_events();
DELETE FROM net._http_response WHERE created < now() - interval '1 day';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
```

Verificação pós-execução (tamanhos devem cair; `job_run_details` só encolhe
fisicamente após VACUUM, mas para de crescer):

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_stat_user_tables
WHERE relname IN ('webhook_events')
UNION ALL
SELECT 'cron.job_run_details', pg_size_pretty(pg_total_relation_size('cron.job_run_details'))
UNION ALL
SELECT 'net._http_response', pg_size_pretty(pg_total_relation_size('net._http_response'));
```
