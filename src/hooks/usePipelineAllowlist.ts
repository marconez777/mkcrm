import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Indica se a clínica ativa está autorizada a executar o agente de pipeline
 * (Marcos 1-4). Enquanto não validamos com mais clínicas, só a Clínica ÓR.
 */
export function usePipelineAllowlist(): { enabled: boolean; loading: boolean; clinicId: string | null } {
  const { membership } = useAuth();
  const clinicId = membership?.clinic?.id ?? null;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!clinicId) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("pipeline_automation_allowlist")
      .select("enabled")
      .eq("clinic_id", clinicId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setEnabled(!!data?.enabled);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clinicId]);

  return { enabled, loading, clinicId };
}
