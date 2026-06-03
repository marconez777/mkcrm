# Fluxo: Tracking → Lead (visitante anônimo vira lead)

> **Quando ler:** antes de mexer no pixel de tracking, na resolução de identidade, ou em atribuição de origem (UTM).
> **Última atualização:** 2026-06-03

---

## Atores

- **Site externo** com snippet/pixel mkart
- **Edge functions** `tracking-config`, `tracking-pixel`, `tracking-event`, `tracking-identify`
- **Postgres**: `tracking_visitors`, `tracking_sessions`, `tracking_events`, `tracking_lead_sources`, `leads`
- **Forms** (`forms-ingest`) ou **WhatsApp click-to-chat** com código `ref=xxxxxxxxxx` ou `MK-XXXXXX`

---

## Estágio 1: visitante anônimo

```text
Site carrega snippet
        │
        ▼
GET tracking-config?project_id=...   (cacheado)
        ▼
recebe { visitor_cookie_name, endpoints, allowed_domains }
        │
        │ se sem cookie:
        │   gera visitor_id (uuid)
        │   set cookie 1ª-party (~2 anos)
        ▼
POST tracking-event { type='page_view', visitor_id, session_id, url, utm, referrer }
        │
        ▼
INSERT tracking_visitors (se novo)
INSERT tracking_sessions (nova se >30min idle ou utm mudou)
INSERT tracking_events
```

---

## Estágio 2: identify (lead conhecido)

```text
Usuário preenche form OU clica botão WhatsApp
        │
        ▼
forms-ingest OU click-to-chat com ref=<código curto> embutido na mensagem
        │
        ▼
POST tracking-identify { project_id, visitor_id, lead_id|email|phone }
        │ valida origem em clinic.settings.tracking.allowed_domains
        │ resolve lead_id (cria/encontra via dedupe inline)
        │ UPSERT em tracking_lead_sources (first_touch + last_non_direct)
        │   onConflict (clinic_id, lead_id, source_type)
        │ UPDATE tracking_events SET lead_id=... WHERE visitor_id=? AND lead_id IS NULL  (backfill)
        │ INSERT tracking_events(event_name='lead_identified', event_type='identity')
        │ email/phone trafegam hasheados (sha256) em event.properties — nunca em claro
```

> ⚠️ A função **não** escreve em `lead_events`. A atribuição vive em `tracking_lead_sources`; a timeline visual de tracking continua em `tracking_events`.

---

## Estágio 3: WhatsApp click-to-chat

```text
CTA no site → link wa.me/55X?text=Quero%20saber%20mais%20(ref=ab12cd34ef)
        │
        ▼
Usuário envia primeira mensagem (Evolution webhook)
        │
        ▼
evolution-webhook
        │ extrai código pelo regex TRACKING_CODE_RE:
        │   /(?:ref=([a-f0-9]{10})|(MK-[A-HJ-NP-Z2-9]{6}))/i
        │ se houver código → resolve visitor_id e chama tracking-identify
        ▼
Atribuição completa: lead ↔ jornada de tracking
```

---

## Atribuição (UTM)

- **`leads`** carrega apenas um conjunto: `utm_source`, `utm_medium`, `utm_campaign`, `form_source` (preenchidos pelo entrypoint do canal — geralmente reflete o first-touch).
- **`tracking_lead_sources`** é a fonte canônica de atribuição multi-touch, com linhas por `source_type` (`first_touch`, `last_non_direct`, …) e os campos `source`, `medium`, `campaign`, `channel_group`, IDs de clique (`gclid`, `fbclid`, `gbraid`, `wbraid`, `ttclid`, `msclkid`, `li_fat_id`, `fbp`, `fbc`), etc.
- **Timeline completa** continua em `tracking_sessions` por `visitor_id`.

> Não existem colunas `first_utm_*` / `last_utm_*` em `leads`. Quem precisa de last-touch lê de `tracking_lead_sources` ou da última `tracking_sessions`.

---

## Pegadinhas

- **Cookie bloqueado** (Safari ITP, ad blocker): `visitor_id` regenera por visita → cada sessão vira visitor diferente. Identify ainda funciona se preencher form.
- **wa.me trunca texto longo**: por isso o ref é curto (`ref=` + 10 chars hex, ou `MK-XXXXXX` base32).
- **Ref no texto**: alguns usuários apagam antes de enviar. Sem ref, não dá pra ligar à jornada — vira lead "direto".
- **Cross-device**: identify por email/phone faz merge se mesmo lead já existe. **Não** unimos visitors de devices diferentes automaticamente — só quando ambos identificam pro mesmo lead.
- **Privacidade**: `tracking-identify` só recebe email/phone hasheados em SHA-256 (`email_hash`, `phone_hash`) — claro nunca é persistido em `tracking_events`. O lead em si guarda email/phone normalmente.
- **Origem bloqueada**: `tracking-identify` exige que o host esteja em `clinic.settings.tracking.allowed_domains` (ou auth de membro/super_admin/service_role). Sem whitelist → 403 `origin_not_allowed`.
- **Bot traffic**: hoje não filtramos. `tracking_events` infla. TODO.
- **GDPR/LGPD**: snippet respeita `Do-Not-Track` se `clinic_settings.tracking_respect_dnt=true`.

---

## Melhorias sugeridas

- Filtro anti-bot (user-agent + heurística).
- Server-side tracking opcional (`/cw` endpoint via proxy do cliente).
- View materializada de atribuição por canal a partir de `tracking_lead_sources`.
- Decay de last-touch (janela 30 dias configurável).
- Merge automático de visitors quando mesmo lead identifica em 2+ devices.

---

## Arquivos-chave

- `supabase/functions/tracking-config/index.ts`
- `supabase/functions/tracking-pixel/index.ts`
- `supabase/functions/tracking-event/index.ts`
- `supabase/functions/tracking-identify/index.ts`
- `supabase/functions/forms-ingest/index.ts`
- `supabase/functions/evolution-webhook/index.ts` (regex `TRACKING_CODE_RE`)
- `docs/edge-functions/TRACKING.md`
- `docs/features/FORMS.md`
