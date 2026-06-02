import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chunkText, embed, type Agent } from "../_shared/ai.ts";

async function loadAgent(agent_id: string): Promise<Agent | null> {
  const { data } = await sb().from("ai_agents").select("*").eq("id", agent_id).single();
  return data as Agent | null;
}

export async function ingestChunks(agent_id: string, doc_id: string, fullText: string, clinic_id?: string) {
  const agent = await loadAgent(agent_id);
  if (!agent) throw new Error("agent not found");
  if (!agent.api_key && !agent.embedding_api_key) throw new Error("Agente sem API key para embeddings");
  const cid = clinic_id ?? (agent as any).clinic_id;
  if (!cid) throw new Error("Agente sem clinic_id");
  const chunks = chunkText(fullText, 800, 100);
  const rows: any[] = [];
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const vectors = await embed(agent, batch, { agent_id, note: `ingest:doc:${doc_id}` });
    batch.forEach((c, j) => {
      rows.push({
        document_id: doc_id, agent_id, clinic_id: cid,
        chunk_index: i + j, content: c,
        embedding: vectors[j], token_count: Math.ceil(c.length / 4),
      });
    });
  }
  if (rows.length > 0) {
    const { error } = await sb().from("ai_chunks").insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();
  try {
    const { agent_id, title, content, source = null, metadata = null } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);
    if (!title || !content) return json({ error: "title and content required" }, 400);

    const { data: agent } = await supabase.from("ai_agents").select("clinic_id").eq("id", agent_id).single();
    if (!agent) return json({ error: "agent not found" }, 404);
    if (!agent.clinic_id) return json({ error: "Agente sem clinic_id" }, 400);

    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .insert({ agent_id, clinic_id: agent.clinic_id, title, content, source, metadata })
      .select("id").single();
    if (docErr) throw docErr;

    const n = await ingestChunks(agent_id, doc.id, content);
    return json({ ok: true, document_id: doc.id, chunks: n });
  } catch (e) {
    console.error("ingest-document", e);
    return json({ error: String(e) }, 500);
  }
});
