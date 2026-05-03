import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE = "Zappy CRM";

export function useUnreadTitle() {
  useEffect(() => {
    let total = 0;
    const apply = () => {
      document.title = total > 0 ? `(${total}) ${BASE}` : BASE;
    };
    const load = async () => {
      const { data } = await supabase.from("leads").select("unread_count");
      total = (data ?? []).reduce((s: number, r: any) => s + (r.unread_count ?? 0), 0);
      apply();
    };
    load();
    const ch = supabase
      .channel(`unread-title-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); document.title = BASE; };
  }, []);
}

export function playPing() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {}
}
