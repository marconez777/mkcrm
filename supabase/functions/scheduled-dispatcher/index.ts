// Dispatches due scheduled_messages by invoking evolution-send.
// Expected to be triggered by pg_cron every minute.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(50);

  let sent = 0, failed = 0;
  for (const item of due ?? []) {
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ lead_id: item.lead_id, text: item.content }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && !(data as any)?.error) {
        await supabase
          .from("scheduled_messages")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", item.id);
        sent++;
      } else {
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", last_error: (data as any)?.error ?? `HTTP ${resp.status}` })
          .eq("id", item.id);
        failed++;
      }
    } catch (e) {
      await supabase
        .from("scheduled_messages")
        .update({ status: "failed", last_error: String(e) })
        .eq("id", item.id);
      failed++;
    }
  }

  return json({ ok: true, processed: (due ?? []).length, sent, failed });
});
