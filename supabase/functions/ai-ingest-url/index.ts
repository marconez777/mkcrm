import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { chunkText, embed, type Agent } from "../_shared/ai.ts";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  try {
    const { agent_id, url, title: customTitle } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);
    if (!url) return json({ error: "url required" }, 400);

    const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", agent_id).single();
    if (!agent) return json({ error: "agent not found" }, 404);
    if (!agent.api_key && !agent.embedding_api_key) return json({ error: "Agente sem API key para embeddings" }, 400);

    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableBot/1.0" } });
    if (!resp.ok) return json({ error: `fetch failed ${resp.status}` }, 400);
    const ctype = resp.headers.get("content-type") || "";
    let text: string;
    if (ctype.includes("html")) text = htmlToText(await resp.text());
    else if (ctype.includes("text") || ctype.includes("json")) text = await resp.text();
    else return json({ error: `unsupported content-type ${ctype}` }, 400);

    if (text.length < 50) return json({ error: "extracted text too short" }, 400);
    const title = customTitle || url;

    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .insert({ agent_id, title, content: text, source: url, metadata: { url } })
      .select("id").single();
    if (docErr) throw docErr;

    const chunks = chunkText(text, 800, 100);
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vectors = await embed(agent as Agent, batch);
      batch.forEach((c, j) => {
        rows.push({
          document_id: doc.id, agent_id, chunk_index: i + j,
          content: c, embedding: vectors[j], token_count: Math.ceil(c.length / 4),
        });
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("ai_chunks").insert(rows);
      if (error) throw error;
    }

    return json({ ok: true, document_id: doc.id, chunks: rows.length, title });
  } catch (e) {
    console.error("ai-ingest-url", e);
    return json({ error: String(e) }, 500);
  }
});
