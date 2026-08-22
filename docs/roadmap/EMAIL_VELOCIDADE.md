---
title: "Roadmap: envio de e-mail a 100–200k com velocidade máxima"
topic: email
kind: roadmap
audience: both
status: proposto
updated: 2026-08-21
summary: "Como fazer o disparo voltar a funcionar sem depender do pg_cron e levar o pipeline ao teto físico da plataforma para campanhas de 100–200k: enfileiramento em fatias resumíveis, contadores por statement em vez de por linha, duas RPCs que trocam ~110 idas ao banco por lote por 3, e worker em cadeias paralelas. Inclui SQL pronto e os pedidos para o agente do Lovable. Premissa do usuário: bounce/reputação não é prioridade."
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/FLUXO_DE_ENVIO.md
  - docs/tenants/mcd/email/OPERACAO.md
  - docs/roadmap/EMAIL_ESCALA.md
code_refs:
  - supabase/functions/dispatch-campaign/index.ts
  - supabase/functions/process-email-queue/index.ts
  - supabase/functions/send-email-batch/index.ts
---

# Roadmap: envio a 100–200k com velocidade máxima

## 0. Premissas (decididas em 21/08/2026)

- **Volume alvo:** campanhas de 100 mil a 200 mil destinatários.
- **Objetivo:** o disparo voltar a funcionar **pela tela** e terminar no menor
  tempo que a plataforma permitir.
- **Bounce e reputação não são prioridade** — decisão do usuário ("o domínio a
  gente recupera rápido"). Este documento **não** impõe ritmo. Os freios
  automáticos que existem ficam como estão (ver §6).
- **Sem VPS, sem Supabase próprio.** Tudo dentro do Lovable Cloud: SQL Editor
  para banco, agente do Lovable para edge functions.

## 1. Onde o tempo vai hoje

Medido e lido no código em 21/08. Para uma campanha de 146k:

| Etapa | Hoje | Custo |
|---|---|---|
| Enfileirar | `pg_cron` (job 58) chama `enqueue_campaign_recipients` — **não executa**; causa não identificada | campanha presa em `sending`, 0 na fila. **Bloqueante.** |
| Enfileirar (quando rodar) | um `INSERT` de 146k linhas numa transação | minutos; sem progresso visível; se falhar, nada entra |
| Worker claim | `claim_email_queue_batch(1000)` — atômico | ok |
| Por lote de 100 no `send-email-batch` | `prepare`: 1 select + 4 RPCs em lote; `Resend`: 1 chamada; `finalize`: **100 `UPDATE` em `email_send_dedup`, um por e-mail, em sequência** + 1 insert de logs + 1 update da fila | **~107 idas ao banco por lote**, a maioria serial |
| Trigger de contadores | `tg_email_queue_campaign_counters` **por linha**: 2 statements por e-mail, todos na **mesma linha** de `email_campaigns` | 5 lotes paralelos serializam nela |
| Health check | ao fim de cada invocação do worker | 2 counts + 1 group by; tolerável |
| Cadeias | 1 invocação por vez (self-trigger) + cron de 10 s | subutiliza o Resend |

Conta de padaria do lote de 100 hoje: ~107 round-trips × ~40 ms ≈ **4,3 s** +
Resend ~0,6 s ≈ **5 s por 100 e-mails por cadeia** → 20/s por cadeia, ~100/s
com 5 lotes paralelos. 146k em **~25 min** — se o enfileiramento funcionasse.

## 2. O teto físico

| Limite | Valor | Implicação |
|---|---|---|
| Chamada via PostgREST | **8 s** (`authenticator`), vale para edge functions | nada que toque 146k linhas pode ser uma chamada só |
| Resend Batch API | 100 e-mails por chamada | — |
| Resend rate limit | ❓ tier da conta do MCD; código assume 5 req/s | **500 e-mails/s = 30k/min** se tudo mais acompanhar |
| Compute (mínimo) | `count(distinct)` de 162k = 8,6 s | escritas em lote são baratas; o que mata é round-trip e lock |
| Edge function | wall-clock por invocação (❓ 150–400 s) | qualquer coisa longa precisa ser resumível |

**Ceiling realista após o plano:** lote de 100 em ~1 s (3 round-trips +
Resend) → ~100/s por cadeia → com 5 lotes paralelos e 2 cadeias, **300–500/s**
até bater no rate limit do Resend. **146k em 5–10 minutos**; 200k em 7–12.
Antes disso o gargalo é o banco; depois, o Resend — e o rate limit do Resend
**sobe sob pedido** (§5).

## 3. Bloco A — voltar a funcionar (hoje, SQL + 1 pedido ao Lovable)

### A1. Por que o cron não roda — diagnóstico barato

`cron.job_run_details` tem 2,7 GB (roadmap de custo); qualquer filtro sem
índice estoura o editor. A única leitura barata é pelo fim da chave primária:

```sql
select runid, jobid, status, left(coalesce(return_message, '-'), 100) as retorno,
       to_char(start_time, 'DD/MM HH24:MI:SS') as inicio
from cron.job_run_details
order by runid desc
limit 40;
```

Se o `jobid = 58` aparecer com `failed`, a mensagem diz o porquê. Se **não
aparecer** entre os últimos 40 (job 16 roda a cada 10 s, então 40 linhas ≈ 5
min), o pg_cron não está executando o job — e não vale investigar mais:
o Bloco A tira o pg_cron do caminho de qualquer jeito.

### A2. Enfileiramento em fatias, resumível, sem pg_cron

Troca o `INSERT` único por `enqueue_campaign_chunk(campaign, limite)`: cada
chamada insere uma fatia (5.000 por padrão) avançando um **cursor por
e-mail** guardado na campanha. Cabe nos 8 s; pode ser chamada por edge
function; se morrer no meio, a próxima chamada continua de onde parou; o
total aparece na tela **crescendo** enquanto enfileira; e o worker já começa
a enviar as primeiras fatias enquanto as últimas entram.

Quem chama: uma edge function nova, `enqueue-campaign`, disparada pelo
`dispatch-campaign` e que se auto-reinvoca até terminar. O
`process-email-queue` (10 s, comprovadamente vivo) vigia campanhas em
`sending` paradas há mais de 90 s e reinicia o enfileiramento — é o
substituto do cron, com uma peça que já funciona.

SQL no §A do apêndice. Pedido ao Lovable: **P1**.

### A3. Desligar o cron 58

Para não existirem dois enfileiradores. No apêndice.

## 4. Bloco B — velocidade (SQL + 2 pedidos ao Lovable)

### B1. Contadores por statement, não por linha

`tg_email_queue_campaign_counters` vira `FOR EACH STATEMENT` com transition
tables: um lote de 100 e-mails marcados `sent` gera **um** `UPDATE` na
campanha e **um** upsert em `campaign_throughput`, em vez de 200. Some a
linha quente. SQL no §B1.

### B2. Uma RPC para preparar o lote, uma para fechar

- `prepare_send_batch(clinic, template, domínio, jobs)` faz as fases 1–4 e 6
  de uma vez (descadastro, dedup, cota, warm-up, tokens) e devolve, por job,
  `send | unsubscribed | already_sent | quota_reached | warmup_cap_reached` +
  token. As devoluções de reserva nos skips acontecem dentro, na mesma
  transação. Throttle por destino (fase 5) fica no JS, só quando ligado.
- `finalize_send_batch(clinic, template, rows)` grava os logs, marca a fila
  como `sent` e carimba o `resend_id` no dedup — **três statements**, um
  round-trip. (Hoje: 100 updates + 1 insert + 1 update.)

Por lote: de ~107 round-trips para **3**. SQL nos §B2/§B3. Pedido: **P3**.

### B3. Worker em cadeias paralelas

Com o claim atômico (`SKIP LOCKED`), duas invocações simultâneas pegam
lotes diferentes. O worker passa a aceitar **até 2 cadeias** (limite por
contagem de `processing` recente) e pula o health check em 90 % das vezes.
`BATCH_PARALLELISM` vira configurável para acompanhar o rate limit do Resend.
Pedido: **P2**.

## 5. Bloco C — fora do código

- **Pedir ao Resend aumento do rate limit** da conta do MCD (eles atendem sob
  pedido, normalmente em horas). Cada +1 req/s = +100 e-mails/s de teto.
  Ajustar `BATCH_PARALLELISM` ≈ rate × latência do lote (~1 s).
- Confirmar o tier atual (❓) — define o paralelismo inicial.

## 6. O que os freios automáticos vão fazer, já que não vamos frear

Registrado para não surpreender:

- `tg_suppress_on_bounce` **remove da lista** cada e-mail que der bounce
  (hard ou soft). A lista encolhe sozinha; a próxima campanha sai mais limpa.
- `check_clinic_bounce_health` marca campanhas como `paused` quando bounce
  > 5 % nos últimos 1.000 logs — **mas não para a fila** (G-39). Na prática,
  só suja `email_health_alerts` (no máximo 1 linha a cada 10 min).
- `send_rate_per_minute` **vazio = sem espaçamento**. É o que se quer aqui.
- Fora do nosso controle: o **Resend** suspende contas com bounce/reclamação
  altos sustentados. Recuperar domínio é uma coisa; recuperar a conta do
  provedor é outra. Uma linha de aviso, como combinado — sem frear.

## 7. Ordem de execução e validação

| Passo | Quem | O quê | Validação |
|---|---|---|---|
| 1 | usuário (SQL) | A1 diagnóstico | só informação |
| 2 ✅ | usuário (SQL) | §A apêndice (colunas, índices, `enqueue_campaign_chunk`, unschedule 58) | `select proname from pg_proc where proname = 'enqueue_campaign_chunk'` |
| 3 ✅ | Lovable | **P1** (`enqueue-campaign` + `dispatch-campaign`) | campanha "teste" → `sent`, 0, `enqueue_finished_at` preenchido, sem erro (22/08 00:26) |
| 4 | usuário (SQL) | §B1 trigger por statement | pausar/retomar uma campanha vazia não dá erro |
| 5 | usuário (SQL) | §B2 + §B3 RPCs | `select proname from pg_proc where proname in ('prepare_send_batch','finalize_send_batch')` |
| 6 | Lovable | **P3** (`send-email-batch`) | campanha de teste pequena (segmento estático de ~500) chega; `email_logs` com `resend_id`; `email_send_dedup.resend_id` preenchido |
| 7 | Lovable | **P2** (`process-email-queue`) | durante o teste de 500, duas invocações no log sem e-mail duplicado |
| 8 | usuário | pedido de rate limit ao Resend | — |
| 9 | usuário | **146k.** Olhar Ao vivo: taxa/min e falhas | `sent_count` sobe; tempo total anotado em `INCIDENTES.md` |

Não pular o passo 3: é o teste que em 21/08 achou o `forbidden` sem enviar
nada.

## Apêndice A — enfileiramento em fatias

```sql
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS enqueue_cursor text,
  ADD COLUMN IF NOT EXISTS enqueue_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS enqueue_finished_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_clinic_lower_email_idx
  ON public.leads (clinic_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS esc_segment_lower_email_idx
  ON public.email_segment_contacts (segment_id, lower(email));

CREATE OR REPLACE FUNCTION public.enqueue_campaign_chunk(_campaign_id uuid, _limit int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _c public.email_campaigns%ROWTYPE;
  _segs uuid[]; _static uuid[] := '{}'::uuid[]; _dynamic uuid[] := '{}'::uuid[];
  _todos boolean;
  _rate int; _base int; _t0 timestamptz;
  _var_id uuid[] := '{}'; _var_subj text[] := '{}'; _var_tpl text[] := '{}'; _var_from text[] := '{}';
  _dom text[] := '{}'; _nv int; _nd int;
  _lim int := LEAST(GREATEST(COALESCE(_limit, 5000), 100), 20000);
  _cursor text; _new_cursor text;
  _rows int := 0; _ins int := 0; _dyn int := 0; _total int;
  rec RECORD; i int;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- duas invocacoes simultaneas para a mesma campanha: a segunda sai
  IF NOT pg_try_advisory_xact_lock(hashtext('enqueue:' || _campaign_id::text)) THEN
    RETURN jsonb_build_object('done', false, 'inserted', 0, 'reason', 'locked');
  END IF;

  SELECT * INTO _c FROM public.email_campaigns WHERE id = _campaign_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'campanha % inexistente', _campaign_id; END IF;
  IF _c.enqueue_finished_at IS NOT NULL THEN
    RETURN jsonb_build_object('done', true, 'inserted', 0, 'total', COALESCE(_c.enqueued_count, 0), 'reason', 'finished');
  END IF;
  IF _c.status <> 'sending' THEN
    RETURN jsonb_build_object('done', true, 'inserted', 0, 'total', COALESCE(_c.enqueued_count, 0), 'reason', 'status_' || _c.status);
  END IF;

  _segs := CASE
    WHEN _c.segment_ids IS NOT NULL AND array_length(_c.segment_ids, 1) > 0 THEN _c.segment_ids
    WHEN _c.segment_id IS NOT NULL THEN ARRAY[_c.segment_id]
    ELSE '{}'::uuid[] END;
  _todos := COALESCE(array_length(_segs, 1), 0) = 0;

  IF NOT _todos THEN
    SELECT COALESCE(array_agg(s.id) FILTER (WHERE COALESCE(s.filters->>'kind', 'dynamic') = 'static'),  '{}'::uuid[]),
           COALESCE(array_agg(s.id) FILTER (WHERE COALESCE(s.filters->>'kind', 'dynamic') <> 'static'), '{}'::uuid[])
      INTO _static, _dynamic
      FROM public.email_segments s
     WHERE s.id = ANY(_segs) AND s.clinic_id = _c.clinic_id;
  END IF;

  _rate   := GREATEST(COALESCE(_c.send_rate_per_minute, 0), 0);
  _base   := COALESCE(_c.enqueued_count, 0);
  _t0     := COALESCE(_c.enqueue_started_at, now());
  _cursor := COALESCE(_c.enqueue_cursor, '');

  IF COALESCE(_c.variant_strategy, 'none') <> 'none' THEN
    FOR rec IN SELECT id, weight, subject_override, template_slug_override, from_name_override
                 FROM public.email_campaign_variants WHERE campaign_id = _campaign_id ORDER BY id
    LOOP
      FOR i IN 1..GREATEST(COALESCE(rec.weight, 1), 1) LOOP
        _var_id := _var_id || rec.id;              _var_subj := _var_subj || rec.subject_override;
        _var_tpl := _var_tpl || rec.template_slug_override; _var_from := _var_from || rec.from_name_override;
      END LOOP;
    END LOOP;
  END IF;

  IF NULLIF(btrim(COALESCE(_c.from_domain_pool, '')), '') IS NOT NULL THEN
    FOR rec IN SELECT domain, rotation_weight FROM public.email_domains
                WHERE clinic_id = _c.clinic_id AND rotation_pool = btrim(_c.from_domain_pool)
                  AND status IN ('verified', 'partially_verified') ORDER BY domain
    LOOP
      FOR i IN 1..GREATEST(COALESCE(rec.rotation_weight, 1), 1) LOOP _dom := _dom || rec.domain; END LOOP;
    END LOOP;
  END IF;
  _nv := COALESCE(array_length(_var_id, 1), 0);
  _nd := COALESCE(array_length(_dom, 1), 0);

  -- 1) segmentos dinamicos (regras sobre leads): de uma vez, so na primeira fatia
  IF _c.enqueue_started_at IS NULL AND COALESCE(array_length(_dynamic, 1), 0) > 0 THEN
    WITH raw AS (
      SELECT lower(r.email) AS email, r.name, r.lead_id
        FROM unnest(_dynamic) AS s(id)
        CROSS JOIN LATERAL public.resolve_email_segment(s.id) AS r
       WHERE r.email IS NOT NULL AND r.email LIKE '%@%'
    ), dedup AS (
      SELECT DISTINCT ON (email) email, name, lead_id FROM raw ORDER BY email, lead_id NULLS LAST
    ), numbered AS (
      SELECT d.*, (row_number() OVER (ORDER BY d.email) - 1)::int + _base AS idx FROM dedup d
    ), ins AS (
      INSERT INTO public.email_queue (
        clinic_id, template_slug, recipient_email, recipient_name, variables, scheduled_at,
        related_lead_id, related_lead_table, force_send, from_name_override, from_domain_override,
        variant_id, priority, status)
      SELECT _c.clinic_id,
             COALESCE(CASE WHEN _nv > 0 THEN _var_tpl[(n.idx % _nv) + 1] END, _c.template_slug),
             n.email, n.name,
             jsonb_build_object('name', COALESCE(n.name, ''), 'campaign_id', _campaign_id,
               'variant_id',       CASE WHEN _nv > 0 THEN _var_id[(n.idx % _nv) + 1] END,
               'subject_override', CASE WHEN _nv > 0 THEN _var_subj[(n.idx % _nv) + 1] END),
             CASE WHEN _rate > 0 THEN _t0 + ((n.idx / _rate) * interval '1 minute') ELSE now() END,
             n.lead_id, 'campaign_' || _campaign_id::text, false,
             COALESCE(CASE WHEN _nv > 0 THEN _var_from[(n.idx % _nv) + 1] END, _c.from_name_override),
             CASE WHEN _nd > 0 THEN _dom[(n.idx % _nd) + 1] END,
             CASE WHEN _nv > 0 THEN _var_id[(n.idx % _nv) + 1] END,
             5, 'pending'
        FROM numbered n
      ON CONFLICT (clinic_id, template_slug, lower(recipient_email), related_lead_table)
        WHERE status = 'pending' AND related_lead_table IS NOT NULL AND related_lead_table <> 'leads_internal'
      DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO _dyn FROM ins;
    _base := _base + _dyn;
  END IF;

  -- 2) fatia por cursor em lower(email): contatos (+ leads quando "Todos")
  WITH src AS (
    (SELECT lower(k.email) AS email, k.name, k.lead_id
       FROM public.email_segment_contacts k
      WHERE k.clinic_id = _c.clinic_id
        AND (_todos OR k.segment_id = ANY(_static))
        AND k.email IS NOT NULL AND k.email LIKE '%@%'
        AND lower(k.email) > _cursor
      ORDER BY lower(k.email) LIMIT _lim)
    UNION ALL
    (SELECT lower(l.email), l.name, l.id
       FROM public.leads l
      WHERE _todos AND l.clinic_id = _c.clinic_id
        AND l.email IS NOT NULL AND l.email <> '' AND l.email LIKE '%@%'
        AND lower(l.email) > _cursor
      ORDER BY lower(l.email) LIMIT _lim)
  ), lim AS (
    SELECT * FROM src ORDER BY email LIMIT _lim
  ), dedup AS (
    SELECT DISTINCT ON (email) email, name, lead_id FROM lim ORDER BY email, lead_id NULLS LAST
  ), numbered AS (
    SELECT d.*, (row_number() OVER (ORDER BY d.email) - 1)::int + _base AS idx FROM dedup d
  ), ins AS (
    INSERT INTO public.email_queue (
      clinic_id, template_slug, recipient_email, recipient_name, variables, scheduled_at,
      related_lead_id, related_lead_table, force_send, from_name_override, from_domain_override,
      variant_id, priority, status)
    SELECT _c.clinic_id,
           COALESCE(CASE WHEN _nv > 0 THEN _var_tpl[(n.idx % _nv) + 1] END, _c.template_slug),
           n.email, n.name,
           jsonb_build_object('name', COALESCE(n.name, ''), 'campaign_id', _campaign_id,
             'variant_id',       CASE WHEN _nv > 0 THEN _var_id[(n.idx % _nv) + 1] END,
             'subject_override', CASE WHEN _nv > 0 THEN _var_subj[(n.idx % _nv) + 1] END),
           CASE WHEN _rate > 0 THEN _t0 + ((n.idx / _rate) * interval '1 minute') ELSE now() END,
           n.lead_id, 'campaign_' || _campaign_id::text, false,
           COALESCE(CASE WHEN _nv > 0 THEN _var_from[(n.idx % _nv) + 1] END, _c.from_name_override),
           CASE WHEN _nd > 0 THEN _dom[(n.idx % _nd) + 1] END,
           CASE WHEN _nv > 0 THEN _var_id[(n.idx % _nv) + 1] END,
           5, 'pending'
      FROM numbered n
    ON CONFLICT (clinic_id, template_slug, lower(recipient_email), related_lead_table)
      WHERE status = 'pending' AND related_lead_table IS NOT NULL AND related_lead_table <> 'leads_internal'
    DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM lim), (SELECT max(email) FROM lim), (SELECT count(*) FROM ins)
    INTO _rows, _new_cursor, _ins;

  _total := _base + _ins;

  UPDATE public.email_campaigns
     SET enqueued_count      = _total,
         total_recipients    = _total,
         enqueue_cursor      = COALESCE(_new_cursor, enqueue_cursor),
         enqueue_started_at  = COALESCE(enqueue_started_at, _t0),
         enqueue_finished_at = CASE WHEN _rows < _lim THEN now()   ELSE enqueue_finished_at END,
         status              = CASE WHEN _rows < _lim THEN 'sent'  ELSE status END,
         sent_at             = CASE WHEN _rows < _lim THEN now()   ELSE sent_at END,
         updated_at          = now()
   WHERE id = _campaign_id;

  RETURN jsonb_build_object('done', _rows < _lim, 'inserted', _ins + _dyn, 'total', _total, 'cursor', _new_cursor);
END;
$fn$;

COMMENT ON FUNCTION public.enqueue_campaign_chunk(uuid, int) IS
  'Enfileira UMA fatia da campanha (keyset em lower(email)) e avanca o cursor. '
  'Cabe nos 8s do PostgREST; chamada em laco pela edge enqueue-campaign ate done=true. '
  'docs/roadmap/EMAIL_VELOCIDADE.md A2.';

REVOKE ALL ON FUNCTION public.enqueue_campaign_chunk(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_campaign_chunk(uuid, int) TO service_role;

DO $$ BEGIN PERFORM cron.unschedule('enqueue-pending-campaigns');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
```

## Apêndice B1 — contadores por statement

```sql
CREATE OR REPLACE FUNCTION public.tg_email_queue_campaign_counters_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  WITH delta AS (
    SELECT substring(n.related_lead_table from 10)::uuid AS campaign_id,
           count(*) FILTER (WHERE n.status = 'sent'   AND o.sent_at IS NULL)::int  AS sent,
           count(*) FILTER (WHERE n.status = 'failed' AND o.status <> 'failed')::int AS failed
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
     WHERE n.related_lead_table ~ '^campaign_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND n.status IS DISTINCT FROM o.status
     GROUP BY 1
  ), upd AS (
    UPDATE public.email_campaigns c
       SET sent_count   = COALESCE(c.sent_count, 0)   + d.sent,
           failed_count = COALESCE(c.failed_count, 0) + d.failed,
           last_sent_at = CASE WHEN d.sent > 0 THEN now() ELSE c.last_sent_at END,
           updated_at   = now()
      FROM delta d
     WHERE c.id = d.campaign_id AND (d.sent > 0 OR d.failed > 0)
    RETURNING c.id
  )
  INSERT INTO public.campaign_throughput (campaign_id, minute, sent, failed, updated_at)
  SELECT d.campaign_id, date_trunc('minute', now()), d.sent, d.failed, now()
    FROM delta d
   WHERE d.sent > 0 OR d.failed > 0
  ON CONFLICT (campaign_id, minute) DO UPDATE
    SET sent       = campaign_throughput.sent   + EXCLUDED.sent,
        failed     = campaign_throughput.failed + EXCLUDED.failed,
        updated_at = now();
  RETURN NULL;
END;
$fn$;

-- Postgres nao aceita `UPDATE OF coluna` junto com transition tables
-- (erro 0A000). Fica AFTER UPDATE; o filtro "so quando o status mudou" ja
-- esta dentro da funcao.
DROP TRIGGER IF EXISTS trg_email_queue_campaign_counters ON public.email_queue;
CREATE TRIGGER trg_email_queue_campaign_counters
AFTER UPDATE ON public.email_queue
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.tg_email_queue_campaign_counters_stmt();
```

## Apêndice B2 — `prepare_send_batch`

```sql
CREATE OR REPLACE FUNCTION public.prepare_send_batch(
  _clinic_id uuid, _template_slug text, _from_domain text, _jobs jsonb)
RETURNS TABLE(queue_id uuid, recipient text, outcome text, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _qid uuid[]; _em text[]; _force boolean[]; _use boolean[]; _ctx text[];
  _n int; _out text[]; _tok text[];
  _unsub text[]; _claimed int[]; _denied int[];
  _granted int; _cnt int; _i int; _k int;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT array_agg((x->>'queue_id')::uuid ORDER BY t.ord),
         array_agg(lower(btrim(COALESCE(x->>'email', ''))) ORDER BY t.ord),
         array_agg(COALESCE((x->>'force')::boolean, false) ORDER BY t.ord),
         array_agg(COALESCE((x->>'use_dedup')::boolean, false) ORDER BY t.ord),
         array_agg(COALESCE(x->>'context', '') ORDER BY t.ord)
    INTO _qid, _em, _force, _use, _ctx
    FROM jsonb_array_elements(COALESCE(_jobs, '[]'::jsonb)) WITH ORDINALITY AS t(x, ord);
  _n := COALESCE(array_length(_qid, 1), 0);
  IF _n = 0 THEN RETURN; END IF;
  _out := array_fill(NULL::text, ARRAY[_n]);
  _tok := array_fill(NULL::text, ARRAY[_n]);

  -- fase 1: descadastro (force ignora)
  SELECT COALESCE(array_agg(lower(u.email)), '{}'::text[]) INTO _unsub
    FROM public.email_unsubscribes u
   WHERE u.clinic_id = _clinic_id AND lower(u.email) = ANY(_em);
  FOR _i IN 1.._n LOOP
    IF NOT _force[_i] AND _em[_i] = ANY(_unsub) THEN _out[_i] := 'unsubscribed'; END IF;
  END LOOP;

  -- fase 2: dedup em lote (um INSERT; quem nao entrou ja tinha sido enviado)
  WITH cand AS (
    SELECT g.i, _em[g.i] AS e, _ctx[g.i] AS c
      FROM generate_subscripts(_em, 1) AS g(i)
     WHERE _out[g.i] IS NULL AND _use[g.i]
  ), ins AS (
    INSERT INTO public.email_send_dedup (clinic_id, template_slug, email, context)
    SELECT _clinic_id, _template_slug, cand.e, cand.c FROM cand
    ON CONFLICT DO NOTHING
    RETURNING email_send_dedup.email, email_send_dedup.context
  )
  SELECT COALESCE(array_agg(cand.i), '{}'::int[]) INTO _claimed
    FROM cand
   WHERE EXISTS (SELECT 1 FROM ins WHERE ins.email = cand.e AND ins.context = cand.c);
  FOR _i IN 1.._n LOOP
    IF _out[_i] IS NULL AND _use[_i] AND NOT (_i = ANY(_claimed)) THEN _out[_i] := 'already_sent'; END IF;
  END LOOP;

  -- fase 3: cota do lote
  SELECT count(*) INTO _cnt FROM generate_subscripts(_em, 1) AS g(i) WHERE _out[g.i] IS NULL;
  IF _cnt > 0 THEN
    SELECT q.granted INTO _granted FROM public.claim_email_quota_bulk(_clinic_id, _cnt) AS q;
    _granted := COALESCE(_granted, 0);
    IF _granted < _cnt THEN
      _k := 0; _denied := '{}'::int[];
      FOR _i IN 1.._n LOOP
        IF _out[_i] IS NULL THEN
          _k := _k + 1;
          IF _k > _granted THEN _out[_i] := 'quota_reached'; _denied := _denied || _i; END IF;
        END IF;
      END LOOP;
      DELETE FROM public.email_send_dedup d
       WHERE d.clinic_id = _clinic_id AND d.template_slug = _template_slug
         AND (d.email, d.context) IN (SELECT _em[x], _ctx[x] FROM unnest(_denied) AS x WHERE _use[x]);
    END IF;
  END IF;

  -- fase 4: warm-up do dominio remetente
  SELECT count(*) INTO _cnt FROM generate_subscripts(_em, 1) AS g(i) WHERE _out[g.i] IS NULL;
  IF _cnt > 0 THEN
    SELECT w.granted INTO _granted FROM public.claim_domain_warmup_bulk(_clinic_id, _from_domain, _cnt) AS w;
    _granted := COALESCE(_granted, 0);
    IF _granted < _cnt THEN
      _k := 0; _denied := '{}'::int[];
      FOR _i IN 1.._n LOOP
        IF _out[_i] IS NULL THEN
          _k := _k + 1;
          IF _k > _granted THEN _out[_i] := 'warmup_cap_reached'; _denied := _denied || _i; END IF;
        END IF;
      END LOOP;
      DELETE FROM public.email_send_dedup d
       WHERE d.clinic_id = _clinic_id AND d.template_slug = _template_slug
         AND (d.email, d.context) IN (SELECT _em[x], _ctx[x] FROM unnest(_denied) AS x WHERE _use[x]);
      PERFORM public.release_email_quota_bulk(_clinic_id, COALESCE(array_length(_denied, 1), 0));
    END IF;
  END IF;

  -- fase 6: tokens de descadastro para quem vai sair
  FOR _i IN 1.._n LOOP
    IF _out[_i] IS NULL THEN
      _out[_i] := 'send';
      _tok[_i] := public.generate_unsubscribe_token(_clinic_id, _em[_i]);
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT _qid[g.i], _em[g.i], _out[g.i], _tok[g.i]
    FROM generate_subscripts(_qid, 1) AS g(i)
   ORDER BY g.i;
END;
$fn$;

REVOKE ALL ON FUNCTION public.prepare_send_batch(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_send_batch(uuid, text, text, jsonb) TO service_role;
```

## Apêndice B3 — `finalize_send_batch`

```sql
CREATE OR REPLACE FUNCTION public.finalize_send_batch(_clinic_id uuid, _template_slug text, _rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _logs int; _queue int; _dedup int;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.email_logs (
    clinic_id, resend_id, template_slug, recipient_email, subject, status,
    related_lead_id, related_lead_table, variant_id, from_domain_override, events, sent_at)
  SELECT _clinic_id, x->>'resend_id', _template_slug, lower(btrim(x->>'email')),
         COALESCE(x->>'subject', ''), 'sent',
         NULLIF(x->>'related_lead_id', '')::uuid, NULLIF(x->>'related_lead_table', ''),
         NULLIF(x->>'variant_id', '')::uuid, NULLIF(x->>'from_domain_override', ''),
         jsonb_build_array(jsonb_build_object('type', 'sent', 'at', now(), 'batch', true)), now()
    FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS x
   WHERE COALESCE(x->>'resend_id', '') <> ''
  ON CONFLICT (resend_id) WHERE resend_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _logs = ROW_COUNT;

  UPDATE public.email_queue q
     SET status = 'sent', sent_at = now(), updated_at = now()
    FROM (SELECT (x->>'queue_id')::uuid AS id
            FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS x
           WHERE COALESCE(x->>'resend_id', '') <> '') AS s
   WHERE q.id = s.id AND q.status <> 'sent';
  GET DIAGNOSTICS _queue = ROW_COUNT;

  UPDATE public.email_send_dedup d
     SET resend_id = s.resend_id
    FROM (SELECT lower(btrim(x->>'email')) AS email, COALESCE(x->>'context', '') AS ctx, x->>'resend_id' AS resend_id
            FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS x
           WHERE COALESCE((x->>'use_dedup')::boolean, false) AND COALESCE(x->>'resend_id', '') <> '') AS s
   WHERE d.clinic_id = _clinic_id AND d.template_slug = _template_slug
     AND d.email = s.email AND d.context = s.ctx;
  GET DIAGNOSTICS _dedup = ROW_COUNT;

  RETURN jsonb_build_object('logs', _logs, 'queue', _queue, 'dedup', _dedup);
END;
$fn$;

REVOKE ALL ON FUNCTION public.finalize_send_batch(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_send_batch(uuid, text, jsonb) TO service_role;
```

## Apêndice P — pedidos ao agente do Lovable

### P1 — `enqueue-campaign` (nova) + `dispatch-campaign`

```text
Criar a edge function supabase/functions/enqueue-campaign/index.ts e ajustar
supabase/functions/dispatch-campaign/index.ts.

CONTEXTO: o enfileiramento de campanha deixou de ser um INSERT unico (nao cabe
nos 8 s do PostgREST) e deixou de depender de pg_cron (nao executou). Agora
existe no banco:
  public.enqueue_campaign_chunk(_campaign_id uuid, _limit int DEFAULT 5000)
    RETURNS jsonb  -> { done: boolean, inserted: int, total: int, cursor: text, reason?: text }
Cada chamada insere uma fatia e avanca um cursor guardado na campanha. Chamar
repetidamente ate done=true. Ela mesma marca a campanha como 'sent' com
total_recipients quando termina. Se duas invocacoes concorrerem, a segunda
recebe { done:false, reason:'locked' } — tratar como "tentar de novo em 2 s".

ENQUEUE-CAMPAIGN (nova, verify_jwt=false, aceita apenas service_role):
  entrada: { campaign_id }
  1. limit = 5000; inicio = Date.now()
  2. loop:
     - chamar supabase.rpc('enqueue_campaign_chunk', { _campaign_id, _limit: limit })
     - se error:
         * se a mensagem contiver 'statement timeout' ou 'canceling statement':
             limit = max(500, floor(limit/2)); continuar (retry)
         * senao: UPDATE email_campaigns SET status='failed', error=<mensagem>
                  WHERE id=campaign_id; devolver 500 e parar
     - se data.reason === 'locked': esperar 2 s e continuar
     - se data.done: parar o loop
     - se Date.now() - inicio > 100_000 ms: sair do loop com pendente=true
  3. se pendente: fetch(<propria URL>, { campaign_id }) sem await (self-trigger)
  4. disparar process-email-queue (POST vazio, sem await) e devolver 202
     { ok:true, total: <ultimo total>, done }

DISPATCH-CAMPAIGN: no caminho real (nao test_only), depois de marcar
status='sending' e passar nas pre-checagens R-4, disparar
enqueue-campaign com { campaign_id } SEM await (fetch com service role), e
devolver 202 { ok:true, status:'queueing' } como hoje. Nao chamar mais
enqueue_campaign_recipients nem enqueue_pending_campaigns. Manter test_only
e as pre-checagens intactos.

Contexto: docs/roadmap/EMAIL_VELOCIDADE.md A2.
```

### P2 — `process-email-queue`

```text
Alterar supabase/functions/process-email-queue/index.ts.

1) VIGIA DE ENFILEIRAMENTO (substitui o pg_cron): logo apos o reaper,
   select id from email_campaigns
    where status='sending' and enqueue_finished_at is null
      and updated_at < now() - interval '90 seconds'
    limit 3;
   para cada id, fetch enqueue-campaign { campaign_id } sem await.

2) CADEIAS PARALELAS (o claim e atomico via SKIP LOCKED, entao e seguro):
   - antes do claim: contar email_queue com status='processing' e
     updated_at > now() - interval '2 minutes'. Se >= 2 * BATCH_SIZE, devolver
     { skipped:'busy' } sem processar (ja ha cadeias suficientes).
   - manter o self-trigger de 1 invocacao quando jobs.length >= SELF_TRIGGER_THRESHOLD.
     (O cron de 10 s abre a segunda cadeia; o limite acima impede a terceira.)

3) PARALELISMO CONFIGURAVEL: BATCH_PARALLELISM e CONCURRENCY passam a ler
   Deno.env.get('EMAIL_BATCH_PARALLELISM') / ('EMAIL_SINGLE_CONCURRENCY') com
   os valores atuais (5 / 5) como default.

4) HEALTH CHECK: chamar check_email_operational_health so quando
   Math.random() < 0.1 (roda a cada 10 s; uma vez por ~100 s basta).

NAO ALTERAR: reaper, claim_email_queue_batch, agrupamento, buckets e
bulk-updates finais.

Contexto: docs/roadmap/EMAIL_VELOCIDADE.md B3.
```

### P3 — `send-email-batch`

```text
Alterar supabase/functions/send-email-batch/index.ts.

EXISTEM NO BANCO:
  prepare_send_batch(_clinic_id uuid, _template_slug text, _from_domain text, _jobs jsonb)
    -> TABLE(queue_id uuid, recipient text, outcome text, token text)
       outcome: 'send' | 'unsubscribed' | 'already_sent' | 'quota_reached' | 'warmup_cap_reached'
       _jobs: [{ queue_id, email, force, use_dedup, context }]
  finalize_send_batch(_clinic_id uuid, _template_slug text, _rows jsonb) -> jsonb
       _rows: [{ queue_id, email, resend_id, subject, related_lead_id,
                 related_lead_table, variant_id, from_domain_override, use_dedup, context }]

MUDANCA 1 — substituir as fases 1, 2, 3, 4 e 6 por UMA chamada a
prepare_send_batch com todos os jobs do lote. Mapear outcome para o array
`skipped` exatamente como hoje (mesmos reasons, mesmos reschedule_at:
quota -> 12:00 UTC de amanha; warmup -> +30 min; unsubscribed e already_sent
sem reschedule). As devolucoes de dedup/cota/warmup dos pulados JA sao feitas
dentro da funcao — nao chamar release_* para eles. Usar o `token` devolvido
para montar a unsubscribeUrl. Se a RPC devolver error: devolver 500 sem
processar (o worker reverte os jobs com backoff).

MUDANCA 2 — manter a fase 5 (throttle por destino) no JS, por job, SO quando
throttleEnabled, aplicada aos jobs com outcome 'send'. Para um job barrado
pelo throttle continuar devolvendo dedup (release_send_dedup_batch com 1
e-mail), cota (release_email_quota_bulk 1) e warmup (release_domain_warmup_bulk 1).

MUDANCA 3 — depois da resposta OK do Resend, substituir o laco que faz
UPDATE em email_send_dedup por e-mail + INSERT de logs + UPDATE da fila por
UMA chamada a finalize_send_batch com os jobs que receberam id. Para jobs que
NAO receberam id (raro), manter o tratamento individual atual (release +
re-pending com attempts+1).

MANTER: render, payload do Resend, Idempotency-Key, caminho de falha do
Resend (!resp.ok) com as liberacoes em lote.

RESULTADO ESPERADO: de ~107 idas ao banco por lote de 100 para 3.

Contexto: docs/roadmap/EMAIL_VELOCIDADE.md B2.
```

## Histórico

- **2026-08-21** — criado após o disparo de 146k ficar preso em `sending`
  (cron 58 sem executar) e a decisão do usuário de priorizar velocidade sobre
  bounce.
