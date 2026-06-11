import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Attendant } from "@/types/crm";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

/**
 * Returns the full clinic team as Attendant[] (one per clinic_member).
 * Auto-creates an `attendants` row for any clinic_member that doesn't have one,
 * so that task_assignees (FK -> attendants) can reference every clinic user.
 * Also includes any legacy attendants without a linked member.
 */
export function useClinicTeam() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: cms } = await supabase
        .from("clinic_members")
        .select("user_id, attendant_id, clinic_id");
      const { data: atts } = await supabase.from("attendants").select("*");
      if (!active) return;

      const userIds = (cms ?? []).map((c) => c.user_id);
      let profilesById = new Map<string, { full_name: string | null; email: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        (profs ?? []).forEach((p: any) => profilesById.set(p.user_id, p));
      }

      const attMap = new Map((atts ?? []).map((a: any) => [a.id, a as Attendant]));
      const result: Attendant[] = [];

      for (const cm of cms ?? []) {
        const prof = profilesById.get(cm.user_id);
        const name = (prof?.full_name || prof?.email || "Usuário").trim();
        let att = cm.attendant_id ? attMap.get(cm.attendant_id) : undefined;
        if (!att) {
          const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
          const { data: created } = await supabase
            .from("attendants")
            .insert({ name, color, clinic_id: cm.clinic_id })
            .select("*")
            .single();
          if (created) {
            await supabase
              .from("clinic_members")
              .update({ attendant_id: (created as any).id })
              .eq("user_id", cm.user_id)
              .eq("clinic_id", cm.clinic_id);
            att = created as Attendant;
            attMap.set(att.id, att);
          }
        }
        if (att) result.push(att);
      }

      // include any legacy attendants not linked to a clinic_member
      for (const a of attMap.values()) {
        if (!result.find((r) => r.id === a.id)) result.push(a);
      }

      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      if (active) setAttendants(result);
    }

    load();
    const ch = supabase
      .channel(`team-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendants" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinic_members" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  return { attendants };
}
