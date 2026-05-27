# Plano: acelerar envio de campanhas (revisado com pesquisa da comunidade)

## Diagnóstico baseado em dados reais + pesquisa

**Campanha real medida** (445 contatos): 6 min, ~74/min médio.
**Meta**: 10.000 e-mails em ≤ 8–10 min, 2x/dia.

### Conta matemática que muda tudo
- Cron 15s → 4 ticks/min → com `BATCH_SIZE=200` o teto é **800/min** (10k em 12,5 min, no melhor cenário). Já não bate a meta.
- **Resend NÃO é o gargalo**: limite padrão é 2 req/s. Usando Batch API (100 e-mails/call), 2 req/s = **12.000 e-mails/min** teórico. Estamos usando <10% do limite.
- Gargalo real: (a) `UPDATE` individual por job no banco, (b) `pick_rotation_domain` RPC por destinatário no enqueue, (c) `CONCURRENCY=20` no caminho singular **viola** o rate limit de 2 req/s do Resend (cada singular é 1 req).

### Configuração-alvo calculada
```
10.000 / 40 ticks (10 min × 4 ticks/min) = 250 e-mails por tick
→ BATCH_SIZE = 400 com 3 batches Resend paralelos (3 × 100 + sobra)
→ 0,2 req/s consumidos (folga enorme dentro dos 2 req/s)
```

## Mudanças (ordenadas por impacto)

### 1. [CRÍTICO] `process-email-queue` — UPDATE em lote
Hoje cada job dispara seu próprio `UPDATE email_queue SET status='sent'`. Para 10k = 10k roundtrips.
- Coletar IDs ao fim do tick e fazer **um** update por status:
  `update({status:'sent', sent_at}).in('id', sentIds)` e mesmo para failed.
- Aplicar tanto no caminho singular quanto no batch (hoje `send-email-batch` também atualiza individualmente).
- **Impacto esperado: -70% no tempo do tick.**

### 2. [CRÍTICO] `dispatch-campaign` — enqueue O(1) por destinatário
- Remover `pick_rotation_domain` do loop. Carregar o pool **uma vez**, distribuir round-robin **em memória**.
- Mantém o `INSERT` em lotes de 1000 já existente.
- **Impacto esperado**: enfileirar 10k em <10 s (hoje provavelmente leva 1–2 min).

### 3. [ALTO] Aumentar throughput por tick
- `BATCH_SIZE`: 200 → **400**.
- **Limitar paralelismo de batches Resend a 3** (3 × 100 = 300 e-mails por rajada). Hoje é ilimitado — pode estourar 429.
- `CONCURRENCY` do caminho singular: 20 → **2** (cada singular = 1 req/s direto ao Resend; estamos violando o rate-limit oficial e os 429 vão de volta pra fila, derrubando throughput).
- `SELF_TRIGGER_THRESHOLD`: 150 → **50** (re-invoca cedo, drena sem esperar próximo cron).

### 4. [ALTO] Idempotency keys no Batch API
- Recomendação oficial do Resend para campanhas. Passar `idempotency_key: campaign-<id>-chunk-<n>` evita duplicatas em retries sem custo extra de quota.

### 5. [ALTO] Backoff exponencial em 429
- Hoje o handler já respeita `Retry-After`, mas não tem jitter. Adicionar `+ Math.random() * 200ms` evita "trovejada" quando vários ticks batem no rate-limit ao mesmo tempo.

### 6. [MÉDIO] Cron mais agressivo
- `process-email-queue-every-minute`: 15 s → **10 s**.
- Combinado com self-trigger e batch maior, drena 10k em ~30–40 ticks.

### 7. [MÉDIO] Counters reais por trigger (base do painel)
- Trigger no `email_queue` que, em transição `pending → sent | failed`, faz `UPDATE email_campaigns SET sent_count = sent_count + 1`, lendo o `campaign_id` de `related_lead_table = 'campaign_<id>'`.
- Nova coluna `email_campaigns.last_sent_at` (atualizada pelo mesmo trigger).
- Tabela leve `campaign_throughput(campaign_id, minute, sent, failed)` para o gráfico ao vivo da fase 2.
- Backfill one-shot dos contadores das campanhas já enviadas.

## Importante: conta nova de 10k contatos

A pesquisa foi unânime no warm-up. Mandar 10k no dia 1 de um domínio/conta nova **queima a reputação imediatamente** (Gmail/Yahoo bloqueiam, hard bounces >5% derrubam o domínio).

**Schedule recomendado para a conta nova** (a apresentar no painel ou na criação da campanha):
| Semana | Volume/dia | Quem |
|---|---|---|
| 1 | 200 → 2.000 | mais engajados |
| 2 | 2.000 → 10.000 | engajados últimos 30d |
| 3+ | 10.000 cheio | lista completa |

Thresholds a vigiar: bounce <3%, complaints <0,1%, unsubscribes <0,5%.

→ **Sugestão (não implementada agora, só registro)**: campo `warm_up_mode` em `email_campaigns` que limita `enqueued_count` ao teto do dia atual. Posso adicionar numa próxima rodada se quiser.

Plano do Resend para 20k/dia: **Scale + Dedicated IP** (~$90/mês + add-on). Em IP compartilhado, o risco de "vizinho tóxico" é real em volume alto.

## Fora deste plano (decisão consciente)

- **Migrar para pgmq** (extensão nativa do Postgres com `SKIP LOCKED`, DLQ, visibility timeout). Pesquisa recomenda fortemente. Mas é refactor grande do `email_queue` + de tudo que enfileira (sequences, automations, transacionais). Vou propor numa segunda fase se os 6 itens acima não chegarem na meta.
- **AWS SES como provedor alternativo** (10× mais barato, rate 100 msg/s vs 2 req/s do Resend). Só vale a pena acima de ~500k/mês.
- **Redesenho do painel ao vivo** (barra de progresso, ETA, lista de falhas, realtime subscription). Depende dos counters/throughput do item 7 estarem populando — fase seguinte.

## Validação após implementar

1. Disparar a próxima campanha real (idealmente em segmento menor, ~500 contatos) e medir início → último `sent_at`. Meta: <40 s.
2. Conferir `campaign_throughput` por minuto — deve ficar **estável** (sem vales como o 14/min do fim da última campanha).
3. `email_campaigns.sent_count` deve bater com `count(*)` em `email_queue status='sent'` em tempo real.
4. Logs do `process-email-queue`: **zero** `429 Retry-After`.
5. Quando estiver estável em 500 contatos, escalar para 5k e depois 10k.

## Fontes da pesquisa
- Resend rate limits oficiais: https://resend.com/changelog/api-rate-limit, https://resend.com/docs/api-reference/rate-limit
- Padrão Promise.all + batch: https://dev.to/dalenguyen/mastering-email-rate-limits-a-deep-dive-into-resend-api-and-cloud-run-debugging-3973
- Supabase Edge Functions + Cron + Queues: https://supabase.com/blog/processing-large-jobs-with-edge-functions
- Warm-up schedule: https://mailflowauthority.com/email-infrastructure/ip-warming-schedule
- Postgres SKIP LOCKED para filas (justificativa do pgmq): https://prequel.co/blog/sql-maxis-why-we-ditched-rabbitmq-and-replaced-it-with-a-postgres-queue
