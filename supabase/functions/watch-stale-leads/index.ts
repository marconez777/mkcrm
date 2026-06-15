// Cron-triggered: encontra leads inativos (sem mensagem nova há ≥ N dias)
// e enfileira o Watcher (silent agent) da instância de WhatsApp do lead
// para que ele decida se deve marcá-lo como "frio" / mover para
// "Lead parou de responder".
//
// Roda diariamente às 03:00 BRT (06:00 UTC) via pg_cron.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const STALE_DAYS = 14; // B27: nunca disparar antes de 14 dias sem resposta.
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, whatsapp_instance_id, tags, last_message_at, archived_at, stage_id")
    .is("archived_at", null)
    .not("whatsapp_instance_id", "is", null)
    .lt("last_message_at", cutoff)
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);

  let queued = 0, skipped = 0;
  const runAt = new Date().toISOString();

  for (const lead of leads ?? []) {
    if (Array.isArray(lead.tags) && lead.tags.includes("frio")) { skipped++; continue; }
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("watcher_agent_id")
      .eq("id", lead.whatsapp_instance_id!)
      .maybeSingle();
    if (!inst?.watcher_agent_id) { skipped++; continue; }

    await supabase.from("pending_replies").upsert(
      { lead_id: lead.id, agent_id: inst.watcher_agent_id, run_at: runAt },
      { onConflict: "lead_id,agent_id" },
    );
    queued++;
  }

  // Dispara o dispatcher uma vez para processar tudo agora.
  if (queued > 0) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scheduled-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: "{}",
      });
    } catch (e) { console.error("dispatcher kick failed", e); }
  }

  return json({ ok: true, scanned: leads?.length ?? 0, queued, skipped });
});
