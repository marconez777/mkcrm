// supabase/functions/_shared/pipeline-allowlist.ts
//
// Gate global: as automações de pipeline (Marcos 1-4) só rodam para clínicas
// presentes em `pipeline_automation_allowlist` com `enabled=true`.
//
// Uso:
//   if (!(await isClinicPipelineAllowed(client, clinicId))) {
//     return { skipped: "clinic_not_allowlisted" };
//   }

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cache = new Map<string, { value: boolean; ts: number }>();
const TTL_MS = 30_000;

export async function isClinicPipelineAllowed(
  client: SupabaseClient,
  clinicId: string | null | undefined,
): Promise<boolean> {
  if (!clinicId) return false;
  const cached = cache.get(clinicId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;
  const { data } = await client
    .from("pipeline_automation_allowlist")
    .select("enabled")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const value = !!data?.enabled;
  cache.set(clinicId, { value, ts: Date.now() });
  return value;
}

export function clearAllowlistCache() {
  cache.clear();
}
