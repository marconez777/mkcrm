// Edge Function: process-scheduled-campaigns
// Cron 5min: busca campanhas agendadas e chama dispatch-campaign.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const nowIso = new Date().toISOString();
    const { data: campaigns } = await supabase
      .from("email_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_for", nowIso)
      .limit(20);

    if (!campaigns?.length) return jsonResponse({ processed: 0 });

    const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-campaign`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let processed = 0;
    for (const c of campaigns as any[]) {
      try {
        await fetch(dispatchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ campaign_id: c.id }),
        });
        processed++;
      } catch (e) {
        console.error("dispatch failed for", c.id, e);
      }
    }
    return jsonResponse({ processed });
  } catch (e) {
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});
