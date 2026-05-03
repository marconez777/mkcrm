import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Stage, Lead } from "@/types/crm";

/**
 * Generic incremental realtime list hook.
 * Loads once, then patches state on INSERT/UPDATE/DELETE — no full refetch.
 * Skips setState when an UPDATE doesn't actually change anything (avoids re-render storms).
 */
function useRealtimeList<T extends { id: string }>(
  table: "pipeline_stages" | "leads",
  orderBy: keyof T & string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const sortFn = (a: any, b: any) => {
      const av = a[orderBy], bv = b[orderBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    };

    (async () => {
      const { data } = await supabase.from(table).select("*").order(orderBy as string);
      if (!active) return;
      setItems(((data ?? []) as unknown as T[]).slice().sort(sortFn));
      setLoaded(true);
    })();

    const ch = supabase
      .channel(`${table}-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, (payload) => {
        const row = payload.new as T;
        setItems((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row].sort(sortFn)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, (payload) => {
        const row = payload.new as T;
        setItems((prev) => {
          const idx = prev.findIndex((x) => x.id === row.id);
          if (idx === -1) return [...prev, row].sort(sortFn);
          const cur = prev[idx] as any;
          let changed = false;
          for (const k in row) {
            if ((row as any)[k] !== cur[k]) { changed = true; break; }
          }
          if (!changed) return prev;
          const copy = prev.slice();
          copy[idx] = { ...cur, ...row };
          // Only re-sort if the sort key actually changed
          if ((row as any)[orderBy] !== cur[orderBy]) copy.sort(sortFn);
          return copy;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
        const old = payload.old as T;
        setItems((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [table, orderBy]);

  return { items, setItems, loaded };
}

export function useStages() {
  const { items, setItems, loaded } = useRealtimeList<Stage>("pipeline_stages", "position");
  return { stages: items, setStages: setItems, loaded };
}

export function useLeads() {
  const { items, setItems, loaded } = useRealtimeList<Lead>("leads", "position");
  return { leads: items, setLeads: setItems, loaded };
}
