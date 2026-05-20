// Controla campanhas de disparo em massa: start, pause, resume, cancel, freeze_audience, add_contacts.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();

  try {
    const body = await req.json();
    const { action, broadcast_id } = body ?? {};
    if (!action || !broadcast_id) return json({ error: "action and broadcast_id required" }, 400);

    const { data: bc, error: bcErr } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("id", broadcast_id)
      .maybeSingle();
    if (bcErr) throw bcErr;
    if (!bc) return json({ error: "broadcast_not_found" }, 404);

    const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
      await supabase.from("broadcasts").update({ status, ...extra }).eq("id", broadcast_id);
      await supabase.from("broadcast_events").insert({
        broadcast_id, clinic_id: bc.clinic_id, type: status,
      });
    };

    if (action === "start") {
      if (!bc.whatsapp_instance_id) {
        return json({ error: "no_whatsapp_instance", message: "Selecione uma instância do WhatsApp na aba Configuração antes de iniciar." }, 400);
      }
      if (!bc.audience_frozen_at) {
        return json({ error: "audience_not_frozen", message: "Congele a audiência na aba Audiência antes de iniciar a campanha." }, 400);
      }
      await setStatus("running");
      return json({ ok: true });
    }
    if (action === "pause") { await setStatus("paused"); return json({ ok: true }); }
    if (action === "resume") { await setStatus("running"); return json({ ok: true }); }
    if (action === "cancel") { await setStatus("cancelled"); return json({ ok: true }); }

    if (action === "freeze_audience") {
      const { pipeline_id = null, stage_ids = [], extra_contacts = [] } = body;
      const { data, error } = await supabase.rpc("broadcast_freeze_audience", {
        _broadcast_id: broadcast_id,
        _pipeline_id: pipeline_id,
        _stage_ids: stage_ids,
        _extra_contacts: extra_contacts,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, inserted: data });
    }

    if (action === "retry_failed") {
      await supabase
        .from("broadcast_recipients")
        .update({ status: "pending", parts_sent: 0, next_send_at: new Date().toISOString(), last_error: null })
        .eq("broadcast_id", broadcast_id)
        .eq("status", "failed");
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("broadcast-control error", err);
    return json({ error: String(err) }, 500);
  }
});
