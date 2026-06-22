import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeadOption = { id: string; name: string };

export function useLeadSearch(pipelineId: string | null, query: string) {
  const [results, setResults] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pipelineId) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      let q = supabase
        .from("leads")
        .select("id, name")
        .eq("pipeline_id", pipelineId)
        .order("name", { ascending: true })
        .limit(20);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data } = await q;
      if (cancelled) return;
      setResults(
        ((data as { id: string; name: string | null }[] | null) ?? []).map((r) => ({
          id: r.id,
          name: r.name ?? "(sem nome)",
        })),
      );
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pipelineId, query]);

  return { results, loading };
}
