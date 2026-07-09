// supabase/functions/pipeline-classify-febracis/apply.ts

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { LeadContext } from "../pipeline-classify/context.ts";
import { executePipelineMove } from "../_shared/pipeline-move.ts";
import type { FebracisIntentOutput } from "./agent.ts";
import { insertTags } from "../pipeline-classify/apply.ts";

export async function updateWatermarkFebracis(
  client: SupabaseClient,
  leadId: string,
  lastMessageId: string,
  newSummary: string
) {
  const { error } = await client
    .from("leads")
    .update({
      last_processed_message_id_classifier: lastMessageId,
      ai_summary: newSummary,
      needs_ai_review: false,
      ai_review_reasons: [],
      ai_review_queued_at: null,
      ai_review_fail_count: 0,
    })
    .eq("id", leadId);

  if (error) {
    console.error("Failed to update watermark and summary", leadId, error);
  }
}

export async function clearQueueFlagFebracis(client: SupabaseClient, leadId: string) {
  await client
    .from("leads")
    .update({
      needs_ai_review: false,
      ai_review_reasons: [],
      ai_review_queued_at: null,
      ai_review_fail_count: 0,
    })
    .eq("id", leadId);
}

export async function writeSkipTelemetryFebracis(
  client: SupabaseClient,
  leadId: string,
  reason: string
) {
  const { error } = await client.from("pipeline_run_items").insert({
    lead_id: leadId,
    run_type: "classifier",
    status: "skipped",
    skipped_reason: reason,
  });
  if (error) {
    console.error("Failed to write skip telemetry", leadId, error);
  }
}

/** Resolve ID da coluna (stage) no banco baseando-se no nome da coluna (ex: Comprando). */
async function getStageIdByName(
  client: SupabaseClient,
  pipelineId: string,
  stageName: string
): Promise<string | null> {
  const { data, error } = await client
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .ilike("name", stageName)
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function applyFebracisClassification(
  client: SupabaseClient,
  ctx: LeadContext,
  classification: FebracisIntentOutput,
  newSummary: string,
  telemetry: any
) {
  const lastMessageId = ctx.messages[ctx.messages.length - 1]?.id || "";
  let targetStageId: string | null = null;
  let actionTaken = "no_move";
  const pId = ctx.lead.pipeline_id;

  // Aplica tags (se houver)
  if (classification.tags_suggested && classification.tags_suggested.length > 0) {
    await insertTags(client, ctx.lead.id, ctx.lead.clinic_id, classification.tags_suggested);
  }

  // Define coluna de destino baseado na intenção
  let targetName = "";
  if (classification.intent === "quer_comprar") {
    targetName = "Comprando";
  } else if (classification.intent === "nao_qualificado") {
    targetName = "Não Qualificado";
  } else if (classification.intent === "suporte_admin") {
    targetName = "Administrativo";
  } else if (classification.intent === "outro") {
    targetName = "Qualificação";
  }

  if (targetName) {
    targetStageId = await getStageIdByName(client, pId, targetName);
  }

  // Executa o movimento real se o stage mudou
  if (targetStageId && targetStageId !== ctx.lead.stage_id) {
    const moveRes = await executePipelineMove({
      client,
      leadId: ctx.lead.id,
      clinicId: ctx.lead.clinic_id,
      pipelineId: pId,
      newStageId: targetStageId,
      triggerType: "automation",
      reason: `IA detectou intenção: ${classification.intent}`,
    });

    if (moveRes.success) {
      actionTaken = `moved_to_${targetName}`;
    } else {
      actionTaken = `move_failed_${moveRes.error}`;
    }
  }

  // Grava Telemetria da Movimentação/Decisão
  await client.from("pipeline_run_items").insert({
    lead_id: ctx.lead.id,
    run_type: "classifier",
    status: "completed",
    result: {
      action_taken: actionTaken,
      intent: classification.intent,
      tags: classification.tags_suggested,
      costTokens: telemetry.totalTokens,
      latencyMs: telemetry.latencyMs,
      model: telemetry.model
    },
  });

  // Atualiza Lead (Watermark + Summary)
  if (lastMessageId) {
    await updateWatermarkFebracis(client, ctx.lead.id, lastMessageId, newSummary);
  } else {
    await clearQueueFlagFebracis(client, ctx.lead.id);
  }

  return { actionTaken, targetStageId };
}
