# Validação final dos docs de Agentes IA + Builder

Comparei `docs/features/BUILDER_AGENTS.md`, `docs/flows/AI_AGENT_LOOP.md`, `docs/maps/AI_RUNTIME.md`, `docs/edge-functions/AI.md`, `docs/AI.md` e `docs/support/journeys/criar-primeiro-agente-ia.md` contra `ai-chat`, `ai-builder`, `ai-auto-reply`, `_shared/agent-flags.ts`, `src/lib/agent-tools.ts`, `src/pages/Agents.tsx`, `src/pages/ai/AgentWizard.tsx`, `src/pages/admin/AdminPanels.tsx` e schema real.

## ✅ O que está 100% alinhado

- 15 tools em `KNOWN_AGENT_TOOLS` ↔ `SILENT_TOOLS` ↔ tools registradas em `ai-chat/index.ts`.
- 10 actions da edge `ai-builder` (§5 do BUILDER_AGENTS).
- Tabelas reais: `ai_usage`, `ai_usage_daily` (view), `ai_spend_events`, `ai_chat_traces`, `agent_memory` (singular), `ai_agents`, `ai_agent_drafts`, `builder_manual_versions`, `ai_insights`.
- Rota de edição do agente (`/ai/agents?agent=<id>`), painel do manual em `src/pages/admin/AdminPanels.tsx`, `/ai/agents/new` no wizard.
- Stub `docs/AI.md` com summary já reescrito.
- Frontmatter `updated: 2026-06-09` aplicado.

## ❌ 3 driftes residuais a corrigir

### Drift A — `docs/features/BUILDER_AGENTS.md` linha 217
Pegadinha da Fase 2 ainda diz:
> "Ele **não responde leads reais** até o usuário ativar manualmente em `/ai/agents/:id` (toggle "Ativo")."

Rota inexistente. Trocar para `/ai/agents?agent=<id>` (igual ao §3.2 corrigido).

### Drift B — `docs/maps/AI_RUNTIME.md` linhas 63 e 98
Usa `agent_memories` (plural). Tabela real é `agent_memory` (singular, confirmado no schema). Corrigir:
- Linha 63: "extrai memórias de conversa para `agent_memories`" → `agent_memory`.
- Linha 98: linha da tabela `| agent_memories |` → `| agent_memory |`.

### Drift C — `docs/maps/AI_RUNTIME.md` linha 108
Aviso atual: "Naming antigo em docs deve ser corrigido para `ai_usage` + `ai_chat_traces`."

Está incompleto. Alinhar com a nota canônica do `AI_AGENT_LOOP.md`: incluir também `ai_usage_daily` (view), `ai_spend_events` e citar que `tool_calls` vivem em `ai_chat_traces.turns[].tool_calls[]`.

## Execução

1. `code--line_replace` em `docs/features/BUILDER_AGENTS.md` (linha 217).
2. `code--line_replace` em `docs/maps/AI_RUNTIME.md` (linhas 63, 98, 108).
3. `node scripts/docs-sync.mjs` para regenerar `INDEX.json`, `public/docs-*.json`, `DRIFT.md`.

Sem mudanças de código de runtime — só 2 arquivos de documentação.

## Fora de escopo (mencionar mas não corrigir agora)

- `docs/frontend/PAGES.md:82`, `docs/features/ADMIN_ACCOUNTS_AND_LIMITS.md`, `docs/maps/BILLING_PLANS.md`, `docs/architecture/SUPER_ADMIN.md`, `docs/maps/ADMIN_SUPER_ADMIN.md` referenciam `src/pages/Admin.tsx` (que não existe — admin vive em `src/pages/admin/*`). Não é doc de agente IA; tratar em outro ciclo se quiser.
- `docs/CHANGELOG.md` menciona `pause_ai_for_lead` num registro histórico — manter como histórico.
