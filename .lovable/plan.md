## Plano — Fase 1: Fundação do tracking first-party

Escopo mínimo aprovado: tabelas base + endpoint `/tracking/event` + `tracker.js` servido por edge function. Multi-clínica desde o dia 1. Zero reaproveitamento do sistema antigo.

Tudo que **não** é Fase 1 (identify, WhatsApp tracking, classificação, telas, Smartlook, Ads) fica para rodadas futuras.

---

### 1. Migração de banco

Três tabelas novas em `public`, todas com `clinic_id` + RLS:

**`tracking_visitors`**
- `visitor_id` (text, único por clínica), `clinic_id`
- `first_seen_at`, `last_seen_at`
- `first_landing_page`, `first_referrer`
- `first_source`, `first_medium`, `first_campaign` (UTM bruto da 1ª sessão)
- `device_type`, `browser`, `operating_system` (parse simples do UA no server)
- `consent_status` (default `'unknown'`)
- `created_at`, `updated_at`
- Índice único `(clinic_id, visitor_id)`

**`tracking_sessions`**
- `session_id` (text), `visitor_id`, `clinic_id`
- `started_at`, `ended_at` (nullable)
- `landing_page`, `referrer`
- `source`, `medium`, `campaign`, `utm_content`, `utm_term`
- `gclid`, `fbclid`, `msclkid`, `gbraid`, `wbraid`
- `device_type`, `browser`, `operating_system`
- `ip_hash` (sha256 do IP + salt da clínica, sem IP cru), `user_agent`
- `created_at`, `updated_at`
- Índice `(clinic_id, visitor_id, started_at desc)`

**`tracking_events`**
- `event_id` (text, único por clínica — idempotência), `clinic_id`
- `visitor_id`, `session_id`, `lead_id` (nullable, vazio na Fase 1)
- `event_name`, `event_type` (`page_view` | `session_start` | `custom`)
- `event_time`, `page_url`, `page_path`, `page_title`, `referrer`
- `properties` jsonb, `created_at`
- Índice único `(clinic_id, event_id)` para deduplicação
- Índice `(clinic_id, visitor_id, event_time desc)`

**RLS**: policy uniforme `clinic_scoped` (`clinic_id = current_clinic_id()`), seguindo o padrão das outras tabelas do CRM. Edge functions usam service-role e fazem o scoping manual via `project_id` recebido.

**Identificação de cliente (no lugar do tracking_sites antigo)**:
- Reuso de `clinics.settings -> 'tracking'` (jsonb) para guardar config por cliente:
  - `enabled` (bool), `allowed_domains` (array), `session_timeout_minutes` (int), `consent_required` (bool)
- `project_id` enviado pelo pixel = `clinic.slug` (já existe, já único). Edge resolve `slug → clinic_id`.
- Sem secret no navegador. Auth feita por **CORS allowlist** (`allowed_domains`) + rate limit por IP.

### 2. Edge functions (3 novas)

```
supabase/functions/tracking-pixel/index.ts    → GET, serve tracker.js
supabase/functions/tracking-config/index.ts   → GET ?project_id=slug, retorna config pública
supabase/functions/tracking-event/index.ts    → POST eventos (1 ou batch)
```

Todas com `verify_jwt = false` e CORS dinâmico (Allow-Origin = origem da request se estiver em `allowed_domains`).

**`tracking-pixel`** retorna JS minificado com `Content-Type: application/javascript`, `Cache-Control: public, max-age=3600`. Aceita `?project_id=` na query para embutir config.

**`tracking-event`**:
- Valida `project_id` → resolve `clinic_id`
- Valida origem (Origin header ∈ `allowed_domains`)
- Valida payload com zod (visitor_id, session_id, event_id, event_name obrigatórios)
- Upsert em `tracking_visitors` (first_seen mantido, last_seen atualizado)
- Upsert em `tracking_sessions` (cria se novo session_id, atualiza ended_at)
- Insert em `tracking_events` com `ON CONFLICT (clinic_id, event_id) DO NOTHING` (idempotência)
- Rate limit simples in-memory (ou tabela leve) por IP+clinic

### 3. Pixel (tracker.js)

Gerado pela edge `tracking-pixel`. Conteúdo:

- Lê/cria `visitor_id` em cookie first-party `_mk_vid` (1 ano) + localStorage como fallback
- Lê/cria `session_id` em sessionStorage com timeout configurável (default 30 min)
- Captura no `page_view` inicial: URL, path, title, referrer, todos UTMs, todos click IDs (gclid/gbraid/wbraid/fbclid/msclkid), UA, idioma, timezone, screen size
- Envia via `navigator.sendBeacon` (fallback `fetch` com `keepalive`)
- Auto-rastreia mudança de rota (SPA: history.pushState/replaceState/popstate)
- API global `window.mkTrack(eventName, properties)` para eventos custom (clicks, etc — usado em fases futuras)
- ~3–4 KB minificado

### 4. Configuração da Clínica ÓR

Após deploy, INSERT em `clinics.settings.tracking` para a clínica ÓR via tool `supabase--insert`:
```json
{
  "enabled": true,
  "allowed_domains": ["clinicaohrpsiquiatria.com", "www.clinicaohrpsiquiatria.com"],
  "session_timeout_minutes": 30,
  "consent_required": false
}
```

Site da ÓR adiciona uma linha:
```html
<script async src="https://crm.mkart.com.br/functions/v1/tracking-pixel?project_id=clinica-or"></script>
```

### 5. Não-objetivos desta fase

- ❌ Sem endpoint `/identify` (lead linking)
- ❌ Sem tabelas `tracking_attribution`, `tracking_click_ids`, `tracking_whatsapp`, `tracking_identity_links`, `tracking_conversion_exports` (vêm nas fases 3–5/8)
- ❌ Sem nenhuma tela no CRM
- ❌ Sem motor de classificação de origem (só guarda dados brutos)
- ❌ Sem rastreamento de cliques/formulários (só `page_view` e `session_start` automáticos; `mkTrack` fica disponível mas não usado)
- ❌ Sem Smartlook, sem Google Ads, sem Meta CAPI

### 6. Critério de sucesso da Fase 1

1. Site da ÓR carrega `tracker.js` sem erro de CORS.
2. Cada acesso gera linha em `tracking_visitors` (novo) ou atualiza `last_seen_at` (recorrente).
3. Cada visita gera linha em `tracking_sessions` com UTMs e click IDs corretos.
4. Cada page_view gera linha em `tracking_events` com `event_id` único.
5. Reenviar o mesmo evento não duplica (idempotência via `event_id`).
6. Outra clínica não consegue ler dados da ÓR (RLS).

### 7. Ordem de implementação (1 rodada de execução)

1. Migração das 3 tabelas + RLS
2. Edge `tracking-pixel` + `tracking-config` + `tracking-event`
3. Insert config da ÓR
4. Documento curto `docs/TRACKING.md` com snippet de instalação

Aguardando seu OK para começar.