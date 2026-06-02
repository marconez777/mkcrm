import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
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

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0$)/i;

function validateUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: "URL inválida" }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Apenas http(s)" };
  if (PRIVATE_HOST_RE.test(url.hostname)) return { ok: false, error: "Host bloqueado" };
  return { ok: true, url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const supabase = sb();
  try {
    const { agent_id, url, title: customTitle } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);
    if (!url) return json({ error: "url required" }, 400);

    const v = validateUrl(String(url));
    if (!v.ok) return json({ error: v.error }, 400);

    const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", agent_id).single();
    if (!agent) return json({ error: "agent not found" }, 404);
    if (!agent.clinic_id) return json({ error: "Agente sem clinic_id" }, 400);
    if (!agent.api_key && !agent.embedding_api_key) return json({ error: "Agente sem API key para embeddings" }, 400);

    const resp = await fetch(v.url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!resp.ok) return json({ error: `fetch falhou (${resp.status})` }, 400);
    // Revalida o host final após redirects para evitar SSRF
    const finalUrl = new URL(resp.url);
    if (PRIVATE_HOST_RE.test(finalUrl.hostname)) return json({ error: "Redirecionou para host bloqueado" }, 400);
    const ctype = resp.headers.get("content-type") || "";
    let text: string;
    if (ctype.includes("html")) text = htmlToText(await resp.text());
    else if (ctype.includes("text") || ctype.includes("json")) text = await resp.text();
    else return json({ error: `tipo de conteúdo não suportado: ${ctype}` }, 400);

    if (text.length < 50) return json({ error: `Texto extraído muito curto (${text.length} chars). A página pode ser renderizada por JavaScript ou estar bloqueando bots.` }, 400);
    const title = customTitle || url;

    const { data: doc, error: docErr } = await supabase
      .from("ai_documents")
      .insert({ agent_id, clinic_id: agent.clinic_id, title, content: text, source: url, metadata: { url } })
      .select("id").single();
    if (docErr) throw docErr;

    const chunks = chunkText(text, 800, 100);
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vectors = await embed(agent as Agent, batch, { agent_id, note: `ingest:url:${doc.id}` });
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

