# Refocar relatório de Tracking

Reorganizar `src/pages/Tracking.tsx` para focar nas métricas que importam, com seleção manual de quais estágios contam como "consulta fechada", "tratamento fechado" e "não converteu (nutrição)".

## Novos KPIs (cards do topo)

Substituir os 10 cards atuais por 8 cards focados:

1. **Visitas únicas** — `summary.visitors` (já existe)
2. **Leads via formulário** — leads cuja `link_source` é form (`form_submit*`, `partial_form_capture`)
3. **Leads via WhatsApp** — leads cuja `link_source` é whatsapp (`isWhatsappSource`)
4. **Total de leads** — total de `tracking_identity_links` distintos no período
5. **Fechou consulta** — leads cujo `stage_id` está no conjunto selecionado de "estágios de consulta"
6. **Fechou tratamento** — leads cujo `stage_id` está no conjunto selecionado de "estágios de tratamento"
7. **Converteu (total)** — leads únicos em consulta **OU** tratamento (sem dupla contagem). Destacado visualmente.
8. **Não converteu (nutrição)** — leads cujo `stage_id` está no conjunto selecionado de "estágios de nutrição / não converteu" (ex.: "NUTRIÇÃO DE LEADS INATIVOS", "Lead - Desqualificado", "Perdido", "Parou de responder").

Cada um de "fechou consulta", "fechou tratamento", "converteu" e "não converteu" mostra breakdown pequeno: `X WhatsApp · Y Form`.

## Seleção de estágios (persistente por usuário)

Novo card "Configuração de fechamento" (colapsável, abaixo dos filtros globais), com **três** multi-selects (popover + checkbox list reaproveitando lista de `stages`):

- **Estágios = "Consulta fechada"**
- **Estágios = "Tratamento fechado"**
- **Estágios = "Não converteu / nutrição"**

Persistência em `localStorage` por chave `tracking:closing-stages:<clinic_id>`:
```json
{ "consulta": string[], "tratamento": string[], "nutricao": string[] }
```
Sem migração de banco. Sem mudanças em RLS.

## Limpeza (remover cards/tabs irrelevantes)

- Remover dos cards do topo: Sessões, Eventos totais, Pageviews, Clique WhatsApp, Form. iniciados, Form. tent. envio, Leads identificados (redundante), Visitantes→Lead (redundante), Taxa visitante→lead (redundante).
- Remover tabs: **Páginas**, **WhatsApp** e **Atribuição**. Manter apenas: **Visitantes**, **Eventos**, **Leads com origem**.
- Remover do `load()` os counts não usados (`pvCount`, `waCount`, `fsCount`, `faCount`, `sessCount`) e os memos `pageReport` / `whatsappReport` para reduzir queries.
- Manter filtros globais (período, event_name, visitor_id, lead_id, page_url, etapa, chips).

## Cálculo

```ts
const leadsArr = Object.values(links);
const isForm = (l) => !isWhatsappSource(l.link_source);
const isWA   = (l) =>  isWhatsappSource(l.link_source);
const inSet  = (l, set) => l.leads?.stage_id && set.includes(l.leads.stage_id);

const formLeads       = leadsArr.filter(isForm);
const waLeads         = leadsArr.filter(isWA);
const consultaLeads   = leadsArr.filter(l => inSet(l, consultaStages));
const tratamentoLeads = leadsArr.filter(l => inSet(l, tratamentoStages));
const nutricaoLeads   = leadsArr.filter(l => inSet(l, nutricaoStages));

// Converteu = união (sem duplicar lead que está nos dois)
const convertedSet = new Set([...consultaLeads, ...tratamentoLeads].map(l => l.lead_id));
const convertedLeads = leadsArr.filter(l => convertedSet.has(l.lead_id));
```

Breakdown por canal: aplicar `isForm`/`isWA` em cada conjunto.

## Arquivos

- **Editado:** `src/pages/Tracking.tsx` (cards, tabs, hook de stages selecionados, remoção dos memos não usados).

Sem mudanças em banco, edge functions, ou outros arquivos.
