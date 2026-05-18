# Plano: ampliar análise de gargalos em `docs/AI.md`

## Objetivo

Atualizar a seção **13.1 Gargalos e melhorias** do `docs/AI.md` para:
1. Reescrever o item #1 deixando claro que o fix de `remember_fact.clinic_id` **já foi aplicado** no código.
2. Adicionar **10 novos achados** que vieram da segunda passagem de análise (RAG, dispatcher, auto-reply, duplicação de código, perda de mensagem).
3. Reorganizar o resumo executivo com a nova prioridade.

Sem alteração de código nesta etapa — só documentação.

---

## Novos gargalos encontrados (a adicionar)

### 🔴 Crítico — mensagem perdida no dispatcher
Em `scheduled-dispatcher/index.ts` o `pending_replies` é **deletado antes** de chamar `ai-chat`/`evolution-send` (claim atômico, linha 56-59). Se o `evolution-send` falhar (linha 140), o registro já foi removido → **a resposta é perdida sem retry**. O `ai_usage` registra erro, mas a mensagem nunca chega ao lead.
**Fix sugerido:** marcar `pending_replies.status='processing'` com timestamp em vez de deletar; só remover após sucesso final; reenfileirar com backoff em falha.

### 🟡 Código morto: cache de embedding/retrieval importado mas nunca usado
`_shared/rag.ts:4` importa `getCachedEmbedding`, `setCachedEmbedding`, `getCachedRetrieval`, `setCachedRetrieval`, `withTimeout` — **nenhum é usado** no arquivo. A infra de cache existe em `utils.ts` mas o caminho de query ignora. Provável trabalho começado e não concluído.
**Fix:** plugar o cache em `retrieveContext` (etapa 3 embed) e na própria RPC (etapa 4) usando hash da query reescrita + agent_id como chave.

### 🟡 `SILENT_TOOLS` duplicado em dois arquivos
A lista de ferramentas que marcam um agente como silent aparece **idêntica** em `ai-auto-reply/index.ts:9-13` e `scheduled-dispatcher/index.ts:81-85`. Adicionar uma tool nova em só um lugar gera comportamento divergente entre enfileiramento e execução.
**Fix:** mover para `_shared/agent-flags.ts` e importar dos dois lados.

### 🟡 Dispatcher trigger via `setTimeout` é frágil
`ai-auto-reply/index.ts:23-35` faz `setTimeout(debounce+1s)` dentro de `EdgeRuntime.waitUntil`. Se a instância edge for reciclada nesse meio-tempo, o dispatcher só dispara no próximo tick do cron (até 1 min depois). UX percebe latência aleatória.
**Fix:** disparar via `pg_notify` ou tabela `dispatcher_wakeup` consumida por trigger; ou simplesmente baixar o cron para 15s.

### 🟡 Histórico fixo de 20 mensagens sem janela inteligente
`scheduled-dispatcher:67-70` e `ai-chat` puxam sempre últimas 20 messages. Em conversas longas o modelo perde contexto inicial (lead pediu X há 50 turnos). Sem sumarização incremental no `agent_memory.kind='summary'`.
**Fix:** quando histórico > 30 turnos, gerar summary via cheap model, salvar em `agent_memory` kind=summary e usar summary + últimas 10 mensagens.

### 🟡 `processScheduled` é serial
`scheduled-dispatcher:17-38` itera 50 mensagens com `for` + `await`. Se cada send leva 2s, 50 mensagens = 100s — estoura o limite de execução da edge.
**Fix:** `pmap(items, 10, sender)` (já existe `pmap` em utils.ts).

### 🟡 Risco de loop dispatcher → webhook → auto-reply
Quando o dispatcher envia via `evolution-send`, a Evolution emite `MESSAGES_UPSERT` com `from_me=true`. O `evolution-webhook` repassa para `ai-auto-reply`, que **ainda enfileira agentes silenciosos** (`from_me && silent`). Cada resposta do bot pode disparar nova rodada do classificador — custo de tokens dobra. O `pending_replies` agrupa, mas ainda gera trace + embed.
**Fix:** marcar mensagens enviadas pelo bot com `bot_id` (já há `client_message_id`) e o webhook ignorar para fins de auto-reply.

### 🟢 `ai_usage` sem coluna `cost_usd` materializada
Cálculo de custo é feito no frontend (`MetricsAiUsage` + `ai-pricing.ts`). Toda mudança de preço exige redeploy. E histórico fica volátil se preço muda.
**Fix:** materializar `cost_usd` no insert (preço da época). Frontend só agrega.

### 🟢 `ai_documents.content` duplica conteúdo dos chunks
Cada documento guarda `content` completo + N linhas em `ai_chunks.content`. Em base grande, dobra storage. `ai_documents.content` parece só ser usado em edição/UI.
**Fix:** mover conteúdo bruto para storage bucket (`ai-docs`), guardar só URL + summary.

### 🟢 RLS de `embedding_cache` está aberta (sem policies)
Tabela tem RLS habilitada mas **nenhuma policy** → acesso só via service role. Funcional, mas se um dia for consultada via cliente autenticado vai falhar silenciosamente. Documentar ou adicionar policy `SELECT for authenticated`.

---

## Estrutura da edição

Substituir a subseção 13.1 atual por uma versão expandida com:

- **🔴 Críticos (2 itens):** memórias (já aplicado, marcar ✅) + mensagem perdida no dispatcher (novo).
- **🔴 Configuração (1 item):** `remember_fact` no agente silencioso ativo.
- **🟡 Médios (8 itens):** cache morto, SILENT_TOOLS duplicado, setTimeout frágil, histórico fixo, scheduled serial, loop bot, retenção `ai_usage`/`agent_traces`, orçamento de tokens no RAG.
- **🟢 Pequenos / UX (6 itens):** custo materializado, dedup `ai_documents.content`, RLS `embedding_cache`, erros tipados do provider, cron de evals, JSON denso no prompt, reranker default, agrupamento de tools na UI.

Atualizar o **resumo executivo** (tabela) com priorização revisada — adicionar linha P0 do dispatcher e linhas P1 dos novos achados.

Adicionar mini-bloco **"Como reproduzir o bug do dispatcher"** (3 linhas SQL + 1 curl) para o time conseguir testar antes do fix.

## Não-objetivos desta etapa

- Não alterar código de edge functions, RLS ou migrations.
- Não criar tasks de implementação dos fixes — só documentar para discussão.
- Não tocar `OVERVIEW.md`, `EMAIL.md`, `TRACKING.md`.
