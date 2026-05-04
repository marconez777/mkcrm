import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline } from "@/types/crm";

const STORAGE_KEY = "pipeline:current";
const EVENT = "pipeline-changed";

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("pipelines").select("*").order("position");
      if (!active) return;
      const list = (data ?? []) as Pipeline[];
      setPipelines(list);
      setLoaded(true);
      setCurrentIdState((cur) => {
        if (cur && list.some((p) => p.id === cur)) return cur;
        const def = list.find((p) => p.is_default) ?? list[0];
        return def?.id ?? null;
      });
    })();

    const ch = supabase
      .channel(`pipelines-rt`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipelines" }, async () => {
        const { data } = await supabase.from("pipelines").select("*").order("position");
        setPipelines((data ?? []) as Pipeline[]);
      })
      .subscribe();

    const onSync = (e: Event) => {
      const id = (e as CustomEvent<string | null>).detail;
      setCurrentIdState(id);
    };
    window.addEventListener(EVENT, onSync as EventListener);

    return () => { active = false; supabase.removeChannel(ch); window.removeEventListener(EVENT, onSync as EventListener); };
  }, []);

  const setCurrentId = useCallback((id: string | null) => {
    try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch {}
    setCurrentIdState(id);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
  }, []);

  const current = pipelines.find((p) => p.id === currentId) ?? null;
  return { pipelines, current, currentId, setCurrentId, loaded };
}
