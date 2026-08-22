---
title: "E-mail do MCD — Fluxo de envio (D3)"
topic: email
kind: map
audience: agent
updated: 2026-08-21
summary: "Um e-mail do MCD, do clique até o evento de entrega, em oito etapas — com o limite que importa em cada uma, o que pode travar, como se manifesta e onde olhar. Escrito contra o código de 21/08/2026, depois das mudanças do dia."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - supabase/functions/dispatch-campaign/index.ts
  - supabase/functions/process-email-queue/index.ts
  - supabase/functions/send-email-batch/index.ts
  - supabase/functions/send-email/index.ts
  - supabase/functions/resend-webhook/index.ts
related_docs:
  - docs/tenants/mcd/email/OPERACAO.md
  - docs/tenants/mcd/email/INTEGRACAO_RESEND.md
  - docs/roadmap/EMAIL_ESCALA.md
---

# E-mail do MCD — Fluxo de envio

## 0. Visão de uma página

```
 clique ──► [1] dispatch-campaign ──► status='sending'  (202, < 1 s)
                      │
                      ▼  cron a cada 1 min  (❗ não executando em 21/08)
            [2] enqueue_pending_campaigns ──► enqueue_campaign_recipients
                      │                      (uma transação, sem paginação)
                      ▼
            [3] email_queue  ── 146k linhas 'pending', scheduled_at espaçado se houver ritmo
                      │
                      ▼  cron a cada 10 s + self-trigger
            [4] process-email-queue ──► claim_email_queue_batch(1000)  (FOR UPDATE SKIP LOCKED)
                      │  agrupa por clinic::template::domínio
                      ▼
            [5] send-email-batch ──► 6 fases em lote (descadastro, dedup, cota, warm-up, throttle, tokens)
                      │
                      ▼
            [6] Resend /emails/batch  ── 100 por chamada, Idempotency-Key
                      │
                      ▼
            [7] email_logs INSERT + email_queue 'sent' + trigger de contadores da campanha
                      │
                      ▼  minutos a horas depois
            [8] resend-webhook ──► email_logs UPDATE (delivered / opened / bounced …)
```

## 1. Disparo — `dispatch-campaign`

**Entrada:** `{ campaign_id }` com JWT do usuário (owner/admin) ou
`service_role` (campanhas agendadas, via `process-scheduled-campaigns`).

**Faz:** valida permissão; se `test_only`, enfileira um único e-mail com
`force_send=true` e contexto `campaign_test_<id>` e retorna; senão, recusa se
já `sent`/`sending`, marca `sending`, checa feature `email_marketing` e
template ativo (cada uma marcando `failed` com motivo se falhar), dispara o
`process-email-queue` e devolve **202 `queueing`**.

**Não faz mais:** resolver destinatários, deduplicar, inserir na fila. Isso
saiu daqui em 21/08 porque **toda chamada via PostgREST tem teto de 8 s**,
inclusive com `service_role` (o `statement_timeout` é do papel
`authenticator`). Enfileirar 146k numa chamada nunca caberia.

**Limite:** nenhum relevante — a função agora é leve.

**Trava como:** `failed` com `error` preenchido (feature/template). Ou 403 se
o usuário não for owner/admin — aparece só no toast da tela, nada no banco.

## 2. Enfileiramento — `enqueue_pending_campaigns` (pg_cron, job 58)

**Faz:** a cada minuto, pega até 3 campanhas com `status='sending'`,
`sent_at IS NULL` e fila vazia; para cada uma, chama
`enqueue_campaign_recipients` em bloco `BEGIN … EXCEPTION`: sucesso →
`sent` com `total_recipients`/`enqueued_count`; erro → `failed` com `SQLERRM`.

**`enqueue_campaign_recipients`:** declara contexto de serviço
(`set_config('request.jwt.claims', …, true)` — sem isso `resolve_email_segment`
levanta `forbidden`); recusa se a campanha já tem linhas na fila; resolve o
público (segmentos via `resolve_email_segment`, ou `leads` +
`email_segment_contacts` quando "Todos"); deduplica por `lower(email)`; aplica
variantes A/B (rodízio ponderado), rotação de domínio (`from_domain_pool`) e
espaçamento (`send_rate_per_minute` → `scheduled_at = base + idx/rate min`);
**um `INSERT … SELECT`**. Tudo ou nada.

**Limite:** roda como `postgres`, sem `statement_timeout`. 146k linhas com os
8 índices de `email_queue` levam minutos no compute mínimo — aceitável, é
assíncrono.

**Trava como:** ❗ **Em 21/08 o cron não executou** — campanha ficou
`sending`, fila vazia, sem erro. Causa não identificada. Ver
[`OPERACAO.md` §5](./OPERACAO.md) para o caminho manual e
[`INCIDENTES.md`](./INCIDENTES.md).

**Onde olhar:** `cron.job` (job 58 ativo?), `cron.job_run_details` (acesso
falhou no editor em 21/08), `pg_stat_activity` (há um `INSERT` em curso?).

## 3. A fila — `email_queue`

Uma linha por destinatário por campanha. Colunas que o fluxo usa: `status`
(`pending → processing → sent | failed | cancelled | paused`), `scheduled_at`,
`priority` (campanha = 5), `attempts`, `related_lead_table =
'campaign_<id>'`, `variables` (inclui `campaign_id`, `variant_id`,
`subject_override`), `from_name_override`, `from_domain_override`.

**Limites:** 8 índices — cada linha inserida custa 8 escritas de índice.
`email_queue_dedup_idx` (único, parcial em `pending`) impede a mesma
combinação clínica+template+e-mail+contexto duas vezes na fila.

**Retenção:** linhas `sent` com mais de 30 dias são apagadas pelo cron
`cleanup-email-runtime` (03:40). `failed`/`cancelled` ficam.

**Onde olhar:** tela Fila (realtime filtrado por clínica, refresh a cada 5 s
no máximo); `select status, count(*) from email_queue where
related_lead_table = 'campaign_<id>' group by 1`.

## 4. O worker — `process-email-queue`

**Cadência:** cron `process-email-queue-every-minute` (nome histórico; roda a
cada **10 s**) + **self-trigger**: se pegou ≥ 100 jobs, chama a si mesma de
novo sem esperar o cron. Durante uma campanha grande isso vira uma cadeia
contínua.

**Faz, nesta ordem** (`process-email-queue/index.ts`):

1. **Reaper:** `processing` há mais de 10 min volta para `pending`.
2. **Claim atômico:** `claim_email_queue_batch(1000)` — `UPDATE … FROM (SELECT
   … FOR UPDATE SKIP LOCKED) RETURNING *`. Duas execuções simultâneas recebem
   lotes disjuntos. (Antes de 21/08 era `select` + `update` separados e ambas
   processavam os mesmos 1.000.)
3. **Agrupa** por `clinic_id::template_slug::from_domain_override`. Grupos
   com ≥ 2 viram chamadas à Batch API em chunks de 100, até 5 em paralelo;
   grupos de 1 vão para o `send-email` unitário, 5 em paralelo.
4. **Buckets de resultado:** `sentNow` (bulk update para `sent`),
   `failedTerminal` (template inativo, e-mail inválido, domínio não
   verificado), `rescheduled` (cota → 12:00 UTC de amanhã; rate limit →
   `Retry-After` + jitter; outros → backoff 1 min / 5 min / 30 min, até
   `MAX_ATTEMPTS=3`).
5. **Health check** `check_email_operational_health()` ao final (desde 21/08
   com guarda de 30 min por tipo de alerta).

**Limite:** cada invocação processa até 1.000 jobs; o wall-clock da edge
function limita quantos lotes de 100 cabem — em 21/08 não medido. 1.000 jobs
= 10 chamadas à Batch API em janelas de 5.

**Trava como:** jobs presos em `processing` (reaper resolve em 10 min);
`email_operational_alerts` com `queue_backlog` quando `pending > 500` (com
146k na fila, esse alerta é permanente e inútil — limiar a revisar).

## 5. O envio em lote — `send-email-batch`

Recebe até 100 jobs da **mesma** clínica + template + domínio. Resolve
template (cache 60 s), domínio (`verified`/`partially_verified`, senão
`failed`), chave Resend (ver [`INTEGRACAO_RESEND.md` §2](./INTEGRACAO_RESEND.md)).

**As seis fases** (desde 21/08, antes era um laço com 5 idas ao banco por
e-mail):

| Fase | Chamada | Quem cai fora | Reagendado para |
|---|---|---|---|
| 1 descadastro | 1 `select … in(emails)` | `unsubscribed` | — (cancelado) |
| 2 dedup | `claim_send_dedup_batch` por contexto | `already_sent` | — |
| 3 cota | `claim_email_quota_bulk(n)` | os `n - granted` últimos: `quota_reached` | 12:00 UTC amanhã |
| 4 warm-up | `claim_domain_warmup_bulk(n)` | excedentes: `warmup_cap_reached` | +30 min |
| 5 throttle destino | por job, **só se ligado** (MCD: desligado) | `recipient_throttle` | próxima hora |
| 6 tokens | `generate_unsubscribe_tokens(emails)` | — | — |

Cada skip **devolve** o que já tinha reservado nas fases anteriores (dedup,
cota, warm-up). Erro de infraestrutura em qualquer RPC **aborta o lote com
500** devolvendo tudo — o worker reverte os jobs para `pending` com backoff.
(G-33/G-34/G-35, corrigidos em 21/08.)

**No MCD:** cota 50M (fase 3 nunca nega), warm-up sem linha (fase 4 libera
tudo), throttle desligado (fase 5 pulada). Na prática só descadastro e dedup
filtram.

**Render:** `subject` e `html` por job com `renderTemplate`; `from` com nome
(override da variante ou do template); headers `List-Unsubscribe`.

## 6. Resend — `POST /emails/batch`

100 e-mails por chamada, `Idempotency-Key` = `proc-<clinic>-<template>-<ts>-<idx>`.

**Resposta OK:** array de `{ id }` **por posição** — o `resend_id` de cada
e-mail. **Resposta não-OK:** libera dedup/cota/warm-up em lote, reverte os
jobs para `pending` com `attempts+1` e `scheduled_at = +1 min`, devolve 502.

**Limites:** tier da conta do MCD ❓. 429 é tratado pelo worker como rate
limit (respeita `Retry-After`).

## 7. Registro — `email_logs` + contadores

Para cada e-mail aceito: `INSERT` em `email_logs` com `resend_id`, `status='sent'`,
`sent_at`, `template_slug`, `recipient_email`, `related_lead_table`,
`variant_id`; `email_queue.status='sent'` em bulk.

**Trigger `tg_email_queue_campaign_counters`** (em `email_queue`, ao virar
`sent`/`failed`): `UPDATE email_campaigns SET sent_count+1` (ou
`failed_count+1`) e upsert em `campaign_throughput(campaign_id, minute)`. É
**uma atualização na mesma linha da campanha por e-mail** — linha quente que
serializa os lotes paralelos (G-06, aberto). Idempotente: só conta quando
`sent_at` passa de nulo para preenchido.

**Retenção:** `email_logs` **não é apagado** — é a base dos relatórios.
`email_send_dedup` (uma linha por e-mail enviado, garante o "nunca duas
vezes") é apagado após 90 dias.

## 8. Retorno — `resend-webhook`

Minutos a horas depois: o Resend chama o endpoint com cada evento; a função
valida a assinatura (vários secrets), deduplica pelo `svix-id`, acha o log
pelo `resend_id` e atualiza `status` + `*_at` + `events`. Detalhe por evento
em [`INTEGRACAO_RESEND.md` §3](./INTEGRACAO_RESEND.md).

**Efeitos colaterais no MCD:** `bounced` → trigger suprime o e-mail
(`email_unsubscribes`) **e remove de `email_segment_contacts`** — a lista
encolhe sozinha a cada bounce; `complained` → suprime.

**Agregação:** `refresh_email_metrics_daily` (cron 15 min, janela de 2 dias;
35 dias uma vez ao dia) alimenta `email_metrics_daily`, de onde o Painel lê
janelas longas.

## 9. Tabela de limites

| Etapa | Teto | Vale para o MCD? |
|---|---|---|
| qualquer chamada PostgREST | 8 s (`authenticator`) | sim — por isso [1] não enfileira e as contagens são pré-calculadas |
| resposta PostgREST | 1.000 linhas | sim |
| `pg_cron` | sem teto | é por onde [2] roda |
| Batch API | 100/chamada | sim |
| worker | 1.000 jobs/invocação; 5 lotes paralelos; 5 unitários paralelos | sim, global |
| cota diária | `clinics.settings.email.quota_daily` | 50M — inativa |
| warm-up | escada por idade do domínio | sem linha — inativo |
| throttle destino | 1.000/h por provedor | desligado |
| `send_rate_per_minute` | espaçamento do `scheduled_at` | **único freio ativo**, e só se preenchido |

## 10. Onde cada sintoma aparece

| Sintoma | Etapa provável | Olhar |
|---|---|---|
| `sending` com 0 na fila por > 3 min | [2] | `cron.job`, `pg_stat_activity`, `email_campaigns.error` |
| `failed` logo após disparar | [1] ou [2] | `email_campaigns.error` |
| fila cheia, `sent_count` parado | [4]/[5]/[6] | log da edge `process-email-queue`; `email_queue.error` dos `pending` com `attempts > 0`; `email_operational_alerts` |
| muitos `failed` na fila com `domain … not verified` | [5] | `email_domains.status`; painel Resend |
| enviados sobem, entregas não | [8] | `resend_webhook_events` recebe? secret/endpoint da conta MCD |
| `delivery_delayed` em massa | [8] | reputação — ver `ENTREGABILIDADE.md` (D5) |
