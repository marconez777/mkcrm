# Mapa: Tracking + Forms (captura externa)

> **Para localizar edições.** Para entender *por quê*, leia [`docs/integracao/README.md`](../integracao/README.md) (visão geral em 11 partes), [`docs/integrations/EXTERNAL_FORMS.md`](../integrations/EXTERNAL_FORMS.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Sistema de captura de eventos e formulários externos: snippets JS embedáveis em sites de clientes, formulários CF7/Elementor/HTML puro, atribuição UTM, sessões, identify, pixel de fallback. Tudo entra como evento → vira lead → entra no kanban.

## 2. Rotas / pontos de entrada

| Rota | Componente |
|---|---|
| `/tracking` | `src/pages/Tracking.tsx` |
| `/tracking/debug` | `src/pages/TrackingDebug.tsx` |
| `/tracking/attribution` (tab) | `src/pages/tracking/AttributionTab.tsx` |
| `/settings/forms` | `src/pages/SettingsForms.tsx` |

## 3. Frontend

### Libs
- `src/lib/tracking-identify.ts` — chamada para `tracking-identify` (resolve visitor → lead).
- `src/lib/csv.ts` — export.

### Componentes de leads
- `src/components/leads/LeadAttributionCard.tsx` — exibe UTM no drawer.

## 4. Edge functions

### Tracking
| Function | Função |
|---|---|
| `tracking-config/index.ts` | retorna config pública do snippet (clinic_id, endpoints) |
| `tracking-event/index.ts` | recebe eventos (pageview, custom, conversion) |
| `tracking-identify/index.ts` | associa visitor a lead/email/phone |
| `tracking-pixel/index.ts` | pixel 1x1 GIF (noscript / cross-domain fallback) |

### Forms
| Function | Função |
|---|---|
| `forms-ingest/index.ts` | endpoint público que recebe submissão (CF7, Elementor, HTML puro) |
| `forms-admin/index.ts` | CRUD de forms (admin) |
| `forms-snippet/index.ts` | gera snippet JS embedável |
| `forms-plugin-zip/index.ts` | empacota plugin WP em ZIP para download |

### Suporte
- `external-lead-capture/index.ts` — API direta (curl/server-to-server). Ver [KANBAN_LEADS](./KANBAN_LEADS.md).

### Compartilhado
- `_shared/attribution.ts` — resolução UTM + first/last-touch + merge de visitor.

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `tracking_events` | evento bruto (pageview, click, custom) |
| `tracking_sessions` | sessão por `visitor_id` |
| `tracking_visitors` | visitor anônimo |
| `tracking_identities` | mapping visitor → lead |
| `tracking_clinic_configs` | config pública por clínica (CORS, domínios) |
| `forms` | definição de formulário (campos, mapping) |
| `form_submissions` | submissões cruas |
| `leads.utm_source / utm_medium / utm_campaign / utm_term / utm_content / referrer / landing_page` | atribuição persistida |

### RLS
- `tracking_events` / `forms_*`: insert via service_role na edge; select por `clinic_id`.
- Edges recebem clinic_id via `tracking_clinic_configs.public_key` (não JWT).

### CORS
- `tracking_clinic_configs.allowed_origins[]` controla CORS dos endpoints públicos. Ver `docs/known-issues/CORS_FORMS_INGEST.md`.

## 6. Integrações externas

- Snippets em sites de clientes (HTML puro, WordPress CF7, Elementor, GTM, React/Next).
- Exemplos em `docs/integracao/exemplos/*` (CF7 PHP, Elementor TXT, GTM JSON, React TSX, HTML, curl SH).

## 7. Invariantes — "não toque sem ler"

1. **CORS por clínica.** `tracking_clinic_configs.allowed_origins[]` é a whitelist. Wildcard `*` só em emergência.
2. **Public key ≠ service role.** Snippets usam `public_key` da clínica; nunca embedar service_role.
3. **Idempotência por `event_id`.** Snippet retry → mesmo event_id → dedupe na edge.
4. **Forms-ingest aceita JSON e `application/x-www-form-urlencoded`** (CF7/Elementor). Não restringir content-type.
5. **Atribuição first-touch persiste no lead** (UTM da primeira sessão). Last-touch fica no evento.
6. **Pixel é fallback.** Eventos preferem POST JSON; pixel GIF só para noscript / cross-domain bloqueado.
7. **Nunca colocar `<noscript><img></noscript>` em `<head>`** — só em `<body>` (regra HTML5). Snippet gerado respeita.

## 8. Pegadinhas

- Submissão Elementor manda `application/x-www-form-urlencoded` — parser na edge precisa cobrir os dois.
- Roteamento de captura: `forms-ingest` → `external-lead-capture` (interno) → cria lead → trigger move para stage default.
- `referrer` pode vir vazio se site usa `Referrer-Policy: no-referrer` — não tratar como erro.
- Visitor ID em cookie 1st-party. Cross-domain (lp.exemplo.com → app.exemplo.com) precisa `tracking-identify` por email/phone.
- Rate limit por IP em `tracking-event` para evitar spam — atual default 100/min.
- `forms-plugin-zip` gera ZIP on-the-fly — não cachear.

## 9. Receitas

### Adicionar tipo de evento custom novo
1. Snippet (lado cliente): documentar em `docs/integracao/06-eventos-customizados.md`.
2. `tracking-event/index.ts` — schema Zod aceita já (campo `event_name` livre). Validação só de tamanho/charset.
3. Métricas: `MetricsOps.tsx` lê de `tracking_events` por `event_name`.

### Adicionar integração com nova plataforma (ex: Webflow)
1. Snippet: novo exemplo em `docs/integracao/exemplos/`.
2. Se a plataforma manda formato diferente de CF7/Elementor: adicionar parser em `forms-ingest`.
3. Atualizar `docs/integracao/02-instalacao-snippets.md`.

### Mudar política de CORS
1. UI: `Tracking.tsx` → "Domínios permitidos".
2. Persistência: `tracking_clinic_configs.allowed_origins`.
3. Edge: `tracking-event` / `forms-ingest` leem essa coluna no preflight.
4. Atualizar `docs/known-issues/CORS_FORMS_INGEST.md` se mudar a estratégia.

### Debug "lead não foi criado a partir do form"
1. `form_submissions` — submissão chegou?
2. Logs de `forms-ingest` — 4xx? schema Zod falhou?
3. CORS — `Origin` do request bate com `allowed_origins`?
4. `external-lead-capture` chamada com sucesso?
5. `leads` — criado? Se sim, qual `pipeline_id`/`stage_id`?
6. Atribuição UTM presente em `tracking_events` mais recente do visitor?
