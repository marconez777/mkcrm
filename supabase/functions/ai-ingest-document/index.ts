import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { chunkText, embed } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  try {
    const { agent_id = null, title, content, source = null, metadata = null } = await req.json();
    if (!title || !content) return json({ error: "title and content required" }, 400);

    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .insert({ agent_id, title, content, source, metadata })
      .select("id")
      .single();
    if (docErr) throw docErr;

    const chunks = chunkText(content, 800, 100);
    // Embed in batches of 16
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vectors = await embed(batch);
      batch.forEach((c, j) => {
        rows.push({
          document_id: doc.id,
          agent_id,
          chunk_index: i + j,
          content: c,
          embedding: vectors[j],
          token_count: Math.ceil(c.length / 4),
        });
      });
    }
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("ai_chunks").insert(rows);
      if (insErr) throw insErr;
    }

    return json({ ok: true, document_id: doc.id, chunks: rows.length });
  } catch (e) {
    console.error("ingest-document", e);
    return json({ error: String(e) }, 500);
  }
});
