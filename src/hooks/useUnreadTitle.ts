import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE = "Zappy CRM";

export function useUnreadTitle() {
  const totalRef = useRef(0);

  useEffect(() => {
    const apply = () => {
      document.title = totalRef.current > 0 ? `(${totalRef.current}) ${BASE}` : BASE;
    };

    let active = true;
    (async () => {
      const { data } = await supabase.from("leads").select("unread_count");
      if (!active) return;
      totalRef.current = (data ?? []).reduce(
        (s: number, r: any) => s + (r.unread_count ?? 0),
        0,
      );
      apply();
    })();

    const ch = supabase
      .channel(`unread-title-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => {
        totalRef.current += (p.new as any).unread_count ?? 0;
        apply();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (p) => {
        const newU = (p.new as any).unread_count ?? 0;
        const oldU = (p.old as any)?.unread_count ?? 0;
        if (newU === oldU) return;
        totalRef.current += newU - oldU;
        if (totalRef.current < 0) totalRef.current = 0;
        apply();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (p) => {
        totalRef.current -= (p.old as any)?.unread_count ?? 0;
        if (totalRef.current < 0) totalRef.current = 0;
        apply();
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); document.title = BASE; };
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
