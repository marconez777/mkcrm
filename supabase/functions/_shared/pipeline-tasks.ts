// supabase/functions/_shared/pipeline-tasks.ts
//
// Marco 3 — Tarefas geradas a partir de classificações:
//  - runNfTask: intent='nf_reembolso' + stage="Consulta finalizada" → lead_task "Emitir NF".
//  - runPaymentAlleged: intent='pagamento_alegado' (sem webhook) → tag + custom_field + task.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isClinicPipelineAllowed } from "./pipeline-allowlist.ts";

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

/** Soma N dias úteis (pula sábado/domingo). */
function addBusinessDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay(); // 0=Sun 6=Sat
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

async function addTags(client: SupabaseClient, leadId: string, tags: string[]) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  const merged = Array.from(new Set([...current, ...tags]));
  if (merged.length === current.length) return;
  await client.from("leads").update({ tags: merged }).eq("id", leadId);
}

async function mergeCustomFields(client: SupabaseClient, leadId: string, patch: Record<string, unknown>) {
  const { data } = await client.from("leads").select("custom_fields").eq("id", leadId).single();
  const current = (data?.custom_fields ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...patch };
  await client.from("leads").update({ custom_fields: merged }).eq("id", leadId);
}

async function hasOpenTaskWithPrefix(
  client: SupabaseClient,
  leadId: string,
  prefix: string,
  withinDays = 7,
): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60_000).toISOString();
  const { data } = await client
    .from("lead_tasks")
    .select("id")
    .eq("lead_id", leadId)
    .is("done_at", null)
    .ilike("title", `${prefix}%`)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export interface NfTaskInput {
  leadId: string;
  clinicId: string;
  stageName: string | null;
}

export async function runNfTask(client: SupabaseClient, input: NfTaskInput) {
  if (!(await isClinicPipelineAllowed(client, input.clinicId))) return { skipped: "clinic_not_allowlisted" };
  if (!(await isEnabled(client, "automation.nf_task.enabled"))) {
    return { skipped: "toggle_off" };
  }
  if (input.stageName !== "Consulta finalizada") {
    return { skipped: `wrong_stage:${input.stageName}` };
  }
  if (await hasOpenTaskWithPrefix(client, input.leadId, "Emitir NF")) {
    return { skipped: "duplicate_task" };
  }
  const due = addBusinessDays(new Date(), 1);
  await client.from("lead_tasks").insert({
    lead_id: input.leadId,
    clinic_id: input.clinicId,
    title: "Emitir NF (solicitada pelo lead)",
    due_at: due.toISOString(),
  });
  await mergeCustomFields(client, input.leadId, {
    data_solicitacao_nf: new Date().toISOString(),
  });
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "nf_solicitada",
    payload: { due_at: due.toISOString(), source: "auto:nf-task" },
  });
  return { ok: true, due_at: due.toISOString() };
}

export interface PaymentAllegedInput {
  leadId: string;
  clinicId: string;
}

export async function runPaymentAlleged(client: SupabaseClient, input: PaymentAllegedInput) {
  if (!(await isClinicPipelineAllowed(client, input.clinicId))) return { skipped: "clinic_not_allowlisted" };
  if (!(await isEnabled(client, "automation.payment_confirmed.enabled"))) {
    return { skipped: "toggle_off" };
  }
  if (await hasOpenTaskWithPrefix(client, input.leadId, "Confirmar pagamento alegado")) {
    return { skipped: "duplicate_task" };
  }
  await addTags(client, input.leadId, ["pagamento_alegado"]);
  await mergeCustomFields(client, input.leadId, {
    pagamento_alegado_em: new Date().toISOString(),
  });
  const due = addBusinessDays(new Date(), 1);
  await client.from("lead_tasks").insert({
    lead_id: input.leadId,
    clinic_id: input.clinicId,
    title: "Confirmar pagamento alegado pelo lead",
    due_at: due.toISOString(),
  });
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "pagamento_alegado",
    payload: { due_at: due.toISOString(), source: "auto:payment-alleged" },
  });
  return { ok: true, due_at: due.toISOString() };
}

export interface PaymentConfirmedInput {
  leadId: string;
  clinicId: string;
  amount?: number | null;
  ref?: string | null;
  source?: string;
}

/** Caminho A: webhook real de pagamento. NÃO move stage (D1). */
export async function runPaymentConfirmed(client: SupabaseClient, input: PaymentConfirmedInput) {
  if (!(await isClinicPipelineAllowed(client, input.clinicId))) return { skipped: "clinic_not_allowlisted" };
  if (!(await isEnabled(client, "automation.payment_confirmed.enabled"))) {
    return { skipped: "toggle_off" };
  }
  // Idempotência por ref.
  if (input.ref) {
    const { data: existing } = await client
      .from("lead_events")
      .select("id")
      .eq("lead_id", input.leadId)
      .eq("type", "auto:payment-confirmed")
      .contains("payload", { ref: input.ref })
      .limit(1)
      .maybeSingle();
    if (existing) return { skipped: "duplicate_ref" };
  }
  await mergeCustomFields(client, input.leadId, { status_financeiro: "pago" });
  // Remove tag "pagamento_alegado" se houver (foi promovida para pago).
  const { data: lead } = await client.from("leads").select("tags").eq("id", input.leadId).single();
  const tags: string[] = lead?.tags ?? [];
  if (tags.includes("pagamento_alegado")) {
    await client
      .from("leads")
      .update({ tags: tags.filter((t) => t !== "pagamento_alegado") })
      .eq("id", input.leadId);
  }
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "auto:payment-confirmed",
    payload: {
      amount: input.amount ?? null,
      ref: input.ref ?? null,
      source: input.source ?? "webhook",
    },
  });
  return { ok: true };
}
