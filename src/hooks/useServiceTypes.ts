import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceKind = "consulta" | "procedimento" | "retorno";

export type ServiceType = {
  id: string;
  clinic_id: string;
  kind: ServiceKind;
  slug: string;
  label: string;
  color_hex: string;
  default_duration_min: number;
  active: boolean;
  position: number;
};

export function useServiceTypes() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("appointment_service_types")
        .select("*")
        .eq("active", true)
        .order("kind", { ascending: true })
        .order("position", { ascending: true });
      if (!active) return;
      setTypes((data as ServiceType[] | null) ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`ast-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_service_types" },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  return { types, loading };
}
