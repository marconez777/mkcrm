// Sends a text message via Evolution API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, text } = await req.json();
    if (!lead_id || !text) {
      return new Response(JSON.stringify({ error: "lead_id and text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("settings").select("evolution_url, evolution_api_key, evolution_instance").eq("id", 1).single();
    if (!settings?.evolution_url || !settings.evolution_api_key || !settings.evolution_instance) {
      return new Response(JSON.stringify({ error: "Evolution não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: lead } = await supabase.from("leads").select("phone").eq("id", lead_id).single();
    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = settings.evolution_url.replace(/\/$/, "");
    const url = `${baseUrl}/message/sendText/${encodeURIComponent(settings.evolution_instance)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: settings.evolution_api_key },
      body: JSON.stringify({ number: lead.phone, text }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Evolution send error", resp.status, result);
      return new Response(JSON.stringify({ error: "Falha ao enviar", detail: result, status: resp.status }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const externalId = result?.key?.id ?? result?.messageId ?? null;
    await supabase.from("messages").insert({
      lead_id,
      external_id: externalId,
      from_me: true,
      message_type: "text",
      content: text,
      status: "sent",
      raw: result,
    });
    await supabase.from("leads").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 120),
      unread_count: 0,
    }).eq("id", lead_id);

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
