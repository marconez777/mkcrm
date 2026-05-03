// Tests Evolution API connection
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
    const { data: settings } = await supabase.from("settings").select("evolution_url, evolution_api_key, evolution_instance").eq("id", 1).single();
    if (!settings?.evolution_url || !settings.evolution_api_key || !settings.evolution_instance) {
      return new Response(JSON.stringify({ ok: false, error: "Configure URL, API Key e instância primeiro." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const baseUrl = settings.evolution_url.replace(/\/$/, "");
    const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(settings.evolution_instance)}`;
    const resp = await fetch(url, { headers: { apikey: settings.evolution_api_key } });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, status: resp.status, error: json?.message ?? "Erro ao consultar Evolution", detail: json }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const state = json?.instance?.state ?? json?.state ?? "unknown";
    return new Response(JSON.stringify({ ok: true, state, raw: json }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
