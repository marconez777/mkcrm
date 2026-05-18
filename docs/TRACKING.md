# Tracking — Documentação técnica

Módulo de analytics first-party do CRM. Substitui (ou complementa) Google Analytics / Meta Pixel com um pixel próprio, sem depender de terceiros, com identificação visitante → lead e backfill histórico de eventos.

---

## 1. Visão geral

- **Multi-tenant por clínica**: cada clínica é identificada pelo `project_id`, que é o `clinics.slug`. O backend resolve `slug → clinic_id`.
- **4 tabelas Postgres** com RLS por `clinic_id`:
  - `tracking_visitors` — 1 linha por visitante anônimo.
  - `tracking_sessions` — 1 linha por sessão (UTMs, click ids, device).
  - `tracking_events` — eventos brutos (page_view, click, form, custom…).
  - `tracking_identity_links` — vínculo `visitor_id ↔ lead_id`.
- **4 Edge Functions** em `supabase/functions/tracking-*`:
  - `tracking-pixel` — entrega o `tracker.js` para o site cliente.
  - `tracking-config` — config pública (timeout de sessão, enabled).
  - `tracking-event` — ingestão de eventos.
  - `tracking-identify` — vincula visitor a lead.
- **2 telas internas** em `src/pages`:
  - `/tracking` (`Tracking.tsx`) — dashboard operacional.
  - `/tracking-debug` (`TrackingDebug.tsx`) — auditoria para super admin / debug.

### Fluxo de alto nível

```text
                 +----------------------+
                 |  Site do cliente     |
                 |  <script src=pixel>  |
                 +----------+-----------+
                            |
              tracker.js (page_view, click, form…)
                            |
                            v
               +-----------------------------+
               |  edge: tracking-event       |
               |  - valida origem (allow)    |
               |  - rate limit               |
               |  - upsert visitor/session   |
               |  - insert event (idemp.)   |
               +-----+------------+----------+
                     |            |
                     v            v
       tracking_visitors    tracking_sessions
                     \            /
                      \          /
                       v        v
                   tracking_events  <----+
                                         |
   Conversão no CRM (WhatsApp, form):    | UPDATE lead_id
   linkVisitorToLead() ----> edge: tracking-identify
                                  - resolve lead
                                  - upsert tracking_identity_links
                                  - backfill tracking_events.lead_id
                                  - insert event lead_identified
```

---

## 2. Identidade e sanitização

| Campo | Onde mora | Formato | TTL |
|---|---|---|---|
| `visitor_id` | cookie `_mk_vid` + `localStorage` (fallback) | `v_<24hex>` | 365 dias |
| `session_id` | `sessionStorage` `_mk_sid` + `_mk_sid_exp` | `s_<24hex>` | `session_timeout_minutes` (default 30) |
| `event_id` | gerado por evento no cliente | `e_<24hex>` | idempotência via `UNIQUE(clinic_id, event_id)` |
| `project_id` | querystring do pixel | `clinics.slug` | — |

**Sanitização de URL** (`sanitizeUrl`): preserva apenas `origin + pathname` e a querystring com chaves permitidas:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`.

**Sanitização de texto** (`sanitizeText`): trim + colapso de whitespace + truncate (geralmente 120 chars).

**Sanitização de `properties`** (no `tracking-identify`): regex bloqueia chaves contendo `email|phone|telefone|cpf|mensagem|message|password|senha|diagnost|sintom|resposta|answer`. Strings > 500 chars são truncadas.

---

## 3. Edge Functions

Todas em `supabase/functions/tracking-*/index.ts`, deploy automático.

### 3.1 `tracking-pixel` — GET, público

`GET /functions/v1/tracking-pixel?project_id=<slug>` → `application/javascript` (sem cache).

Retorna o `tracker.js` interpolado com `PROJECT_ID`, endpoint de eventos e endpoint de config.

**O que o script faz no navegador**:

1. Resolve `visitor_id` (cookie / localStorage / gera novo) e seta `_mk_vid` por 365d.
2. Resolve `session_id` via `sessionStorage`. Se expirou (timeout configurável), cria novo.
3. Faz `GET tracking-config` → se `enabled === false`, não dispara nada.
4. Dispara `session_start` + `page_view` no boot.
5. **SPA-aware**: monkey-patch em `history.pushState` / `replaceState` + listener `popstate` → re-dispara `page_view` quando a rota muda.
6. **Auto-captura de cliques** (listener global `click` em capture):
   - Elementos com `data-track-event="nome"` → dispara `nome` com props `label`, `location`, `element_text`, `element_href`, `element_tag`.
   - Links para WhatsApp (`wa.me`, `api.whatsapp.com`, `web.whatsapp.com`, esquema `whatsapp:`) → dispara `whatsapp_click` com `href`, `button_text`, `page_path`, `page_title`, `location`. Se o elemento já tinha `data-track-event` que não seja `whatsapp_click`, dispara os dois.
7. **Auto-captura de formulário**:
   - `focusin` / `change` dentro de um `<form>` → `form_start` (uma vez por form, via `WeakSet`).
   - `submit` → `form_submit_attempt`.
8. **Envio**: `navigator.sendBeacon` com `Blob` JSON; fallback `fetch` com `keepalive: true`, `credentials: omit`.
9. **API global**: `window.mkTrack(name, props)` para eventos customizados.

### 3.2 `tracking-config` — GET, público

`GET /functions/v1/tracking-config?project_id=<slug>` → `application/json`, `Cache-Control: public, max-age=300`.

Lê `clinics.settings.tracking` e retorna apenas o que o cliente precisa saber:

```json
{
  "enabled": true,
  "session_timeout_minutes": 30,
  "consent_required": false
}
```

### 3.3 `tracking-event` — POST, público (com origem restrita)

`POST /functions/v1/tracking-event` — recebe 1 evento ou batch de até 50.

**Pipeline**:

1. Parse JSON. Rejeita batch vazio ou > 50 (`bad_batch`).
2. Resolve clínica via `project_id` (`clinics.slug`). 404 se inexistente.
3. Se `settings.tracking.enabled === false` → retorna `{ok:true, ignored:true}` (silencioso).
4. **Allowlist de origem** (`tcfg.allowed_domains`):
   - Compara `hostname` do `Origin`/`Referer` contra a lista (matching exato ou subdomínio).
   - Lista vazia = permissivo (não recomendado em produção).
   - Se origem não bate, tenta `isInternalAuthorized()`: Bearer válido + `super_admin` ou `clinic_members` com role `owner|admin`. Útil para teste a partir do app.
   - Falhou as duas → `403 origin_not_allowed`.
5. **Rate limit em memória**: 120 req/min por `(clinic_id, ip)`. Best-effort por instância da edge — não estrito.
6. `ip_hash = sha256(clinic_id|ip)` — IP cru nunca é persistido.
7. Para cada evento (válido: requer `visitor_id`, `event_id`, `event_name`):
   - Parse de UA → `device_type` (`desktop|mobile|tablet`), `browser`, `operating_system`.
   - Acumula payload de visitor / session / event.
8. **Persistência**:
   - `tracking_visitors`: **tenta INSERT primeiro**; em conflito (mesmo `clinic_id+visitor_id`), faz UPDATE só de `last_seen_at` + device. Isso preserva os campos `first_*` (landing page, referrer, UTM) do primeiro contato — comportamento intencional.
   - `tracking_sessions`: `upsert` com `ignoreDuplicates: true` em `(clinic_id, session_id)`. Sessão existente fica como está.
   - `tracking_events`: `upsert` com `ignoreDuplicates: true` em `(clinic_id, event_id)`. Garante idempotência mesmo se o cliente reenviar.
9. Retorno: `{ ok: true, received: <n> }`.

### 3.4 `tracking-identify` — POST, mesma política de origem

`POST /functions/v1/tracking-identify` — vincula `visitor_id` anônimo a um `lead_id`.

**Body**:
```json
{
  "project_id": "minha-clinica",
  "visitor_id": "v_abc...",
  "session_id": "s_xyz...",          // opcional
  "lead_id": "uuid",                  // opcional se passar email/phone
  "email": "...",                     // opcional
  "phone": "...",                     // opcional (digits only é melhor)
  "whatsapp_id": "...",               // opcional
  "source_event": "form_submit",      // opcional
  "properties": { ... }               // opcional, PII filtrada
}
```

**Pipeline**:

1. Mesma validação de origem do `tracking-event` (allowlist OU usuário interno).
2. Resolução do lead:
   - Se `lead_id` veio no body → usa.
   - Senão: busca em `leads` da clínica por `email` (ilike) ou `phone` (normalizado para dígitos).
   - Sem resultado → `400 lead_not_resolved`.
3. Hash de PII: `email_hash = sha256(lower(trim(email)))`, `phone_hash = sha256(digits(phone))`.
4. **Upsert** em `tracking_identity_links` (`onConflict: clinic_id,visitor_id,lead_id`).
5. **Backfill**: `UPDATE tracking_events SET lead_id = X WHERE clinic_id = ? AND visitor_id = ? AND lead_id IS NULL`. Todos os eventos passados desse visitante passam a estar atribuídos ao lead.
6. Insere evento `lead_identified` (`event_type: 'identity'`) com `properties` sanitizadas + `source_event`, `has_email_hash`, `has_phone_hash`.
7. Retorno: `{ ok: true, lead_id: <uuid> }`.

---

## 4. Helper interno: `src/lib/tracking-identify.ts`

```ts
import { linkVisitorToLead } from "@/lib/tracking-identify";

await linkVisitorToLead({
  clinic_id,
  visitor_id,              // do cookie _mk_vid capturado em algum ponto
  lead_id,                 // ou email / phone
  source_event: "manual",
});
```

Resolve `project_id` consultando `clinics.slug` pelo `clinic_id` e chama a edge `tracking-identify` via `supabase.functions.invoke` (que injeta o JWT do usuário logado, satisfazendo `isInternalAuthorized()` mesmo para origens não listadas — ex.: chamado a partir do CRM).

Usado em fluxos onde a conversão acontece dentro do CRM e queremos amarrar a um visitante já conhecido (ex.: lead novo vindo do WhatsApp depois de ter visto a landing page).

---

## 5. Schema do banco

Todas as tabelas com RLS `clinic_scoped USING (clinic_id = current_clinic_id())`.

### `tracking_visitors`
- PK: `id (uuid)`; UNIQUE `(clinic_id, visitor_id)`.
- Campos imutáveis após criação (lógica na edge, não constraint): `first_seen_at`, `first_landing_page`, `first_referrer`, `first_source`, `first_medium`, `first_campaign`.
- Atualizáveis em cada hit: `last_seen_at`, `device_type`, `browser`, `operating_system`.
- `consent_status text default 'unknown'` (reservado para LGPD/consent mode futuro).
- Trigger: `set_updated_at`.

### `tracking_sessions`
- PK: `id`; UNIQUE `(clinic_id, session_id)`.
- Idx: `(clinic_id, visitor_id, started_at DESC)`.
- Atribuição: `source`, `medium`, `campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `msclkid`, `gbraid`, `wbraid`.
- Contexto: `landing_page`, `referrer`, `device_type`, `browser`, `operating_system`, `ip_hash`, `user_agent (≤500)`.
- `ended_at` reservado (não preenchido hoje).

### `tracking_events`
- PK: `id`; **UNIQUE `(clinic_id, event_id)`** — idempotência total.
- Idx: `(clinic_id, visitor_id, event_time DESC)`.
- Campos: `event_name`, `event_type` (default `custom`), `event_time`, `page_url`, `page_path`, `page_title`, `referrer`, `properties jsonb`.
- `lead_id` começa `NULL` e é preenchido pelo backfill do `tracking-identify`.

### `tracking_identity_links`
- PK: `id`; UNIQUE `(clinic_id, visitor_id, lead_id)`.
- Idx parciais úteis: `(clinic_id, email_hash) WHERE email_hash IS NOT NULL`, mesmo para `phone_hash`.
- Campos: `email_hash`, `phone_hash`, `whatsapp_id`, `link_source`, `linked_at`.

---

## 6. Catálogo de eventos

| event_name | event_type | Origem | Props típicas |
|---|---|---|---|
| `session_start` | `session_start` | Auto (boot) | — |
| `page_view` | `page_view` | Auto (boot + SPA route change) | — |
| `whatsapp_click` | `custom` | Auto (links WA) ou manual | `href`, `button_text`, `page_path`, `page_title`, `location` |
| `form_start` | `custom` | Auto (focusin/change em `<form>`) | `form_id`, `form_name`, `form_action`, `page_path`, `page_title` |
| `form_submit_attempt` | `custom` | Auto (submit) | mesmas do `form_start` |
| **custom** | `custom` | `data-track-event="..."` ou `window.mkTrack(name, props)` | livres (sem PII) |
| `lead_identified` | `identity` | Gerado pelo `tracking-identify` | `source_event`, `has_email_hash`, `has_phone_hash` |

---

## 7. Configuração por clínica

Armazenada em `clinics.settings.tracking`:

```jsonc
{
  "enabled": true,
  "session_timeout_minutes": 30,
  "consent_required": false,
  "allowed_domains": [
    "clinica.com.br",
    "https://www.clinica.com.br"
  ],
  "debug_enabled": false
}
```

- **`enabled: false`** → `tracking-event` aceita e descarta silenciosamente; `tracking-config` retorna `enabled:false` e o script não dispara nada.
- **`allowed_domains`** vazio = permissivo (qualquer origem). Em produção, **sempre preencher** para evitar spoofing de `project_id`.
- **`session_timeout_minutes`** — inatividade que invalida `session_id`.
- **`debug_enabled`** — habilita a aba/rota Debug para usuários que não são super admin.

---

## 8. Instalação no site cliente

```html
<!-- Coloque antes de </body> -->
<script async src="https://<SUPABASE_URL>/functions/v1/tracking-pixel?project_id=<slug>"></script>
```

### Eventos customizados via marcação
```html
<a href="/contato"
   data-track-event="cta_click"
   data-track-label="hero_primary"
   data-track-location="hero">
  Falar com a gente
</a>
```

### Eventos customizados via JS
```html
<script>
  window.mkTrack && window.mkTrack("video_played", { video_id: "intro" });
</script>
```

### WhatsApp
Links normais para `https://wa.me/55...` ou `https://api.whatsapp.com/send?...` são capturados automaticamente como `whatsapp_click`. Não precisa marcar.

---

## 9. Telas internas

### 9.1 `/tracking` — `src/pages/Tracking.tsx`

Acessível por todos os membros da clínica. Visão operacional consolidada.

**Header**
- Seletor de período: `Hoje`, `Últimas 24h`, `7 dias`, `30 dias`, `Personalizado` (datetime-local).
- Toggle "Debug" (apenas super admin OU `settings.tracking.debug_enabled === true`) → link para `/tracking-debug`.
- Botão "Atualizar dados".

**Filtros globais**
- Texto parcial: `event_name`, `visitor_id`, `lead_id`, `page_url`.
- Etapa do funil (select de `pipeline_stages`).
- Checkboxes: "Apenas anônimos", "Apenas viraram lead", "Com clique no WhatsApp", "Com formulário".

**Cards de visão geral**
Visitantes únicos, Sessões, Eventos totais, Pageviews, Clique WhatsApp, Formulários iniciados, Form. tentativa de envio, Leads identificados, Visitantes→Lead, Taxa visitante→lead %.

**Abas**

1. **Visitantes** — tabela com `visitor_id`, primeira/última visita, primeira/última página, referrer, contadores (sessões / eventos), flags (WA / Form / Submit), lead vinculado + etapa do funil, botão 👁 abre modal de jornada.
2. **Eventos** — últimos 500 eventos (no período filtrado), com `properties` exibido como JSON cru.
3. **Leads com origem** — join `tracking_identity_links + leads + tracking_visitors + tracking_events`; mostra lead, visitor, primeira visita, primeira página, página de conversão, evento de conversão (`whatsapp_click` ou `form_submit_attempt`), etapa atual.
4. **Páginas** — top 100 páginas por pageviews, com visitantes, WA, form_start, form_submit_attempt, leads gerados, conv%.
5. **WhatsApp** — totais (cliques, visitantes únicos, viraram lead, taxa) + top 20 páginas geradoras.

**Modal Jornada** — abre ao clicar 👁:
- Resumo: 1ª visita, última visita, sessões, eventos.
- Lead vinculado (link para `/?lead=...`).
- Lista cronológica de sessões (até 50) e eventos (até 500) do visitante.

**Notas de carregamento**
- `load()` puxa até 5000 eventos e 1000 visitantes do período, e processa flags / pageReport / whatsappReport em `useMemo`.
- Os filtros de texto vão como `ilike` na query Supabase; checkboxes/etapa filtram client-side.

### 9.2 `/tracking-debug` — `src/pages/TrackingDebug.tsx`

Acessível por super admin OU quando `settings.tracking.debug_enabled === true`.

- Períodos curtos (`1h`, `24h`, `7d`).
- Filtros por `event_name`, `visitor_id`, `page_url`.
- Visão de sessões com **todos os atributos de atribuição** (utm_content, utm_term, gclid, fbclid, msclkid, gbraid, wbraid, user_agent…).
- Ferramentas internas — entre elas, vínculo manual `visitor → lead` via `linkVisitorToLead` para depurar fluxos de identificação.

### 9.3 Navegação

`src/components/AppShell.tsx` decide o que mostrar:

```ts
navItems = [...navItems, { to: "/tracking", label: "Tracking", icon: Radar }];
if (debugEnabled) {
  navItems = [...navItems, { to: "/tracking-debug", label: "Tracking Debug", icon: Radar }];
}
```

Rotas registradas em `src/App.tsx`.

---

## 10. Segurança e privacidade

- **Sem PII em `properties`**: o `tracking-identify` filtra; recomendamos não passar PII em eventos no cliente também.
- **Hashes**: `email_hash` / `phone_hash` em SHA-256 (email lowercased + trimmed; phone reduzido a dígitos). Permitem casamento sem armazenar o valor cru.
- **IP**: nunca persistido em texto. Apenas `ip_hash = sha256(clinic_id|ip)` em `tracking_sessions`.
- **Allowlist de origem** é a única defesa contra spoofing de `project_id` em produção — preencher sempre.
- **Rate limit** (`tracking-event`) é por instância da edge, não global. Vale como freio, não como bloqueio rígido.
- **RLS** garante isolamento: nenhum usuário enxerga dados de outra clínica.
- **Idempotência** por `event_id` evita duplicação se o `sendBeacon` reentregar.
- **`consent_status`** já existe em `tracking_visitors` (default `unknown`) — gancho para implementar consent mode futuro sem migration.

---

## 11. Cheatsheet para devs

| Quero… | Editar |
|---|---|
| Adicionar evento auto-capturado | `supabase/functions/tracking-pixel/index.ts` (listeners + `track(...)`) |
| Mudar validação de origem / rate limit / batch size | `supabase/functions/tracking-event/index.ts` |
| Resolver lead por outro identificador (ex.: external_id) | `supabase/functions/tracking-identify/index.ts`, bloco "Resolve lead_id" |
| Persistir nova UTM / click id | 1) coluna em `tracking_sessions` (migration) · 2) payload no `tracking-pixel` (`baseEvent`) · 3) gravar em `tracking-event` (`sessionRows`) |
| Mudar política de PII filtrada | `tracking-identify/index.ts → safeProps()` |
| Adicionar métrica/aba na UI | `src/pages/Tracking.tsx` (`load()`, `summary`, `useMemo`, `<Tabs>`) |
| Vincular visitor a lead a partir do CRM | `src/lib/tracking-identify.ts → linkVisitorToLead()` |
| Habilitar/configurar tracking de uma clínica | `clinics.settings.tracking.{enabled,allowed_domains,session_timeout_minutes,debug_enabled}` (UI de Settings ou SQL direto) |
| Inspecionar eventos crus rapidamente | `/tracking-debug` |
| Investigar duplicações | conferir `event_id` único + `UNIQUE(clinic_id, event_id)` |
| "Por que esse visitor não virou lead?" | Aba "Leads com origem" + modal Jornada; checar se `tracking_identity_links` existe e se backfill rodou (`tracking_events.lead_id`) |

---

## 12. Limitações conhecidas

- Rate limit em memória **não compartilhado entre instâncias** da edge function.
- `tracking_sessions.ended_at` não é preenchido (sessões são "abertas" indefinidamente; o cliente decide quando começa uma nova via timeout).
- `consent_required` é lido pelo cliente, mas o gating real de captura por consentimento ainda precisa ser implementado.
- `tracking_events` cresce sem retenção configurada — considerar política de purge para clínicas com alto volume.
- `Tracking.tsx` puxa até 5000 eventos / 1000 visitantes por período. Janelas muito largas em clínicas grandes podem precisar de paginação ou agregação no banco.
