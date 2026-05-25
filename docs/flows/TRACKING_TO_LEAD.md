# Fluxo: Tracking → Lead (visitante anônimo vira lead)

> **Quando ler:** antes de mexer no pixel de tracking, na resolução de identidade, ou em atribuição de origem (UTM).
> **Última atualização:** 2026-05-25

---

## Atores

- **Site externo** com snippet/pixel mkart
- **Edge functions** `tracking-config`, `tracking-pixel`, `tracking-event`, `tracking-identify`
- **Postgres**: `tracking_visitors`, `tracking_sessions`, `tracking_events`, `leads`
- **Forms** (`forms-ingest`) ou **WhatsApp click-to-chat** com `wa_ref`

---

## Estágio 1: visitante anônimo

```text
Site carrega snippet
        │
        ▼
GET tracking-config?site_id=...   (cacheado 1h)
        ▼
recebe { visitor_cookie_name, endpoints }
        │
        │ se sem cookie:
        │   gera anonymous_id (uuid)
        │   set cookie 1ª-party 2 anos
        ▼
POST tracking-event { type='page_view', anonymous_id, url, utm, referrer }
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
forms-ingest OU click-to-chat com wa_ref=<anonymous_id>
        │
        ▼
POST tracking-identify { anonymous_id, email|phone }
        │ 1) acha/cria lead via findOrCreateLead
        │ 2) UPDATE tracking_visitors SET lead_id=...
        │ 3) UPDATE tracking_sessions de mesmo anonymous_id (histórico)
        │ 4) INSERT lead_events('tracking_identified', { sessions_count, first_utm })
        │ 5) seta leads.source / first_utm_* se ainda null (first-touch attribution)
```

---

## Estágio 3: WhatsApp click-to-chat

```text
CTA no site → link wa.me/55X?text=Quero%20saber%20mais&ref=<anonymous_id>
        │
        ▼
Usuário envia primeira mensagem (Evolution webhook)
        │
        ▼
evolution-webhook
        │ extrai 'ref' do texto se presente (regex)
        │ se houver ref → POST tracking-identify(anonymous_id=ref, phone=lead.phone)
        ▼
Atribuição completa: lead ↔ jornada de tracking
```

---

## Atribuição (UTM)

- **First touch**: gravado na primeira `tracking_sessions` do visitante.
- **Last touch**: derivado da sessão mais recente antes do identify.
- **Multi touch**: timeline completa em `tracking_sessions` por `visitor_id`.

Campos em `leads`: `first_utm_source`, `first_utm_medium`, `first_utm_campaign`, `last_utm_*` (se já identificado quando voltar, atualiza last).

---

## Pegadinhas

- **Cookie bloqueado** (Safari ITP, ad blocker): `anonymous_id` regenera por visita → cada sessão vira visitor diferente. Identify ainda funciona se preencher form.
- **wa.me trunca query params longos**: usar `ref` curto (uuid sem hífens, 32 chars).
- **Ref no texto**: alguns usuários apagam antes de enviar. Sem ref, não dá pra ligar à jornada — vira lead "direto".
- **Cross-device**: identify por email/phone faz merge se mesmo lead já existe. **Não** unimos visitors de devices diferentes automaticamente — só quando ambos identificam pro mesmo lead.
- **Bot traffic**: hoje não filtramos. Tracking_events infla. TODO.
- **GDPR/LGPD**: snippet respeita `Do-Not-Track` se `clinic_settings.tracking_respect_dnt=true`.

---

## Melhorias sugeridas

- Filtro anti-bot (user-agent + heurística).
- Server-side tracking opcional (`/cw` endpoint via proxy do cliente).
- View materializada de atribuição por canal.
- Decay de last-touch (janela 30 dias configurável).
- Merge automático de visitors quando mesmo lead identifica em 2+ devices.

---

## Arquivos-chave

- `supabase/functions/tracking-config/index.ts`
- `supabase/functions/tracking-pixel/index.ts`
- `supabase/functions/tracking-event/index.ts`
- `supabase/functions/tracking-identify/index.ts`
- `supabase/functions/forms-ingest/index.ts`
- `edge-functions/TRACKING.md`
- `features/FORMS.md`
