---
title: "Tracking (First-Party Pixel)"
topic: tracking
kind: map
audience: agent
updated: 2026-07-01
summary: "Pixel próprio (tracker.js) que grava visitor/session/event, resolve atribuição multi-touch e conecta anônimos a leads."
code_refs:
  - src/pages/Tracking.tsx
  - src/pages/TrackingDebug.tsx
  - src/pages/tracking/AttributionTab.tsx
  - src/lib/tracking-identify.ts
  - supabase/functions/tracking-pixel/
  - supabase/functions/tracking-event/
  - supabase/functions/tracking-identify/
  - supabase/functions/tracking-config/
  - supabase/functions/_shared/attribution.ts
related_docs:
  - docs/maps/FORMS.md
  - docs/maps/METRICS.md
---

# Tracking — Mapa Runtime

Pixel **first-party** (nenhum SDK de terceiros). Endpoints públicos com
rate-limit em memória. Cookies `_mk_vid` (persistente) e `_mk_sid`
(sessão) identificam visitantes.

## 1. Frontend

| Rota | Arquivo | Papel |
|---|---|---|
| `/tracking` | `src/pages/Tracking.tsx` (1303 LOC) | Painel com 4 tabs: eventos, sessões, atribuição, relatório finalizados |
| `/tracking-debug` | `src/pages/TrackingDebug.tsx` (584 LOC) | Inspeção detalhada de payloads recebidos |
| tab Atribuição | `src/pages/tracking/AttributionTab.tsx` (136 LOC) | Agrupa `tracking_lead_sources` por `channel_group/source/medium` |
| Card mensal | `src/components/tracking/MonthlyFinalizadosReportCard.tsx` | Exibe `clinic_monthly_reports` da ÓR |

Helper cliente: `src/lib/tracking-identify.ts` — chama `tracking-identify`
para vincular `visitor_id → lead_id`.

## 2. Edge functions (4)

### 2.1 `tracking-pixel` (394 LOC) — GET `?project_id=<slug>`

Serve `tracker.js` inline. **Bloqueia bots** por User-Agent (lovable,
headless, phantom, puppeteer, playwright, googlebot, facebook, whatsapp,
semrush, ahrefs…) e `navigator.webdriver`. Injeta:

- `PROJECT_ID`, `ENDPOINT=tracking-event`, `CONFIG_ENDPOINT=tracking-config`,
  `WA_REDIRECT=wa-redirect`.
- Cookies `_mk_vid` (12 meses) + `_mk_sid` (sessionStorage).
- Captura de UTM/click IDs (gclid, gbraid, wbraid, fbclid, ttclid, msclkid,
  li_fat_id) + fbp/fbc; primeiro-touch fica em `visitor.first_utms`,
  último-touch em `session.utms`.

### 2.2 `tracking-event` (465 LOC) — POST público

CORS com origin echo. **Rate-limit em memória: 60 req/min por (ip+clinic)**.
Recebe eventos e escreve em cascata:

- `tracking_visitors` (upsert por visitor_id, agrega first/last touch).
- `tracking_sessions` (upsert por session_id, TTL 30min de inatividade).
- `tracking_events` (append; suporta `pageview`, `click`, `form_start`,
  `form_submit`, `wa_click`, custom).
- `tracking_lead_sources` (quando o evento já vem com lead_id).

Chama `resolveTrafficSource` (`_shared/attribution.ts`) para determinar
`source/medium/campaign/channel_group/confidence_score/attribution_reason`
com base em UTM + click IDs + referrer + regras em `traffic_source_rules`.

### 2.3 `tracking-identify` (311 LOC) — POST autenticado interno

Vincula um `visitor_id` a um `lead_id`. Faz **backfill** dos eventos
passados desse visitante com o lead_id. Cria hash SHA-256 de email/phone
para enriquecer `tracking_identity_links`. Usa `originHost` para inferir
origem confiável.

### 2.4 `tracking-config` (50 LOC) — GET público

Devolve config pública do project_id (habilita/desabilita módulos do
pixel — ex: capturar clicks de WA). Consultado pelo `tracker.js` a
cada boot.

## 3. Modelo de dados

- `tracking_visitors` (26 cols) — persistente por `visitor_id`, guarda
  first-touch UTMs, device/OS/browser, país.
- `tracking_sessions` (36 cols) — TTL 30min, guarda last-touch UTMs,
  landing/exit page, engagement time.
- `tracking_events` (15 cols) — append-only.
- `tracking_lead_sources` (28 cols) — atribuição por lead (multi-touch:
  first_touch, last_touch, campaign attribution).
- `tracking_identity_links` (11 cols) — email/phone hash → visitor.
- `traffic_source_rules` (11 cols) — regras custom por clínica
  (ex: `utm_source=fb → channel_group=Paid Social`).

## 4. Atribuição (`_shared/attribution.ts`)

Ordem de precedência dentro de `resolveTrafficSource`:

1. UTM explícito (`utm_source` + `utm_medium`).
2. Click IDs → deriva `source/medium/channel_group` (gclid=google/cpc,
   fbclid=facebook/cpc, ttclid=tiktok/cpc, msclkid=bing/cpc, li_fat_id=linkedin/cpc).
3. Referrer parsing (google/bing/duckduckgo/instagram/facebook/tiktok/
   linkedin/youtube).
4. Regras custom de `traffic_source_rules` (aplicadas sobre o resultado).
5. Fallback `(direct)/(none)` com `confidence_score` baixo.

`channel_group` normaliza: Direct, Organic Search, Paid Search, Organic
Social, Paid Social, Referral, Email, Display, Other.

## 5. Invariantes / gotchas

- **Não** remova o bloqueio de bots no `tracker.js` — sem ele o
  pré-render do próprio Lovable poluí métricas.
- Cookies são **first-party** no domínio do cliente. Se o cliente tiver
  CSP restritivo, o pixel precisa ser injetado com `nonce`.
- `tracking-event` **não** valida JWT; a proteção é `project_id` + rate
  limit + origin echo (não `*` com credentials).
- Backfill de identidade em `tracking-identify` roda em background e
  pode levar segundos para eventos antigos aparecerem com `lead_id`.
- Confidence score: UTM=1.0, click id=0.9, referrer=0.6, rule=0.7,
  direct=0.2. Nunca exiba <0.5 como certeza.
