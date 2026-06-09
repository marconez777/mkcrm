
# Auditoria das docs do agente Construtor (Builder + Co-piloto)

Comparei as docs que cobrem o agente que ajuda a criar e treinar os agentes de atendimento com o código real. Abaixo, o relatório de drift e a proposta de atualização.

## Escopo auditado

- `docs/features/BUILDER_AGENTS.md`
- `docs/maps/BUILDER_AGENTS.md`
- `docs/copilot.md`
- `docs/support/pages/ai-agents.md`
- Código: `supabase/functions/ai-builder/index.ts`, `_shared/builder-*`, `src/pages/ai/AgentWizard.tsx`, `src/pages/Agents.tsx`, `src/pages/AgentMemories.tsx`, `src/components/agents/*`, schema do Supabase.

## Drift encontrado (precisa corrigir nas docs)

### 1. Nomes de tabela errados

| Doc cita | Tabela real no schema | Onde corrigir |
|---|---|---|
| `ai_agent_versions` | `agent_prompt_versions` | `maps/BUILDER_AGENTS.md` §5 |
| `ai_agent_prompt_history` | `agent_prompt_versions` (não existe trigger com esse nome) | `features/BUILDER_AGENTS.md` §7 (Fase 7) |
| `ai_eval_runs` | `agent_evals` | `maps/BUILDER_AGENTS.md` §5 |
| `agent_memories` (plural) | `agent_memory` (singular) | `maps/BUILDER_AGENTS.md` §3 e §5; `features/BUILDER_AGENTS.md` §1 invariantes |
| `agent_eval_results` | não existe; usar `agent_evals` | `copilot.md` §4 (Evals contínuos) |
| `ai_usage_daily` | só existe `ai_usage` | `features/BUILDER_AGENTS.md` §2 e §6 (Pegadinhas), §8 |

### 2. Contagem de actions desatualizada

Tanto `maps/BUILDER_AGENTS.md` §4 quanto `features/BUILDER_AGENTS.md` §2/§5 dizem **"9 actions"**, mas o `switch` em `ai-builder/index.ts` tem **10**: `ping, interview_plan, generate_system_prompt, suggest_kb_urls, draft_knowledge_base, audit_kb, generate_scenarios, run_evaluation, generate_insights, copilot_chat`.

A tabela "Catálogo de actions" em `features/BUILDER_AGENTS.md` §5 **não inclui `copilot_chat`** — adicionar linha com `agent_id + messages` no body e tool `propose_agent_patch`.

### 3. Line numbers dos `case` no mapa estão deslocados

`maps/BUILDER_AGENTS.md` §4 cita L1401 ping … L1462 copilot_chat. Reais: **L1410 ping … L1471 copilot_chat** (+9 linhas). Atualizar.

### 4. Trigger de versionamento

`maps/BUILDER_AGENTS.md` §5 e `features/BUILDER_AGENTS.md` §7 dizem "trigger BEFORE UPDATE em `ai_agents.system_prompt` cria snapshot em `ai_agent_prompt_history`". Não existe trigger desse nome no banco. O versionamento hoje é **manual via INSERT em `agent_prompt_versions`** feito pelo frontend (`src/pages/Agents.tsx:434`). Corrigir a descrição (ou abrir tarefa separada para criar o trigger se for desejado).

### 5. Pequenas inconsistências

- `features/BUILDER_AGENTS.md` §10 (resumo executivo) não lista `CopilotPanel.tsx`, `PersonasPanel.tsx`, `StagesPanel.tsx`, `ThreadLearningPanel.tsx`, `AlfredDialog.tsx`, `PromptDiff.tsx` (todos existem em `src/components/agents/`).
- `features/BUILDER_AGENTS.md` §7 invariantes diz "leitura `authenticated`, escrita só `owner/admin` via RLS" para `builder_manual_versions` — confirmar que casa com a migration mais recente (memória de segurança recente escopou várias políticas para `authenticated`).
- `maps/BUILDER_AGENTS.md` §1 invariante 9 menciona `BuilderManualPanel` em `/admin` — agora o super admin login é separado (`/admin/login`); valeria referenciar a doc nova de SUPER_ADMIN.
- `copilot.md` §2.2 lista campos do `changes` do `propose_agent_patch`. Reconfirmar contra `COPILOT_PATCH_TOOL` atual em `ai-builder/index.ts` e atualizar se novos campos foram adicionados (RAG flags, hybrid_search, hyde, memory_enabled, planning_mode aparecem na UI mas talvez não no patch).

## O que NÃO está em drift (ok)

- 12 KBs de nicho em `_shared/builder-knowledge/niches/` ✓
- `ai_agent_drafts` schema, unique `(clinic_id, user_id)` ✓
- Wizard 5 passos em `AgentWizard.tsx` ✓
- Roadmap do co-piloto (Fase A1 `copilot_threads`, A2 `agent_revisions`) — tabelas ainda não criadas, então continuam como roadmap ✓
- `BuilderSetupCard`, `KbAssistant`, `TestLab`, `AgentInsights`, `PromptHistory`, `AuditLogPanel`, `CostsPanel`, `AgentHealth`, `ProviderErrorBanner`, `StagesPanel`, `PersonasPanel`, `ThreadLearningPanel`, `CopilotPanel`, `AlfredDialog` — todos existem ✓
- 10 actions do edge `ai-builder` ✓

## Plano de atualização

1. **`docs/maps/BUILDER_AGENTS.md`**
   - §4: atualizar line numbers (L1401→L1410, …, L1462→L1471) e somar `copilot_chat` no total (9→10 actions).
   - §5: trocar `ai_agent_versions`→`agent_prompt_versions`, `ai_eval_runs`→`agent_evals`, `agent_memories`→`agent_memory`. Remover trigger inexistente; descrever versionamento como "INSERT manual via UI".

2. **`docs/features/BUILDER_AGENTS.md`**
   - §2: "9 actions" → "10 actions".
   - §2 e §6/§8: substituir `ai_usage_daily` por `ai_usage` (e remover referência à view inexistente).
   - §5: adicionar linha `copilot_chat` na tabela de actions com payload `{agent_id, messages[]}`, tool `propose_agent_patch`, persistência `—` (UPDATE em `ai_agents` é feito pelo frontend ao "Aplicar").
   - §7 Fase 7: corrigir nome da tabela (`agent_prompt_versions`) e remover menção ao trigger; descrever fluxo real (INSERT pelo `Agents.tsx`).
   - §10: completar resumo executivo com componentes faltantes.

3. **`docs/copilot.md`**
   - §4: trocar `agent_eval_results` por `agent_evals` (campo `last_passed`); ajustar descrição de "baselinePassedIds" para a query real em `CopilotPanel.tsx`.
   - §2.2: reconferir `COPILOT_PATCH_TOOL` e expandir a tabela de campos se houver flags novas (rag/hybrid/hyde/memory/planning).
   - Atualizar `updated:` no frontmatter.

4. **Rodar `node scripts/docs-sync.mjs`** para regenerar `docs/INDEX.json`, `docs/DRIFT.md` e manifest do SupportKB, e validar que nenhum `code_refs` quebrou.

5. Atualizar `updated:` para 2026-06-09 nos três arquivos editados.

Nenhuma mudança de código de produto neste plano — só docs. Posso prosseguir e aplicar?
