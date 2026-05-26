# Email Marketing — Roadmap de Escala & Performance

> **Quando ler:** antes de subir cliente de alto volume, ao planejar otimizações da fila/automações/campanhas, ou ao avaliar custo de Postgres no módulo de email.
> **Escopo:** módulo de email marketing (campanhas, automações, fila, envio). Para auth emails ver `docs/roadmap/EMAIL.md`.
> **Última atualização:** 2026-05-26.

---

## Contexto

A pipeline atual (`send-email` + `process-email-queue` + `dispatch-campaign` + `email-automations-tick`) foi dimensionada para clínicas de volume médio. Vamos colocar um cliente com **alto volume de contatos e disparos** (campanhas grandes + múltiplas automações simultâneas), então precisamos endereçar gargalos de throughput, deliverability e contenção de banco **antes** do go-live.

---

## Gargalos identificados (auditoria 2026-05-26)

| # | Gargalo | Onde | Impacto |
|---|---|---|---|
| G1 | Cron de 1 min + batch 50 + concorrência 5 | `process-email-queue/index.ts` | Teto prático ~50 emails/min ≈ **3.000/h** |
| G2 | 6–8 queries por envio sem cache | `send-email/index.ts` | Pressão alta no Postgres em volume |
| G3 | Idempotência via `SELECT ... maybeSingle()` em `email_logs` | `send-email` §3 | Degrada com milhões de linhas; sem índice composto |
| G4 | Enqueue sequencial em chunks de 20 RPCs | `dispatch-campaign/index.ts` | Estoura 150s da edge function em campanhas >5k |
| G5 | `email-automations-tick` serial (`for...of`) | `email-automations-tick/index.ts` | Lento com 50+ automações ativas |
| G6 | Cota diária via UPSERT linha-a-linha | `send-email` §4 + §11 | Contenção (lock) sob paralelismo |
| G7 | Sem prioridade na fila | `email_queue` | Campanha massiva atrasa transacional/auth |
| G8 | Sem warm-up de domínio nem rate-limit por destino | — | Risco de ban/spam ao escalar |
| G9 | Webhook Resend sem dedup de eventos | `resend-webhook/index.ts` | `email_logs.events[]` infla com retries do Resend |
| G10 | `dispatch-campaign` carrega leads em 1 query (limit 10k) em memória | `dispatch-campaign/index.ts` | Não escala >10k destinatários |

---

## Roadmap

### Tier 0 — Quick wins (1–2 dias, sem mudança de arquitetura)

- **R-1. Subir throughput do dispatcher** *(resolve G1)*
  - Cron `1min → 15s` (via `pg_cron` `*/15 * * * * *` ou self-trigger).
  - `BATCH_SIZE: 50 → 200`, `CONCURRENCY: 5 → 20`.
  - **Resultado esperado:** ~**12.000 emails/h** por instância.
- **R-2. Índices críticos** *(resolve G3, G9)*
  ```sql
  CREATE INDEX CONCURRENTLY idx_email_queue_pending
    ON email_queue(scheduled_at) WHERE status = 'pending';
  CREATE INDEX CONCURRENTLY idx_email_logs_idempotency
    ON email_logs(clinic_id, template_slug, recipient_email, related_lead_table);
  CREATE INDEX CONCURRENTLY idx_email_logs_resend_id
    ON email_logs(resend_id);
  ```
- **R-3. Self-trigger pós-batch** *(resolve G1)*
  - No fim de `process-email-queue`, se ainda há `pending`, dispara `process-email-queue` recursivamente (mesma técnica já usada em `dispatch-campaign`). Elimina latência do cron.
- **R-4. Paralelizar enqueue do `dispatch-campaign`** *(resolve G4)*
  - Trocar 2.500 RPCs por **INSERT em lote** em `email_queue` (chunks de 500). 1 round-trip por 500 vs 1 por linha.
- **R-5. Dedup de webhook Resend** *(resolve G9)*
  - Unique `(resend_id, event_type)` em nova tabela `email_log_events` OU normalizar para ignorar evento repetido em JSON antes do `push`.

### Tier 1 — Performance estrutural ✅ implementado 2026-05-26

- **R-6. Cache em `send-email`** ✅ *(G2)* — Cache em memória do isolate para `email_templates`, `email_domains`, `clinic_email_integrations`, `clinics.slug` (TTL 60s). Reduz ~6 queries para ~3 por envio.
- **R-7. Filas com prioridade** ✅ *(G7)* — Coluna `email_queue.priority smallint default 5` (`auth=1, transacional=2, campaign=3, drip=4, batch=5`). Dispatcher ordena `ORDER BY priority ASC, scheduled_at ASC`.
- **R-8. `dispatch-campaign` paginado** ✅ *(G10)* — Paginação por `range(offset, offset+1000)` para leads e contatos manuais. Suporta >1000 destinatários sem hit no cap do PostgREST. **Pendente Tier 2:** modo 202 assíncrono para campanhas muito grandes (>50k).
- **R-9. Paralelizar `email-automations-tick`** ✅ *(G5)* — `Promise.all` com concorrência 10 por automação.
- **R-10. Idempotência atômica** ✅ *(G3)* — Nova tabela `email_send_dedup(clinic_id, template_slug, email, context)` com UNIQUE. Troca SELECT+INSERT por INSERT ON CONFLICT. Em falha de envio, dedup é revertido.
- **R-11. Contador de cota atômico** ✅ *(G6)* — Novo RPC `claim_email_quota(_clinic_id)` faz UPSERT atômico com reset diário automático e decremento em falha. Sem contenção sob paralelismo alto.

### Tier 2 — Escala e deliverability ✅ implementado 2026-05-26 (parcial)

- **R-12. Warm-up automático de domínio** ✅ — Nova tabela `email_domain_warmup` (per-clinic_id+domain). RPC `claim_domain_warmup` aloca atomicamente respeitando a curva `50 → 100 → 500 → 1k → 5k → 10k → 25k → ilimitado` por dia desde `started_at`. Reset diário automático. `send-email` e `send-email-batch` chamam o claim antes de enviar; se estourar, re-agendam o job para +30min. Failures liberam a vaga via `release_domain_warmup`. **Opt-in:** sem registro na tabela = sem cap.
- **R-13. Rate-limit per-domain destinatário** ✅ — Nova tabela `email_recipient_throttle(clinic_id, dest_domain, window_start, sent)` PK composta. RPC `claim_recipient_throttle` faz UPSERT atômico por janela de 1h (limite padrão 1000/h). Se estourar, re-agenda para a próxima janela horária.
- **R-14. Separar fila por tipo** ❌ não necessário — R-7 (prioridade na fila única) já cobre o caso.
- **R-15. Resend Batch API** ✅ — Nova edge function `send-email-batch` (até 100 por chamada). `process-email-queue` agrupa jobs por `(clinic_id, template_slug)` e envia em lote quando o grupo tem ≥3 jobs; menos que isso vai singular. Fallback automático para singular se a chamada batch falhar. Reduz ~95% das chamadas HTTP em campanhas.
- **R-16. Feedback loop bounce/complaint** ✅ — Trigger `email_logs_bounce_health_trigger` (AFTER UPDATE OF status). Função `check_clinic_bounce_health` calcula bounce_rate/complaint_rate nas últimas 1000 mensagens; se `bounce_rate > 5%` ou `complaint_rate > 0.3%`, **pausa automaticamente** campanhas em `running/sending/scheduled` da clínica e grava em `email_health_alerts(clinic_id, alert_type, metric_value, threshold, sample_size, action_taken)`. Throttle de 10min entre alertas para não pausar repetidamente.
- **R-17. Métricas em tempo real** ✅ — Views `email_throughput_stats` (por clínica, agrega fila + logs) e `email_system_health` (global). Tabela `email_operational_alerts` com tipos (`queue_backlog`, `stuck_processing`, `high_failure_rate`, etc.). Função `check_email_operational_health` verifica backlog (>500), jobs presos (>10min) e taxa de falha (>10%). Trigger na fila dispara a cada 100 inserts. Admins e owners têm acesso via RLS.


### Tier 3 — Recursos para o cliente grande ✅ implementado 2026-05-26

- **R-18. Throttling por campanha** ✅ — Coluna `email_campaigns.send_rate_per_minute`. Quando definida, `dispatch-campaign` espalha `scheduled_at` por janelas de 1 minuto (ex.: rate=100 → 100 jobs em t+0, 100 em t+1min, etc.). NULL = sem throttle.
- **R-19. Segmentação avançada server-side** ✅ — `_email_segment_rule_to_sql` agora aceita `last_message_at_range` (from/to), `deal_value_range` (min/max) e `custom_field` (key + value/values, com fallback a `?key`).
- **R-20. A/B test de subject/template** ✅ — Tabela `email_campaign_variants(label, weight, subject_override, template_slug_override, from_name_override, sent_count, opened_count, clicked_count, is_winner)`. `email_campaigns.variant_strategy` ativa A/B (`none|ab|multi`). `dispatch-campaign` faz round-robin ponderado determinístico por destinatário. Colunas `email_queue.variant_id` e `email_logs.variant_id` rastreiam atribuição. RPC `pick_ab_winner(_campaign_id)` recalcula métricas e marca vencedor por taxa de abertura.
- **R-21. Multi-domínio rotativo** ✅ — Colunas `email_domains.rotation_pool` + `rotation_weight` agrupam domínios verificados em pools. `email_campaigns.from_domain_pool` indica o pool a usar. `dispatch-campaign` chama RPC `pick_rotation_domain` por linha (weighted random) e salva em `email_queue.from_domain_override`. `send-email` e `send-email-batch` substituem o domínio do `from_email` preservando o local-part; warmup, throttle e validação operam no domínio efetivo. `process-email-queue` agrupa batches por `(clinic_id, template_slug, from_domain_override)` para manter o `From` consistente no Resend Batch API.


---

## Sugestão de priorização

| Janela | Itens | Ganho |
|---|---|---|
| **Semana 1 (antes do go-live)** | R-1, R-2, R-3, R-4, R-5, R-7, R-10, R-11 | ~3k/h → **~50k/h**, prioridade garantida para transacional |
| **Primeiras 4 semanas em produção** | R-6, R-8, R-9, R-15, R-17 | Reduz custo Postgres, suporta múltiplas automações, observabilidade real |
| **Conforme volume crescer** | R-12, R-13, R-16, R-18, R-21 | Protege reputação e dá controle fino ao cliente |

---

## SLOs propostos

| Métrica | Alvo |
|---|---|
| Email transacional/auth: invocação → Resend | p95 <30s |
| Campanha 10k destinatários: enqueue completo | <60s |
| Campanha 10k destinatários: 100% enviado | <2h |
| Drip: trigger → enfileirado | <6min (limite do cron) |
| Fila pendente em condição normal | <500 jobs |
| Bounce rate por clínica | <2% (alerta >5%) |
| Complaint rate por clínica | <0.1% (alerta >0.3%) |

---

## Arquivos-chave

- `supabase/functions/send-email/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/dispatch-campaign/index.ts`
- `supabase/functions/email-automations-tick/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `docs/edge-functions/EMAIL.md` (referência do módulo)
- `docs/flows/EMAIL_CAMPAIGN.md` (fluxo end-to-end)
- `docs/operations/PERFORMANCE.md` (SLOs gerais)
- `docs/roadmap/IMPROVEMENTS.md` (roadmap geral do produto)
