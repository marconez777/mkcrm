# Migração UI V3 → V6 (5 agentes do pipeline)

## Contrato confirmado

- `ai_usage.operation`: `classifier:summarizer`, `classifier:agendador`, `classifier:typifier`, `classifier:movimentador`, `classifier:maestro`.
- `lead_events.payload.agents`:
  - modelos: `summarizer_model`, `agendador_model`, `typifier_model`, `movimentador_model`, `maestro_model`
  - `latency_ms: { summarizer, agendador, typifier, movimentador, maestro }`
  - `ran: { summarizer, agendador, typifier, movimentador, maestro }`
- Compat: UI deve degradar quando vier payload V3 antigo (sem chaves de agendador/movimentador).

## Arquivos afetados

1. `src/components/ai/usage/PipelineOverview.tsx` — aba de Custos.
2. `src/pages/PipelineRuns.tsx` — tela de execuções + drawer + dialog de escopo.

Nenhuma mudança em backend, types ou tabelas.

---

## 1. `PipelineOverview.tsx` (Custos)

### Metadata
Expandir `AGENT_META` para 5 entradas com cor/emoji/explicação distintos. Ordem de exibição lógica:

1. `classifier:summarizer` — Resumidor 📝 (azul) — sequencial
2. `classifier:agendador` — Agendador 📅 (violeta) — paralelo
3. `classifier:typifier` — Tipificador 🏷️ (âmbar) — paralelo
4. `classifier:movimentador` — Movimentador 🎯 (rosa) — paralelo
5. `classifier:maestro` — Maestro 🎼 (esmeralda) — sequencial

`PIPELINE_OPS` passa a ter 5 itens (a query `in("operation", PIPELINE_OPS)` continua valendo).

### Cabeçalho
- `h3` "Os 3 agentes do pipeline" → **"Os 5 agentes do pipeline"**.
- Hero subtitle muda para: "Cada lead é lido por 5 agentes (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro)".
- `classifiedRuns = Math.max(successEvents, Math.round(rows.length / 3))` → dividir por **5** (uma execução completa = 5 linhas de `ai_usage`).

### Novo layout 3-linhas (substitui `grid md:grid-cols-3`)

```text
[      Resumidor (full)       ]
[Agendador][Tipificador][Movimentador]   ← faixa "Execução Paralela"
[       Maestro (full)        ]
```

- Linha 1 e 3: `Card` ocupando largura total, mesmo visual atual (`p-4`, `meta.accent`, barra de % do custo).
- Linha 2: wrapper `Card` translúcido com label "⑂ Execução paralela" (ícone `GitBranch` lucide) + `grid grid-cols-1 md:grid-cols-3 gap-3` dentro; conectores visuais por gradient/borda lateral (`border-l-2 border-dashed border-primary/30`).
- Manter Custo / Chamadas / Latência média / barra de % do custo total por card (já existe).

### Compat V3
Se `byOp` para `agendador`/`movimentador` vier zerado em todas as métricas, ainda renderiza os cards (com "—" e badge "sem dados" sutil), pois o usuário pode estar vendo janela onde só rodou V3.

### Drawer (`LeadRunDetail`)
- Título: "Os 5 agentes desta execução".
- Iterar os 5 `PIPELINE_OPS`. Para mapear modelo via `agents`:
  - `summarizer` → `agents.summarizer_model`
  - `agendador` → `agents.agendador_model`
  - `typifier` → `agents.typifier_model`
  - `movimentador` → `agents.movimentador_model`
  - `maestro` → `agents.maestro_model`
- Latência: `latency_ms[op.split(':')[1]]` (já compatível com nomes novos).
- Visualmente: Resumidor sozinho em cima → bloco "⑂ Paralelos" com os 3 cards agrupados (`rounded-md border border-dashed p-2 space-y-1.5`) → Maestro sozinho embaixo.
- Tipos atualizados (chaves opcionais de V6, mantendo as antigas opcionais para compat).

---

## 2. `PipelineRuns.tsx`

### Tipos
```ts
type OnlyAgent = "summarizer" | "parallel" | "maestro";  // 3 opções (confirmado)
```
Backend já aceita `summarizer`/`typifier`/`maestro`; quando o usuário escolher `parallel`, mandar o novo valor `"parallel"` no campo `only_agent`. **Pré-requisito do backend**: aceitar `"parallel"` como alias que roda os 3 paralelos. Documentar isso no diff e fallback: se `parallel` falhar com 400, exibir toast "Backend ainda não suporta escopo paralelo — atualize o pipeline-classify". *(Se o usuário preferir já mapear `parallel` para 3 chamadas sequenciais no frontend, sinalizar na revisão do plano.)*

### Drawer da execução (`RunItemDetailDrawer`)
- Atualizar tipo `agents` para incluir `agendador_model`, `movimentador_model` e respectivos `latency_ms.{agendador,movimentador}`, `ran.{agendador,movimentador}`.
- Substituir os 3 `AgentCard` por layout idêntico ao novo PipelineOverview drawer:
  - Resumidor (full)
  - Card "⑂ Execução paralela" envolvendo Agendador / Tipificador / Movimentador em `grid-cols-3`
  - Maestro (full)
- Mantém props `model`, `latencyMs`, `ran` para cada agente (chaves V6).
- Botões "🔁 só X" (linhas 677-686): substituir os 3 botões individuais por 3 botões que correspondem ao novo escopo: **Resumidor / Paralelos / Maestro**. Ícone para "Paralelos": `GitBranch`.
- Mapeamento `item.step`:
  - `classify:summarizer` → "🔁 só Resumidor"
  - `classify:parallel` → "🔁 paralelos (Agendador+Tipificador+Movimentador)"
  - `classify:maestro` → "🔁 só Maestro"
  - Compat antigo: `classify:typifier` continua reconhecido como "🔁 só Tipificador (legado V3)".

### Dialog "Executar com escopo"
- Opções (linhas 826-829) viram 3:
  1. `full` — Sparkles — "Completo" — **"Forçar Pipeline V6"** (era "Os 3 agentes")
  2. `summarizer` — FileText — "Só Resumidor"
  3. `parallel` — GitBranch — "Só Paralelos" — "Agendador + Tipificador + Movimentador"
  4. `maestro` — Target — "Só Maestro"
- Ajustar condicionais nas linhas 844/849 (que controlam campos visíveis dependendo de `onlyAgent === "maestro"` etc.) para o novo set; manter mesma lógica de hidratação para `parallel` (assume comportamento como `typifier` para visibilidade de campos extras).

### Botões principais (linha 190-194)
- Manter "Executar com escopo" e "Executar pipeline inteiro".
- Sem renomeação (já genéricos). A label "Forçar Pipeline V6" vai dentro do dialog conforme item acima.

---

## Visual / design tokens

- Reusar paleta semântica existente (`bg-*-500/10`, `text-*-700`, `border-*-500/20`).
- Wrapper "Execução paralela": fundo `bg-gradient-to-br from-muted/30 to-transparent`, `backdrop-blur-sm`, `border border-dashed`, label em pill com ícone `GitBranch`.
- Manter glassmorphism atual de scrollbars (sem mudanças globais).

## Validação

1. Visual em /metrics (aba Custos) com clínica vazia e clínica com tráfego — checar fallback "—".
2. Drawer em /pipeline-runs abrindo um RunItem antigo (V3) e novo (V6) — ambos renderizam sem erro.
3. Dialog de escopo: selecionar `parallel` e enviar — confirmar request payload `only_agent: "parallel"`.
4. Tipos TS compilam (build automático do harness).

## Fora do escopo

- Mudanças em edge functions (`pipeline-classify`, `pipeline-run-executor`).
- Migrações DB.
- Atualização de docs em `docs/pipeline/runtime/CLASSIFIER.md` (pode ser próxima fase).