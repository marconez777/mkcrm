# Fluxo: Broadcast (envio em massa WhatsApp)

> **Quando ler:** antes de mexer no envio em massa do WhatsApp — criação, audiência, throttling, retry.
> **Última atualização:** 2026-05-25

---

## Atores

- **Frontend** página `Broadcasts` (criação)
- **Postgres**: `broadcasts`, `broadcast_recipients`, `broadcast_message_variants`
- **Edge function** `broadcast-control` (start/pause/cancel)
- **Edge function** `broadcast-tick` (worker, roda via `pg_cron` a cada 1min)
- **Edge function** `evolution-send` / `evolution-send-media`

---

## Sequência

```text
Usuário cria broadcast
        │ define: audiência (filtro), 1+ variantes de mensagem (A/B),
        │ schedule_at, throttle (msgs/min), instância
        ▼
broadcast-control('create')
        │ INSERT broadcasts(status='draft')
        │ INSERT broadcast_message_variants
        │ FREEZE audience: INSERT broadcast_recipients (lead_id, variant_id round-robin)
        │                  status='pending'
        ▼
Usuário clica "iniciar"
        │
        ▼
broadcast-control('start') → UPDATE broadcasts(status='running', started_at)
        │
        ▼
[loop] broadcast-tick a cada 1min (pg_cron):
        │ SELECT broadcasts WHERE status='running'
        │ para cada broadcast:
        │   1) advisory_lock(broadcast_id)  ← evita 2 ticks concorrentes
        │   2) calcula budget = throttle_per_min - sent_no_last_60s
        │   3) SELECT broadcast_recipients WHERE status='pending' LIMIT budget
        │   4) UPDATE recipients SET status='claimed', claimed_at=now() (atomic)
        │   5) para cada claim (com jitter aleatório 50-300ms):
        │        chama evolution-send/-media
        │        UPDATE status='sent' OU 'failed'
        │   6) se SUM(pending)=0 → status='done'
        │   7) release lock
```

---

## Estados

| Status broadcast | Significado |
|---|---|
| `draft` | criada, ainda não inicia |
| `scheduled` | aguardando `schedule_at` |
| `running` | em envio |
| `paused` | pausada manualmente |
| `done` | sem mais `pending` |
| `cancelled` | cancelada (`pending` viram `skipped`) |

| Status recipient | Significado |
|---|---|
| `pending` | aguardando claim |
| `claimed` | tick pegou, vai enviar |
| `sent` | Evolution OK |
| `failed` | erro persistente (sem retry automático) |
| `skipped_unsubscribed` | lead optou-out de marketing |
| `skipped_invalid_phone` | normalizePhoneBR falhou |

---

## Throttling e jitter

- `throttle_per_min` por broadcast (default 30, max definido em `clinic_settings.broadcast_max_per_min`).
- Jitter aleatório entre envios evita padrão "bot".
- Respeita `business_hours` da clínica — fora dela, tick pula sem alterar status.
- Múltiplos broadcasts no mesmo clinic competem pelo throttle global do `clinic_settings`.

---

## A/B (message variants)

- `broadcast_message_variants` com `weight` (round-robin ponderado na hora do freeze).
- Após `done`, agregamos `sent_count`, `delivered_count`, `read_count`, `reply_count` por variant — visível na UI.

---

## Personalização

- Variáveis suportadas: `{{nome}}`, `{{primeiro_nome}}`, `{{clinica}}`, `{{link_agendamento}}`.
- Interpolação acontece **no tick**, não no freeze (permite editar variant antes do start).

---

## Cancel / pause

- `broadcast-control('pause')`: status → `paused`. Tick ignora.
- `broadcast-control('cancel')`: status → `cancelled`, `UPDATE recipients SET status='skipped_cancelled' WHERE status='pending'`. Claimed continuam (já estavam enviando).

---

## Pegadinhas

- **Audience freeze**: leads criados depois do freeze **não recebem** (intencional, evita disparar para quem nem opted-in).
- **Sem retry automático em `failed`**: decisão consciente para não spammar leads cujo número está errado. Reenvio manual = duplicar broadcast com filtro `failed`.
- **Claim sem ack**: se `evolution-send` der timeout depois do `claim`, o recipient fica `claimed` para sempre. Job `broadcast-tick` no início libera claims órfãos (`claimed_at < now() - 5min` e sem `sent_at`).
- **Concorrência entre ticks**: pg_cron pode atrasar e disparar 2 ticks juntos. Advisory lock previne race.
- **Opt-out**: lead com `marketing_opt_out=true` é filtrado no freeze. Se opt-out depois, recipients já criados são marcados `skipped_unsubscribed` no momento do envio.

---

## Melhorias sugeridas

- Retry com backoff opcional por categoria de erro.
- Quiet hours por lead (timezone).
- Limite global cross-broadcast por lead/dia (anti-fadiga).
- UI de "dry run" mostrando primeiros 5 leads + preview interpolado.

---

## Arquivos-chave

- `supabase/functions/broadcast-control/index.ts`
- `supabase/functions/broadcast-tick/index.ts`
- `features/BROADCASTS.md`
- `src/pages/Broadcasts.tsx`
