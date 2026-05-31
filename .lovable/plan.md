## Objetivo

Tirar o filtro de **Período** do card "Filtros globais" (que vive colapsado) e exibi‑lo fixo, sempre visível, logo acima dos cards de KPI em `src/pages/Tracking.tsx`. Trocar o select por uma barra mais rápida com chips + seletor de mês.

## UI da nova barra de período

Linha única, fixa, acima das KPIs:

```text
Período:  [ Hoje ] [ 7 dias ] [ 30 dias ] [ Máximo ]   Mês: [ Selecionar… ▾ ]
```

- **Chips** (`Button` em `variant="default"` quando ativo, `variant="outline"` caso contrário): Hoje · 7 dias · 30 dias · Máximo.
- **"Mês"**: `Select` com a lista dos últimos 24 meses (rótulo "Nov 2025", value `YYYY-MM`). Selecionar um mês ativa o modo mês e desativa os chips.
- Quando um chip está ativo, o select de mês mostra "Selecionar mês".
- Não há mais a opção "Personalizado" nem inputs `customFrom`/`customTo`.

## Comportamento (técnico)

- Substituir `period: PeriodKey` por um estado mais simples:
  ```ts
  type PeriodMode =
    | { kind: "today" }
    | { kind: "last"; days: 7 | 30 }
    | { kind: "max" }
    | { kind: "month"; ym: string }; // "2025-11"
  ```
- `computeRange()` passa a derivar `{ sinceISO, untilISO }` deste estado:
  - `today` → início do dia local → agora.
  - `last 7/30` → `now - N*86400_000` → agora.
  - `max` → `"1970-01-01T00:00:00Z"` → agora (o limite real são os 5000 eventos já fetchados).
  - `month` → 1º dia 00:00 → último dia 23:59 daquele mês (local).
- Default: `{ kind: "last", days: 7 }` (mantém o comportamento atual).
- Remover `customFrom`/`customTo`/`period` antigo e o caso `period === "custom"` no card de filtros globais; o restante de Filtros globais (event_name, visitor_id, lead_id, page_url, Etapa, checkboxes) continua dentro do card colapsável.

## Lugar no JSX

- Inserir a barra de período entre o `<Card>` "Configuração de fechamento" e o grid de KPIs (`<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">`).
- Estilo: container fino com `mb-3 flex flex-wrap items-center gap-2` (sem `Card` para parecer leve e sempre visível). Label "Período:" pequeno em `text-muted-foreground`.

## Lista de meses

- Gerada uma vez via `useMemo`: últimos 24 meses a partir do mês atual (inclusive), labels em pt-BR (`toLocaleDateString("pt-BR", { month: "short", year: "numeric" })`).

## Fora do escopo

- Não mexer nas KPIs, na aba Páginas, nas abas, nem na configuração de fechamento.
- Não mexer no `load()` além do que `computeRange()` já entrega.

## Arquivo

- `src/pages/Tracking.tsx` (única edição).
