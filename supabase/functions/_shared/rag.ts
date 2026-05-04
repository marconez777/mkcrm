// Advanced RAG: query rewrite + HyDE + hybrid search (RRF) + reranker + memory recall.
import { embed, chatCompletion, type Agent, type ChatMessage } from "./ai.ts";

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  score: number;
  doc_title?: string | null;
};

export type RetrieveResult = {
  chunks: RetrievedChunk[];
  memories: Array<{ id: string; kind: string; content: string }>;
  rewritten_query: string;
  hyde_doc?: string;
};

const fetchJSON = async (url: string, init: RequestInit) => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

/** Use a cheap LLM call to rewrite the user query using prior history. */
async function rewriteQuery(agent: Agent, history: ChatMessage[], query: string): Promise<string> {
  if (history.length < 2) return query;
  try {
    const sys: ChatMessage = {
      role: "system",
      content:
        "Reescreva a pergunta do usuário como uma consulta de busca completa e independente, em português, " +
        "incorporando contexto da conversa anterior. Responda APENAS com a consulta reescrita, sem aspas.",
    };
    const recent = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
    const usr: ChatMessage = { role: "user", content: `Conversa:\n${recent}\n\nPergunta atual: ${query}\n\nConsulta:` };
    const r = await chatCompletion({ ...agent, temperature: 0 }, [sys, usr]);
    const out = r.choices?.[0]?.message?.content?.trim();
    return out && out.length < 400 ? out : query;
  } catch {
    return query;
  }
}

/** Generate a hypothetical answer (HyDE) — embed it instead of the question. */
async function hydeAnswer(agent: Agent, query: string): Promise<string | undefined> {
  try {
    const sys: ChatMessage = {
      role: "system",
      content: "Escreva um parágrafo curto que pareça ser a resposta ideal à pergunta. Seja específico e factual.",
    };
    const r = await chatCompletion({ ...agent, temperature: 0.2 }, [sys, { role: "user", content: query }]);
    return r.choices?.[0]?.message?.content?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Cohere / Voyage / Jina rerank — generic OpenAI-ish API. */
async function rerank(
  provider: string | null,
  apiKey: string | null,
  query: string,
  docs: RetrievedChunk[],
  topN = 5,
): Promise<RetrievedChunk[]> {
  if (!provider || !apiKey || docs.length === 0) return docs.slice(0, topN);
  try {
    if (provider === "cohere") {
      const j = await fetchJSON("https://api.cohere.com/v1/rerank", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "rerank-multilingual-v3.0",
          query,
          documents: docs.map((d) => d.content),
          top_n: topN,
        }),
      });
      return (j.results ?? []).map((r: any) => ({
        ...docs[r.index],
        score: r.relevance_score,
      }));
    }
    if (provider === "jina") {
      const j = await fetchJSON("https://api.jina.ai/v1/rerank", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "jina-reranker-v2-base-multilingual",
          query,
          documents: docs.map((d) => d.content),
          top_n: topN,
        }),
      });
      return (j.results ?? []).map((r: any) => ({
        ...docs[r.index],
        score: r.relevance_score,
      }));
    }
    if (provider === "voyage") {
      const j = await fetchJSON("https://api.voyageai.com/v1/rerank", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "rerank-2",
          query,
          documents: docs.map((d) => d.content),
          top_k: topN,
        }),
      });
      return (j.data ?? []).map((r: any) => ({
        ...docs[r.index],
        score: r.relevance_score,
      }));
    }
  } catch (e) {
    console.error("rerank error", e);
  }
  return docs.slice(0, topN);
}

export async function retrieveContext(opts: {
  supabase: any;
  agent: Agent & {
    use_hyde?: boolean;
    use_hybrid_search?: boolean;
    use_memory?: boolean;
    rag_top_k?: number;
    reranker_provider?: string | null;
    reranker_api_key?: string | null;
  };
  query: string;
  history: ChatMessage[];
  leadId?: string | null;
}): Promise<RetrieveResult> {
  const { supabase, agent, query, history, leadId } = opts;

  // 1. Query rewriting
  const rewritten = await rewriteQuery(agent, history, query);

  // 2. Optional HyDE
  let textForEmbed = rewritten;
  let hyde: string | undefined;
  if (agent.use_hyde) {
    hyde = await hydeAnswer(agent, rewritten);
    if (hyde) textForEmbed = hyde;
  }

  // 3. Embed
  let queryVec: number[] | null = null;
  try {
    const [v] = await embed(agent, [textForEmbed]);
    queryVec = v;
  } catch (e) {
    console.error("rag embed error", e);
  }

  // 4. Retrieve (hybrid or vector-only)
  let chunks: RetrievedChunk[] = [];
  if (queryVec) {
    const fetchPool = (agent.rag_top_k ?? 5) * 4;
    if (agent.use_hybrid_search !== false) {
      const { data } = await supabase.rpc("match_chunks_hybrid", {
        query_embedding: queryVec, query_text: rewritten, p_agent_id: agent.id, match_count: fetchPool,
      });
      chunks = (data ?? []).map((m: any) => ({ id: m.id, document_id: m.document_id, content: m.content, score: m.score }));
    } else {
      const { data } = await supabase.rpc("match_chunks", {
        query_embedding: queryVec, p_agent_id: agent.id, match_count: fetchPool,
      });
      chunks = (data ?? []).map((m: any) => ({ id: m.id, document_id: m.document_id, content: m.content, score: m.similarity }));
    }
  }

  // 5. Rerank
  const topK = agent.rag_top_k ?? 5;
  if (chunks.length > topK) {
    chunks = await rerank(agent.reranker_provider ?? null, agent.reranker_api_key ?? null, rewritten, chunks, topK);
  } else {
    chunks = chunks.slice(0, topK);
  }

  // 6. Attach doc titles
  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  if (docIds.length > 0) {
    const { data: docs } = await supabase.from("ai_documents").select("id, title").in("id", docIds);
    const titleMap = Object.fromEntries((docs ?? []).map((d: any) => [d.id, d.title]));
    chunks = chunks.map((c) => ({ ...c, doc_title: titleMap[c.document_id] ?? null }));
  }

  // 7. Memory recall
  let memories: Array<{ id: string; kind: string; content: string }> = [];
  if (agent.use_memory !== false && queryVec) {
    try {
      const { data } = await supabase.rpc("match_memories", {
        query_embedding: queryVec, p_agent_id: agent.id, p_lead_id: leadId ?? null, match_count: 3,
      });
      memories = (data ?? []).map((m: any) => ({ id: m.id, kind: m.kind, content: m.content }));
    } catch (e) {
      console.error("memory recall error", e);
    }
  }

  return { chunks, memories, rewritten_query: rewritten, hyde_doc: hyde };
}

/** Build a markdown context block ready to splice into a system prompt. */
export function formatContext(r: RetrieveResult): string {
  let out = "";
  if (r.memories.length > 0) {
    out += "\n\n## Memórias do agente sobre este lead\n";
    out += r.memories.map((m, i) => `- (${m.kind}) ${m.content}`).join("\n");
  }
  if (r.chunks.length > 0) {
    out += "\n\n## Trechos da base de conhecimento (cite como [1], [2]...)\n";
    out += r.chunks
      .map((c, i) => `[${i + 1}] ${c.doc_title ? `(${c.doc_title}) ` : ""}${c.content}`)
      .join("\n\n");
  }
  return out;
}
