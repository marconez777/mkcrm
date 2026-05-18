# Documentação: Tracking

Criar `docs/TRACKING.md` (Markdown, 6-9 páginas) cobrindo todo o módulo de Tracking — pixel first-party, ingestão de eventos, identificação de leads, telas internas e schema de banco.

## Estrutura do documento

1. **Visão geral**
   - O que é: analytics first-party próprio (sem GA/Meta Pixel), por clínica (`projectId = clinics.slug`), com identificação de visitante → lead e backfill histórico.
   - Stack: tracker JS servido por Edge Function, ingestão via Edge Function, armazenamento em 4 tabelas Postgres (`tracking_visitors`, `tracking_sessions`, `tracking_events`, `tracking_identity_links`), RLS por `clinic_id`.
   - Diagrama de fluxo (ASCII): site cliente → `tracking-pixel` (JS) → `tracking-event` (batch ingest) → tabelas; conversão WhatsApp/inbox → `tracking-identify` → backfill `lead_id` em eventos.

2. **Arquitetura e identidade**
   - `visitor_id`: cookie `_mk_vid` (365d) + fallback `localStorage`, gerado `v_<24hex>`.
   - `session_id`: `sessionStorage` `_mk_sid` + `_mk_sid_exp`, timeout configurável (default 30min).
   - `event_id`: `e_<24hex>` por evento — usado para idempotência via UNIQUE `(clinic_id, event_id)`.
   - `project_id` = `clinics.slug`, resolve para `clinic_id`.
   - Sanitização: URLs preservam apenas UTMs + click ids permitidos (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`); texto truncado; PII bloqueada em `properties` no identify (regex `email|phone|cpf|mensagem|...`).

3. **Edge Functions** (`supabase/functions/tracking-*`)
   - **`tracking-pixel`** (GET, público): retorna `tracker.js` parametrizado por `project_id`. Sem cache (`no-store`).
     - Bootstrap: chama `tracking-config` → se `enabled !== false`, dispara `session_start` + `page_view`.
     - Auto-captura: SPA route (`pushState`/`replaceState`/`popstate`), cliques em `[data-track-event]` e em links WhatsApp (`wa.me`, `api.whatsapp.com`, `web.whatsapp.com`, `whatsapp:`), `form_start` (focusin/change) e `form_submit_attempt` (submit).
     - Envio: `navigator.sendBeacon` com fallback `fetch keepalive`, `credentials: omit`.
     - API global: `window.mkTrack(name, props)`.
   - **`tracking-config`** (GET, público): lê `clinics.settings.tracking` → `{ enabled, session_timeout_minutes, consent_required }`. Cache 5min.
   - **`tracking-event`** (POST, público com restrições): aceita 1 evento ou batch (até 50).
     - Validações: `project_id` válido, `tracking.enabled !== false`, origem em `allowed_domains` (ou usuário interno owner/admin/super_admin via Bearer), rate limit em memória 120 req/min por (clinic, ip).
     - Parse de UA → `device_type`, `browser`, `operating_system`.
     - `ip_hash = sha256(clinic_id|ip)` salvo em `tracking_sessions`.
     - Escritas:
       1. `tracking_visitors`: insert; on conflict atualiza só `last_seen_at` + device (NÃO sobrescreve `first_*`).
       2. `tracking_sessions`: upsert `ignoreDuplicates` em `(clinic_id, session_id)`.
       3. `tracking_events`: upsert `ignoreDuplicates` em `(clinic_id, event_id)` (idempotência).
   - **`tracking-identify`** (POST, mesma política de origem): liga `visitor_id` a `lead_id`.
     - Resolve `lead_id` direto, ou por `email` (ilike) ou `phone` (digits only) dentro da clínica.
     - Upsert em `tracking_identity_links` com `email_hash`/`phone_hash` SHA-256, `link_source`, `whatsapp_id`.
     - Backfill: `UPDATE tracking_events SET lead_id = … WHERE visitor_id = … AND lead_id IS NULL`.
     - Insere evento `lead_identified` (type `identity`).

4. **Helper interno**
   - `src/lib/tracking-identify.ts → linkVisitorToLead({ clinic_id, visitor_id, lead_id?, email?, phone?, source_event, … })`: resolve `project_id` via `clinics.slug` e chama a edge `tracking-identify` autenticada. Usado para vincular conversões originadas no CRM (ex.: novo lead vindo do WhatsApp).

5. **Schema do banco** (com índices, RLS e constraints)
   - `tracking_visitors` — `UNIQUE (clinic_id, visitor_id)`, campos `first_*` imutáveis após inserção, `consent_status` (default `unknown`).
   - `tracking_sessions` — `UNIQUE (clinic_id, session_id)`, UTM/click ids, `ip_hash`, `user_agent (≤500)`.
   - `tracking_events` — `UNIQUE (clinic_id, event_id)`, idx `(clinic_id, visitor_id, event_time DESC)`, `properties jsonb`.
   - `tracking_identity_links` — `UNIQUE (clinic_id, visitor_id, lead_id)`, idx por `lead_id`, `email_hash`, `phone_hash`.
   - RLS: todas com policy `clinic_scoped USING (clinic_id = current_clinic_id())`.

6. **Eventos catalogados**
   Tabela com `event_name`, `event_type`, origem (auto/manual), payload típico:
   - `session_start`, `page_view` (auto, SPA-aware)
   - `whatsapp_click` (auto em links WA) — props: `href`, `button_text`, `page_path`, `location`
   - `form_start`, `form_submit_attempt` (auto em `<form>`) — props: `form_id`, `form_name`, `form_action`
   - Custom via `data-track-event="nome"` (+ `data-track-label`, `data-track-location`) ou `window.mkTrack(name, props)`
   - `lead_identified` (gerado pelo `tracking-identify`)

7. **Configuração por clínica** (`clinics.settings.tracking`)
   ```json
   {
     "enabled": true,
     "session_timeout_minutes": 30,
     "consent_required": false,
     "allowed_domains": ["clinica.com.br", "https://www.clinica.com.br"],
     "debug_enabled": false
   }
   ```
   - `allowed_domains` vazio = permissivo (qualquer origem) — não recomendado em produção.
   - `debug_enabled` libera a aba/rota Debug para usuários não-super-admin.

8. **Instalação no site cliente**
   ```html
   <script async src="https://<SUPABASE_URL>/functions/v1/tracking-pixel?project_id=<slug>"></script>
   ```
   - Marcação de eventos custom: `<a data-track-event="cta_click" data-track-location="hero">…</a>`.
   - WhatsApp: links normais para `wa.me/…` já são capturados automaticamente.

9. **Telas internas** (`src/pages`)
   - **`/tracking` — `Tracking.tsx`** (acessível por todos os membros)
     - Header: período (Hoje / 24h / 7d / 30d / Custom) + botão "Atualizar".
     - Toggle "Debug" (só super-admin ou `debug_enabled`) → link para `/tracking-debug`.
     - **Filtros globais**: `event_name`, `visitor_id`, `lead_id`, `page_url`, etapa do funil, checkboxes (apenas anônimos / viraram lead / com WA / com formulário).
     - **Cards**: visitantes únicos, sessões, eventos, page_view, whatsapp_click, form_start, form_submit_attempt, leads identificados, visitantes→lead, taxa %.
     - **Abas**:
       - Visitantes — tabela com flags (WA/Form/Submit), sessões, lead vinculado, etapa, ação "ver jornada".
       - Eventos — últimos 500 eventos com `properties` cru.
       - Leads com origem — junção `tracking_identity_links + leads + visitors`, mostra evento e página de conversão.
       - Páginas — pageviews, visitantes, WA, form, leads, conv% por `pathname`.
       - WhatsApp — totais, únicos, viraram lead, taxa, top páginas geradoras.
     - **Modal Jornada**: visitante, sessões (até 50) e timeline de eventos (até 500), link para lead.
   - **`/tracking-debug` — `TrackingDebug.tsx`** (super-admin ou `debug_enabled`)
     - Períodos 1h/24h/7d, filtros similares, foco em inspecionar sessões e UTM/click ids.
     - Ações de testes manuais (linkVisitorToLead, ver eventos crus).
   - Navegação: `src/components/AppShell.tsx` adiciona itens "Tracking" e "Tracking Debug" condicionalmente.

10. **Segurança e privacidade**
    - Sem PII em `properties` (sanitizado no identify; recomendar não enviar pelo cliente).
    - `email_hash`/`phone_hash` SHA-256 (phone normalizado para dígitos, email lowercase trim).
    - `ip_hash` por clínica (sem armazenar IP cru).
    - Origin allowlist obrigatória em produção para evitar spoofing de `project_id`.
    - Rate limit em memória por instância (best-effort, não estrito).
    - RLS impede que outra clínica leia dados.

11. **Cheatsheet para devs**
    - Adicionar novo evento auto-capturado → editar `supabase/functions/tracking-pixel/index.ts`.
    - Mudar regras de ingestão → `tracking-event/index.ts` (allowlist, rate limit, parse).
    - Resolver lead por outro identificador → `tracking-identify/index.ts` (bloco "Resolve lead_id").
    - Nova coluna de UTM/click id → adicionar em `tracking_sessions` (migration) + payload em `tracking-pixel` + persistência em `tracking-event`.
    - Nova métrica na UI → `src/pages/Tracking.tsx` (`load()`, `summary`, `useMemo` por aba).
    - Disparar identify a partir do CRM → `linkVisitorToLead()` em `src/lib/tracking-identify.ts`.
    - Habilitar/configurar clínica → escrever `clinics.settings.tracking.{enabled,allowed_domains,session_timeout_minutes,debug_enabled}` (via Settings ou SQL).

## Entregável
Arquivo único: `docs/TRACKING.md`. Sem mudanças em código.
