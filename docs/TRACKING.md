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
<script async src="https://crm.mkart.com.br/functions/v1/tracking-pixel?project_id=or"></script>
```

O pixel emite automaticamente `session_start` + `page_view` no boot, e novos `page_view` em mudanças de rota (SPA). Expõe `window.mkTrack(name, props)` para eventos custom (não usado nesta fase).

## Identificadores

- `visitor_id` — cookie first-party `_mk_vid` (1 ano) + fallback localStorage.
- `session_id` — sessionStorage com timeout configurável.
- `event_id` — gerado no cliente, único por clínica para idempotência.

## Não inclui nesta fase

`/identify`, vínculo visitor→lead, tracking de WhatsApp, classificação de origem, telas de UI, Smartlook, envio para Google/Meta Ads.
