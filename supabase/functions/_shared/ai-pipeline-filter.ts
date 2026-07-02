// supabase/functions/_shared/ai-pipeline-filter.ts
//
// Consome `clinics.settings.ai_target_pipeline_ids` (jsonb array de UUIDs).
// Se a lista existir e NÃO contiver o `pipeline_id` do lead, a IA/automação
// não deve agir. Lista vazia ou ausente => permite todos (default).
//
// Uso:
//   if (!(await isAiAllowedForPipeline(client, clinicId, pipelineId))) {
//     return { skipped: "pipeline_not_in_ai_targets" };
//   }

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Entry = { ids: string[] | null; ts: number };
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

async function loadTargets(
  client: SupabaseClient,
  clinicId: string,
): Promise<string[] | null> {
  const cached = cache.get(clinicId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.ids;
  const { data } = await client
    .from("clinics")
    .select("settings")
    .eq("id", clinicId)
    .maybeSingle();
  const settings = ((data as { settings?: unknown } | null)?.settings ?? {}) as Record<string, unknown>;
  const raw = settings.ai_target_pipeline_ids;
  const ids = Array.isArray(raw) ? (raw.filter((x) => typeof x === "string") as string[]) : null;
  cache.set(clinicId, { ids, ts: Date.now() });
  return ids;
}

export async function isAiAllowedForPipeline(
  client: SupabaseClient,
  clinicId: string | null | undefined,
  pipelineId: string | null | undefined,
): Promise<boolean> {
  if (!clinicId || !pipelineId) return true; // sem dados suficientes — não bloqueia
  const ids = await loadTargets(client, clinicId);
  if (!ids || ids.length === 0) return true; // lista vazia = todos os pipelines
  return ids.includes(pipelineId);
}

export async function getAiTargetPipelineIds(
  client: SupabaseClient,
  clinicId: string,
): Promise<string[] | null> {
  return loadTargets(client, clinicId);
}

export function clearAiPipelineFilterCache() {
  cache.clear();
}
