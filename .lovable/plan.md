## Reformular `/ai/usage` — visão "Pipeline IA" para leigos

Hoje a página `MetricsAiUsage` é uma tabela técnica de `ai_usage`. Vou transformá-la em um painel narrativo focado nos 3 agentes do pipeline-classify (Resumidor → Tipificador → Maestro), fila, execuções por lead e motivos de skip — sem perder o detalhe técnico atual (vira aba "Avançado").

### ⚠️ Dependência backend obrigatória

`ai_usage` está **vazia para o pipeline-classify**. O classificador chama `generateText` direto via `clinic-openai` e não passa por `logUsage`. Sem instrumentar isso, a aba "Custo por agente" mostra zero.

**Passo 0 — instrumentar `agent-core.ts`:**
- Após cada `runSummarizer`/`runTypifier`/`runMaestro`, chamar `logUsage({...})` de `_shared/metrics.ts` com:
  - `clinic_id: ctx.lead.clinic_id`, `lead_id: ctx.lead.id`
  - `model`: `summarizerModel` / `TYPIFIER_MODEL` / `MAESTRO_MODEL`
  - `operation`: `classifier:summarizer` | `classifier:typifier` | `classifier:maestro`
  - `input_tokens`/`output_tokens`/`total_tokens`: extrair de `result.usage` (AI SDK v6: `inputTokens`, `outputTokens`, `totalTokens`)
  - `latency_ms`: medir com `performance.now()` por passo
  - `status`: `"success"` ou `"error"` (no caminho de erro, registrar antes do `return { error }`)
- `_shared/metrics.ts` já preenche `cost_usd` via `ai-pricing.ts` — só preciso garantir que `gpt-4o`, `gpt-5-mini` estejam em `src/lib/ai-pricing.ts`/`_shared/ai-pricing.ts` (validar; adicionar se faltar).

### Página `/ai/usage` reformulada

Layout em 3 zonas + drawer:

```text
┌─────────────────────────────────────────────────────────────┐
│ Hero — "Sua IA hoje" (linguagem leiga)                      │
│  • X leads classificados nas últimas 24h                    │
│  • US$ Y gastos · ~US$ Y/lead                               │
│  • Z na fila · tempo médio de espera                        │
│  • [⏸ Pausar IA] (toggle automation.classifier.enabled)    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐ ┌──────────────────────────────────┐
│ Fila ao vivo         │ │ Pipeline de 3 agentes (donut/    │
│ (realtime leads)     │ │ barras horizontais empilhadas)   │
│ • Aguardando: N      │ │ Resumidor (gpt-4o) ━━━━ $X       │
│ • Travados >30min: M │ │ Tipificador  ━━ $Y               │
│ • Processados/hora   │ │ Maestro      ━━ $Z               │
│ • [Limpar travados]  │ │ Tooltip: "o que cada um faz"     │
└──────────────────────┘ └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Últimas execuções por lead (timeline, 50 mais recentes)     │
│  ✅ Maria S.   12:03  →  movida p/ Consulta agendada · $0.003│
│  ⚠️ João P.    12:01  →  pulada: precisa atenção humana     │
│  ❌ Ana R.     11:58  →  erro no agente Resumidor            │
│  [clique → drawer com detalhe completo]                     │
└─────────────────────────────────────────────────────────────┘

┌────────────────────┐ ┌────────────────────────────────────┐
│ Motivos de skip    │ │ Erros (últimas 24h)                │
│ pizza/lista        │ │ agrupados por mensagem · count     │
│ (clinic_not_       │ │                                    │
│  allowlisted: 676) │ │                                    │
└────────────────────┘ └────────────────────────────────────┘

[Aba "Avançado"] — preserva a tabela técnica atual (filtros, CSV, drawer de chamada)
```

### Fontes de dados

| Widget | Fonte |
|---|---|
| Hero "leads classificados 24h" | `lead_events` `type='auto:classifier'` AND `payload->>'skipped' IS NULL` |
| Hero "custo 24h" | `ai_usage` filtrado por `operation LIKE 'classifier:%'` |
| Fila | `leads`: `count(*) FILTER (WHERE needs_ai_review)`, idem com `ai_review_queued_at < now()-30min` |
| Processados/hora | `leads.last_classified_at > now()-1h` |
| Custo por agente | `ai_usage` `GROUP BY operation` para `classifier:*` |
| Execuções por lead | `lead_events` últimas 50 com `type='auto:classifier'` + JOIN leads(name,phone) |
| Motivos de skip | `lead_events.payload->>'skipped' GROUP BY` |
| Erros | `lead_events.payload->>'skipped' LIKE 'agent_error:%' GROUP BY` |

Tudo em uma query agregadora client-side (até 30d). Subscrição realtime em `leads` (filtro `clinic_id`) só para o widget Fila.

### Drawer "Execução do lead"

Ao clicar numa linha da timeline, abrir `Sheet` mostrando:
1. **Lead** (nome, telefone, link `/inbox/:id`)
2. **Linha do tempo dos 3 agentes** com tempo/custo de cada um, lido de `payload.agents` + `ai_usage` por `lead_id`+timestamp próximo
3. **Resumo gerado** (campo `summary` precisa ser exposto — ver nota abaixo)
4. **Decisão final**: stage_suggestion, intent, confidence (barra), is_b2b, reasons (bullet)
5. **O que foi aplicado**: tags adicionadas/removidas, custom_fields setados, datas resolvidas, bloqueios G10
6. **Bruto** (collapsed `<details>` com `payload` cru, pra suporte)

> **Sub-decisão técnica:** o `summary` do Agente 1 não é persistido hoje. Para o drawer mostrá-lo, adicionar `summary` e `summary_chars` no `telemetry.applied` (em `apply.ts`) recebendo de `agents` no parâmetro novo (passar via `runAgent` → `applyClassification`). Sem migration; só payload de evento.

### Linguagem leiga

- Substituir jargão: "stage_suggestion" → "Etapa sugerida", "intent" → "Intenção", "G10" → "respeita edição humana recente", "skipped" → "pulada", "needs_ai_review" → "aguardando IA".
- Cada bloco com tooltip `<HelpCircle />` explicando em 1 frase.
- Status com cores semânticas + emoji: ✅ aplicada · ⚠️ pulada · ❌ erro · ⏸ pausada.
- Custos em US$ com 4 casas + equivalente "≈ R$ X" (taxa fixa configurável, ou só USD se preferir simplicidade).

### Estrutura de arquivos

- `src/pages/MetricsAiUsage.tsx` → vira shell com `Tabs`: **Visão geral** (novo) e **Avançado** (conteúdo atual movido).
- Novos componentes em `src/components/ai/usage/`:
  - `PipelineHero.tsx`
  - `LiveQueueCard.tsx` (com subscription realtime)
  - `AgentBreakdown.tsx` (donut + legenda)
  - `RecentExecutions.tsx`
  - `SkipReasons.tsx`
  - `ErrorsPanel.tsx`
  - `LeadRunDrawer.tsx`
- Hook `src/hooks/usePipelineUsage.ts` centraliza queries (data range + clinic).

### Fora de escopo

- Não alterar pipeline-deterministic, summarizer, auditores.
- Não migrar tabela `ai_usage` (operação é text livre, só novos valores).
- Não mexer em RLS.
- Não tocar na sidebar / navegação superior.

### Validação

1. Deploy `pipeline-classify` com `logUsage` por agente.
2. Forçar 1 tick V2 em clínica allowlisted; conferir 3 linhas em `ai_usage` (`operation='classifier:*'`) e custo > 0.
3. Abrir `/ai/usage` — hero não-zerado, fila batendo com `SELECT count` direto, drawer abrindo um lead recente sem erros.
4. Aba Avançado intacta (mesma tabela e CSV).

### Pergunta única antes de seguir

Quer o **toggle "Pausar IA"** no hero (flipa `automation.classifier.enabled` em `app_settings`, só super-admin)? É 1 botão a mais, útil em incidentes — mas posso deixar fora se preferir só leitura nessa página.
