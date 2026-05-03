import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HealthStatus = {
  connection_state: string | null;
  last_health_check: string | null;
  webhook_ok: boolean | null;
  webhook_last_error: string | null;
  last_poll_at: string | null;
};

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      // Aggregate health across all configured WhatsApp instances.
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("connection_state, last_health_check, webhook_ok, webhook_last_error, last_poll_at, is_default")
        .order("is_default", { ascending: false });
      if (!active) return;
      if (!data || data.length === 0) {
        setHealth(null);
        return;
      }
      // Prefer default; aggregate webhook_ok = all OK; pick latest health check.
      const def = data[0] as any;
      const allOk = data.every((d: any) => d.webhook_ok === true);
      const latest = data.reduce((acc: any, d: any) =>
        !acc?.last_health_check || (d.last_health_check && d.last_health_check > acc.last_health_check) ? d : acc,
      data[0]);
      const firstError = data.find((d: any) => d.webhook_last_error)?.webhook_last_error ?? null;
      setHealth({
        connection_state: def.connection_state,
        last_health_check: latest.last_health_check,
        webhook_ok: allOk,
        webhook_last_error: firstError,
        last_poll_at: latest.last_poll_at,
      });
    };
    load();
    const ch = supabase
      .channel(`health-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_instances" },
        load,
      )
      .subscribe();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const stale =
    health?.last_health_check &&
    Date.now() - new Date(health.last_health_check).getTime() > 3 * 60 * 1000;

  const overall: "ok" | "warn" | "down" | "unknown" =
    !health || !health.last_health_check
      ? "unknown"
      : stale || health.connection_state === "close" || !health.webhook_ok
      ? "down"
      : health.connection_state === "connecting"
      ? "warn"
      : health.connection_state === "open" && health.webhook_ok
      ? "ok"
      : "warn";

  return { health, overall, stale };
}
