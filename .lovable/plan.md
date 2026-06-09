## Análise da documentação dos agentes de IA

Verifiquei `docs/features/BUILDER_AGENTS.md`, `docs/flows/AI_AGENT_LOOP.md`, `docs/AI.md`, `docs/support/journeys/criar-primeiro-agente-ia.md` e `docs/support/troubleshooting/ia.md` contra o código real (`supabase/functions/ai-builder`, `ai-chat`, `ai-auto-reply`, `_shared/agent-flags.ts`, `src/lib/agent-tools.ts`, `src/pages/admin/*`, schema do Postgres).

**Resultado:** o grosso está bom. Encontrei 3 pontos de drift que precisam ser corrigidos.

---

### Drift 1 — `docs/flows/AI_AGENT_LOOP.md` desatualizado e inconsistente

Problemas concretos:

- **Frontmatter quebrado:** `summary:` está com o texto "Registradas em `supabase/functions/ai-chat/index.ts`…" (sobrou de uma seção interna). Deveria ser uma frase descrevendo o loop.
- **Tabelas fantasmas no corpo:** o aviso ⚠️ no topo diz "`ai_runs` / `ai_tool_calls` não existem", mas o diagrama ASCII e o texto continuam usando `INSERT ai_runs(...)`, `UPDATE ai_runs(...)`, `INSERT ai_tool_calls(...)`. Reescrever para refletir o real: `ai_usage` + `ai_chat_traces.turns[].tool_calls[]`.
- **Tabela errada:** "Postgres: …, `agent_memories`, …". A tabela real é `agent_memory` (singular) — confirmado no schema.
- **Tool inexistente:** seção "Pause / handoff" cita `pause_ai_for_lead` como tool. Não existe em `ai-chat/index.ts` nem em `KNOWN_AGENT_TOOLS` / `SILENT_TOOLS`. A pausa é via tool `transfer_to_human` ou via UI manual. Remover menção.
- **"LLM call via ai_gateway":** o loop atual chama o provedor da clínica direto (`_shared/ai.ts` → `chatCompletion`), sem gateway. Atualizar a label do diagrama.
- **`clinic_settings.ai_*` no diagrama:** já há nota no aviso, mas o passo 1 do loop ainda diz "carrega `clinic_settings.ai_*`". Trocar por `clinics.settings.ai.*`.
- Atualizar `updated:` para 2026-06-09 e a "Última atualização" no corpo.

### Drift 2 — `docs/features/BUILDER_AGENTS.md` com 3 imprecisões

- **`ai_usage_daily` existe.** Seção 2 diz "Não existe view/tabela `ai_usage_daily`; agregações diárias são calculadas on-the-fly". Verifiquei no DB: existe como VIEW (`CREATE OR REPLACE VIEW public.ai_usage_daily` em migration `20260518140308`). Reescrever para: agregações usam a view `ai_usage_daily` quando possível; `CostsPanel` faz on-the-fly só para filtros finos.
- **Caminho errado em §10:** `src/pages/Admin.tsx` não existe. O `BuilderManualPanel` é montado em `src/pages/admin/AdminPanels.tsx`. Corrigir nas duas ocorrências (linha 461 e §9 que diz `/admin` → aba "Manual do Builder").
- **Rota `/ai/agents/:id` inexistente.** Pegadinha #11 fala "A página `/ai/agents/:id` precisa deixar o toggle 'Ativo' bem visível", mas §3.2 corretamente afirma que não há essa rota — edição vive em `/ai/agents?agent=<id>` dentro de `src/pages/Agents.tsx`. Ajustar pegadinha #11 para usar o caminho real. Mesmo problema na descrição do KbAssistant em §4 ("exibido na página do agente em `/ai/agents/:id`").
- **Duas datas conflitantes:** frontmatter diz `updated: 2026-06-09`, mas linha 12 diz "Última atualização: 2026-06-03". Alinhar para 2026-06-09.

### Drift 3 — `docs/AI.md` é só um stub de redirect

O arquivo existe apenas para apontar para `docs/edge-functions/AI.md`. Está OK funcionalmente, mas o `summary:` do frontmatter ("Conteúdo idêntico…") é estranho como descrição. Trocar por algo do tipo: "Stub de redirecionamento — conteúdo real em `edge-functions/AI.md`." Mudança cosmética; pode ser feita junto.

---

### O que NÃO precisa mudar

- Lista de 15 tools em `KNOWN_AGENT_TOOLS` bate exatamente com as tools registradas em `ai-chat/index.ts` e com `SILENT_TOOLS` em `_shared/agent-flags.ts`. ✅
- Catálogo de 10 actions do `ai-builder` em §5 bate com os `case` reais (`ping`, `interview_plan`, `generate_system_prompt`, `suggest_kb_urls`, `draft_knowledge_base`, `audit_kb`, `generate_scenarios`, `run_evaluation`, `generate_insights`, `copilot_chat`). ✅
- KBs de nicho em §6.1 batem com `_shared/builder-knowledge/niches/` (12 arquivos). ✅
- Componentes listados em §10 existem todos em `src/components/agents/`. ✅
- Documentos de suporte (`journeys/criar-primeiro-agente-ia.md`, `troubleshooting/ia.md`) estão coerentes com o fluxo real do wizard e com o spend guard 402.

---

### Plano de execução

1. **Reescrever** `docs/flows/AI_AGENT_LOOP.md`:
   - Corrigir `summary:` no frontmatter; bumpar `updated:`.
   - Reescrever diagrama ASCII e seção "Loop" trocando `ai_runs`/`ai_tool_calls` por `ai_usage` + `ai_chat_traces`.
   - Trocar `agent_memories` → `agent_memory`.
   - Remover/ajustar menção a `pause_ai_for_lead` (usar `transfer_to_human`).
   - Trocar "LLM call via ai_gateway" por "LLM call (provedor da clínica via `_shared/ai.ts`)".
   - Trocar `clinic_settings.ai_*` por `clinics.settings.ai.*`.

2. **Editar** `docs/features/BUILDER_AGENTS.md`:
   - §2: corrigir afirmação sobre `ai_usage_daily`.
   - §4 e Pegadinha #11: trocar `/ai/agents/:id` por `/ai/agents?agent=<id>` (página `src/pages/Agents.tsx`).
   - §9 e §10: trocar `pages/Admin.tsx` por `pages/admin/AdminPanels.tsx`.
   - Alinhar a data "Última atualização" interna com o frontmatter (2026-06-09).

3. **Ajuste cosmético** em `docs/AI.md`: reescrever `summary:` do frontmatter.

4. **Rodar** `node scripts/docs-sync.mjs` para regenerar `docs/INDEX.json`, `public/docs-index.json`, `public/docs-content.json` e `docs/DRIFT.md`, e checar se algum `code_refs` quebrou.

Nenhuma mudança de código de runtime — só docs.
