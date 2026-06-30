## Objetivo

Em **Métricas → IA (Custos)** hoje o painel `PipelineOverview` mostra só os 5 agentes do classifier (`classifier:summarizer/agendador/typifier/movimentador/maestro`). O agente de atendimento (Febracis e similares, via `ai-chat`/`ai-auto-reply`) já grava em `ai_usage`, mas fica "escondido" na tabela bruta e fora do hero de custo/lead. Vamos consolidar os dois mundos na mesma tela.

## Fases

### Fase 1 — Garantir telemetria completa do atendimento
**Arquivos:** `supabase/functions/ai-chat/index.ts`, `supabase/functions/ai-auto-reply/index.ts`, `supabase/functions/_shared/metrics.ts`

- Conferir que toda chamada do `ai-chat` registra `operation = "agent:reply"` (hoje grava como `chat` genérico) e propaga `agent_id`, `lead_id`, `provider`, `model`, `cost_usd`, `latency_ms`, `status`.
- Em `ai-auto-reply`, registrar 1 linha de telemetria por execução (mesmo quando `skipped`), com `source = "auto-reply"` e `agent_step = "dispatch"` — hoje só o `ai-chat` interno loga.
- Padronizar `source`: `"agent-runtime"` para respostas reais; `"agent-tool"` para chamadas de tool (KB, mover stage). Isso permite separar custo de "responder" vs "ferramentas internas".
- Materializar `cost_usd` no insert via `calcCostUsd` (já existe em `_shared/ai-pricing.ts`).

### Fase 2 — Novo painel "Atendimento" em Custos → IA
**Arquivos novos:** `src/components/ai/usage/AgentRuntimeOverview.tsx`
**Arquivos editados:** `src/pages/MetricsAiUsage.tsx` (adicionar aba/abas), `src/components/ai/usage/PipelineOverview.tsx` (refactor leve)

- Adicionar uma 2ª aba `Tabs` na página: **Pipeline (classifier)** | **Atendimento (agentes)**.
- `AgentRuntimeOverview` consulta `ai_usage` filtrando `operation IN ('agent:reply','agent:tool')` nas últimas 24h/7d/30d e exibe:
  - Hero: custo total, custo por resposta, respostas enviadas, tokens, erros.
  - Quebra por agente (`agent_id` → nome de `ai_agents`): chamadas, custo, latência p50/p95, taxa de erro.
  - Quebra por modelo/provider (gemini vs openai/lovable).
  - Top 10 leads mais caros nas 24h (lead → custo acumulado → link `/inbox`).
  - Linha do tempo simples (recharts) de custo por hora.

### Fase 3 — Consolidar visão total
**Arquivos:** `src/pages/MetricsAiUsage.tsx`, possível view SQL nova.

- Acima das abas, um "Hero geral": **Custo IA total = Pipeline + Atendimento + Embeddings** (mesmo recorte de data dos filtros do topo).
- Opcional: criar view `v_ai_cost_by_surface_daily` agregando por (`day`, `surface`) onde `surface` é derivado de `source/operation` (`pipeline`, `agent-runtime`, `ingest`, `support`). Útil para o card de KPI no Admin → Pipeline Health também.

### Fase 4 — Limites e alertas
**Arquivos:** `src/components/agents/CostsPanel.tsx`, `src/components/admin/AiSpendLimitCard.tsx`

- `CostsPanel` do agente já soma de `ai_usage` por `agent_id` — confirmar que a Fase 1 não quebra o filtro.
- `AiSpendLimitCard`: hoje conta tudo. Adicionar quebra textual "X% pipeline / Y% atendimento" para o usuário entender onde gastou.

### Fase 5 — Docs
- Atualizar `docs/pipeline/runtime/EVENTS_TELEMETRY.md` listando `operation` novos.
- Anotar em `docs/agents/FEBRACIS_PRI.md` que o custo aparece em Métricas → IA → Atendimento.

## Detalhes técnicos

- `ai_usage` já tem todas as colunas necessárias (`agent_id`, `cost_usd`, `provider`, `operation`, `source`). Nada de migration obrigatória — só padronização de valores.
- Filtro RLS já restringe por `clinic_id`, ok para clínicas.
- Nenhuma mudança visual no `PipelineOverview` atual além de virar conteúdo de aba.

## Fora de escopo
- Reescrita das views `v_ai_cost_daily` / `v_classify_health_daily`.
- BYOK billing por usuário individual.
- Forecast de custo mensal (pode virar Fase 6 depois).
