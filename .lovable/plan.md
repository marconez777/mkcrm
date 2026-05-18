# Onda 1 — Fundação Imutável de Atribuição

Mudança 100% aditiva ao módulo de tracking. Sem refatorar nada existente. Sem UI nova.

## Entregáveis

### 1. Migration — `add_tracking_attribution_foundation.sql`

Nova migration idempotente, criada via `supabase--migration`:

- `ALTER TABLE tracking_sessions ADD COLUMN IF NOT EXISTS` para: `fbp`, `fbc`, `ttclid`, `li_fat_id`, `raw_querystring`, `raw_referrer` (text) e `raw_params` (jsonb).
- `CREATE TABLE IF NOT EXISTS tracking_lead_sources` (fotografia imutável da atribuição) com colunas: `clinic_id`, `lead_id`, `visitor_id`, `session_id`, `source_type` (check `first_touch|conversion_touch|last_non_direct`), `source`, `medium`, `campaign`, `content`, `term`, `channel_group`, `landing_page`, `conversion_page`, `referrer`, todos click IDs (`gclid`, `gbraid`, `wbraid`, `fbclid`, `fbp`, `fbc`, `ttclid`, `msclkid`, `li_fat_id`), `confidence_score`, `raw_params`, `created_at`.
- `UNIQUE (clinic_id, lead_id, source_type)`.
- Índices: `(clinic_id, lead_id)` e `(clinic_id, visitor_id)`.
- RLS habilitado com policies select/insert/update no padrão `clinic_id = current_clinic_id()` (mesmo padrão das demais tabelas tracking).

### 2. `supabase/functions/tracking-pixel/index.ts` (tracker.js gerado)

Adições dentro da string `buildScript`, sem remover nada:

- Helper `readCookie(name)` com escape de regex.
- Helper `collectAllParams(url)` que percorre `url.searchParams`, limita key>64 / value>512 e retorna objeto ou null.
- No bloco onde UTMs/click IDs são lidos:
  - Lê `fbclid` da URL, `_fbp` e `_fbc` dos cookies.
  - Se `fbclid` presente e `_fbc` ausente, monta `fbc = 'fb.1.' + Date.now() + '.' + fbclid`.
  - Lê `ttclid` e `li_fat_id` da URL.
- No payload `baseEvent` adiciona: `fbp`, `fbc`, `ttclid`, `li_fat_id`, `raw_querystring` (`window.location.search`), `raw_referrer` (`document.referrer` cru), `raw_params` (saída de `collectAllParams`).
- `sanitizeUrl` permanece intocado — `page_url` continua sanitizado, os `raw_*` são paralelos para auditoria.

### 3. `supabase/functions/tracking-event/index.ts`

No objeto `sessionRow` do upsert em `tracking_sessions`, adicionar os 7 novos campos (`fbp`, `fbc`, `ttclid`, `li_fat_id`, `raw_querystring`, `raw_referrer`, `raw_params`) com `event.<campo> ?? null`. Manter `ignoreDuplicates: true` para que sessões antigas não sejam sobrescritas (primeira atribuição imutável). `tracking_visitors` permanece inalterado.

### 4. `supabase/functions/tracking-identify/index.ts`

Inserir novo passo 4.5 entre o upsert de `tracking_identity_links` e o backfill de `tracking_events`:

- Buscar `firstSession` (mais antiga por `started_at asc` para `clinic_id+visitor_id`).
- Buscar `conversionSession`: se `session_id` veio no body, busca por ele; senão pega a mais recente do visitor.
- Helper `buildSourceRow(sourceType, session)` mapeando campos da sessão para a linha de `tracking_lead_sources` (com `channel_group` e `confidence_score` em null — Onda 2; `conversion_page` só preenchido em `conversion_touch`).
- `upsert` array com `first_touch` e `conversion_touch` (filtrando null), `onConflict: 'clinic_id,lead_id,source_type'`, `ignoreDuplicates: false`.
- Erro nesse upsert apenas loga (`console.error`) e não interrompe — backfill e evento `lead_identified` continuam.

## Regras inegociáveis aplicadas

- Tudo aditivo: nenhuma coluna/função/upsert existente é alterada.
- `tracking_identity_links` não é tocada.
- `ignoreDuplicates: true` mantido em `tracking_sessions` e `tracking_events`.
- RLS clinic-scoped igual ao padrão atual.
- Sem novas dependências npm.
- Sem mudanças em `Tracking.tsx` / `TrackingDebug.tsx`.
- Sem `resolveTrafficSource`, sem `confidence_score`, sem `last_*` — tudo isso é Onda 2.

## Ordem de execução

1. Aplicar migration (com aprovação do usuário).
2. Editar `tracking-pixel/index.ts` (tracker).
3. Editar `tracking-event/index.ts` (persistir novos campos da sessão).
4. Editar `tracking-identify/index.ts` (congelar atribuição).
5. Deploy das 3 edge functions modificadas.

## Validação pós-deploy (critérios de aceitação)

Verificar via `tracking-debug` ou query direta:
- Migration roda 2x sem erro.
- `?fbclid=test123` → `tracking_sessions.fbclid='test123'` e `fbc='fb.1.<ts>.test123'`.
- Cookie `_fbp` setado → `tracking_sessions.fbp` populado.
- `?ttclid=abc` e `?li_fat_id=xyz` persistidos.
- `raw_querystring`, `raw_referrer`, `raw_params` populados (raw_params inclui parâmetros desconhecidos como `?foo=bar`).
- Após `tracking-identify` com 2+ sessões: 2 linhas em `tracking_lead_sources` (first_touch + conversion_touch).
- Segunda chamada de identify para mesmo `(lead_id, visitor_id)` não duplica (upsert por unique key).
- Eventos antigos seguem aparecendo em `/tracking` sem regressão.
- Se `tracking_lead_sources` falhar, `tracking_events.lead_id` ainda é atualizado.
