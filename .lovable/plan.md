## Problema

No passo 5 do wizard `/ai/agents/new`, ao clicar **"Concluir esta fase"** o sistema só faz `persist({ step: 5 })` e exibe o toast "Prompt salvo no rascunho. Próximas etapas (KB, testes) chegam em breve.". Ou seja, **o agente nunca é criado** em `ai_agents` — fica preso para sempre como rascunho em `ai_agent_drafts`. Por isso o usuário não vê o agente no `/ai/agents` depois.

Trecho atual (`src/pages/ai/AgentWizard.tsx` ~593):

```ts
onClick={async () => {
  await persist({ step: 5 });
  toast.success("Prompt salvo no rascunho. Próximas etapas (KB, testes) chegam em breve.");
}}
```

## Solução

Transformar a finalização em **criação real do agente**, e levar o usuário direto para a página dele.

### 1. Adicionar campo "Nome do agente" no passo 5

- Input simples acima do botão "Concluir", com valor sugerido `"<GOAL_LABEL> — <NICHE_LABEL>"` (ex.: *"SDR — Clínica"*).
- Validação: 2-80 caracteres. Bloqueia "Concluir" se vazio.
- Estado guardado no draft (`settings.agent_name`) para sobreviver a refresh.

### 2. Trocar o handler do botão por uma função `finishAndCreateAgent()`

Fluxo:

1. Valida `bundle.system_prompt`, `apiKey`, `model`, `provider` e `agentName`.
2. Faz `INSERT` em `public.ai_agents` com:
   - `clinic_id`, `name`, `role = goal` (sdr/classifier/...), `niche`, `niche_other`
   - `provider`, `api_key`, `base_url`, `model`
   - `system_prompt = bundle.system_prompt`
   - `temperature = bundle.suggested_temperature`
   - `max_iterations = bundle.suggested_max_iterations`
   - `rag_top_k = bundle.suggested_top_k`
   - `tools = bundle.suggested_tools` (filtradas contra a whitelist em `_shared/agent-flags.ts`)
   - `enabled = false` (o usuário ativa depois de testar)
   - `draft_mode = true`
   - `description` curta baseada em nicho/objetivo (auto)
3. Em sucesso:
   - `DELETE` do registro em `ai_agent_drafts` daquele `(clinic_id, user_id)`.
   - Toast "Agente criado".
   - `nav(\`/ai/agents/${insertedId}\`)`.
4. Em erro: toast com a mensagem do Supabase (`unique_violation` etc.) e mantém o draft intacto.

### 3. Whitelist de tools

Hoje `bundle.suggested_tools` vem direto do LLM. Antes de gravar em `ai_agents.tools`, intersectar com a lista conhecida (`SILENT_TOOLS` + tools "non-silent" usadas no projeto). Isso evita gravar tools inexistentes que travariam o `ai-chat`. A lista vive em `supabase/functions/_shared/agent-flags.ts`; vou espelhar um array mínimo de tools válidas no frontend (`src/lib/agent-tools.ts`, novo) para evitar import de pasta `supabase/`.

### 4. Texto auxiliar e copy

- Substituir a linha "As próximas etapas (base de conhecimento, configurações, testes) chegam nas próximas fases…" por "Depois de criado, você pode adicionar base de conhecimento, rodar testes e ativar o agente na página dele."
- Trocar o label do botão de **"Concluir esta fase"** para **"Criar agente"** com `<Sparkles>`.

### 5. Atualizar docs

- `docs/features/BUILDER_AGENTS.md`: ajustar Fase 2 indicando que o wizard agora cria o agente no passo 5 (e não apenas salva o rascunho).

## Fora de escopo

- Editar `ai-builder` (edge): nenhuma mudança no backend, criação é via SDK supabase do frontend (já tem RLS de membership em `ai_agents`).
- Não toco em `BuilderSetupCard`, `TestLab`, `KbAssistant` — eles continuam funcionando na página `/ai/agents/:id` depois que o agente passa a existir.
- Não migro o draft para "concluído" — apaga após sucesso, simples e idempotente.

## Detalhes técnicos

- **RLS:** owner/admin já podem INSERT em `ai_agents` (verificado pela existência do `BuilderSetupCard` que também insere). Se aparecer erro de RLS, criar policy correspondente vira nova migration; vou validar no primeiro `insert` retornado.
- **Unique constraint:** `ai_agents_clinic_system_key_uidx` é parcial em `system_key NOT NULL` — não bloqueia múltiplos agentes sem `system_key`.
- **Defaults:** colunas como `silent`, `is_system`, `use_hybrid_search`, etc. ficam nos defaults da tabela; só seto o que vem do wizard.
- **Tipo:** `role` é text livre (sem CHECK); ok mandar `goal` direto.

## Arquivos tocados

- `src/pages/ai/AgentWizard.tsx` — input de nome, função `finishAndCreateAgent`, novo botão, copy.
- `src/lib/agent-tools.ts` (novo) — whitelist mínima de tools válidas.
- `docs/features/BUILDER_AGENTS.md` — nota da Fase 2.
