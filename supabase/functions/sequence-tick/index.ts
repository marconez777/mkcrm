// Cron tick: processes due message_sequence_enrollments.
// Runs every minute via pg_cron.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

function renderVars(text: string, lead: any): string {
  const name = lead?.name || lead?.phone || "";
  const first = String(name).split(" ")[0] || "";
  return text
    .split("{{nome}}").join(name)
    .split("{{primeiro_nome}}").join(first)
    .split("{{telefone}}").join(lead?.phone ?? "")
    .split("{{email}}").join(lead?.email ?? "")
    .split("{{empresa}}").join(lead?.company ?? "");
}

function inSendWindow(window: any): boolean {
  if (!window || typeof window !== "object") return true;
  const tz = window.timezone || "America/Sao_Paulo";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "numeric", hour12: false, minute: "numeric",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  const weekday = String(parts.weekday).toLowerCase(); // mon,tue,...
  const startH = Number(window.start_hour ?? 0);
  const endH = Number(window.end_hour ?? 24);
  if (hour < startH || hour >= endH) return false;
  if (Array.isArray(window.weekdays) && window.weekdays.length > 0) {
    if (!window.weekdays.includes(weekday)) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();

  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await supabase
      .from("message_sequence_enrollments")
      .select("id, clinic_id, sequence_id, lead_id, current_step")
      .eq("status", "active")
      .lte("next_run_at", nowIso)
      .limit(50);

    let processed = 0, sent = 0, failed = 0, skipped = 0;
    for (const e of due ?? []) {
      processed++;
      try {
        // Load sequence + steps + lead
        const [{ data: seq }, { data: steps }, { data: lead }] = await Promise.all([
          supabase.from("message_sequences").select("id, enabled, whatsapp_instance_id, stop_on_reply").eq("id", e.sequence_id).single(),
          supabase.from("message_sequence_steps").select("*").eq("sequence_id", e.sequence_id).order("position"),
          supabase.from("leads").select("id, phone, name, email, company").eq("id", e.lead_id).single(),
        ]);

        if (!seq?.enabled) {
          await supabase.from("message_sequence_enrollments")
            .update({ status: "canceled", ended_at: nowIso }).eq("id", e.id);
          skipped++; continue;
        }
        if (!lead) {
          await supabase.from("message_sequence_enrollments")
            .update({ status: "failed", ended_at: nowIso }).eq("id", e.id);
          failed++; continue;
        }

        const stepIdx = e.current_step ?? 0;
        const step = (steps ?? [])[stepIdx];
        if (!step) {
          // No more steps → completed
          await supabase.from("message_sequence_enrollments")
            .update({ status: "completed", ended_at: nowIso, next_run_at: null }).eq("id", e.id);
          continue;
        }

        // Send window: if outside, push 30 min and try again
        if (!inSendWindow(step.send_window)) {
          await supabase.from("message_sequence_enrollments")
            .update({ next_run_at: new Date(Date.now() + 30 * 60_000).toISOString() })
            .eq("id", e.id);
          skipped++; continue;
        }

        // Resolve content (template or inline)
        let text: string | null = step.content ?? null;
        if (step.template_id) {
          const { data: tpl } = await supabase
            .from("message_templates").select("content").eq("id", step.template_id).maybeSingle();
          text = tpl?.content ?? text;
        }
        if (!text?.trim()) {
          await supabase.from("message_sequence_runs").insert({
            clinic_id: e.clinic_id, enrollment_id: e.id, step_id: step.id,
            status: "skipped", detail: "empty content",
          });
          // Advance step
          await supabase.from("message_sequence_enrollments")
            .update({ current_step: stepIdx + 1, next_run_at: nowIso }).eq("id", e.id);
          skipped++; continue;
        }

        const rendered = renderVars(text, lead);

        // Override lead's instance for this sequence if configured
        if (seq.whatsapp_instance_id && lead.phone) {
          // Temporarily set lead's instance so evolution-send picks it
          await supabase.from("leads").update({ whatsapp_instance_id: seq.whatsapp_instance_id })
            .eq("id", lead.id).is("whatsapp_instance_id", null);
        }

        const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          },
          body: JSON.stringify({
            lead_id: lead.id,
            text: rendered,
            client_message_id: crypto.randomUUID(),
            // Pass sequence's instance override (evolution-send uses lead's first; we patched above)
          }),
        });
        const sendData = await sendResp.json().catch(() => ({}));

        if (sendResp.ok) {
          await supabase.from("message_sequence_runs").insert({
            clinic_id: e.clinic_id, enrollment_id: e.id, step_id: step.id,
            status: "sent", detail: rendered.slice(0, 200),
          });
          // Schedule next step
          const nextStep = (steps ?? [])[stepIdx + 1];
          if (nextStep) {
            const delay = (nextStep.delay_minutes ?? 0) * 60_000;
            await supabase.from("message_sequence_enrollments").update({
              current_step: stepIdx + 1,
              next_run_at: new Date(Date.now() + delay).toISOString(),
            }).eq("id", e.id);
          } else {
            await supabase.from("message_sequence_enrollments").update({
              current_step: stepIdx + 1, status: "completed",
              ended_at: new Date().toISOString(), next_run_at: null,
            }).eq("id", e.id);
          }
          sent++;
        } else {
          await supabase.from("message_sequence_runs").insert({
            clinic_id: e.clinic_id, enrollment_id: e.id, step_id: step.id,
            status: "failed", detail: `${sendResp.status}: ${JSON.stringify(sendData).slice(0, 200)}`,
          });
          // Retry in 15min, max 3 retries (track via runs count for this step)
          const { count } = await supabase.from("message_sequence_runs")
            .select("*", { count: "exact", head: true })
            .eq("enrollment_id", e.id).eq("step_id", step.id).eq("status", "failed");
          if ((count ?? 0) >= 3) {
            await supabase.from("message_sequence_enrollments").update({
              status: "failed", ended_at: new Date().toISOString(),
            }).eq("id", e.id);
          } else {
            await supabase.from("message_sequence_enrollments").update({
              next_run_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            }).eq("id", e.id);
          }
          failed++;
        }
      } catch (err) {
        console.error("enrollment error", e.id, err);
        failed++;
      }
    }

    return json({ ok: true, processed, sent, failed, skipped });
  } catch (err) {
    console.error("sequence-tick error", err);
    return json({ error: String(err) }, 500);
  }
});
