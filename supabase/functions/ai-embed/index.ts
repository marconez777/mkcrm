import { corsHeaders, json } from "../_shared/evolution.ts";
import { embed } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const texts: string[] = Array.isArray(body.texts)
      ? body.texts
      : body.text
      ? [body.text]
      : [];
    if (texts.length === 0) return json({ error: "text or texts required" }, 400);
    const vectors = await embed(texts);
    return json({ vectors });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
