import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Attendant } from "@/types/crm";

export function useAttendants() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("attendants").select("*").order("name");
      if (active && data) setAttendants(data as Attendant[]);
    };
    load();
    const ch = supabase
      .channel(`att-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendants" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);
  return { attendants };
}
