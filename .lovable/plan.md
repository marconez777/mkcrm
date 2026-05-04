
## Atualização da Documentação

A documentação atual em `docs/` está desatualizada — só descreve o CRM básico (Inbox, Kanban, Evolution). O projeto cresceu bastante: agora tem módulos de IA (agentes, RAG, auto-reply), automações, pipelines múltiplos, tarefas, mensagens agendadas, templates, métricas, autenticação, etc.

### O que será atualizado

**1. `docs/MANUAL.md`** — manual do usuário
- Adicionar seções: Autenticação/Login, Pipelines múltiplos (sales/internal), Agentes de IA, Automações, Tarefas, Mensagens agendadas, Templates, Métricas, Campos customizados.
- Atualizar Inbox: notas internas, encaminhamento, agendamento, painel de tarefas do lead, transcrição de áudio.
- Atualizar Kanban: troca de pipeline, sidebar, overview, drag dos cards vs pan horizontal do board.

**2. `docs/ARCHITECTURE.md`**
- Adicionar camada de IA (RAG + agentes + MCP + auto-reply).
- Adicionar módulo de automações (gatilhos + tick).
- Adicionar dispatcher de mensagens agendadas.
- Atualizar diagrama incluindo IA Gateway (Lovable AI) e fluxo auto-reply.
- Documentar Auth (Supabase Auth + RLS por usuário onde aplicável).

**3. `docs/DATABASE.md`** — incluir as ~20 novas tabelas:
- `pipelines`, `whatsapp_instances`
- `lead_tasks`, `lead_internal_notes`, `lead_reply_counters`, `lead_ai_settings`
- `scheduled_messages`, `message_templates`, `pending_replies`
- `automations`, `automation_runs`
- `ai_agents`, `ai_documents`, `ai_chunks`, `ai_threads`, `ai_messages`, `ai_usage`
- `agent_evals`, `agent_traces`, `agent_memory`, `agent_mcp_servers`, `stage_ai_defaults`
- `embedding_cache`, `rag_cache`, `webhook_dedup`

**4. `docs/EDGE_FUNCTIONS.md`** — adicionar as novas:
- `ai-assist`, `ai-auto-reply`, `ai-chat`, `ai-embed`, `ai-eval-run`
- `ai-ingest-document`, `ai-ingest-pdf`, `ai-ingest-url`, `ai-ingest-urls`
- `automations-tick`, `scheduled-dispatcher`
- `evolution-backfill-all`, `fetch-wa-avatar`, `transcribe-audio`

**5. `docs/EVOLUTION.md`**
- Atualizar para múltiplas instâncias (`whatsapp_instances`).
- Documentar `evolution-backfill-all`, `fetch-wa-avatar`, dedup via `webhook_dedup`.

**6. Novos arquivos**
- `docs/AI.md` — visão completa do módulo de IA: agentes, RAG (chunking, embeddings, cache), auto-reply, threads, MCP servers, evals, custos (`ai_usage`).
- `docs/AUTOMATIONS.md` — modelo de automação, gatilhos suportados, execução via `automations-tick`, runs.
- `docs/AUTH.md` — fluxo de login (`Auth.tsx`, `useAuth`, `ProtectedRoute`), políticas RLS.

**7. `README.md`** — atualizar índice apontando para os novos docs e listar os novos módulos na seção "Estrutura".

### Método

Para garantir precisão, antes de escrever cada doc vou:
- Ler os arquivos de hook/página correspondentes (ex.: `useAuth`, `usePipelines`, `lead-tasks`, `scheduled-messages`, `Automations.tsx`, `Agents.tsx`, `Templates.tsx`, `Metrics.tsx`).
- Inspecionar schema real das novas tabelas via `psql` (`\d <tabela>`) para listar colunas corretas.
- Ler cada nova edge function para descrever input/output/JWT.

### Resultado

Documentação completa, atual e fiel ao código, cobrindo todos os módulos hoje em produção, pronta para onboarding de novos devs e para uso como referência operacional.
