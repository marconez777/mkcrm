import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chunkText, embed, type Agent } from "../_shared/ai.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { assertSpendAllowed, SpendLimitExceeded } from "../_shared/spend-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();
  try {
    const { agent_id, title, file_base64 } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);
    if (!file_base64) return json({ error: "file_base64 required" }, 400);

    const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", agent_id).single();
    if (!agent) return json({ error: "agent not found" }, 404);
    if (!agent.api_key && !agent.embedding_api_key) return json({ error: "Agente sem API key para embeddings" }, 400);
    try { await assertSpendAllowed(agent.clinic_id ?? null); } catch (e) {
      if (e instanceof SpendLimitExceeded) return json(e.body, 402);
      throw e;
    }

    const b64 = (file_base64 as string).replace(/^data:application\/pdf;base64,/, "");
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const pdf = await getDocumentProxy(bin);
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = (text as string).replace(/\s+/g, " ").trim();
    if (cleaned.length < 50) return json({ error: "extracted text too short" }, 400);

    const docTitle = title || `PDF (${cleaned.slice(0, 40)}…)`;
    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .insert({ agent_id, title: docTitle, content: cleaned, source: "pdf", metadata: { pages: pdf.numPages, size: bin.byteLength } })
      .select("id").single();
    if (docErr) throw docErr;

    const chunks = chunkText(cleaned, 800, 100);
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vectors = await embed(agent as Agent, batch, { agent_id, note: `ingest:pdf:${doc.id}` });
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

    return json({ ok: true, document_id: doc.id, chunks: rows.length, pages: pdf.numPages });
  } catch (e) {
    console.error("ai-ingest-pdf", e);
    return json({ error: String(e) }, 500);
  }
});
