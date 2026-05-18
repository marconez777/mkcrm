# Onda 2: Inteligência de Atribuição

100% aditivo. Não toca em `tracking_identity_links`, rate-limit, allowlist, batch size, UI ou colunas `first_*`. Sessões antigas não são reclassificadas (`ignoreDuplicates: true` mantido).

## 1. Migration `add_tracking_attribution_intelligence.sql`

Idempotente (`add column if not exists`).

- **`tracking_sessions`**: `channel_group text`, `confidence_score int`, `attribution_reason text`.
- **`tracking_visitors` (last_touch)**: `last_source`, `last_medium`, `last_campaign`, `last_channel_group`, `last_seen_attribution_at timestamptz`.
- **`tracking_visitors` (last_non_direct_touch)**: `last_non_direct_source`, `last_non_direct_medium`, `last_non_direct_campaign`, `last_non_direct_channel_group`, `last_non_direct_at timestamptz`.
- **Backfill**: `UPDATE tracking_visitors SET last_* = first_*` onde `last_source IS NULL AND first_source IS NOT NULL` (apenas para não quebrar relatórios na transição).

## 2. Novo arquivo `supabase/functions/_shared/attribution.ts`

Função pura `resolveTrafficSource(input)` retornando `{source, medium, campaign, content, term, channel_group, confidence_score, attribution_reason}`.

Normalização: `trim + lowercase + remove protocol + remove www`.

Prioridade determinística:
1. **Click IDs** (95 se coerente com UTM, 85 se incoerente):
   - `gclid|gbraid|wbraid` → google/cpc, paid_search, `google_click_id`
   - `fbclid|fbc` → meta (ou facebook/instagram se coerente)/paid_social, paid_social, `meta_click_id`
   - `ttclid` (90) → tiktok/paid_social, `tiktok_click_id`
   - `msclkid` (90) → microsoft/cpc, paid_search, `microsoft_click_id`
   - `li_fat_id` (90) → linkedin/paid_social, paid_social, `linkedin_click_id`
2. **UTMs** (80 com campaign, 70 sem) → classifyChannel(source, medium), reason `utm`
3. **Referrer** (65 buscadores google/bing/duckduckgo, 55 sociais instagram/facebook/linkedin/youtube, 50 outros) → organic_search / organic_social / referral
4. **Direct** (30) → direct/none, channel_group `direct`, reason `no_referrer_no_params`

`classifyChannel` mapeia medium → `paid_search | paid_social | organic_search | organic_social | email | referral | other | unknown`.

## 3. `tracking-event/index.ts` — usar resolveTrafficSource na criação da sessão

Import do `_shared/attribution.ts`. Dentro do loop `for (const ev of events)`, antes de montar `sessionRow`:

```ts
const attr = resolveTrafficSource({
  utm_source: ev.utm_source, utm_medium: ev.utm_medium, utm_campaign: ev.utm_campaign,
  utm_content: ev.utm_content, utm_term: ev.utm_term,
  gclid: ev.gclid, gbraid: ev.gbraid, wbraid: ev.wbraid,
  fbclid: ev.fbclid, fbp: ev.fbp, fbc: ev.fbc,
  ttclid: ev.ttclid, msclkid: ev.msclkid, li_fat_id: ev.li_fat_id,
  referrer: ev.referrer,
});
```

No `sessionRows.set(...)` (linha ~195): sobrescrever `source/medium/campaign/utm_content/utm_term` com os valores de `attr` e adicionar `channel_group`, `confidence_score`, `attribution_reason`. Todos os click IDs e `raw_*` da Onda 1 continuam vindo do `ev.*`. Upsert mantém `ignoreDuplicates: true` (Onda 1).

## 4. `tracking-event/index.ts` — last_* e last_non_direct_* em `tracking_visitors`

Calcular `attr` por evento já no loop (item 3). Agregar no Map de visitors o `attr` do **último evento por visitor no batch**.

No **INSERT** (visitor novo) — adicionar campos last_* (= first_*) e, se `attr.source !== 'direct'`, last_non_direct_* também. `first_*` permanece imutável (já é setado só no INSERT).

No **UPDATE** (visitor existente) — substituir payload por:

```ts
const updatePayload: any = {
  last_seen_at: v.last_seen_at,
  device_type: v.device_type, browser: v.browser, operating_system: v.operating_system,
  last_source: v.attr.source,
  last_medium: v.attr.medium,
  last_campaign: v.attr.campaign,
  last_channel_group: v.attr.channel_group,
  last_seen_attribution_at: v.last_seen_at,
};
if (v.attr.source !== 'direct') {
  Object.assign(updatePayload, {
    last_non_direct_source: v.attr.source,
    last_non_direct_medium: v.attr.medium,
    last_non_direct_campaign: v.attr.campaign,
    last_non_direct_channel_group: v.attr.channel_group,
    last_non_direct_at: v.last_seen_at,
  });
}
```

**Regra crítica:** `direct` nunca sobrescreve `last_non_direct_*`.

## 5. `tracking-pixel/index.ts` — quebra de sessão por mudança de campanha

Adicionar constante `STORAGE_SID_SIG = "_mk_sid_sig"`. Adicionar helper `getCampaignSignature()` que lê de `window.location.search` os params `gclid|gbraid|wbraid|fbclid|ttclid|msclkid|li_fat_id|utm_source|utm_campaign` e retorna concatenação com `|`.

Reescrever `getSid()`:
- Ler `sid`, `exp`, `lastSig` de sessionStorage.
- `expired = !sid || now > exp`.
- `hasCampaignSignal = nowSig && nowSig.replace(/\|/g,'').length > 0`.
- `campaignChanged = hasCampaignSignal && lastSig && nowSig !== lastSig`.
- Se `expired || campaignChanged` → gera novo sid.
- Sempre renova `exp`.
- **Só atualiza** `_mk_sid_sig` quando `hasCampaignSignal` (navegação interna sem UTMs preserva última assinatura conhecida).

## 6. `tracking-identify/index.ts` — channel_group/confidence_score + last_non_direct

Em `buildSourceRow`: trocar `channel_group: null` por `session.channel_group ?? null` e `confidence_score: null` por `session.confidence_score ?? null`.

Após buscar `firstSession`/`conversionSession`, buscar visitor:

```ts
const { data: visitor } = await supabase
  .from('tracking_visitors')
  .select('last_non_direct_source,last_non_direct_medium,last_non_direct_campaign,last_non_direct_channel_group,last_non_direct_at')
  .eq('clinic_id', clinic.id).eq('visitor_id', visitor_id).maybeSingle();
```

Se `visitor?.last_non_direct_source` existe **E** difere de `conversionSession?.source`, adicionar row extra `source_type: 'last_non_direct'` (com `session_id: null`, click IDs `null`, `confidence_score: null`, raw_params `null`). Mesmo upsert com `onConflict: 'clinic_id,lead_id,source_type'`.

## Critérios de aceitação (do brief)

- Migration idempotente; backfill `first_* → last_*` em visitors existentes.
- `?gclid=abc&utm_source=newsletter` → source=google, medium=cpc, reason=google_click_id, score=85, channel=paid_search.
- `?utm_source=instagram&utm_medium=social&utm_campaign=teste` → score=80, reason=utm, channel=organic_social.
- Referrer google.com sem params → google/organic, score=65, reason=referrer_google.
- Sem nada → direct/none, score=30.
- Visitor entra via `?fbclid=...` e volta sem UTMs: `last_source=direct`, `last_non_direct_source=meta`, `first_source=meta` (imutável).
- Mesma aba `/?fbclid=abc` → `/contato`: mesmo session_id. `/?fbclid=abc` → `/?gclid=xyz`: novo session_id. Timeout 30min → novo session_id.
- `tracking_lead_sources` na identificação contém first_touch + conversion_touch + (se aplicável) last_non_direct com `channel_group` e `confidence_score`.

## Fora do escopo

UI/Tracking.tsx, `traffic_source_rules`, reprocessamento de sessões antigas, modelos multi-touch, mudanças em batch size/rate-limit/allowlist/identity_links.