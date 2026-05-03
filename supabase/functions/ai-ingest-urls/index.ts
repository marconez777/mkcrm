// Batch URL ingestion: takes an array of URLs and ingests each by calling ai-ingest-url.
import { corsHeaders, json } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { agent_id = null, urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) return json({ error: "urls[] required" }, 400);
    if (urls.length > 50) return json({ error: "max 50 urls per batch" }, 400);

    const results: any[] = [];
    for (const url of urls) {
      try {
        const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-ingest-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          },
          body: JSON.stringify({ agent_id, url }),
        });
        const data = await resp.json();
        results.push({ url, ok: resp.ok, ...data });
      } catch (e) {
        results.push({ url, ok: false, error: String(e) });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    return json({ ok: true, processed: results.length, succeeded: ok, results });
  } catch (e) {
    console.error("ai-ingest-urls", e);
    return json({ error: String(e) }, 500);
  }
});
