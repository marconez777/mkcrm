## Filtro de data no Pipeline

Adicionar um filtro de período no topo do Kanban que mostra apenas os leads cuja **data de entrada (`created_at`)** caia dentro do período selecionado. Os leads fora do intervalo somem das colunas, mas continuam no banco.

### UI

Novo botão "Período" na toolbar do Kanban (`src/pages/Kanban.tsx`), ao lado do campo de busca, abrindo um Popover com:

- **Atalhos por dia**: Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Últimos 90 dias
- **Atalhos por mês**: Este mês, Mês passado, e seletor "Mês/Ano específico"
- **Intervalo personalizado**: dois calendários (de — até) usando o `Calendar` do shadcn
- Botão "Limpar" para remover o filtro

Quando ativo, o botão mostra o período escolhido (ex.: "Últimos 30 dias", "Out/2025", "01/05–15/05") e fica destacado. Um pequeno contador "X leads" aparece ao lado.

### Lógica de filtro

No componente `KanbanPage`, adicionar estado:

```ts
type DateFilter = { from: Date | null; to: Date | null; label: string | null };
const [dateFilter, setDateFilter] = useState<DateFilter>({ from: null, to: null, label: null });
```

A lista `leads` derivada passa a aplicar o filtro **em cima de `allPipelineLeads`**, antes do filtro de busca:

```ts
const dateFiltered = dateFilter.from
  ? allPipelineLeads.filter((l) => {
      if (!l.created_at) return false;
      const t = new Date(l.created_at).getTime();
      if (dateFilter.from && t < dateFilter.from.getTime()) return false;
      if (dateFilter.to && t > dateFilter.to.getTime()) return false;
      return true;
    })
  : allPipelineLeads;
```

E em seguida o filtro textual (já existente) opera sobre `dateFiltered`.

### Persistência

Salvar o filtro no `localStorage` junto com `UI_KEY` (apenas o preset ativo, não as datas absolutas — para "Hoje" recalcular a cada abertura). Estende `loadUi/saveUi` com `dateFilterPreset?: string` e `dateFilterCustom?: { from: string; to: string }`.

### Arquivos

- `src/pages/Kanban.tsx` — toolbar, estado, filtro
- `src/components/kanban/PipelineDateFilter.tsx` (novo) — Popover com presets + calendário; recebe `value` e `onChange`

### Detalhes técnicos

- Usar `date-fns` (já no projeto) para `startOfDay`, `endOfDay`, `startOfMonth`, `endOfMonth`, `subDays`, `subMonths`
- Calendário: `Calendar` do shadcn em modo `range`, com `className="p-3 pointer-events-auto"` para funcionar dentro do Popover
- O filtro **não** altera contagens dos funis na sidebar (`PipelineSidebar`) — apenas o que é renderizado nas colunas. Caso queira refletir lá também, é simples adicionar depois.
- Não toca em backend / RLS / migrations.
