# Validação e sync das docs do pipeline → arquitetura V6

## Diagnóstico (drift confirmado)

O código em `supabase/functions/pipeline-classify/agent-core.ts` já roda a **arquitetura V6 de 5 agentes**:

```
Resumidor → [ Agendador ∥ Tipificador ∥ Movimentador ] → Maestro
```

Operations gravadas em `ai_usage.operation`:
- `classifier:summarizer`
- `classifier:agendador`
- `classifier:typifier`
- `classifier:movimentador`
- `classifier:maestro`

Payload em `lead_events.payload.agents` contém: `summarizer_model`, `agendador_model`, `typifier_model`, `movimentador_model`, `maestro_model`, `latency_ms.{...}`, `ran.{...}`.

Porém **as docs em `docs/pipeline/` ainda descrevem V2 / 3 agentes** (snapshot 2026-06-18/19, anterior ao refactor V6). Exemplos:

| Doc | Conteúdo defasado |
|---|---|
| `docs/pipeline/runtime/CLASSIFIER.md` | Título "runtime V2"; descreve "Linha de Montagem de 3 Agentes" (summarizer/typifier/maestro); `payload.version=2`; sem agendador/movimentador. |
| `docs/pipeline/runtime/ARCHITECTURE.md` | Fluxo do classifier listado como 3 agentes. |
| `docs/pipeline/runtime/EVENTS_TELEMETRY.md` | Esquema de `lead_events.payload.agents` com 3 modelos; sem `version=6`. |
| `docs/pipeline/runtime/README.md` | Tabela de runtime menciona Classifier como monolito/V2 com 3 etapas. |
| `docs/pipeline/runtime/GATES.md` | Cita G10/G11 ancorados em "3 etapas LLM". |
| `docs/pipeline/runtime/KNOWN_ISSUES.md` | Issue de "agrupamento de telemetria" descrito como ativo — já corrigido. |
| `docs/pipeline/runtime/STAGES_LIVE.md` / `SUMMARIZER.md` | Referências cruzadas ao "classifier de 3 passos". |
| `docs/pipeline/README.md` + `AUTOMATION_PLAN.md` | Visão geral menciona 3 agentes; falta sub-bloco "paralelos". |
| `.lovable/memories/docs/maintenance-progress.md` | Diz "1 chamada gpt-5-mini" — desatualizado (agora 5 chamadas em 3 fases). |

## Escopo da entrega

Atualizar **somente arquivos de documentação** (sem mexer em código). Foco em deixar cada arquivo condizente com o que o código realmente faz hoje.

### 1. `docs/pipeline/runtime/CLASSIFIER.md` (reescrita parcial)
- Título: "Classifier LLM (pipeline-classify) — runtime V6".
- Substituir o bloco "Linha de Montagem de 3 Agentes" por diagrama ASCII de 5 agentes com a fase paralela:
  ```text
  Resumidor
      │
      ▼
  ┌───────────────────────────────┐
  │ Agendador ∥ Tipificador ∥ Movimentador │
  └───────────────────────────────┘
      │
      ▼
   Maestro
  ```
- Tabela "Operations" com os 5 valores exatos de `ai_usage.operation`.
- Atualizar `payload.version` para `6` e listar todos os campos novos de `agents` (`agendador_model`, `movimentador_model`, latências e flags `ran` por agente).
- Documentar `only_agent` aceitos hoje (`summarizer`, `parallel`, `maestro`) usados pelo botão "Executar com escopo" em `/pipeline-runs`.
- Manter seções de G10/A3/tool `get_lead_history` (continuam válidas).

### 2. `docs/pipeline/runtime/ARCHITECTURE.md`
- Atualizar fluxo do classifier (3 → 5 agentes, com bloco paralelo).
- Ajustar nº de chamadas LLM por execução (1 → 3 fases / até 5 chamadas).

### 3. `docs/pipeline/runtime/EVENTS_TELEMETRY.md`
- Atualizar shape de `lead_events.payload.agents` (5 modelos, 5 latências, 5 flags).
- Bump `payload.version` para 6; nota de compat retro (UI tolera V3+V6).
- Listar os 5 valores de `ai_usage.operation`.

### 4. `docs/pipeline/runtime/README.md`
- Linha do Classifier: "5 agentes (Resumidor → Paralelos → Maestro)".

### 5. `docs/pipeline/runtime/GATES.md`
- Trocar "3 etapas LLM" por "5 agentes (Resumidor + 3 paralelos + Maestro)" onde G10/G11 fazem referência.

### 6. `docs/pipeline/runtime/KNOWN_ISSUES.md`
- Marcar como **resolvido** o item de "telemetria agrupada do classifier" (com data 2026-06-19).

### 7. `docs/pipeline/runtime/SUMMARIZER.md` e `docs/pipeline/runtime/STAGES_LIVE.md`
- Pequenos ajustes de menção cruzada ("classifier de 3 passos" → "classifier V6 de 5 agentes").

### 8. `docs/pipeline/README.md` + `docs/pipeline/AUTOMATION_PLAN.md`
- Atualizar visão geral / diagrama ao mesmo padrão V6.
- Atualizar `LEAD_SAMPLES.md` / `SCENARIOS.md` somente se citarem nominalmente os 3 agentes (verificar e ajustar trechos pontuais).

### 9. `.lovable/memories/docs/maintenance-progress.md`
- Adicionar bloco "Pipeline V6 — DEPLOYADO (2026-06-20)" descrevendo 5 agentes + operations + `payload.version=6` + UI `/pipeline-runs` adaptada (`only_agent: summarizer|parallel|maestro`).
- Marcar trechos da Fase 1 V5 como históricos.

## Validação final

Após as edições rodar:
```bash
grep -RIn -E "3 agentes|version=2|Linha de Montagem de 3" docs/pipeline/
```
Resultado esperado: zero ocorrências em texto descritivo (apenas em notas históricas claramente datadas).

## Fora de escopo

- Nenhuma alteração em código (`src/**`, `supabase/functions/**`).
- Não recriar `scripts/docs-sync.mjs` / `docs/INDEX.json` (memória confirma que não existem neste projeto).
- Não revisar docs fora de `docs/pipeline/**` (email, inbox, admin, etc.).
