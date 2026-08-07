import { supabase } from "@/integrations/supabase/client";
import type { AppointmentKind, AppointmentStatus } from "@/hooks/useAppointments";

export async function updateAppointmentSchedule(
  id: string,
  scheduled_at: Date,
  duration_min?: number,
): Promise<{ error: string | null }> {
  const payload: { scheduled_at: string; duration_min?: number } = {
    scheduled_at: scheduled_at.toISOString(),
  };
  if (duration_min !== undefined) payload.duration_min = duration_min;
  const { error } = await supabase.from("appointments").update(payload).eq("id", id);
  return { error: error?.message ?? null };
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  return { error: error?.message ?? null };
}

export type AppointmentPatch = {
  kind?: AppointmentKind;
  service_type_id?: string | null;
  scheduled_at?: Date;
  duration_min?: number;
  notes?: string | null;
};

export async function updateAppointment(
  id: string,
  patch: AppointmentPatch,
): Promise<{ error: string | null }> {
  const payload: {
    kind?: AppointmentKind;
    service_type_id?: string | null;
    scheduled_at?: string;
    duration_min?: number;
    notes?: string | null;
  } = {};
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.service_type_id !== undefined) payload.service_type_id = patch.service_type_id;
  if (patch.scheduled_at !== undefined) payload.scheduled_at = patch.scheduled_at.toISOString();
  if (patch.duration_min !== undefined) payload.duration_min = patch.duration_min;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  const { error } = await supabase.from("appointments").update(payload).eq("id", id);
  return { error: error?.message ?? null };
}

export type CreateAppointmentInput = {
  lead_id: string;
  kind: AppointmentKind;
  service_type_id: string | null;
  scheduled_at: Date;
  duration_min: number;
  notes: string | null;
};

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("clinic_id")
    .eq("id", input.lead_id)
    .maybeSingle();
  if (leadErr || !lead?.clinic_id) {
    return { id: null, error: leadErr?.message ?? "Lead não encontrado" };
  }
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: lead.clinic_id,
      lead_id: input.lead_id,
      kind: input.kind,
      service_type_id: input.service_type_id,
      scheduled_at: input.scheduled_at.toISOString(),
      duration_min: input.duration_min,
      notes: input.notes,
      status: "agendado",
    })
    .select("id")
    .maybeSingle();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function deleteAppointment(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  return { error: error?.message ?? null };
}
