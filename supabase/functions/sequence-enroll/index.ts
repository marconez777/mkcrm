// Enroll a lead manually into a sequence (called from the CRM UI).
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const supabase = sb();
  try {
    const { sequence_id, lead_id } = await req.json();
    if (!sequence_id || !lead_id) return json({ error: "sequence_id and lead_id required" }, 400);

    const { data: seq } = await supabase
      .from("message_sequences")
      .select("id, clinic_id, enabled, cooldown_days")
      .eq("id", sequence_id).single();
    if (!seq) return json({ error: "sequence not found" }, 404);
    if (!seq.enabled) return json({ error: "sequence disabled" }, 403);

    const { data: lead } = await supabase.from("leads")
      .select("id, clinic_id").eq("id", lead_id).single();
    if (!lead || lead.clinic_id !== seq.clinic_id) return json({ error: "lead not found" }, 404);

    // Cooldown
    const cutoff = new Date(Date.now() - seq.cooldown_days * 86400_000).toISOString();
    const { data: recent } = await supabase.from("message_sequence_enrollments")
      .select("id").eq("sequence_id", seq.id).eq("lead_id", lead.id)
      .gt("started_at", cutoff).maybeSingle();
    if (recent) return json({ ok: true, enrollment_id: recent.id, deduped: true });

    const { data: enrollment, error } = await supabase.from("message_sequence_enrollments")
      .insert({
        clinic_id: seq.clinic_id, sequence_id: seq.id, lead_id: lead.id,
        status: "active", current_step: 0, next_run_at: new Date().toISOString(),
        source: { trigger: "manual", actor: auth },
      }).select("id").single();
    if (error) throw error;

    return json({ ok: true, enrollment_id: enrollment.id });
  } catch (e) {
    console.error("sequence-enroll error", e);
    return json({ error: String(e) }, 500);
  }
});
