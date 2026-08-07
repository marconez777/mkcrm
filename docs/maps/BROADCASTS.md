---
title: "Mapa â€” Broadcasts (disparo em massa)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Motor de disparo em massa via WhatsApp: broadcast-control (start/pause/etc) + broadcast-tick (cron). Cobre modelo de dados (broadcasts/message_groups/message_parts/recipients/events), throttle, janela horÃ¡ria, freeze de audiÃªncia, modo teste e bug do position resolvido."
code_refs:
  - supabase/functions/broadcast-control/
  - supabase/functions/broadcast-tick/
  - src/pages/Broadcasts.tsx
  - src/lib/broadcast-template.ts
related_docs:
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/evolution/WHATSAPP.md
  - docs/clinics/COMPARATIVO.md
---

# Broadcasts â€” Disparo em Massa

## 1. Modelo de dados (5 tabelas)

| Tabela | Papel |
|---|---|
| `broadcasts` (14 col) | Campanha. Campos: `name`, `status` (`draft|running|paused|done|failed|cancelled`), `whatsapp_instance_id`, `throttle_seconds`, `send_window` (jsonb: `{start,end,tz,weekdays[]}`), `source` (`{type:'pipeline'|'list', pipeline_id, stage_ids[], extra_contacts[]}`), `totals`, `audience_frozen_at`. |
| `broadcast_message_groups` (5 col) | Grupos de mensagem (A/B ou variaÃ§Ãµes). Ordenados por `position`. |
| `broadcast_message_parts` (5 col) | Partes sequenciais de UM grupo (mensagem 1, mensagem 2, ...). Enviadas com **drip de 1s** entre partes. |
| `broadcast_recipients` (17 col) | DestinatÃ¡rios com `phone`, `name`, `status`, `parts_sent`, `next_send_at`, `last_error`, `group_position`, `stage_id_at_send`, `stage_position_at_send`. |
| `broadcast_events` (7 col) | Audit trail (`type`, `payload`) para cada `sent/failed/paused/started/done`. |

Constraint relevante: `broadcasts_throttle_seconds_check` â€” throttle mÃ­nimo jÃ¡ foi relaxado para permitir **modo teste** com valores baixos.

## 2. Frontend â€” `src/pages/Broadcasts.tsx` (771 LOC)

Componentes: `BroadcastList` (lista) e `BroadcastEditor` (abas ConfiguraÃ§Ã£o / Mensagens / AudiÃªncia / Envio / Analytics).

Fluxo do usuÃ¡rio:
1. **ConfiguraÃ§Ã£o**: nome, instÃ¢ncia (`whatsapp_instances`), throttle, janela horÃ¡ria, weekdays.
2. **Mensagens**: cria N grupos com M partes cada. Placeholder `{{nome}}` substituÃ­do no tick.
3. **AudiÃªncia**: 
   - Fonte pipeline: seleciona pipeline + stages â†’ congela em `broadcast_recipients`.
   - Fonte lista: upload CSV/XLSX via `parseContactsFile`.
   - Extra contacts inline.
   - `Congelar audiÃªncia` â†’ grava `audience_frozen_at`.
4. **Envio**: `Iniciar` chama `broadcast-control` com `{action:'start'}` (exige instÃ¢ncia + audiÃªncia congelada).
5. **Modo teste**: envia primeiras N mensagens para o prÃ³prio nÃºmero do usuÃ¡rio sem consumir a audiÃªncia.

**Bug resolvido (2026)**: `position` de novos grupos/partes era calculado a partir de state React desatualizado, causando violaÃ§Ã£o de unique constraint. Agora busca `max(position)` direto no DB antes de inserir.

## 3. Edges

### `broadcast-control` (183 LOC)
AÃ§Ãµes: `start`, `pause`, `resume`, `cancel`, `freeze_audience`, `add_contacts`, `test_send_first`.

ValidaÃ§Ãµes no `start`:
- `whatsapp_instance_id` obrigatÃ³rio â†’ erro `no_whatsapp_instance`.
- `audience_frozen_at` obrigatÃ³rio â†’ erro `audience_not_frozen`.
- Reseta `next_send_at` do primeiro recipient para `now()` para envio imediato.
- Dispara `triggerTick()` fire-and-forget.

Grava evento em `broadcast_events` a cada transiÃ§Ã£o.

### `broadcast-tick` (308 LOC) â€” cron
Executa a cada minuto (pg_cron). Para cada broadcast `running`:
1. Resolve timezone: `bc.send_window.tz` ou `getClinicTimezone(clinic_id)`.
2. `withinWindow()` checa weekday + hora local; fora â†’ empurra pendentes para `nextOpenIso` e pula.
3. Busca **1 recipient** com `status in (pending,sending)` e `next_send_at <= now()` (limit=1 respeita throttle entre contatos).
4. Se nÃ£o achou nenhum â†’ checa se acabou; se sim â†’ `status='done'` + evento.
5. Carrega `broadcast_message_groups` + `parts` uma vez por broadcast.
6. **Claim atÃ´mico do contato inteiro**: seta `next_send_at = now() + partsRemaining*5s + 30s` filtrando por `parts_sent = startIndex` â€” se claim falhar, outro tick jÃ¡ pegou.
7. Loop interno envia **todas as partes restantes do MESMO contato** com 1s entre partes via `/message/sendText`.
8. A cada parte OK: `broadcast_recipients.parts_sent++` + `broadcast_events.sent`. Se falhou: `status='failed'`, `last_error`, empurra `next_send_at + 24h`.
9. Ao finalizar o contato: snapshot `stage_id_at_send/stage_position_at_send` do lead.
10. Aplica throttle entre contatos: empurra `next_send_at` dos pendentes por `throttle_seconds Â± 10% jitter`.
11. Dispara `triggerTick()` para o prÃ³ximo contato sem esperar cron.

InstÃ¢ncia carregada via `loadInstance(bc.whatsapp_instance_id)`. Se null â†’ pausa broadcast com `reason:no_instance`.

## 4. Bugs histÃ³ricos e correÃ§Ãµes

| Bug | CorreÃ§Ã£o |
|---|---|
| `position` calculado do state React â†’ unique violation | Buscar `max(position)` do DB antes de insert. |
| Modo teste falhava com throttle mÃ­nimo | Constraint `throttle_seconds_check` relaxada + rollback de estado no frontend. |
| Grupo com 3 partes enviava sÃ³ 1 (MK Espanha) | Loop interno no `broadcast-tick` que envia todas as partes do contato no mesmo tick (claim atÃ´mico). |
| Contatos duplicados em ticks paralelos | Claim atÃ´mico via `UPDATE ... WHERE parts_sent=startIndex AND next_send_at<=now RETURNING id`. |

Ver detalhes em [`docs/clinics/COMPARATIVO.md`](../clinics/COMPARATIVO.md).

## 5. Invariantes

1. Nunca iniciar broadcast sem `whatsapp_instance_id` + `audience_frozen_at`.
2. `limit=1` no fetch de recipients Ã© obrigatÃ³rio para respeitar throttle entre contatos.
3. Claim atÃ´mico via `WHERE parts_sent = startIndex` â€” nÃ£o relaxar.
4. Drip de 1s entre partes Ã© fixo (nÃ£o configurÃ¡vel) â€” evita rate limit do WhatsApp.
5. `stage_id_at_send` sÃ³ Ã© gravado quando **todas** as partes foram enviadas.
6. `broadcast_events.type='failed'` sempre carrega `evolution_response` no payload para debugging.
7. Falha de envio empurra `next_send_at + 24h` â€” nÃ£o retenta automaticamente (necessita aÃ§Ã£o manual).
8. Throttle entre contatos aplica jitter Â±10% para evitar padrÃ£o detectÃ¡vel.
9. `preview_mode` de cada parte controla como links sÃ£o renderizados no WhatsApp â€” cascata `video_card â†’ link_preview â†’ text_only` implementada em `_shared/link-preview.ts`. Se `resolveThumbnail` falhar, cai automaticamente para `link_preview`.

## 6. Preview de link (YouTube / Instagram Reels)

Cada `broadcast_message_parts.preview_mode` aceita 4 valores:

| Modo | Comportamento |
|---|---|
| `auto` (default) | Detecta YT Shorts/IG Reels â†’ `video_card`; outros links â†’ `link_preview`; sem link â†’ `text_only`. |
| `video_card` | `POST /message/sendMedia` com `mediatype:image`, thumbnail resolvida (`i.ytimg.com/vi/<id>/hqdefault.jpg` para YT; oEmbed do Graph ou `og:image` para IG) e o link+texto no `caption`. Aparece como card grande e clicÃ¡vel â€” funciona bem para Reels/Shorts, onde o `linkPreview:true` costuma falhar. |
| `link_preview` | `POST /message/sendText` com `options.linkPreview:true`. Depende do OG do site (Instagram frequentemente bloqueia). |
| `text_only` | Envio cru (comportamento antigo). |

Helper compartilhado: `supabase/functions/_shared/link-preview.ts` â€” usado por `broadcast-tick` e `evolution-send`.

## 7. DÃ©bitos tÃ©cnicos

- Sem retry automÃ¡tico de recipients `failed` â€” usuÃ¡rio precisa reprocessar manualmente.
- NÃ£o hÃ¡ suporte a mÃ­dia arbitrÃ¡ria em partes (thumb via `video_card` funciona; mÃ­dia genÃ©rica nÃ£o).
- Analytics bÃ¡sico â€” falta funil de replied/opted-out.
- `broadcast-tick` nÃ£o emite mÃ©trica agregada de duraÃ§Ã£o do ciclo.
- Sem UI para editar `send_window` de broadcast jÃ¡ `running`.

## 8. Secrets

- Nenhum extra obrigatÃ³rio â€” reutiliza `whatsapp_instances.evolution_api_key`.
- `INSTAGRAM_OEMBED_TOKEN` (opcional): App Token do Graph API. Se ausente, `video_card` de Instagram cai para scraping de `og:image` (funciona em posts pÃºblicos com HTML acessÃ­vel).
