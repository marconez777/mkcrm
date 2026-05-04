import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const tried = new Set<string>();

/** Fetches the WhatsApp profile picture for a lead in background once per session. */
export function useWaAvatar(leadId: string | undefined, currentUrl: string | null | undefined) {
  const ranRef = useRef(false);
  useEffect(() => {
    if (!leadId) return;
    if (currentUrl) return;
    if (tried.has(leadId)) return;
    if (ranRef.current) return;
    ranRef.current = true;
    tried.add(leadId);
    const t = setTimeout(() => {
      supabase.functions.invoke("fetch-wa-avatar", { body: { lead_id: leadId } }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [leadId, currentUrl]);
}
