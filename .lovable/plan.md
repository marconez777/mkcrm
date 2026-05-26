# Melhorias no Dashboard de IA (`/ai` → aba Dashboard)

## Problemas atuais
- O gráfico aparece vazio (bug de altura em flexbox — barras com `height: %` colapsam porque a coluna pai não tem altura definida).
- Só existem 4 stats e 1 gráfico fixo em 7 dias.
- Sem seletor de período.

## O que vou entregar

### 1. Seletor de período (topo do dashboard)
Botões: **24h · 7 dias · 30 dias · 90 dias**, com opção "personalizado" (date range picker já existente em shadcn).
Todas as métricas e o gráfico passam a respeitar o período escolhido.

### 2. Cards de métricas (expandir de 4 para 8)
Linha 1 (volume):
- Mensagens IA no período
- Tokens (in / out separados — ex: "2.1M / 1.4M")
- Custo total no período (usando `calcCost` de `src/lib/ai-pricing.ts`)
- Custo médio por chamada

Linha 2 (qualidade/saúde):
- Agentes ativos
- Automações ativas
- Taxa de erro (% de chamadas com `status != success`)
- Latência média (ms)

Cada card mostra também a **variação vs período anterior** (ex: ▲ 12% em verde / ▼ 5% em vermelho), comparando com a janela imediatamente anterior de mesmo tamanho.

### 3. Gráfico principal — Mensagens & Tokens por dia
Trocar a implementação manual quebrada por **Recharts** (já instalado no projeto):
- `ComposedChart` com:
  - Barras: mensagens/dia (eixo Y esquerdo)
  - Linha: tokens/dia (eixo Y direito)
- Tooltip mostrando dia, mensagens, tokens in/out e custo
- Granularidade automática: horária para 24h, diária para 7/30d, semanal para 90d
- Cores via tokens semânticos (`hsl(var(--primary))`, `hsl(var(--chart-2))`)

### 4. Dois gráficos secundários (grid 2 colunas)
- **Top 5 agentes por chamadas** — barras horizontais (Recharts `BarChart` layout vertical)
- **Distribuição por operação** — donut/pie (`reply`, `summary`, `classification`, etc.)

### 5. Lista compacta — Últimas 5 chamadas com erro
Tabela enxuta (modelo, agente, erro truncado, há quanto tempo) com link "Ver tudo" para `/ai/usage`. Aparece só se houver erros no período.

## Detalhes técnicos

- Arquivo único: `src/pages/ai/AiDashboard.tsx`.
- Buscar `ai_usage` uma vez por período (limit 5000) e derivar todas as métricas em `useMemo` — evita N queries.
- Para "período anterior", segundo fetch com a janela deslocada.
- Reutilizar `calcCost` e `isModelKnown` de `@/lib/ai-pricing`.
- Para o componente de Recharts, usar o wrapper já existente em `src/components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`).
- Sem alterações de schema/backend — só leitura de tabelas já existentes (`ai_usage`, `ai_agents`, `automations`).
- Mantém restrição de visibilidade atual (membership.clinic_id).

## Fora do escopo
- Não vou mexer na aba "Custos" (`/ai/usage`) — só o "Dashboard".
- Sem export CSV nesse dashboard (já existe em Custos).
