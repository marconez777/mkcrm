// supabase/functions/pipeline-summarize/index.ts
//
// Marco 3 — entry point standalone para o summarizer.
// Usado em invocação manual / smoke test / cron de catchup.
// O caminho normal de produção é o classifier chamando runSummarize() direto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { runSummarize } from "../_shared/pipeline-summarize-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body.lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    const result = await runSummarize(client, body.lead_id, {
      force: !!body.force,
      reason: body.reason ?? "manual",
    });
    console.log(JSON.stringify({ fn: "pipeline-summarize", lead_id: body.lead_id, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-summarize error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
