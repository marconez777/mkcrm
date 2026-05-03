import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Stage, Lead } from "@/types/crm";

export function useStages() {
  const [stages, setStages] = useState<Stage[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("pipeline_stages").select("*").order("position");
      if (active && data) setStages(data as Stage[]);
    };
    load();
    const ch = supabase.channel(`stages-rt-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages" }, load).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);
  return { stages, setStages };
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("leads").select("*").order("position");
      if (active && data) setLeads(data as Lead[]);
    };
    load();
    const ch = supabase.channel(`leads-rt-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "leads" }, load).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);
  return { leads, setLeads };
}
