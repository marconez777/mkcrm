## Diagnóstico do que já existe

O tracking atual já cobre boa parte do que está no estudo:

- `tracking_visitors`, `tracking_sessions`, `tracking_events`, `tracking_lead_sources`, `tracking_identity_links` — todas com first-touch, last-touch e last-non-direct.
- Captura client-side de `visitor_id` (cookie 1st party), `session_id`, UTMs, `gclid/gbraid/wbraid/fbclid/ttclid/msclkid`, `fbp/fbc`, referrer, landing.
- Eventos `page_view`, `whatsapp_click`, `form_start`, `form_submit_attempt` indo para `tracking-event`.
- `tracking-identify` resolve lead por email/telefone, congela first/conversion/last-non-direct em `tracking_lead_sources` e faz backfill de eventos do `visitor_id` → `lead_id`.
- Atribuição com regras de canal (`_shared/attribution.ts`), confidence score, e campos `landing_page`/`utm` direto no lead.

## O gap real

Quando o lead entra **por WhatsApp** (clica `wa.me` → manda mensagem → cai no `evolution-webhook`), o lead é criado/atualizado mas **nunca é casado com o `visitor_id`** porque:

1. O link de WhatsApp do site é `wa.me` puro — sem `tracking_code` na mensagem, sem `visitor_id` carregado.
2. `evolution-webhook` cria o lead e dispara `ai-auto-reply`, mas **não chama `tracking-identify`** em momento nenhum.
3. Não capturamos `referral.ctwa_clid` que a Evolution/Baileys entrega em mensagens vindas de Click-to-WhatsApp Ads.

Resultado: a coluna "linha do tempo" do lead começa em branco — `tracking_visitors` tem todo o histórico, mas nada conecta com `leads`.

## Plano de implementação

### Fase 1 — Redirect rastreável de WhatsApp (`/w/abrir`)

1. Nova tabela `whatsapp_intents`:
   - `clinic_id`, `visitor_id`, `session_id`, `lead_id`, `tracking_code` (único por clínica), `phone_destination`, `source/medium/campaign`, `status` (`pending`/`matched`/`expired`), `clicked_at`, `matched_at`.
   - Index único `(clinic_id, tracking_code)`.

2. Nova edge function `wa-redirect` (GET, sem JWT, com CORS aberto):
   - Recebe `?p=<project_slug>&v=<visitor_id>&s=<session_id>&to=<phone>&msg=<base>`.
   - Valida origem pelo `allowed_domains` (mesma whitelist usada hoje).
   - Gera `tracking_code` curto (ex.: `MK-XXXXXX`), grava `whatsapp_intents`, grava `tracking_events` com `event_name='whatsapp_redirect'`.
   - Faz `302` para `https://wa.me/<to>?text=<msg> · Código: MK-XXXXXX`.

3. No tracking script client-side (`tracking-pixel`): substituir cliques em `[href*="wa.me"]` e `[data-track="whatsapp"]` para reescrever o `href` para `…/functions/v1/wa-redirect?...` antes do navegador abrir. Mantém o `whatsapp_click` que já existe.

### Fase 2 — Webhook do WhatsApp casando intent → lead

No `evolution-webhook` (logo após `ingestMessage` retornar `isNew` para mensagens inbound):

1. Extrair `tracking_code` do texto via regex `MK-[A-Z0-9]{6}` (qualquer match na primeira ou nas últimas N mensagens do lead).
2. Extrair `referral.ctwa_clid` quando presente em `messages.upsert` (Click-to-WhatsApp).
3. Resolver `visitor_id` por ordem de prioridade:
   1. `tracking_code` pendente em `whatsapp_intents`.
   2. `ctwa_clid` já registrado em `tracking_sessions`/`tracking_events`.
   3. `phone_hash` em `tracking_identity_links` (lead já identificado em visita anterior).
   4. Última sessão recente (últimas 2h) que disparou `whatsapp_click` e ainda não tem identity link.
4. Chamar `tracking-identify` com `{ project_id, visitor_id, lead_id, phone, source_event: 'whatsapp_inbound' }` para:
   - Criar `tracking_identity_links`.
   - Congelar `tracking_lead_sources` (first/conversion/last-non-direct).
   - Backfill de `tracking_events` antigos com `lead_id`.
5. Atualizar `whatsapp_intents.status='matched'` e `lead_id`.

Para mensagens **inbound sem código nem ctwa_clid**, fazer fallback automático por `phone_hash` (passos 3.3 e 3.4) — isso já resolve grande parte dos casos onde o lead já tinha sido identificado por formulário antes.

### Fase 3 — Capturar `ctwa_clid` em `tracking_sessions`

Adicionar coluna `ctwa_clid` em `tracking_sessions` e `tracking_lead_sources` (Meta usa esse ID para casar Click-to-WhatsApp Ads com CAPI). Já capturamos `fbclid`; `ctwa_clid` chega só pelo webhook do WhatsApp, então fica gravado em `whatsapp_intents` e também é replicado em `tracking_lead_sources` quando o identify roda.

### Fase 4 — UI no CRM

Na timeline do lead (`LeadJourneyTab` e `Tracking`):
- Mostrar `tracking_lead_sources` (first/conversion/last-non-direct) já gravado, hoje sub-utilizado.
- Marcar visitas posteriores ao "lead criado" como "retorno ao site".

## Detalhes técnicos

- **Schema do redirect**: `GET /functions/v1/wa-redirect?p=<slug>&v=<uuid>&s=<uuid>&to=5511...&msg=<text>` → `302` → `https://wa.me/<to>?text=<msg encoded><newline>Código: MK-XXXXXX`.
- **Regex código**: `/MK-[A-Z0-9]{6}/`. Procurar nas últimas 5 mensagens inbound do lead para tolerar quando o usuário apaga/edita a 1ª mensagem.
- **CTWA**: Baileys entrega em `messages.upsert[i].message.extendedTextMessage.contextInfo.externalAdReply` ou `messages.upsert[i].source = 'ad'` com `ctwaClid`. Verificar ambos os shapes.
- **Idempotência**: o identify é upsert; chamar várias vezes para o mesmo `visitor_id+lead_id` é seguro.
- **Performance**: roda em `EdgeRuntime.waitUntil` igual ao `ai-auto-reply` para não bloquear o webhook.
- **Backfill**: o `tracking-identify` já faz backfill de `tracking_events`, então o histórico anterior do visitor entra direto no timeline do lead.

## Fora de escopo

- Server-side Meta CAPI / Google Ads offline conversions (fases 7-8 do estudo) — fica para depois.
- Cross-device por email/telefone via link rastreável `lead_token` — fica para outra iteração.
- Consent Mode v2 — já temos `consent_status` rudimentar; refinar depois.
- Mudanças no painel `Tracking`/`LeadJourneyTab` ficam em fase 4 e podem ser feitas separadamente.
