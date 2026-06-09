---
title: "Mapa: Construtor de Agentes (Builder)"
topic: ai
kind: map
audience: agent
updated: 2026-06-09
summary: Agente de IA dedicado que ajuda o usuário (não-técnico) a configurar **outros agentes** (SDR, classificador, agendador…). Roda como `ai_agents` com `system_key='builder'`, um por clínica. Usa provider/chave próprios da clínica.
---
# Mapa: Construtor de Agentes (Builder)

> **Para localizar edições.** Para entender *por quê*, leia [`docs/features/BUILDER_AGENTS.md`](../features/BUILDER_AGENTS.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Agente de IA dedicado que ajuda o usuário (não-técnico) a configurar **outros agentes** (SDR, classificador, agendador…). Roda como `ai_agents` com `system_key='builder'`, um por clínica. Usa provider/chave próprios da clínica.

## 2. Rotas / pontos de entrada

| Rota | Componente | Função |
|---|---|---|
| `/ai/agents` | `src/pages/Agents.tsx` | lista de agentes da clínica |
| `/ai/agents/new` | `src/pages/ai/AgentWizard.tsx` | wizard 5 passos do Builder |
| `/ai` (hub) | `src/pages/ai/AiHub.tsx` | dashboard com cards |
| `/admin` → aba "Builder Manual" | `src/components/admin/BuilderManualPanel.tsx` | edição do manual canônico (super_admin only) |

## 3. Frontend

### Páginas
- `src/pages/ai/AgentWizard.tsx` — wizard principal, orquestra os 5 passos.
- `src/pages/Agents.tsx` — listagem, com `SectionAccordion` por categoria.
- `src/pages/AgentMemories.tsx` — visualização de `agent_memory` (tab `memories` do `AiHub`).

### Componentes (`src/components/agents/`)
| Arquivo | Função |
|---|---|
| `BuilderSetupCard.tsx` | Configura provider/chave do Builder por clínica |
| `KbAssistant.tsx` | Sugere URLs + monta `ai_documents` |
| `TestLab.tsx` | Gera cenários e roda simulações |
| `AgentInsights.tsx` | Mostra `ai_insights` gerados pelo Builder |
| `PromptHistory.tsx` + `PromptDiff.tsx` | Versionamento de `system_prompt` |
| `AuditLogPanel.tsx` | Auditoria de mudanças no agente |
| `ProviderErrorBanner.tsx` | Erros de chave/quota do provider da clínica |
| `StagesPanel.tsx` | Vincula agente a stages (`stage_ai_defaults`) |
| `CostsPanel.tsx` | Custo do agente (lê `ai_usage_daily`) |
| `AgentHealth.tsx` | Estado/observabilidade do agente |
| `PersonasPanel.tsx` | Personas configuráveis |
| `ThreadLearningPanel.tsx` | UI para `agent-learn-from-thread` |
| `CopilotPanel.tsx` | Chat de copilot do Builder |
| `AlfredDialog.tsx` | Diálogo guiado |

### Hooks / libs
- `src/lib/builder-errors.ts` — mapeamento de erros do Builder para mensagens PT-BR.
- `src/lib/builder-tooltips.ts` — textos de ajuda inline.
- `src/lib/quality-ladder.ts` — escada de qualidade do prompt.
- `src/lib/agent-tools.ts` — **`KNOWN_AGENT_TOOLS`** (whitelist; espelha `_shared/agent-flags.ts`).

## 4. Edge functions

### Principal
- `supabase/functions/ai-builder/index.ts` — **10 actions** (linha de cada `case` no `switch`):
  - L1410 `ping` — healthcheck
  - L1424 `interview_plan` — plano de perguntas adaptado ao nicho
  - L1431 `generate_system_prompt` — gera prompt (injetando `LEAD_CONTEXT_CLAUSE`)
  - L1438 `suggest_kb_urls` — sugere URLs para KB
  - L1443 `draft_knowledge_base` — monta KB inicial
  - L1448 `audit_kb` — audita qualidade da KB
  - L1453 `generate_scenarios` — cenários para Test Lab
  - L1458 `run_evaluation` — roda simulação e avalia
  - L1463 `generate_insights` — insights sobre conversas reais
  - L1471 `copilot_chat` — chat de co-piloto que devolve patch estruturado (`propose_agent_patch`)

### Compartilhado
- `_shared/builder-system-prompt.ts` — `CORE_RULES`, `LEAD_CONTEXT_CLAUSE`, `MULTI_NICHE_CLAUSE`, `buildBuilderSystemPrompt()` (carrega manual de `builder_manual_versions` com cache 60s + fallback em arquivo).
- `_shared/builder-knowledge/best-practices.md` — fallback do manual genérico.
- `_shared/builder-knowledge/niches/<slug>.md` — **12 KBs de nicho** (clinic, dental, aesthetics, real_estate, restaurant, ecommerce, saas, law, education, agency, local_services, other). Estáticos, versionados via git.
- `_shared/builder-knowledge/niche-loader.ts` — `loadNicheKb(slug)` + `nicheKbBlock(slug, label)`, cache em memória sem TTL, injetado no system prompt de 6 actions (ver §4).
- `_shared/ai.ts` — wrapper LLM (todos os providers).
- `_shared/spend-guard.ts` — bloqueia 402 quando excede.
- `_shared/rag.ts` — busca semântica para `audit_kb` e `draft_knowledge_base`.
- `_shared/agent-flags.ts` — whitelist de tools (espelhado em `src/lib/agent-tools.ts`).

### Relacionadas
- `agent-learn-from-thread` — alimenta `agent_memories` a partir de conversas.
- `ai-ingest-document` / `ai-ingest-pdf` / `ai-ingest-url` / `ai-ingest-urls` / `ai-reingest-document` — população de `ai_documents` (KB).
- `ai-embed` — embeddings.
- `ai-eval-run` — avaliação fora do Builder.

## 5. Banco de dados

### Tabelas
| Tabela | Colunas-chave |
|---|---|
| `ai_agents` | `id`, `clinic_id`, `name`, `system_key`, `system_prompt`, `tools[]`, `api_key`, `provider`, `model`, `enabled` |
| `agent_prompt_versions` | versionamento de prompt (alimenta `PromptHistory`) — INSERT manual feito pelo frontend ao salvar mudanças relevantes |
| `builder_manual_versions` | `id`, `version`, `content`, `is_active`, `published_by` — fonte canônica do manual |
| `ai_documents` | KB por agente; `embedding` vector |
| `agent_memory` | fatos persistidos via tool `remember_fact` (singular no schema real) |
| `ai_insights` | resultado de `generate_insights` |
| `stage_ai_defaults` | `stage_id`, `agent_id`, `auto_reply` — agente default por stage |
| `agent_evals` | casos de avaliação do Test Lab (`prompt`, `expected_contains`, `last_passed`, `last_response`) |
| `agent_personas`, `agent_stages`, `agent_mcp_servers`, `agent_traces` | personas, estágios, MCP e telemetria do agente |

### RPCs / funções
- `get_active_builder_manual()` — retorna `{content, version}` do manual ativo (usado por `_shared/builder-system-prompt.ts`).
- `has_role(_user_id, 'super_admin')` — gating do painel admin do manual (login do super admin é separado em `/admin/login` — ver [`SUPER_ADMIN`](../architecture/SUPER_ADMIN.md)).

### Triggers
- Atualização de `updated_at` padrão.
- **Não há trigger automático** copiando `ai_agents.system_prompt` para histórico. O snapshot em `agent_prompt_versions` é feito por `INSERT` explícito no frontend (`src/pages/Agents.tsx`).

## 6. Integrações externas

- **Provider LLM da clínica** — OpenAI / Anthropic / Google / xAI / OpenAI-compatible (`ai_agents.provider` + `api_key`).
- **Lovable AI Gateway** — usado pelo Builder se a clínica não configurou provider próprio (ver `BuilderSetupCard`).
- Nenhuma outra integração externa direta.

## 7. Invariantes — "não toque sem ler"

1. **`LEAD_CONTEXT_CLAUSE` literal em todo `system_prompt` gerado.** Há eval automático que reinjeta se faltar. Se mudar o texto da cláusula em `_shared/builder-system-prompt.ts`, todos os agentes antigos continuam válidos (a checagem é por presença, não match exato — mas mudanças semânticas precisam de migração).
2. **Multi-nicho.** Nunca assumir "clínica" em qualquer texto gerado pelo Builder. Usar "seu negócio / seus clientes / seu produto".
3. **Manual do Builder ≠ KB do agente final.** `builder_manual_versions` é **só** para o Builder. Não copiar para `ai_documents`.
4. **KBs de nicho são fonte de verdade do vocabulário/oferta por vertical.** Vivem em `_shared/builder-knowledge/niches/*.md` (12 arquivos, git-versionados). São injetados no system prompt das actions `interview_plan`, `generate_system_prompt`, `draft_knowledge_base`, `audit_kb`, `generate_scenarios` e `copilot_chat`. **Não** popular `other.md` com nicho específico — ele é o fallback genérico. Para adicionar nicho novo: criar `.md` + adicionar slug em `KNOWN_NICHES` (loader), `NICHE_LABEL` e `DOMINANT_OFFER_HINT` (`ai-builder/index.ts`), e na lista do `AgentWizard.tsx`.
5. **`KNOWN_AGENT_TOOLS` (frontend) deve espelhar tools registradas em `ai-chat/index.ts`.** Tool sugerida pelo LLM que não está na whitelist é descartada por `filterKnownTools()`.
6. **Chave do provider é da clínica.** Zero markup, zero intermediário. Builder não escolhe chave global.
7. **PT-BR + frases curtas.** Regra do `CORE_RULES`. Não traduzir para inglês "porque o modelo entende melhor".
8. **`system_key='builder'` é único por clínica.** Não criar dois Builders.
9. **Painel admin do manual** (`BuilderManualPanel`) só para `super_admin` via `has_role`. RLS de `builder_manual_versions` deve refletir isso.

## 8. Pegadinhas

- Cache do manual em `_shared/builder-system-prompt.ts` é por instância de edge function (TTL 60s). Mudança no manual demora até 60s para propagar em runtime.
- `ai_agents.api_key` é criptografada — não logar.
- Wizard guarda estado em `localStorage` (rascunho). Bug comum: dados antigos contaminam novo agente — verificar limpeza ao abrir wizard.
- `BuilderSetupCard` pode mostrar "OK" mesmo com chave inválida se o provider não responder rápido — testar com `ping` action.
- `TestLab` consome créditos reais do provider da clínica. Logar custo em `ai_usage` com `meta.source='test_lab'`.

## 9. Receitas

### Adicionar uma nova action no `ai-builder`
1. `supabase/functions/ai-builder/index.ts`:
   - Adicionar string em `type Action`.
   - Adicionar `case "nova_action": { ... }` no `switch` (manter ordem do README).
2. Frontend que invoca: `AgentWizard.tsx` ou componente correspondente em `src/components/agents/`.
3. Atualizar [`docs/features/BUILDER_AGENTS.md`](../features/BUILDER_AGENTS.md) §2 (lista de actions) e este mapa §4.
4. Se gerar conteúdo persistido em tabela nova, criar migration com GRANT + RLS.

### Adicionar uma nova tool ao runtime do agente final
**Não é tarefa do Builder — vai em [AI_RUNTIME §9](./AI_RUNTIME.md#9-receitas).** O Builder só *sugere* tools (filtra por `KNOWN_AGENT_TOOLS`).

### Mudar uma regra do `CORE_RULES` do Builder
1. Editar `_shared/builder-system-prompt.ts` (texto literal).
2. Se a regra exigir que prompts antigos sejam regerados, criar script de migração + comunicar no `CHANGELOG.md`.
3. Atualizar §1 e §7 deste mapa se for invariante.

### Adicionar campo configurável no Builder por clínica
1. Schema: campo em `clinics.settings.ai.*` (JSONB) — **não** criar tabela `clinic_settings`.
2. Leitura: `_shared/builder-system-prompt.ts` ou caller relevante.
3. UI: `BuilderSetupCard.tsx`.

### Adicionar nova versão do manual
1. Via UI: `/admin` → "Builder Manual" → editor → "Publicar nova versão". Trigger marca `active=true` na nova e `false` nas antigas.
2. Manual: insert em `builder_manual_versions` + flip de `active` — sempre via UI, não via SQL direto.
