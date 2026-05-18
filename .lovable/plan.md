# Onda 3: Normalização de variações + UI de atribuição

100% aditivo. Não toca em `tracking-pixel`/tracker.js, não recalcula sessões antigas, não modifica `raw_params`.

## 1. Migration `add_tracking_normalization_rules.sql`

Tabela `traffic_source_rules`:
- `id uuid pk default gen_random_uuid()`, `clinic_id uuid null` (null = global), `match_type text check in ('exact','contains')`, `input_source text`, `input_medium text`, `normalized_source text`, `normalized_medium text`, `channel_group text`, `priority int default 100`, `active boolean default true`, `created_at timestamptz default now()`.
- Index `(active, priority, clinic_id)`.
- RLS habilitada:
  - SELECT: `clinic_id is null OR clinic_id = current_clinic_id()`
  - INSERT/UPDATE: `clinic_id = current_clinic_id()` (globais ficam reservadas a service_role / SQL direto)
- Seeds 21 regras globais (clinic_id NULL, priority 10): fb→facebook/paid_social; facebook.com/m.facebook.com/l.facebook.com→facebook/organic_social; ig/insta/instagram.com/l.instagram.com→instagram/organic_social; metaads/meta-ads→meta/paid_social; googleads/google-ads/adwords→google/paid_search; youtube.com/m.youtube.com→youtube/organic_social; linkedin.com→linkedin/organic_social; tiktok.com→tiktok/organic_social; wa/whatsapp→whatsapp/referral; bing.com→bing/organic_search; duckduckgo.com→duckduckgo/organic_search. `ON CONFLICT DO NOTHING`.

## 2. `tracking-event/index.ts` — aplicar regras pós-resolveTrafficSource

No topo do módulo (escopo da edge, persiste entre invocações na mesma instância):

```ts
type Rule = { match_type:'exact'|'contains'; input_source:string|null; normalized_source:string|null; normalized_medium:string|null; channel_group:string|null; priority:number };
const ruleCacheByClinic = new Map<string,{rules:Rule[];stamp:number}>();
const RULE_CACHE_TTL_MS = 5*60*1000;
async function getRulesForClinic(clinic_id:string): Promise<Rule[]> { /* select com .or('clinic_id.is.null,clinic_id.eq.'+clinic_id) + active=true + order priority asc, cache 5min */ }
function applyRules(source:string|null, rules:Rule[]): {source,medium,channel_group}|null { /* lowercase compare; first match (já ordenado por priority) vence */ }
```

Antes do loop de eventos (handler), `const rules = await getRulesForClinic(clinic.id);`. Dentro do loop, depois de `const attr = resolveTrafficSource(...)`:

```ts
const m = applyRules(attr.source, rules);
if (m) {
  attr.source = m.source ?? attr.source;
  if (m.medium) attr.medium = m.medium;
  if (m.channel_group) attr.channel_group = m.channel_group;
}
```

`raw_params` permanece intocado.

## 3. `src/components/leads/LeadAttributionCard.tsx` (novo)

Busca `tracking_lead_sources` filtrando por `lead_id` (RLS já scope clinic). Estados: loading (Skeleton), vazio ("Sem dados de origem. Esse lead não foi vinculado a um visitante rastreado."), e com dados.

Render: agrupa por `source_type` (conversion_touch, first_touch, last_non_direct). Para cada bloco usa `SourceBlock` com título, badge de `confidence_score`, linha `source / medium`, campanha, channel_group e página. `conversion_touch` recebe `highlight` (border/bg sutis via design tokens).

`ClickIdsRow` (uma vez, baseado em conversion_touch ?? first_touch): lê `gclid, fbclid, fbp, fbc, ttclid, msclkid, li_fat_id`, e renderiza **só nome em Badge "capturado"** quando truthy. Nunca exibir o valor.

Cleanup via `cancelled` flag no useEffect.

## 4. Integrar no `src/pages/LeadDrawer.tsx`

Adicionar `<LeadAttributionCard leadId={lead.id} />` na coluna lateral / abaixo das informações principais (decisão pontual ao implementar — sem alterar lógica do drawer).

## 5. Aba "Atribuição" em `src/pages/Tracking.tsx` + `src/pages/tracking/AttributionTab.tsx`

Em `Tracking.tsx`:
- Adicionar `<TabsTrigger value="attribution">Atribuição</TabsTrigger>` (linha ~438) e respectivo `<TabsContent value="attribution"><AttributionTab clinicId={membership?.clinic?.id} from={sinceISO} to={untilISO} /></TabsContent>` (após o de visitors).
- Renderizar `AttributionTab` apenas quando `clinicId` definido.

`AttributionTab` (novo arquivo `src/pages/tracking/AttributionTab.tsx`):
- useEffect com cleanup busca `tracking_lead_sources` filtrando `clinic_id`, `source_type='conversion_touch'`, `created_at` entre `from`/`to` (período obrigatório, **nunca sem filtro**).
- `useMemo` agrupa por `${channel_group}|${source}|${medium}` agregando: leads (count) e confidence média (sum/count).
- Renderiza Table: Canal | Origem | Mídia | Leads | Confiança média. Ordenado por leads desc.
- Estados: loading text, vazio ("Sem leads com atribuição no período"), tabela.

## Regras inegociáveis

- Globais (`clinic_id IS NULL`) read-only para clínicas via RLS; só service_role/SQL direto altera.
- Cache de regras por instância, TTL 5min — aceitável.
- Normalização **nunca** toca `raw_params`.
- UI lê **exclusivamente** de `tracking_lead_sources` (canônica) — sem joins reconstrutivos.
- Click IDs aparecem só como badge "capturado" (nome) — nunca valor em texto.

## Fora de escopo

- Editor de regras na UI.
- Mudanças em tracker.js / tracking-pixel.
- Recálculo de sessões antigas.
- Onda 4.

## Critérios de aceitação

- Migration cria 21 regras globais.
- `?utm_source=fb&utm_medium=cpc` → session `source='facebook'`.
- `?utm_source=IG` → `source='instagram'`.
- `?utm_source=googleads` → `source='google'`, `channel_group='paid_search'`.
- `raw_params` preserva `fb`, `IG`, `googleads` originais.
- Card do lead mostra conversion_touch, first_touch, last_non_direct (quando existirem), confidence_score e badges de identificadores capturados.
- Lead sem sources → "Sem dados de origem".
- Aba Atribuição agrupa canal × origem × mídia com contagem e confiança média do período.
- Nenhum valor de click ID em texto na UI.