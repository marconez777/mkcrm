// supabase/functions/_shared/stage-bindings.ts
//
// Marco 4 — aplica stage_sequence_bindings ativos após mover lead de stage.
// Inscreve o lead na message_sequence vinculada (trigger='on_enter') de forma
// idempotente: 1 enrollment ativo por (lead, sequence).
// Toggle global: automation.stage_bindings.enabled

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isClinicPipelineAllowed } from "./pipeline-allowlist.ts";

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

export async function applyStageBindings(
  client: SupabaseClient,
  leadId: string,
  clinicId: string,
  toStageId: string,
): Promise<{ enrolled: string[]; skipped: string }> {
  if (!(await isClinicPipelineAllowed(client, clinicId))) {
    return { enrolled: [], skipped: "clinic_not_allowlisted" };
  }
  if (!(await isEnabled(client, "automation.stage_bindings.enabled"))) {
    return { enrolled: [], skipped: "toggle_off" };
  }
  const { data: bindings } = await client
    .from("stage_sequence_bindings")
    .select("id, sequence_id")
    .eq("stage_id", toStageId)
    .eq("clinic_id", clinicId)
    .eq("trigger", "on_enter")
    .eq("enabled", true);
  if (!bindings || bindings.length === 0) return { enrolled: [], skipped: "no_bindings" };

  const enrolled: string[] = [];
  for (const b of bindings) {
    const { data: existing } = await client
      .from("message_sequence_enrollments")
      .select("id, status")
      .eq("lead_id", leadId)
      .eq("sequence_id", b.sequence_id)
      .in("status", ["active", "scheduled"])
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    const { error } = await client.from("message_sequence_enrollments").insert({
      clinic_id: clinicId,
      sequence_id: b.sequence_id,
      lead_id: leadId,
      status: "active",
      current_step: 0,
      next_run_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      source: { auto: "stage_bindings", binding_id: b.id, stage_id: toStageId },
    });
    if (!error) enrolled.push(b.sequence_id);
  }
  if (enrolled.length > 0) {
    await client.from("lead_events").insert({
      clinic_id: clinicId,
      lead_id: leadId,
      type: "auto:stage-bindings",
      payload: { stage_id: toStageId, sequences: enrolled },
    });
  }
  return { enrolled, skipped: enrolled.length ? "" : "all_already_enrolled" };
}
