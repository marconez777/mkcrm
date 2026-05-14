// Public webhook to enroll a lead into a message sequence.
// Used by external sites (e.g. depression test landing page) to start a sequence
// when a form is submitted. No JWT required — auth is via the sequence's public_token.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

function sanitizePhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabase = sb();
  try {
    const body = await req.json().catch(() => ({}));
    const { token, phone, name, email, tags, metadata } = body ?? {};
    if (!token || !phone) return json({ error: "token and phone required" }, 400);

    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 8) return json({ error: "invalid phone" }, 400);

    // 1. Resolve sequence by token
    const { data: seq } = await supabase
      .from("message_sequences")
      .select("id, clinic_id, enabled, cooldown_days, trigger_type, whatsapp_instance_id")
      .eq("public_token", token)
      .maybeSingle();
    if (!seq) return json({ error: "invalid token" }, 404);
    if (!seq.enabled) return json({ error: "sequence disabled" }, 403);
    if (seq.trigger_type !== "webhook") return json({ error: "sequence not webhook-triggered" }, 403);

    // 2. Find or create lead in that clinic
    let { data: lead } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("clinic_id", seq.clinic_id)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (!lead) {
      // Pick default sales pipeline + first stage
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("clinic_id", seq.clinic_id)
        .eq("kind", "sales")
        .order("is_default", { ascending: false })
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      const { data: stage } = pipeline
        ? await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("pipeline_id", pipeline.id)
            .order("position")
            .limit(1)
            .maybeSingle()
        : { data: null as any };

      const { data: created, error: leadErr } = await supabase
        .from("leads")
        .insert({
          clinic_id: seq.clinic_id,
          phone: cleanPhone,
          name: name ?? null,
          email: email ?? null,
          stage_id: stage?.id ?? null,
          pipeline_id: pipeline?.id ?? null,
          tags: Array.isArray(tags) ? tags : [],
          whatsapp_instance_id: seq.whatsapp_instance_id ?? null,
        })
        .select("id, name, email")
        .single();
      if (leadErr) throw leadErr;
      lead = created;
    } else {
      // Patch missing fields, append tags
      const patch: Record<string, unknown> = {};
      if (name && !lead.name) patch.name = name;
      if (email && !lead.email) patch.email = email;
      if (Array.isArray(tags) && tags.length) {
        // append unique tags
        const { data: cur } = await supabase
          .from("leads").select("tags").eq("id", lead.id).single();
        const merged = Array.from(new Set([...(cur?.tags ?? []), ...tags]));
        patch.tags = merged;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("leads").update(patch).eq("id", lead.id);
      }
    }

    // 3. Cooldown check
    const cutoff = new Date(Date.now() - seq.cooldown_days * 86400_000).toISOString();
    const { data: recent } = await supabase
      .from("message_sequence_enrollments")
      .select("id")
      .eq("sequence_id", seq.id)
      .eq("lead_id", lead.id)
      .gt("started_at", cutoff)
      .maybeSingle();
    if (recent) {
      return json({ ok: true, lead_id: lead.id, enrollment_id: recent.id, deduped: true });
    }

    // 4. Create enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from("message_sequence_enrollments")
      .insert({
        clinic_id: seq.clinic_id,
        sequence_id: seq.id,
        lead_id: lead.id,
        status: "active",
        current_step: 0,
        next_run_at: new Date().toISOString(),
        source: { trigger: "webhook", metadata: metadata ?? null },
      })
      .select("id")
      .single();
    if (enrollErr) throw enrollErr;

    return json({ ok: true, lead_id: lead.id, enrollment_id: enrollment.id });
  } catch (e) {
    console.error("sequence-trigger error", e);
    return json({ error: String(e) }, 500);
  }
});
