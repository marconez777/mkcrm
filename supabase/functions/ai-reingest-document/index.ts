import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chunkText, embed, type Agent } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();
  try {
    const { document_id, title, content } = await req.json();
    if (!document_id) return json({ error: "document_id required" }, 400);
    if (typeof title !== "string" || !title.trim()) return json({ error: "title required" }, 400);
    if (typeof content !== "string" || content.trim().length < 1) return json({ error: "content required" }, 400);

    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .select("id, agent_id")
      .eq("id", document_id)
      .single();
    if (docErr || !doc) return json({ error: "document not found" }, 404);

    const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", doc.agent_id).single();
    if (!agent) return json({ error: "agent not found" }, 404);
    if (!agent.api_key && !agent.embedding_api_key) {
      return json({ error: "Agente sem API key para embeddings" }, 400);
    }

    // Update doc
    const { error: updErr } = await supabase
      .from("ai_documents")
      .update({ title, content })
      .eq("id", document_id);
    if (updErr) throw updErr;

    // Delete existing chunks
    const { error: delErr } = await supabase.from("ai_chunks").delete().eq("document_id", document_id);
    if (delErr) throw delErr;

    // Re-ingest
    const chunks = chunkText(content, 800, 100);
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vectors = await embed(agent as Agent, batch, { agent_id: doc.agent_id, note: `reingest:doc:${document_id}` });
      batch.forEach((c, j) => {
        rows.push({
          document_id, agent_id: doc.agent_id,
          chunk_index: i + j, content: c,
          embedding: vectors[j], token_count: Math.ceil(c.length / 4),
        });
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("ai_chunks").insert(rows);
      if (error) throw error;
    }
    return json({ ok: true, document_id, chunks: rows.length });
  } catch (e) {
    console.error("ai-reingest-document", e);
    return json({ error: String(e) }, 500);
  }
});
