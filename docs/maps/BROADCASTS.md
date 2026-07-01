---
title: "Mapa — Broadcasts (disparo em massa)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Motor de disparo em massa via WhatsApp: broadcast-control (start/pause/etc) + broadcast-tick (cron). Cobre modelo de dados (broadcasts/message_groups/message_parts/recipients/events), throttle, janela horária, freeze de audiência, modo teste e bug do position resolvido."
code_refs:
  - supabase/functions/broadcast-control/
  - supabase/functions/broadcast-tick/
  - src/pages/Broadcasts.tsx
  - src/lib/broadcast-template.ts
related_docs:
  - docs/maps/EVOLUTION_EDGES.md
  - docs/maps/WHATSAPP.md
  - docs/clinics/COMPARATIVO.md
---

# Broadcasts — Disparo em Massa

## 1. Modelo de dados (5 tabelas)

| Tabela | Papel |
|---|---|
| `broadcasts` (14 col) | Campanha. Campos: `name`, `status` (`draft|running|paused|done|failed|cancelled`), `whatsapp_instance_id`, `throttle_seconds`, `send_window` (jsonb: `{start,end,tz,weekdays[]}`), `source` (`{type:'pipeline'|'list', pipeline_id, stage_ids[], extra_contacts[]}`), `totals`, `audience_frozen_at`. |
| `broadcast_message_groups` (5 col) | Grupos de mensagem (A/B ou variações). Ordenados por `position`. |
| `broadcast_message_parts` (5 col) | Partes sequenciais de UM grupo (mensagem 1, mensagem 2, ...). Enviadas com **drip de 1s** entre partes. |
| `broadcast_recipients` (17 col) | Destinatários com `phone`, `name`, `status`, `parts_sent`, `next_send_at`, `last_error`, `group_position`, `stage_id_at_send`, `stage_position_at_send`. |
| `broadcast_events` (7 col) | Audit trail (`type`, `payload`) para cada `sent/failed/paused/started/done`. |

Constraint relevante: `broadcasts_throttle_seconds_check` — throttle mínimo já foi relaxado para permitir **modo teste** com valores baixos.

## 2. Frontend — `src/pages/Broadcasts.tsx` (771 LOC)

Componentes: `BroadcastList` (lista) e `BroadcastEditor` (abas Configuração / Mensagens / Audiência / Envio / Analytics).

Fluxo do usuário:
1. **Configuração**: nome, instância (`whatsapp_instances`), throttle, janela horária, weekdays.
2. **Mensagens**: cria N grupos com M partes cada. Placeholder `{{nome}}` substituído no tick.
3. **Audiência**: 
   - Fonte pipeline: seleciona pipeline + stages → congela em `broadcast_recipients`.
   - Fonte lista: upload CSV/XLSX via `parseContactsFile`.
   - Extra contacts inline.
   - `Congelar audiência` → grava `audience_frozen_at`.
4. **Envio**: `Iniciar` chama `broadcast-control` com `{action:'start'}` (exige instância + audiência congelada).
5. **Modo teste**: envia primeiras N mensagens para o próprio número do usuário sem consumir a audiência.

**Bug resolvido (2026)**: `position` de novos grupos/partes era calculado a partir de state React desatualizado, causando violação de unique constraint. Agora busca `max(position)` direto no DB antes de inserir.

## 3. Edges

### `broadcast-control` (183 LOC)
Ações: `start`, `pause`, `resume`, `cancel`, `freeze_audience`, `add_contacts`, `test_send_first`.

Validações no `start`:
- `whatsapp_instance_id` obrigatório → erro `no_whatsapp_instance`.
- `audience_frozen_at` obrigatório → erro `audience_not_frozen`.
- Reseta `next_send_at` do primeiro recipient para `now()` para envio imediato.
- Dispara `triggerTick()` fire-and-forget.

Grava evento em `broadcast_events` a cada transição.

### `broadcast-tick` (308 LOC) — cron
Executa a cada minuto (pg_cron). Para cada broadcast `running`:
1. Resolve timezone: `bc.send_window.tz` ou `getClinicTimezone(clinic_id)`.
2. `withinWindow()` checa weekday + hora local; fora → empurra pendentes para `nextOpenIso` e pula.
3. Busca **1 recipient** com `status in (pending,sending)` e `next_send_at <= now()` (limit=1 respeita throttle entre contatos).
4. Se não achou nenhum → checa se acabou; se sim → `status='done'` + evento.
5. Carrega `broadcast_message_groups` + `parts` uma vez por broadcast.
6. **Claim atômico do contato inteiro**: seta `next_send_at = now() + partsRemaining*5s + 30s` filtrando por `parts_sent = startIndex` — se claim falhar, outro tick já pegou.
7. Loop interno envia **todas as partes restantes do MESMO contato** com 1s entre partes via `/message/sendText`.
8. A cada parte OK: `broadcast_recipients.parts_sent++` + `broadcast_events.sent`. Se falhou: `status='failed'`, `last_error`, empurra `next_send_at + 24h`.
9. Ao finalizar o contato: snapshot `stage_id_at_send/stage_position_at_send` do lead.
10. Aplica throttle entre contatos: empurra `next_send_at` dos pendentes por `throttle_seconds ± 10% jitter`.
11. Dispara `triggerTick()` para o próximo contato sem esperar cron.

Instância carregada via `loadInstance(bc.whatsapp_instance_id)`. Se null → pausa broadcast com `reason:no_instance`.

## 4. Bugs históricos e correções

| Bug | Correção |
|---|---|
| `position` calculado do state React → unique violation | Buscar `max(position)` do DB antes de insert. |
| Modo teste falhava com throttle mínimo | Constraint `throttle_seconds_check` relaxada + rollback de estado no frontend. |
| Grupo com 3 partes enviava só 1 (MK Espanha) | Loop interno no `broadcast-tick` que envia todas as partes do contato no mesmo tick (claim atômico). |
| Contatos duplicados em ticks paralelos | Claim atômico via `UPDATE ... WHERE parts_sent=startIndex AND next_send_at<=now RETURNING id`. |

Ver detalhes em [`docs/clinics/COMPARATIVO.md`](../clinics/COMPARATIVO.md).

## 5. Invariantes

1. Nunca iniciar broadcast sem `whatsapp_instance_id` + `audience_frozen_at`.
2. `limit=1` no fetch de recipients é obrigatório para respeitar throttle entre contatos.
3. Claim atômico via `WHERE parts_sent = startIndex` — não relaxar.
4. Drip de 1s entre partes é fixo (não configurável) — evita rate limit do WhatsApp.
5. `stage_id_at_send` só é gravado quando **todas** as partes foram enviadas.
6. `broadcast_events.type='failed'` sempre carrega `evolution_response` no payload para debugging.
7. Falha de envio empurra `next_send_at + 24h` — não retenta automaticamente (necessita ação manual).
8. Throttle entre contatos aplica jitter ±10% para evitar padrão detectável.

## 6. Débitos técnicos

- Sem retry automático de recipients `failed` — usuário precisa reprocessar manualmente.
- Não há suporte a mídia em partes (apenas texto).
- Analytics básico — falta funil de replied/opted-out.
- `broadcast-tick` não emite métrica agregada de duração do ciclo.
- Sem UI para editar `send_window` de broadcast já `running`.

## 7. Secrets

Nenhum extra além dos do Evolution — reutiliza `whatsapp_instances.evolution_api_key`.
