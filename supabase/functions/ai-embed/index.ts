// Deprecated: embeddings are now per-agent. Use ai-ingest-* functions which carry agent_id.
import { corsHeaders, json } from "../_shared/evolution.ts";
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return json({ error: "Deprecated. Embeddings agora exigem agent_id (use ai-ingest-document/url/pdf)." }, 410);
});
