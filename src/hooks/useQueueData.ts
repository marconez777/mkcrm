import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QueueSource = "sequence" | "automation" | "scheduled" | "reply";
export type QueueStatus = "pending" | "sent" | "failed" | "skipped" | "cancelled" | "success" | "error";

export type QueueRow = {
  id: string;
  source: QueueSource;
  when: string;            // ISO
  leadId: string | null;
  leadName: string | null;
  preview: string | null;
  status: QueueStatus | string;
  detail: string | null;
  refId: string;           // the underlying row id (for cancel actions)
  extra?: Record<string, any>;
};

type LeadMap = Record<string, { name: string | null; phone: string | null }>;

async function hydrateLeads(ids: string[]): Promise<LeadMap> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return {};
  const { data } = await supabase.from("leads").select("id, name, phone").in("id", uniq);
  const map: LeadMap = {};
  (data ?? []).forEach((l: any) => { map[l.id] = { name: l.name, phone: l.phone }; });
  return map;
}

/** Fila ativa: próximos envios pendentes/agendados. */
export function useUpcomingQueue() {
  return useQuery({
    queryKey: ["queue", "upcoming"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<QueueRow[]> => {
      const nowIso = new Date().toISOString();
      const [sched, replies, enrolls] = await Promise.all([
        supabase.from("scheduled_messages")
          .select("id, lead_id, content, send_at, status, created_at")
          .eq("status", "pending").order("send_at", { ascending: true }).limit(100),
        supabase.from("pending_replies")
          .select("lead_id, agent_id, run_at, status, attempts, last_error, created_at")
          .eq("status", "pending").order("run_at", { ascending: true }).limit(100),
        supabase.from("message_sequence_enrollments")
          .select("id, lead_id, sequence_id, current_step, next_run_at, status")
          .eq("status", "active").not("next_run_at", "is", null).gte("next_run_at", nowIso)
          .order("next_run_at", { ascending: true }).limit(100),
      ]);

      const leadIds = [
        ...(sched.data ?? []).map((r: any) => r.lead_id),
        ...(replies.data ?? []).map((r: any) => r.lead_id),
        ...(enrolls.data ?? []).map((r: any) => r.lead_id),
      ];
      const leads = await hydrateLeads(leadIds);

      const rows: QueueRow[] = [];
      (sched.data ?? []).forEach((r: any) => rows.push({
        id: `sched:${r.id}`, source: "scheduled", when: r.send_at, leadId: r.lead_id,
        leadName: leads[r.lead_id]?.name ?? null,
        preview: (r.content ?? "").slice(0, 80), status: r.status, detail: null, refId: r.id,
      }));
      (replies.data ?? []).forEach((r: any) => rows.push({
        id: `reply:${r.lead_id}:${r.agent_id}`, source: "reply", when: r.run_at, leadId: r.lead_id,
        leadName: leads[r.lead_id]?.name ?? null,
        preview: `Resposta IA pendente (tentativas: ${r.attempts ?? 0})`,
        status: r.status, detail: r.last_error ?? null,
        refId: `${r.lead_id}::${r.agent_id}`,
        extra: { agent_id: r.agent_id },
      }));
      (enrolls.data ?? []).forEach((r: any) => rows.push({
        id: `enroll:${r.id}`, source: "sequence", when: r.next_run_at, leadId: r.lead_id,
        leadName: leads[r.lead_id]?.name ?? null,
        preview: `Sequência — próximo passo (#${(r.current_step ?? 0) + 1})`,
        status: "pending", detail: null, refId: r.id,
        extra: { sequence_id: r.sequence_id },
      }));
      rows.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
      return rows;
    },
  });
}

/** Histórico: envios já tentados (sucesso ou falha). */
export function useHistoryQueue(opts: { failedOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["queue", "history", opts.failedOnly ? "failed" : "all"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<QueueRow[]> => {
      const failed = opts.failedOnly === true;
      const [seq, autos, sched] = await Promise.all([
        supabase.from("message_sequence_runs")
          .select("id, enrollment_id, status, message_id, detail, created_at")
          .in("status", failed ? ["failed"] : ["sent", "failed", "skipped"])
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("automation_runs")
          .select("id, automation_id, lead_id, status, detail, created_at")
          .in("status", failed ? ["error"] : ["success", "error"])
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("scheduled_messages")
          .select("id, lead_id, content, send_at, sent_at, status, last_error, created_at")
          .in("status", failed ? ["failed"] : ["sent", "failed", "cancelled"])
          .order("created_at", { ascending: false }).limit(200),
      ]);

      // hydrate lead ids: automation_runs has lead_id; sequence_runs needs enrollment lookup
      const enrollIds = Array.from(new Set((seq.data ?? []).map((r: any) => r.enrollment_id).filter(Boolean)));
      let enrollMap: Record<string, string> = {};
      if (enrollIds.length) {
        const { data: enrolls } = await supabase.from("message_sequence_enrollments")
          .select("id, lead_id").in("id", enrollIds);
        (enrolls ?? []).forEach((e: any) => { enrollMap[e.id] = e.lead_id; });
      }
      const leadIds = [
        ...(autos.data ?? []).map((r: any) => r.lead_id),
        ...(sched.data ?? []).map((r: any) => r.lead_id),
        ...Object.values(enrollMap),
      ];
      const leads = await hydrateLeads(leadIds);

      const rows: QueueRow[] = [];
      (seq.data ?? []).forEach((r: any) => {
        const leadId = enrollMap[r.enrollment_id] ?? null;
        rows.push({
          id: `seqrun:${r.id}`, source: "sequence", when: r.created_at, leadId,
          leadName: leadId ? leads[leadId]?.name ?? null : null,
          preview: "Sequência — passo executado",
          status: r.status, detail: r.detail ?? null, refId: r.id,
        });
      });
      (autos.data ?? []).forEach((r: any) => rows.push({
        id: `autorun:${r.id}`, source: "automation", when: r.created_at, leadId: r.lead_id,
        leadName: leads[r.lead_id]?.name ?? null,
        preview: "Automação executada",
        status: r.status, detail: r.detail ?? null, refId: r.id,
        extra: { automation_id: r.automation_id },
      }));
      (sched.data ?? []).forEach((r: any) => rows.push({
        id: `sched:${r.id}`, source: "scheduled",
        when: r.sent_at ?? r.send_at ?? r.created_at, leadId: r.lead_id,
        leadName: leads[r.lead_id]?.name ?? null,
        preview: (r.content ?? "").slice(0, 80),
        status: r.status, detail: r.last_error ?? null, refId: r.id,
      }));
      rows.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      return rows;
    },
  });
}

/** Resumo das últimas 24h. */
export function useQueueSummary() {
  return useQuery({
    queryKey: ["queue", "summary"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [seq, autos, sched, replies, enrolls] = await Promise.all([
        supabase.from("message_sequence_runs").select("status", { count: "exact", head: false }).gte("created_at", since),
        supabase.from("automation_runs").select("status", { count: "exact", head: false }).gte("created_at", since),
        supabase.from("scheduled_messages").select("status").gte("created_at", since),
        supabase.from("pending_replies").select("status").eq("status", "pending"),
        supabase.from("message_sequence_enrollments").select("id", { count: "exact", head: true })
          .eq("status", "active").not("next_run_at", "is", null),
      ]);
      const seqRows = (seq.data ?? []) as any[];
      const autoRows = (autos.data ?? []) as any[];
      const schedRows = (sched.data ?? []) as any[];
      const sent =
        seqRows.filter((r) => r.status === "sent").length +
        autoRows.filter((r) => r.status === "success").length +
        schedRows.filter((r) => r.status === "sent").length;
      const failed =
        seqRows.filter((r) => r.status === "failed").length +
        autoRows.filter((r) => r.status === "error").length +
        schedRows.filter((r) => r.status === "failed").length;
      const cancelled = schedRows.filter((r) => r.status === "cancelled").length;
      const queued =
        (schedRows.filter((r) => r.status === "pending").length) +
        ((replies.data ?? []).length) +
        (enrolls.count ?? 0);
      return { queued, sent, failed, cancelled };
    },
  });
}

/** Pause flag stored em clinics.settings.automations_paused. */
export function useAutomationsPaused(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ["clinic", clinicId, "automations_paused"],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("settings").eq("id", clinicId!).maybeSingle();
      return !!(data?.settings as any)?.automations_paused;
    },
  });
}

export async function setAutomationsPaused(clinicId: string, paused: boolean) {
  const { data: cur } = await supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle();
  const next = { ...((cur?.settings as any) ?? {}), automations_paused: paused };
  const { error } = await supabase.from("clinics").update({ settings: next }).eq("id", clinicId);
  if (error) throw error;
}

export async function cancelQueueRow(row: QueueRow) {
  if (row.source === "scheduled") {
    const { error } = await supabase.from("scheduled_messages")
      .update({ status: "cancelled" }).eq("id", row.refId).eq("status", "pending");
    if (error) throw error;
  } else if (row.source === "reply") {
    const [leadId, agentId] = row.refId.split("::");
    const { error } = await supabase.from("pending_replies")
      .delete().eq("lead_id", leadId).eq("agent_id", agentId).eq("status", "pending");
    if (error) throw error;
  } else if (row.source === "sequence") {
    const { error } = await supabase.from("message_sequence_enrollments")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("id", row.refId).eq("status", "active");
    if (error) throw error;
  }
}
