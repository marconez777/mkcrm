import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceType } from "./useServiceTypes";

export type AppointmentStatus =
  | "agendado"
  | "realizado"
  | "cancelado"
  | "faltou"
  | "remarcado";

export type AppointmentKind = "consulta" | "procedimento" | "retorno";

export type AppointmentRow = {
  id: string;
  clinic_id: string;
  lead_id: string;
  kind: AppointmentKind;
  service_type_id: string | null;
  scheduled_at: string;
  duration_min: number;
  status: AppointmentStatus;
  notes: string | null;
  lead_name: string | null;
  lead_stage_id: string | null;
};

type RawJoined = Omit<AppointmentRow, "lead_name" | "lead_stage_id"> & {
  leads: { id: string; name: string | null; stage_id: string | null; pipeline_id: string | null } | null;
};

export function useAppointments(opts: {
  pipelineId: string | null;
  from: Date;
  to: Date;
}) {
  const { pipelineId, from, to } = opts;
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<number | null>(null);

  const fromIso = useMemo(() => from.toISOString(), [from]);
  const toIso = useMemo(() => to.toISOString(), [to]);

  const load = useCallback(async () => {
    if (!pipelineId) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, clinic_id, lead_id, kind, service_type_id, scheduled_at, duration_min, status, notes, leads!inner(id, name, stage_id, pipeline_id)",
      )
      .gte("scheduled_at", fromIso)
      .lt("scheduled_at", toIso)
      .eq("leads.pipeline_id", pipelineId)
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("useAppointments load failed", error.message);
      setAppointments([]);
      setLoading(false);
      return;
    }

    const rows: AppointmentRow[] = ((data as unknown as RawJoined[]) ?? []).map((r) => ({
      id: r.id,
      clinic_id: r.clinic_id,
      lead_id: r.lead_id,
      kind: r.kind,
      service_type_id: r.service_type_id,
      scheduled_at: r.scheduled_at,
      duration_min: r.duration_min,
      status: r.status,
      notes: r.notes,
      lead_name: r.leads?.name ?? null,
      lead_stage_id: r.leads?.stage_id ?? null,
    }));
    setAppointments(rows);
    setLoading(false);
  }, [pipelineId, fromIso, toIso]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!pipelineId) return;
    const scheduleReload = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(load, 200);
    };
    const ch = supabase
      .channel(`appt-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [pipelineId, load]);

  return { appointments, loading, refetch: load };
}

// ---------------- helpers ----------------

const STATUS_OPACITY: Record<AppointmentStatus, number> = {
  agendado: 1,
  realizado: 0.6,
  cancelado: 0.35,
  faltou: 0.35,
  remarcado: 0.5,
};

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    leadId: string;
    status: AppointmentStatus;
    serviceTypeId: string | null;
    kind: AppointmentKind;
  };
};

export function appointmentToEvent(
  a: AppointmentRow,
  types: ServiceType[],
): CalendarEvent {
  const st = types.find((t) => t.id === a.service_type_id);
  const baseColor = st?.color_hex ?? "#3b82f6";
  const label = st?.label ?? a.kind;
  const start = new Date(a.scheduled_at);
  const end = new Date(start.getTime() + a.duration_min * 60_000);
  const alpha = STATUS_OPACITY[a.status] ?? 1;
  return {
    id: a.id,
    title: `${a.lead_name ?? "Lead"} — ${label}`,
    start: start.toISOString(),
    end: end.toISOString(),
    backgroundColor: hexWithAlpha(baseColor, alpha),
    borderColor: baseColor,
    extendedProps: {
      leadId: a.lead_id,
      status: a.status,
      serviceTypeId: a.service_type_id,
      kind: a.kind,
    },
  };
}
