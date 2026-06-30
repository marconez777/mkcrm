# Roadmap v5 — Agente de Vendas Febracis / Paulo Vieira

Revisão honesta após auditoria das fontes da v4. **Teses sobrevivem; números não-verificados saem.** Toda decisão numérica vira hipótese a calibrar no golden set, não critério de aceite arbitrário.

Contexto: evento presencial do **Paulo Vieira** (Febracis). Duas ofertas Stripe: **Setor VIP** (50 vagas, primária) e **Setor Bronze** (alternativa em objeção de preço/pedido explícito).

---

## Correções vs v4 (o que a auditoria mudou)

### Removido: números fabricados ou não-verificáveis
- ❌ "MTEB-PT, 54 modelos, 16 tarefas, Jun/26, gap de 5pp" — benchmark nativo PT-BR aparenta não existir. Mantenho só a recomendação verificável: Gemini Embedding 001 lidera MTEB inglês (68.32); 3-small segue como melhor custo-benefício.
- ❌ "Recall@50 − Recall@5 ≥ 25pp" como gate do reranker — tese real, número inventado.
- ❌ Scores específicos de chunking (0.648 etc.) — papers não confirmados nesta auditoria.

### Mantido com confiança
- ✅ **Contextual Retrieval (Anthropic): −49% em falhas de retrieval em top-20 chunks** (5.7% → 2.9%), combinando Contextual Embeddings + Contextual BM25. **Anthropic recomenda explicitamente Gemini e Voyage como embeddings particularmente eficazes nesse pipeline.** Este é o delta mais bem-sustentado da pesquisa.
- ✅ Rerank pode piorar recall — bem documentado. Decisão por eval on/off, sem número mágico.
- ✅ Section-aware não é vitória garantida — o golden set decide.
- ✅ Padrões WhatsApp: split por bubble, markdown→WhatsApp, buffer de tokens, debounce — bugs reais em issues abertas.

### Nova pergunta de enquadramento (ponto cego da v4)
**Anthropic: se a base < ~200k tokens (≈500 páginas), não precisa de RAG — cabe tudo no prompt com cache.**

Antes de construir chunker, RPC v2, bake-off de embedding e gate de reranker, precisamos medir: **quantos tokens tem o material da Febracis (playbook + ofertas + objeções + scripts)?** A resposta condiciona tudo.

Três caminhos possíveis dependendo do tamanho real:

| Tamanho do corpus | Caminho recomendado |
|---|---|
| **< 50k tokens** | Sem RAG. System prompt inteiro + cache de prompt. Construir só o agente, o splitter WhatsApp e os gates de incerteza. |
| **50k–200k tokens** | Híbrido fino. Prompt-cached carrega o playbook e as ofertas; RAG só para FAQ/objeções (poucos chunks, alta precisão). |
| **> 200k tokens** | RAG completo como na v4: chunker, embedding, rerank, Contextual Retrieval. |

**Fase 0 (nova) decide qual caminho seguir.** Sem essa medição, qualquer engenharia de RAG é prematura.

---

## Roadmap v5 — fases

### Fase 0 — Medir o corpus (NOVO, bloqueante)
Contar tokens do playbook + ofertas + objeções + scripts da Febracis (`tiktoken` ou contagem grosseira `chars/4`). **Saída**: número absoluto + caminho recomendado (A/B/C acima). Sem isso a Fase 4 inteira pode ser desnecessária.

### Fase 1 — Inventário Febracis
Snapshot do tenant: clinic_id, agentes, KB atual, pipelines, secrets. Sem mudanças vs v4.

### Fase 2 — Auditoria de infra
- `ai-chat`: two-context (memória vs RAG) preservado? buffer de tokens? splitter de bubble? conversor markdown→WhatsApp? debounce de input?
- `ai-ingest-document`: chunker atual é `800/100` em `chunkText` — entra como baseline, não vencedor.
- `_shared/rag.ts`: HyDE, hybrid, rerank já existem; ajustar é cirúrgico.
- `agent_memory` ativo no agente?

### Fase 3 — Golden set (PRÉ-REQUISITO, bloqueante para Fase 4+)
- 30+ perguntas reais em PT-BR coloquial + typos ("vlr do vip?", "qnto tá saindo?", "manda link").
- Métricas: **Recall@5, Recall@50, MRR, taxa de fallback "não sei"**.
- Baseline rodado contra o estado atual (chunker 800/100, text-embedding-3-small, sem rerank, sem filtro).
- **Todo número que entrar como gate adiante (incluindo "ativar rerank") é calibrado aqui.**

### Fase 4 — Caminho A: Sem RAG (se corpus < 50k tokens)
- System prompt completo com playbook + ofertas + objeções + scripts.
- Prompt cache (Lovable AI Gateway suporta? validar).
- Pular Fase 4b–4f da v4 inteiras.

### Fase 4 — Caminho B/C: Com RAG (se corpus ≥ 50k tokens)

**4a. System prompt — princípios**
- Política de roteamento VIP×Bronze (VIP primário; Bronze só em objeção de preço, pedido explícito ou alternativa).
- Regras WhatsApp (tamanho, formatação, anti-passividade, 70/20/10).
- Regra de tool: "preço → `search_knowledge_base(doc_type='offer', offer_tier='vip')`; só Bronze em (a) objeção, (b) pedido explícito, (c) alternativa."
- Gate de incerteza: "se top-1 < `min_confidence` (calibrado no golden set), não invente número/link/data — diga que vai confirmar."

**4b. KB — chunker e metadados**
| `doc_type` | `metadata extra` |
|---|---|
| `method` | `section_title`, `section_path` |
| `offer` | `offer_tier: vip\|bronze`, `is_primary_offer`, `stripe_link`, `price_anchor` |
| `objection` | `objection_kind: price\|trust\|time\|authority` |
| `script` | `intent: price\|how\|interest\|fit` |

Chunker section-aware (corta por `#`/`##`, sub-divide chunks longos). **Mas fixed-size 250 entra como controle** — golden set decide.

**4c. Contextual Retrieval — FAVORITO a testar primeiro**
Promovido de "candidato" a "favorito". Razões:
- É o delta com evidência mais sólida (−49% Anthropic, número auditado).
- Custo é one-shot na ingestão (1 chamada de LLM barato por chunk), zero runtime.
- Casa com o conteúdo: playbook tem placeholders densos (`[VALOR]`, `[NOME DO PRODUTO]`) que se beneficiam muito de contexto situacional.
- Anthropic recomenda Gemini explicitamente para esse pipeline → alinha com nosso BYOK.

Implementação: para cada chunk, Gemini Flash gera 1–2 frases "este chunk pertence a [doc] e fala sobre [tema], no contexto de [seção pai]". Prependa antes de embeddar. Validado no golden set vs baseline sem CR.

**4d. Filtro por tipo + tier**
- Índice GIN em `ai_chunks.metadata`.
- `match_chunks_hybrid_v2(query_embedding, query_text, p_agent_id, p_doc_types, p_offer_tier, match_count)`.
- Tool `search_knowledge_base` aceita `doc_type[]` e `offer_tier`.

**4e. Embedding — bake-off no golden set**
Candidatos:
- `openai/text-embedding-3-small` (baseline atual, melhor custo-benefício).
- `openai/text-embedding-3-large`.
- `google/gemini-embedding-001` (preferido pela Anthropic no pipeline de CR).

Vencedor pelo golden set, **não por benchmark externo**. Se vencedor mudar dimensão (1536 → 3072), planejar migração da coluna `vector(1536)` ou usar `dimensions: 1536` em modelos OpenAI para manter compatibilidade.

**4f. Reranker — eval on/off, sem número mágico**
Cohere `rerank-multilingual-v3.0` ou Jina/Voyage equivalentes. **Critério de ativação**: eval on/off no golden set mostra **ganho líquido em Recall@5 e MRR sem regressão em queries curtas/com typo**. Se piorar qualquer um dos dois, fica desligado. Cache `(query_hash, chunk_id)` com TTL para latência.

### Fase 5 — Validar com golden set
Tabela: chunker × embedding × CR on/off × rerank on/off. Promove a config com melhor Recall@5 e MRR no golden set, com gate de regressão em queries curtas.

### Fase 6 — Runtime WhatsApp (P0)
Independente de A/B/C. Todos os agentes precisam:
- Splitter ≤1.600 char/bubble, quebra por parágrafo.
- Conversor markdown→WhatsApp (`**`→`*`, sem `#`, listas → bullets).
- Buffer de tokens (impedir stream-per-token vazar).
- Debounce de input (1.5–2s, agrupa mensagens consecutivas).
- Detector janela 24h Meta + sinalização para humano quando precisa de template.

### Fase 7 — Nicho global "Vendas / Evento"
Só depois da Febracis validar. Avaliar `niches/sales.md` no `AgentWizard`.

### Fase 8 — Gaps de plataforma

**P0**: medição de corpus (Fase 0), golden set (Fase 3), runtime WhatsApp (Fase 6), gate de incerteza no agente.

**P0 condicionais (só se Caminho B/C)**: chunker, filtro doc_type+tier + RPC v2, Contextual Retrieval, bake-off embedding, rerank com eval on/off.

**P1**: cache de prompt (Caminho A torna isso P0), circuit breaker em tool calls, two-context validado, eval comportamental (frases proibidas, 70/20/10), UI no `Agents.tsx` para marcar `doc_type`/`offer_tier`.

**P2**: `send_payment_link(offer_slug)` (lê só do KB), painel "CTA/total" por agente.

### Fase 9 — Documentação
- `docs/agents/SALES_PLAYBOOK.md`
- `docs/agents/RAG_DECISION.md` (novo — registra a escolha A/B/C e o número de tokens medido)
- `docs/agents/RETRIEVAL_EVALS.md`
- `docs/agents/WHATSAPP_RUNTIME.md`

---

## Princípio que ficou explícito
**Todo número que parecer um "critério de aceite" vem do nosso golden set, não de pesquisa externa.** Pesquisa externa serve para escolher *o que testar*, não *o que aceitar*. Foi exatamente o risco de canonizar número não verificado que derrubou a v4.

## Referências auditadas que sustentam a v5
- ✅ Anthropic Contextual Retrieval: https://www.anthropic.com/engineering/contextual-retrieval
- ✅ MTEB leaderboard inglês (Gemini 68.32, posições de OpenAI): huggingface.co/spaces/mteb/leaderboard
- ✅ Reranker pode piorar recall: consenso documentado em múltiplos posts/papers (tese verificada, número específico de qualquer post individual é anecdótico).
- ✅ WhatsApp runtime bugs: issues abertas em hermes-agent, nanobot, gaia — referenciadas na pesquisa anterior.

## Próximo passo
Aprove a v5 e eu começo pela **Fase 0 (medir o corpus Febracis)** + **Fase 1 (snapshot do tenant)** + **Fase 2 (auditoria sem editar)**. Só com o número de tokens em mãos decidimos se a Fase 4 inteira é necessária.
