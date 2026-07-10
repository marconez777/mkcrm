// supabase/functions/_template_pipeline_classify/apply.ts
// ============================================================================
// Aplica a Classificação: move card + aplica tags + escreve custom_fields.
// TODA movimentação passa por `pipelineMove()` (nunca UPDATE direto).
//
// Em modo dry_run: pula `pipelineMove`, mas ainda escreve telemetria com
// `dry_run: true` no `pipeline_run_items.result`.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { pipelineMove } from "../_shared/pipeline-move.ts";
import { getTenantSettingJSON } from "../_shared/app-settings.ts"; // G2 (a criar)
import type { Classification } from "./schema.ts";

type Lead = { id: string; clinic_id: string; pipeline_id: string | null };

interface ApplyInput {
  lead: Lead;
  classification: Classification;
  dryRun: boolean;
  tenantSlug: string;
}

/**
 * Mapeamento intent → nome canônico do estágio.
 * PERSONALIZE por tenant conforme o Kanban do cliente.
 */
const INTENT_TO_STAGE: Record<string, string | null> = {
  qualificado:        "Qualificado",
  quer_agendar:       "Agendamento pendente",
  perdeu_interesse:   "Nutrição inativa",
  indefinido:         null, // sem move
};

async function resolveStageId(
  client: SupabaseClient,
  clinicId: string,
  pipelineId: string,
  stageName: string,
): Promise<string | null> {
  const { data } = await client
    .from("pipeline_stages")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("pipeline_id", pipelineId)
    .eq("name", stageName)
    .maybeSingle();
  return data?.id ?? null;
}

async function getAllowedTags(client: SupabaseClient, slug: string): Promise<Set<string>> {
  const raw = await getTenantSettingJSON<string[]>(client, slug, "allowed_tags");
  return new Set((raw ?? []).map(String));
}

export async function applyClassification(
  client: SupabaseClient,
  input: ApplyInput,
): Promise<{ moved: boolean; reason?: string; tagsApplied: string[]; tagsDropped: string[] }> {
  const { lead, classification, dryRun, tenantSlug } = input;

  // Whitelist de tags (nunca aceita tag fora da lista).
  const allowed = await getAllowedTags(client, tenantSlug);
  const tagsApplied: string[] = [];
  const tagsDropped: string[] = [];
  for (const t of classification.tags_suggested ?? []) {
    if (allowed.has(t)) tagsApplied.push(t);
    else tagsDropped.push(t);
  }

  // Aplica tags (se não for dry_run).
  if (!dryRun && tagsApplied.length && lead.pipeline_id) {
    const { data: cur } = await client
      .from("leads").select("tags").eq("id", lead.id).maybeSingle();
    const merged = Array.from(new Set([...(cur?.tags ?? []), ...tagsApplied]));
    await client.from("leads").update({ tags: merged }).eq("id", lead.id);
  }

  // Mapeia intent → estágio.
  const targetStageName = INTENT_TO_STAGE[classification.intent];
  if (!targetStageName || !lead.pipeline_id) {
    return { moved: false, reason: "no_stage_for_intent", tagsApplied, tagsDropped };
  }

  const toStageId = await resolveStageId(
    client, lead.clinic_id, lead.pipeline_id, targetStageName,
  );
  if (!toStageId) {
    return { moved: false, reason: `stage_not_found:${targetStageName}`, tagsApplied, tagsDropped };
  }

  // G9 — dry_run: não move, só simula.
  if (dryRun) {
    return { moved: false, reason: "dry_run", tagsApplied, tagsDropped };
  }

  const result = await pipelineMove(client, {
    leadId: lead.id,
    toStageId,
    source: `auto:classifier-${tenantSlug}` as `auto:${string}`,
    reason: `IA detectou intenção: ${classification.intent}`,
    idempotencyKey: `${tenantSlug}:${lead.id}:${classification.intent}:${Date.now()}`,
  });

  return {
    moved: result.moved,
    reason: result.moved ? undefined : (result as { reason: string }).reason,
    tagsApplied,
    tagsDropped,
  };
}
