// supabase/functions/pipeline-classify-febracis/apply.ts

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { LeadContext } from "../pipeline-classify/context.ts";
import { pipelineMove } from "../_shared/pipeline-move.ts";
import type { FebracisIntentOutput } from "./agent.ts";

const FEBRACIS_ALLOWED_TAGS = new Set([
  "aluno_antigo",
  "reclamacao",
  "urgencia_financeira",
  "vip"
]);

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
  clinicId: string,
  pipelineId: string,
  reason: string
) {
  const { error } = await client.from("pipeline_run_items").insert({
    lead_id: leadId,
    clinic_id: clinicId,
    pipeline_id: pipelineId,
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

  // 1. Aplica tags de forma segura com restrição da Febracis
  if (classification.tags_suggested && classification.tags_suggested.length > 0) {
    const validTags = classification.tags_suggested.filter(t => FEBRACIS_ALLOWED_TAGS.has(t));
    if (validTags.length > 0) {
      const currentTags = ctx.lead.tags || [];
      const nextTagsSet = new Set([...currentTags, ...validTags]);
      const nextTags = Array.from(nextTagsSet);
      
      const { error: rpcErr } = await client.rpc("apply_lead_automation_patch", {
        p_lead_id: ctx.lead.id,
        p_custom_fields: null,
        p_tags: nextTags,
      });
      if (rpcErr) {
        console.error("apply_lead_automation_patch failed (tags)", rpcErr.message);
      }
    }
  }

  // 2. Define coluna de destino baseado na intenção
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

  // 3. Executa o movimento real se o stage mudou
  if (targetStageId && targetStageId !== ctx.lead.stage_id) {
    const moveRes = await pipelineMove(client, {
      leadId: ctx.lead.id,
      toStageId: targetStageId,
      source: "auto:classifier-febracis",
      reason: `IA detectou intenção: ${classification.intent}`,
      idempotencyKey: `febracis:${ctx.lead.id}:${lastMessageId}`,
    });

    if (moveRes.moved) {
      actionTaken = `moved_to_${targetName}`;
    } else {
      actionTaken = `move_failed_${moveRes.reason}`;
    }
  }

  // 4. Grava Telemetria da Movimentação/Decisão
  await client.from("pipeline_run_items").insert({
    lead_id: ctx.lead.id,
    clinic_id: ctx.lead.clinic_id,
    pipeline_id: pId,
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

  // 5. Atualiza Lead (Watermark + Summary)
  if (lastMessageId) {
    await updateWatermarkFebracis(client, ctx.lead.id, lastMessageId, newSummary);
  } else {
    await clearQueueFlagFebracis(client, ctx.lead.id);
  }

  return { actionTaken, targetStageId };
}
