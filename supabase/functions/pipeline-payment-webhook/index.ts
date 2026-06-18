// supabase/functions/pipeline-payment-webhook/index.ts
//
// Marco 3 — Caminho A do auto:payment-confirmed.
// Webhook que recebe confirmações reais de pagamento de provedor externo.
// Seta custom_fields.status_financeiro='pago'. NÃO move stage (D1).
//
// Auth: header `x-internal-secret` deve igualar SUPABASE_SERVICE_ROLE_KEY
// (use Bearer/secret externo dedicado se o provedor exigir).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { runPaymentConfirmed } from "../_shared/pipeline-tasks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (secret !== SERVICE_KEY && bearer !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body.lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: lead } = await client
      .from("leads")
      .select("clinic_id")
      .eq("id", body.lead_id)
      .maybeSingle();
    if (!lead) {
      return new Response(JSON.stringify({ error: "lead_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await runPaymentConfirmed(client, {
      leadId: body.lead_id,
      clinicId: lead.clinic_id as string,
      amount: body.amount ?? null,
      ref: body.ref ?? null,
      source: body.source ?? "webhook",
    });
    console.log(JSON.stringify({ fn: "payment-webhook", lead_id: body.lead_id, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("payment-webhook error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
