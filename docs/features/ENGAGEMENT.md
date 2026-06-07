---
title: "Feature: Engajamento (respostas a broadcasts e sequências)"
topic: ai
kind: feature
audience: agent
updated: 2026-06-07
summary: "A feature \\\\\\\"Engajamento\\\\\\\" mede **taxa de resposta** de mensagens enviadas pela clínica via WhatsApp:"
---
# Feature: Engajamento (respostas a broadcasts e sequências)

> **Quando ler:** antes de mexer na aba `Engajamento` em IA, RPCs `engagement_*` ou nas colunas de snapshot em `message_sequence_runs`.
> **Última atualização:** 2026-05-30
> **Veja também:** `database/FUNCTIONS_TRIGGERS.md` (RPCs), `flows/AI_AGENT_LOOP.md` (como `replied_at` é preenchido), `frontend/PAGES.md` § 2.3.

---

## Visão geral

A feature "Engajamento" mede **taxa de resposta** de mensagens enviadas pela clínica via WhatsApp:

- **Broadcasts** (disparo em massa) — agrega por broadcast: enviados, lidos, respondidos.
- **Sequências** (drip) — agrega por sequência e por passo da sequência: enviados, respondidos, taxa.

Não mede engajamento de **email** (isso vive em `email_logs.events[]` e `email_throughput_stats`).

---

## UI

- **Onde**: aba **Engajamento** dentro do hub `/ai` (`pages/MetricsEngagement.tsx`).
- **Rota canônica**: `/ai/engagement`. Aliases mantidos: `/metrics/engagement`, `/metrics`.
- **Não tem item no sidebar** — acessada via tabs do AiHub.
- Filtro de período (`_from`/`_to`) — default 7 dias.

---

## Backend

### RPCs (security definer, sem acesso público — `REVOKE EXECUTE` para `PUBLIC` e `anon`)

| RPC | Retorno | Uso na UI |
|---|---|---|
| `engagement_broadcasts_summary(_from, _to)` | broadcast_id, name, sent, replied, reply_rate | Tabela "Broadcasts" |
| `engagement_sequences_summary(_from, _to)` | sequence_id, name, sent, replied, reply_rate | Tabela "Sequências" |
| `engagement_sequence_steps(_sequence_id, _from, _to)` | step_index, sent, replied, reply_rate | Drilldown ao clicar numa sequência |

Acesso: `EXECUTE` apenas para `authenticated` (escopo por clinic enforced dentro da função via `auth.uid()` → membership).

### Snapshot em `message_sequence_runs`

Para que a métrica seja precisa retroativamente (mesmo se o lead mudar de stage ou a sequência for editada), o registro do envio salva:

- `replied_at timestamptz` — quando o lead respondeu (preenchido pelo handler de mensagens inbound).
- `stage_id_at_send uuid` — pipeline stage do lead no momento do envio.
- `stage_position_at_send int` — posição da stage (para ordenar drilldown).

Essas colunas foram adicionadas em 2026-05-30. Registros antigos têm `NULL` — as RPCs lidam com isso filtrando pela existência do snapshot.

---

## Como `replied_at` é preenchido

O handler de inbound (`ai-auto-reply` / `evolution-webhook`) procura o último `message_sequence_runs` aberto para o lead e marca `replied_at = now()` na primeira resposta após o envio. Não há reset — só conta a 1ª resposta.

---

## Arquivos-chave

- Frontend: `src/pages/MetricsEngagement.tsx`, `src/pages/ai/AiHub.tsx` (aba).
- Backend: RPCs `engagement_*` em `supabase/migrations/`.
- DB: colunas `replied_at`, `stage_id_at_send`, `stage_position_at_send` em `message_sequence_runs`.
