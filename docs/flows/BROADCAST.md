---
title: "Fluxo: Broadcast (envio em massa WhatsApp)"
topic: automations
kind: flow
audience: agent
updated: 2026-06-07
---
# Fluxo: Broadcast (envio em massa WhatsApp)

> **Quando ler:** antes de mexer no envio em massa do WhatsApp — criação, audiência, throttling, retry.
> **Última atualização:** 2026-06-03
> **Veja também:** `features/BROADCASTS.md` (modelo completo).

---

## Atores

- **Frontend** `src/pages/Broadcasts.tsx` (lista, configuração, audiência, eventos)
- **Postgres**: `broadcasts`, `broadcast_message_groups`, `broadcast_message_parts`, `broadcast_recipients`, `broadcast_events`
- **Edge function** `broadcast-control` — actions: `start`, `pause`, `resume`, `cancel`, `delete`, `freeze_audience`, `add_contacts`, `retry_failed`, `test_send_first`
- **Edge function** `broadcast-tick` — worker, roda via `pg_cron` a **cada 1 min** + auto-trigger encadeado
- **Edge function** `evolution-send` (apenas texto — não há mídia em broadcast hoje)
- **RPC** `broadcast_freeze_audience(_broadcast_id, _pipeline_id, _stage_ids, _extra_contacts)`

---

## Sequência

```text
Usuário cria broadcast
        │ define: name, whatsapp_instance_id, throttle_seconds,
        │ send_window ({ start, end, tz, weekdays[] })
        ▼
Cria 1+ broadcast_message_groups (variações por position)
   e suas broadcast_message_parts (drip 1s entre partes do mesmo contato)
        │
        ▼
freeze_audience → RPC broadcast_freeze_audience
        │ snapshot dos leads filtrados → INSERT broadcast_recipients
        │ (status='pending', parts_sent=0, group_position distribuído)
        ▼
broadcast-control('start')
        │ next_send_at = now() para todos pending/sending
        │ UPDATE broadcasts SET status='running'
        │ dispara broadcast-tick (fire-and-forget)
        ▼
[loop] broadcast-tick (pg_cron 1min + auto-trigger):
        │ para cada broadcast status='running':
        │   1) withinWindow(send_window) — fora da janela:
        │      empurra next_send_at de todos pending p/ próxima abertura
        │   2) seleciona 1 recipient (pending|sending) com
        │      next_send_at <= now(), ordenado por next_send_at
        │   3) claim atômico:
        │      UPDATE broadcast_recipients
        │      SET next_send_at = now()+60s
        │      WHERE id=? AND parts_sent=? AND next_send_at<=now()
        │      RETURNING id        ← 0 linhas = outro tick pegou, pula
        │   4) evolution-send(texto interpolado com {{nome}})
        │      exige resp.key.id|messageId|message.id (200 sem id = falha)
        │   5) parts_sent++; se acabou as partes → status='sent'
        │   6) jitter ±10% sobre throttle_seconds → empurra outros pending
        │   7) re-dispara broadcast-tick (fire-and-forget)
        │   8) sem mais recipients elegíveis → status='done' + evento 'done'
```

---

## Estados

| Status `broadcasts.status` | Significado |
|---|---|
| `draft` | criado, ainda não inicia |
| `running` | em envio |
| `paused` | pausado manualmente OU automaticamente (`reason='no_instance'`) |
| `done` | sem mais recipients elegíveis |
| `cancelled` | cancelado pelo usuário |
| `failed` | erro fatal |

| Status `broadcast_recipients.status` | Significado |
|---|---|
| `pending` | aguardando próxima janela de envio |
| `sending` | recebeu pelo menos 1 parte; ainda faltam partes |
| `sent` | todas as partes do grupo enviadas |
| `failed` | erro definitivo no envio (não retenta por padrão; `retry_failed` reabre) |

> Não existem hoje os status `claimed`, `skipped_unsubscribed` ou `skipped_invalid_phone` — o claim é refletido no `next_send_at` futuro e opt-out é responsabilidade do filtro de audiência.

---

## Throttling

- **`throttle_seconds`** por broadcast — intervalo entre **contatos** distintos.
- Jitter **±10%** aplicado a cada empurrão (`next_send_at = now() + throttle_seconds * (1 ± 10%)`).
- **Partes do mesmo contato**: intervalo fixo de **1 segundo**.
- **`send_window`** (`{ start, end, tz, weekdays[] }`) — fora da janela o tick não envia e adia para `nextOpenIso`.
- **Sem throttle global por instância**: dois broadcasts paralelos na mesma instância somam pressão (ver limitações em `features/BROADCASTS.md §7`).

---

## A/B (grupos de mensagens)

- `broadcast_message_groups` com `position`. Cada `recipient.group_position` é fixado no freeze (distribuído round-robin quando há múltiplos grupos).
- Não há split aleatório com métricas comparativas — distribuição é determinística.
- Métricas hoje: apenas `broadcasts.totals.sent` (contagem). `delivered`/`read`/`replied` não são correlacionados (faltaria webhook por `key.id`).

---

## Personalização

- Variáveis interpoladas pelo tick (não no freeze): `{{nome}}` (case-insensitive), via `recipient.name`.
- Sem suporte a `{{primeiro_nome}}` / `{{clinica}}` / `{{link_agendamento}}` no broadcast — para isso, usar **Sequences** (ver `features/SEQUENCES_AUTOMATIONS.md`).

---

## Pause / Cancel / Retry

- `pause` → `status='paused'`. Tick ignora. Auto-pause acontece quando `whatsapp_instance_id` desaparece (`reason='no_instance'`).
- `resume` → volta para `running`.
- `cancel` → `status='cancelled'`. Recipients pendentes ficam como estão (não há `skipped_cancelled`).
- `retry_failed` → recipients com `status='failed'` voltam para `pending` com `next_send_at=now()`.

---

## Pegadinhas

- **Audience freeze**: leads criados depois do freeze **não recebem** (intencional, evita disparar para quem nem opted-in). Use `add_contacts` para reforçar.
- **Sem retry automático em `failed`**: decisão consciente para não spammar números errados. Reenvio = `retry_failed`.
- **Evolution 200 sem `messageId`** = número não existe no WhatsApp → recipient vira `failed`. Comum em listas frias.
- **Claim sem ack**: o claim usa `next_send_at = now()+60s`. Se a execução demorar mais que isso, outro tick pode tentar e ser barrado pelo `parts_sent=?` no WHERE — mas em caso patológico (>60s pendurado) pode duplicar parte. Em produção isso é raro.
- **Concorrência entre ticks**: cron + auto-trigger podem rodar em paralelo; o claim atômico no `UPDATE … RETURNING` previne duplicação.
- **Opt-out**: hoje depende do filtro aplicado no `broadcast_freeze_audience` (`leads.opt_out_marketing`). Após o freeze, opt-outs subsequentes **não** são respeitados — limitação conhecida.

---

## Melhorias sugeridas

- Suporte a mídia (`evolution-send-media`) em broadcasts.
- Retry com backoff opcional por categoria de erro.
- Quiet hours / janela por lead (timezone do contato, não do broadcast).
- Limite global cross-broadcast por lead/dia (anti-fadiga).
- A/B real com split aleatório + métricas comparativas (`delivered`/`replied` via webhook Evolution).
- Lock global por `whatsapp_instance_id` para evitar somar pressão entre broadcasts simultâneos.

---

## Arquivos-chave

- `supabase/functions/broadcast-control/index.ts`
- `supabase/functions/broadcast-tick/index.ts`
- `src/pages/Broadcasts.tsx`
- `src/lib/broadcast-template.ts` (CSV/XLSX da audiência)
- `features/BROADCASTS.md` (modelo completo + troubleshooting)
