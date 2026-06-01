## Problema

Na página **Tracking**, os KPIs de leads e conversão funcionam em "Hoje" e "7 dias", mas zeram em "30 dias", "Máximo" e em meses inteiros — mesmo com leads reais no período (Mai/2026 mostra 25 leads como mês, mas 0 em "Máximo").

## Causa raiz

Em `src/pages/Tracking.tsx` (`load`), após buscar os visitantes do período fazemos:

```ts
const ids = vList.map(v => v.visitor_id);
await supabase.from("tracking_identity_links").select("...").in("visitor_id", ids);
```

Em períodos longos a lista cresce (936 visitantes em 30d, confirmado no banco). Centenas de UUIDs no `.in()` geram uma URL enorme que estoura o limite de URI do PostgREST/HTTP — a request falha silenciosamente (sem `throw`), `linkData` volta `null` e `links` fica vazio. Resultado: visitantes corretos, mas todos os KPIs de leads/consulta/tratamento/conversão zeram.

Além disso, durante o `load` os cards continuam mostrando os números antigos (ou zeros), passando a impressão de "0 leads" antes da query terminar.

---

## Etapa 1 — Corrigir KPIs zerados em períodos longos

Eliminar a falha silenciosa do `.in()` longo, sem mudar UI nem semântica dos KPIs.

### Mudanças em `src/pages/Tracking.tsx` (função `load`)

Trocar o bloco do `.in("visitor_id", ids)` por chunking via helper que já existe no projeto (`fetchAllByIn` em `src/lib/fetch-all.ts`):

```ts
import { fetchAllByIn } from "@/lib/fetch-all";

const linkMap: Record<string, LinkRow> = {};
if (ids.length) {
  const linkRows = await fetchAllByIn<LinkRow>(
    (slice) => supabase
      .from("tracking_identity_links")
      .select("visitor_id, lead_id, created_at, linked_at, link_source, leads(id, name, created_at, stage_id)")
      .in("visitor_id", slice),
    ids,
    200, // chunk pequeno o suficiente para caber na URL
  );
  for (const l of linkRows) {
    if (!linkMap[l.visitor_id]) linkMap[l.visitor_id] = l;
  }
}
setLinks(linkMap);
```

Defensivo (não muda comportamento): logar `error` das queries principais (`tracking_events`, `tracking_visitors`, count) com `console.warn` para não engolir falhas futuras.

### Validação

1. "Máximo" → KPIs ≥ aos de "Mai/2026".
2. "30 dias" → mostra leads (≥ "7 dias").
3. "7 dias" e "Hoje" → continuam iguais.
4. Aba "Leads com origem" lista os leads novamente.

### Arquivos
- `src/pages/Tracking.tsx`

---

## Etapa 2 — Melhorar experiência de loading

Hoje, enquanto `load` roda, os cards de KPI mostram valores antigos ou zeros, confundindo o usuário (parece que "não tem dados"). Vamos esconder/bloquear as métricas até a carga terminar.

### Mudanças em `src/pages/Tracking.tsx`

1. **Skeleton nos KPIs**: enquanto `loading === true`, substituir o valor numérico em `KpiCard` por um skeleton (`<Skeleton className="h-7 w-16" />` de `@/components/ui/skeleton`). O label fica visível para não "pular" o layout. Aplicar nos 8 cards (Visitas únicas, Leads via formulário, Leads via WhatsApp, Total de leads, Fechou consulta, Fechou tratamento, Converteu, Não converteu).

2. **Esconder hints durante load**: o `hint` ("0 WhatsApp · 0 Form") também vira skeleton quando `loading`.

3. **Bloquear as abas de tabelas**: enquanto `loading`, mostrar um overlay leve (opacidade reduzida + `pointer-events-none`) sobre o `<Tabs>` com um spinner central, em vez de exibir tabelas vazias. Reusar `RefreshCw` animado.

4. **Botões e seletor de período**: desabilitar `Período` (Hoje/7d/30d/Máximo/Mês) durante `loading` para evitar disparos sobrepostos. O botão "Atualizar dados" já é desabilitado.

5. **Suportar trocas rápidas de período sem flicker**: marcar `loading` ANTES de limpar dados (`setEvents`, `setVisitors`, `setLinks`, `setVisitorsTotal(0)` no início de `load`) para que o skeleton apareça imediatamente em vez de cards com números desatualizados.

6. **Acessibilidade**: KPI em loading recebe `aria-busy="true"`.

### Detalhe de `KpiCard`

Adicionar prop opcional `loading?: boolean`:

```tsx
function KpiCard({ label, value, hint, highlight, loading }: {...}) {
  return (
    <Card aria-busy={loading || undefined} ...>
      <CardHeader>...</CardHeader>
      <CardContent>
        {loading
          ? <Skeleton className="h-7 w-16" />
          : <div className="text-2xl font-semibold ...">{value}</div>}
        {hint && (loading ? <Skeleton className="mt-1 h-3 w-24" /> : <div className="...">{hint}</div>)}
      </CardContent>
    </Card>
  );
}
```

Passar `loading={loading}` em todas as instâncias de `KpiCard`.

### Validação

1. Trocar período → KPIs viram skeleton imediatamente; ao terminar, valores aparecem de uma vez.
2. Tabelas não exibem "vazias" durante o load — overlay com spinner.
3. Botões de período desabilitam enquanto carrega.
4. Sem layout shift perceptível.

### Arquivos
- `src/pages/Tracking.tsx`
