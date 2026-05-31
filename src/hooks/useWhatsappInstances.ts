import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WhatsappInstance = {
  id: string;
  name: string;
  evolution_instance: string;
  connection_state: string | null;
  is_default: boolean;
  webhook_ok: boolean | null;
  last_health_check: string | null;
};

export function useWhatsappInstances() {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, name, evolution_instance, connection_state, is_default, webhook_ok, last_health_check")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (!active) return;
      setInstances((data ?? []) as WhatsappInstance[]);
      setLoaded(true);
    };
    load();
    const ch = supabase
      .channel(`wa-inst-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_instances" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const defaultInstance = instances.find((i) => i.is_default) ?? instances[0] ?? null;
  return { instances, defaultInstance, loaded };
}
