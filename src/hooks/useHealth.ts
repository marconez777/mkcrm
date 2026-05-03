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
      const { data } = await supabase
        .from("settings")
        .select("connection_state, last_health_check, webhook_ok, webhook_last_error, last_poll_at")
        .eq("id", 1)
        .single();
      if (active && data) setHealth(data as HealthStatus);
    };
    load();
    const ch = supabase
      .channel(`health-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "settings" },
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
