import { supabase } from "@/integrations/supabase/client";

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
  status: "agendado" | "realizado" | "cancelado" | "faltou" | "remarcado",
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  return { error: error?.message ?? null };
}
