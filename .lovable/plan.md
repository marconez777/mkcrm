
# Agente de Suporte In-App ("Alfred Suporte")

Chat de suporte com IA acessível por **todos os usuários autenticados**, configurado **100% no Super Admin**, usando **OpenAI (`gpt-4o-mini`)** com chave do super admin, alimentado pela KB de `docs/support/` e com **contexto da tela** + **detecção de erros runtime**.

---

## 1. Como o usuário vê

```text
┌─────────────────────────────────────────────────────────┐
│  App (qualquer rota autenticada)                        │
│                                                         │
│                                          [💬 Suporte]  │ ← FAB
│                                                         │
│                            ┌──────────────────────────┐ │
│                            │ Suporte via chat  _  ✕  │ │  ← minimiza/fecha
│                            │──────────────────────────│ │
│                            │ Oi! Vi que você está em  │ │
│                            │ /ai/agents. Posso ajudar?│ │
│                            │  [Sim, me guie] [Não]    │ │
│                            │                          │ │
│                            │ ...mensagens...          │ │
│                            │──────────────────────────│ │
│                            │ [Digite sua dúvida...]➤ │ │
│                            └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- **Bolha flutuante** fixa no canto inferior direito (estilo Intercom).
- Estados: **fechada** (bolha 56px) · **minimizada** (barrinha fina embaixo, mantém thread) · **aberta** (painel 380×580).
- Estado persistido em `localStorage` por usuário.
- Oculta em `/auth`, `/onboarding`, `/site/*`.

---

## 2. Onde o super admin configura

Nova aba **"Suporte IA"** em `/admin` com:

### Card "Configuração"
- Toggle **Ativo** (desliga o FAB de todo mundo).
- **API Key OpenAI** (cifrada via `pgsodium`, mesmo padrão de `ai_agents.api_key`) + botão **Testar conexão**.
- **Modelo** (default `gpt-4o-mini`, dropdown com `gpt-4o`, `gpt-4o-mini`).
- **Temperatura** (default 0.3).
- **Teto mensal USD** (spend guard global).
- **System prompt mestre** (editor + botão "Restaurar padrão").

### Card "Base de Conhecimento"
- Lista dos docs ingeridos (path, chunks, atualizado em).
- Botão **🔄 Re-sincronizar KB** → roda `support-kb-sync` (lê `docs/support/**.md`, re-chunka e re-embedda).

### Card "Performance & Histórico" (atende sua pergunta 1)
- KPIs do mês: **mensagens · usuários únicos · tempo médio de resposta · custo USD · % "resolvido"**.
- Gráfico diário (linhas) de mensagens e custo.
- **Top 10 rotas que mais geram dúvida** (lista clicável).
- **Top 10 erros runtime detectados**.
- **Lista de threads** com filtros (usuário, clínica, rota, "não resolvidas", "com feedback ruim") → clica e vê a conversa inteira + contexto da tela de cada turn + tools chamadas + custo do turn.
- Botão **Exportar CSV** das threads.

### Card "Feedback"
- Lista de avaliações ruins (👎 ou comentário) com link pra thread, pra alimentar melhorias do prompt/KB.

---

## 3. Fases de implementação

### Fase A — Banco e Super Admin (sem chat ainda)
- Migração das tabelas (ver seção 5).
- Aba "Suporte IA" no `/admin` com config + teste de conexão + KB list + botão re-sync.

### Fase B — Ingestão da KB
- Edge function **`support-kb-sync`** (super_admin only):
  - Lê `.md` copiados em `supabase/functions/_shared/support-kb/` (snapshot do `docs/support/` no deploy).
  - Para cada arquivo: chunk (~1000 chars, overlap 150) → embed via Lovable AI Gateway (`google/gemini-embedding-001`, 3072 dims) → upsert em `support_documents` com `path`, `hash`, `chunk_index`.
  - Re-ingere só o que mudou (compara hash).
- Script de build copia `docs/support/**.md` → `supabase/functions/_shared/support-kb/` antes do deploy (regra já existe em `COMMIT_PR.md`).

### Fase C — Edge function `support-chat`
- POST `{ thread_id?, message, context }` → **SSE streaming**.
- `context`: `{ route, page_title, viewport, dom_skeleton, console_errors[], failed_requests[] }`.
- Pipeline:
  1. Carrega config + verifica `enabled` + `assertSpendAllowed` (spend-guard global).
  2. Cria/recupera thread.
  3. Monta `system = master_prompt + bloco_contexto_da_tela`.
  4. Reescreve query (HyDE leve) → busca top-K em `support_documents` (pgvector cosine).
  5. Chama OpenAI `gpt-4o-mini` com `tools`:
     - `lookup_doc(slug)` — markdown completo de uma página/jornada.
     - `link_to_route(path, label, reason)` — chip "Ir para X".
     - `highlight_element(selector, reason)` — UI destaca elemento via `window.postMessage`.
     - `start_step_by_step(journey_slug)` — entra em modo guiado.
     - `report_bug(summary, repro)` — grava em `support_chat_events`.
  6. Streaming dos tokens; persiste mensagens + tokens + custo em `support_chat_messages`.
- Bloco de contexto injetado no system:
  > "O usuário está em `/ai/agents`, viewport 1194×715. Cabeçalhos visíveis: ... Botões visíveis: ... Erros recentes no console: ... Requisições falhadas: ..."

### Fase D — UI do chat (frontend)
- `src/components/support/`:
  - `SupportChatFab.tsx` — bolha + estado fechado/minimizado/aberto + persistência local.
  - `SupportChatPanel.tsx` — header (título, minimizar, fechar, "nova conversa"), lista de mensagens, composer.
  - `SupportMessage.tsx` — markdown + action chips (botão "Ir para X" → `navigate()`; "Destacar" → highlight).
  - `StepByStepHeader.tsx` — barra "Passo 2/5 · Conectar WhatsApp" + [✓ Feito] [Tive problema].
  - `FeedbackButtons.tsx` — 👍 👎 + comentário opcional.
- `src/hooks/`:
  - `useScreenContext.ts` — pathname, title, viewport, headings/buttons visíveis (DOM textual, sem screenshot).
  - `useRuntimeWatcher.ts` — buffer (10 últimos) de `window.onerror`, `unhandledrejection`, `console.error`, `fetch` 4xx/5xx (apenas `url` sem query, `status`, primeiros 200 chars do body).
  - `useSupportChat.ts` — orquestra SSE stream, ações de tool, persistência da thread no servidor.
- `src/lib/support-highlight.ts` — anima `outline` em selector recebido.
- Montagem em `AppShell` atrás de `ProtectedRoute`; respeita `support_agent_config.enabled`.

### Fase E — Detecção proativa de erros
- Quando o `useRuntimeWatcher` captura erro novo **com o chat aberto**, mostra dentro do chat:
  > "⚠️ Vi um erro aqui. Quer que eu explique?" → [Sim]
  - manda turn automático com `auto_triage=true` + payload do erro.
- **Privacidade**: nunca enviar tokens/cookies/auth headers; URLs sem query strings de chave; toggle "compartilhar contexto da tela" no header do chat (default ligado).

### Fase F — Página de Performance no Super Admin
- KPIs + gráficos (Recharts) + lista de threads + drawer da conversa.
- Conecta direto nas tabelas `support_chat_*`.

---

## 4. System prompt mestre (rascunho)

> Você é o assistente de suporte do MK-CRM. Responda **sempre em PT-BR**, **direto ao ponto**, em **passos numerados curtos**, como se explicasse para alguém com pouca paciência, zero contexto técnico e dificuldade de atenção. Frases curtas. Um passo por linha. Sem jargão.
>
> Antes de responder qualquer coisa: leia o "Contexto da tela" abaixo. Se houver erro no console ou requisição falhada, comente isso primeiro e proponha a correção.
>
> Nunca invente caminhos do app. Se não tiver certeza, use a ferramenta `lookup_doc` antes de responder. Quando for guiar uma ação, no primeiro passo sempre ofereça `link_to_route` + `highlight_element` apontando o botão/menu certo.
>
> Quando o usuário pedir um fluxo (ex.: "como conecto WhatsApp"), use `start_step_by_step` e mande **um passo de cada vez**, esperando o usuário responder "feito" antes do próximo.
>
> Se o usuário disser que algo não funcionou, peça o print do erro (ele pode colar) ou use o contexto runtime já enviado. Se for bug real, use `report_bug`.

---

## 5. Banco de dados (resumo)

Todas em `public`, com GRANTs + RLS.

- **`support_agent_config`** (singleton)
  - `provider`, `api_key` (cifrada), `model`, `temperature`, `system_prompt`, `enabled`, `monthly_cap_usd`, `updated_by`, `updated_at`.
  - RLS: read/write só `has_role(uid, 'super_admin')`.

- **`support_documents`** (KB com embeddings)
  - `id`, `path`, `title`, `chunk_index`, `content`, `embedding vector(3072)`, `hash`, `metadata jsonb`, `updated_at`.
  - Index HNSW cosine.
  - RLS: read super_admin; escrita só service_role (via `support-kb-sync`).

- **`support_chat_threads`**
  - `id`, `user_id`, `clinic_id`, `title`, `last_route`, `resolved bool`, `created_at`, `updated_at`.
  - RLS: usuário lê/escreve as próprias; super_admin lê todas.

- **`support_chat_messages`**
  - `id`, `thread_id`, `role` (user/assistant/tool/system), `content`, `tool_name`, `tool_args jsonb`, `tool_result jsonb`, `screen_context jsonb`, `runtime_errors jsonb`, `tokens_in`, `tokens_out`, `cost_usd`, `created_at`.
  - RLS: dono da thread lê; super_admin lê tudo.

- **`support_chat_events`**
  - `id`, `thread_id`, `message_id`, `kind` (console_error / network_error / unhandled / bug_report), `payload jsonb`, `created_at`.

- **`support_feedback`**
  - `id`, `message_id`, `user_id`, `rating` (1/-1), `comment`, `created_at`.

Spend guard usa `support_agent_config.monthly_cap_usd` somando `cost_usd` de `support_chat_messages` no mês corrente.

---

## 6. Edge functions novas

- `support-chat` — streaming + tools + RAG + spend guard.
- `support-kb-sync` — re-ingere `docs/support/**.md` (super_admin only).
- `support-chat-feedback` — POST rating + comentário.
- `support-test-connection` — POST {api_key, model} → faz 1 chamada teste à OpenAI e devolve ok/latência.

---

## 7. Arquivos frontend (resumo)

- `src/components/support/SupportChatFab.tsx`
- `src/components/support/SupportChatPanel.tsx`
- `src/components/support/SupportMessage.tsx`
- `src/components/support/StepByStepHeader.tsx`
- `src/components/support/FeedbackButtons.tsx`
- `src/hooks/useScreenContext.ts`
- `src/hooks/useRuntimeWatcher.ts`
- `src/hooks/useSupportChat.ts`
- `src/lib/support-highlight.ts`
- Aba "Suporte IA" em `src/pages/Admin.tsx` (novos componentes em `src/components/admin/support/`).
- Montagem do FAB em `src/components/AppShell.tsx`.

---

## 8. PRs sugeridos (entrega incremental)

1. **PR 1** — Migração + aba Super Admin com config (sem chat ainda).
2. **PR 2** — `support-kb-sync` + ingestão inicial da KB + lista de docs.
3. **PR 3** — `support-chat` (streaming + RAG, sem tools avançadas) + FAB básico (abrir, mandar mensagem, ver resposta).
4. **PR 4** — Tools (`link_to_route`, `highlight_element`, `start_step_by_step`) + contexto da tela + minimizar/persistir estado.
5. **PR 5** — `useRuntimeWatcher` + detecção proativa de erros + bloco runtime no contexto.
6. **PR 6** — Aba Performance & Histórico no Super Admin + feedback 👍👎.

---

## 9. Riscos / pontos de atenção

- **Custo**: `gpt-4o-mini` é barato (~$0.15/M in, $0.60/M out), mas com contexto da tela + RAG cada turn pode ficar em ~2-5k tokens. Spend cap mensal protege.
- **Privacidade do DOM**: serializar só headings/labels/botões visíveis; nunca innerHTML cru de listas com dados de leads. Adicionar blocklist de seletores sensíveis (ex.: dentro de `/inbox` não mandar conteúdo de mensagens).
- **DOM skeleton em rotas com tabelas grandes**: truncar em ~3KB.
- **Latência**: streaming SSE é mandatório pra UX boa.
- **Re-sync KB**: como é manual no v1, deixar banner no super admin "KB desatualizada há X dias" se `docs/support` tiver mudado no repo (comparar hash do snapshot empacotado vs último sync).

Pronto pra implementar quando você aprovar.
