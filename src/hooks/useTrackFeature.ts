import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Evt = { feature: string; action: string; entity_id?: string; metadata?: Record<string, any> };

let queue: Evt[] = [];
let timer: any = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  supabase.functions.invoke("track-event", { body: { events: batch } }).catch(() => {
    // best-effort; descarta em caso de falha
  });
}

function enqueue(e: Evt) {
  queue.push(e);
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 2000);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => flush());
}

/** Dispara um evento de uso de feature. Batch + debounce 2s. */
export function trackFeature(feature: string, action: string, opts?: { entity_id?: string; metadata?: Record<string, any> }) {
  enqueue({ feature, action, ...opts });
}

/** Hook que registra uma única vez ao montar (ex: visualização de página). */
export function useTrackFeature(feature: string, action: string, opts?: { entity_id?: string; metadata?: Record<string, any>; deps?: any[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    trackFeature(feature, action, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, opts?.deps ?? []);
}
