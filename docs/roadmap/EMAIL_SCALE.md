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

### Tier 2 — Escala e deliverability (próximo mês)

- **R-12. Warm-up automático de domínio novo**
  - Tabela `email_domain_warmup_schedule(domain, day_offset, max_sends)`.
  - Curva 50 → 100 → 500 → 1k → 5k → 10k... ao longo de 2 semanas.
  - Dispatcher respeita o teto diário do domínio.
- **R-13. Rate-limit per-domain destinatário**
  - Limite "X emails/h para `@gmail.com`" para evitar burst (anti-spam).
  - Janela em nova tabela `email_recipient_throttle(clinic_id, dest_domain, window_start, sent)`.
- **R-14. Separar fila por tipo (opcional)**
  - Alternativa a R-7: `email_queue_auth`, `email_queue_marketing` com workers dedicados.
- **R-15. Resend Batch API**
  - `POST /emails/batch` (até 100 por chamada) — corta HTTP por envio.
  - `send-email` recebe lote opcional.
- **R-16. Feedback loop bounce/complaint em tempo real**
  - Trigger SQL: se `bounce_rate > 5%` nas últimas 1000 msgs da clínica, **pausa campanhas** automaticamente (`UPDATE email_campaigns SET status='paused'`).
- **R-17. Métricas em tempo real**
  - View materializada `mv_email_throughput_5min` (refresh a cada 1min).
  - Alertas: fila pendente >1000, tempo médio em fila >5min, bounce_rate >5%.

### Tier 3 — Recursos para o cliente grande

- **R-18. Throttling por campanha**
  - `email_campaigns.send_rate_per_minute` — disparo gradual (100/h em vez de 10k em 30min).
- **R-19. Segmentação avançada server-side**
  - Expandir `resolve_email_segment` RPC com: `created_at` ranges, `last_message_at`, `score`, custom fields.
- **R-20. A/B test de subject/template**
  - `email_campaign_variants` (split 50/50, vencedor pelo open rate em 24h).
- **R-21. Multi-domínio rotativo**
  - Clínica com `notify1.dominio`, `notify2.dominio`... dispatcher rotaciona para distribuir reputação.

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
