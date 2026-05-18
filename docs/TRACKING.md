# Tracking first-party — Fase 1

Sistema próprio de tracking. O site externo carrega um pixel servido pelo CRM e envia eventos para edge functions; o CRM armazena visitantes, sessões e eventos por clínica.

## Componentes

### Tabelas (`public`)
- `tracking_visitors` — 1 linha por `(clinic_id, visitor_id)`. Mantém primeira/última visita, primeira origem e dispositivo.
- `tracking_sessions` — 1 linha por `(clinic_id, session_id)`. Guarda UTMs, click IDs (gclid/gbraid/wbraid/fbclid/msclkid), IP hashado, user agent.
- `tracking_events` — 1 linha por `(clinic_id, event_id)`. Idempotente.

Todas com RLS `clinic_scoped`. Edge functions usam service role e fazem o scoping manual via `project_id`.

### Edge functions
- `tracking-pixel` — `GET /functions/v1/tracking-pixel?project_id=<slug>` retorna `tracker.js` minificado (cache 1h).
- `tracking-config` — `GET /functions/v1/tracking-config?project_id=<slug>` retorna `{ enabled, session_timeout_minutes, consent_required }`.
- `tracking-event` — `POST /functions/v1/tracking-event` recebe 1 evento ou batch (até 50). Valida `project_id`, Origin contra `allowed_domains`, faz upsert nas 3 tabelas.

Autenticação: sem JWT, sem secret no browser. Validação por **CORS allowlist** + rate limit (120 req/min por IP+clínica).

## Configuração por clínica

`clinics.settings.tracking`:
```json
{
  "enabled": true,
  "allowed_domains": ["clinicaohrpsiquiatria.com", "www.clinicaohrpsiquiatria.com"],
  "session_timeout_minutes": 30,
  "consent_required": false
}
```

`project_id` enviado pelo pixel = `clinics.slug`.

## Snippet de instalação no site

```html
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=or"></script>
```

## Eventos automáticos

| Evento | Origem |
|---|---|
| `session_start` | Boot do pixel |
| `page_view` | Boot + mudanças de rota SPA |
| `whatsapp_click` | Clique em link `wa.me` / `api.whatsapp.com` / `web.whatsapp.com` / `whatsapp:` |
| `form_start` | Primeiro focus/change dentro de um `<form>` (1x por form) |
| `form_submit_attempt` | Submit de qualquer `<form>` (não garante sucesso) |
| qualquer | Clique em elemento com `data-track-event="..."` |

Eventos custom via `window.mkTrack(name, props)`.

Envio com `navigator.sendBeacon` (fallback: `fetch keepalive`).

URLs sanitizadas no cliente: mantidos `origin + pathname` e apenas UTMs + click IDs (gclid/gbraid/wbraid/fbclid/msclkid). Valores de inputs **nunca** são enviados.

Cache do `tracker.js`: `no-store` durante Fase 1 (testes). Voltar a `max-age=3600` quando estabilizar.

Guia para o time do site: [`TRACKING_SITE.md`](./TRACKING_SITE.md).

## Identificadores

- `visitor_id` — cookie first-party `_mk_vid` (1 ano) + fallback localStorage.
- `session_id` — sessionStorage com timeout configurável.
- `event_id` — gerado no cliente, único por clínica para idempotência.

## Não inclui nesta fase

`/identify`, vínculo visitor→lead, tracking de WhatsApp, classificação de origem, telas de UI, Smartlook, envio para Google/Meta Ads.

## Fase 2 — Identidade & Jornada

Tabela `tracking_identity_links`: liga `visitor_id` ↔ `lead_id` por clínica. Guarda apenas hashes SHA-256 de e-mail e telefone, nunca o valor puro. RLS por `has_clinic_access`.

### Edge function `tracking-identify`

`POST /functions/v1/tracking-identify` com `{ project_id, visitor_id, session_id?, lead_id?, email?, phone?, whatsapp_id?, source_event?, properties? }`.

- Resolve `clinic_id` por `project_id` (slug).
- Valida `Origin` contra `allowed_domains` ou autoriza chamada interna (membro da clínica).
- Se `lead_id` não vier, tenta resolver por `email`/`phone` dentro da clínica.
- Upsert em `tracking_identity_links` (único por `clinic_id+visitor_id+lead_id`).
- Backfill: `tracking_events` desse `visitor_id` recebe `lead_id`.
- Insere evento `lead_identified` (type `identity`).

### Helper interno

```ts
import { linkVisitorToLead } from "@/lib/tracking-identify";
await linkVisitorToLead({ clinic_id, visitor_id, lead_id, source_event: "form_submit_success" });
```

### UI

- Aba **Jornada** no lead drawer (`LeadJourneyTab`): resumo do visitante principal, sessões, timeline de eventos, visitantes vinculados.
- `/tracking-debug`: coluna **lead vinculado** + botões **Abrir lead** e **Criar jornada de teste** (gera visitor + eventos + identify com `test_mode=true`).
