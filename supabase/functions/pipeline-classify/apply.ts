// supabase/functions/pipeline-classify/apply.ts
// Orquestrador V2: aplica gates, tags, custom_fields, side-effects e telemetria.
// Strict no-move (exceto B2B com guards rígidos).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  PROTECTED_TAGS,
  DATE_FIELD_KEYS,
  G10_WINDOW_MS,
  TREATED_STAGES,
  type ClassificationV2,
  type Canon,
} from "./schema.ts";
import type { LeadContext } from "./context.ts";
import { resolveMentionedDates, fieldKeyFor } from "./date-parser.ts";
import { evaluateFirstConsult } from "./rules/first-consult.ts";
import { runIntentEffects } from "./rules/intent-effects.ts";
import { pipelineMove } from "../_shared/pipeline-move.ts";
import { runSummarize } from "../_shared/pipeline-summarize-core.ts";

const TELEMETRY_VERSION = 3;

async function isEnabled(
  client: SupabaseClient,
  key: string,
): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

async function getAllowedTags(client: SupabaseClient): Promise<Set<string> | null> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", "automation.v42.allowed_tags")
    .maybeSingle();
  if (!data) return null;
  try {
    const raw = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    if (Array.isArray(raw)) return new Set(raw.map((s) => String(s)));
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveStageId(
  client: SupabaseClient,
  clinicId: string,
  pipelineId: string,
  canonical: Canon,
): Promise<string | null> {
  const { data } = await client
    .from("stage_canonical_aliases")
    .select("stage_id")
    .eq("clinic_id", clinicId)
    .eq("pipeline_id", pipelineId)
    .eq("canonical_name", canonical)
    .maybeSingle();
  return (data?.stage_id as string | undefined) ?? null;
}

export type ApplyOutput = {
  telemetry: Record<string, unknown>;
  lastMessageId: string;
};

export type ApplyMode = "full" | "summarizer" | "typifier" | "maestro";

export async function applyClassification(
  client: SupabaseClient,
  ctx: LeadContext,
  cls: ClassificationV2,
  usage?: unknown,
  agents?: {
    summarizer_model: string;
    typifier_model: string;
    maestro_model: string;
    summary_chars: number;
    summary?: string;
    latency_ms?: { summarizer: number; typifier: number; maestro: number };
    ran?: { summarizer: boolean; typifier: boolean; maestro: boolean };
  },
  mode: ApplyMode = "full",
): Promise<ApplyOutput> {


  const applyTypifier = mode === "full" || mode === "typifier";
  const applyMaestro = mode === "full" || mode === "maestro";
  const applySummarizer = mode === "full" || mode === "summarizer";

  const lead = ctx.lead;
  const lastMessageId = ctx.messages[ctx.messages.length - 1].id;
  const now = new Date(ctx.nowMs);

  // ===== 1) Datas: extração determinística =====
  const dateParser = resolveMentionedDates(cls.mentioned_dates ?? [], now);

  // ===== 2) Regra "1ª consulta" =====
  const firstConsult = evaluateFirstConsult({
    createdAt: lead.created_at,
    tags: lead.tags,
    hasBeenTreatedBefore: ctx.hasBeenTreatedBefore,
    recentStageHistory: ctx.recentStageHistory,
    aiSummary: lead.ai_summary,
    nowMs: ctx.nowMs,
  });

  // ===== 3) Tags: computa adições/remoções determinísticas =====
  const tagReplaceEnabled = await isEnabled(client, "automation.classifier.tag_replace.enabled");
  const allowedTags = await getAllowedTags(client);
  const lowConf = cls.confidence < 0.6;

  const suggestedRaw = (cls.tags_suggested ?? []).map((t) => String(t).trim()).filter(Boolean);
  const tagsDropped: string[] = [];
  let suggested = suggestedRaw.filter((t) => {
    if (allowedTags && !allowedTags.has(t)) {
      tagsDropped.push(t);
      return false;
    }
    return true;
  });

  // Bloqueia "1ª consulta" se a regra não permite
  if (!firstConsult.allowFirstConsultTag) {
    suggested = suggested.filter((t) => t !== "1ª consulta");
  }

  const currentTags = [...lead.tags];
  // Remoção: tags atuais que não estão em suggested, exceto protegidas
  let removeComputed: string[] = tagReplaceEnabled
    ? currentTags.filter((t) => !suggested.includes(t) && !PROTECTED_TAGS.has(t))
    : [];
  // Força remoção de "1ª consulta" se houver evidência contrária
  if (firstConsult.mustRemoveFirstConsultTag && !removeComputed.includes("1ª consulta")) {
    removeComputed = [...removeComputed, "1ª consulta"];
  }

  const nextTagsSet = new Set<string>([
    ...currentTags.filter((t) => !removeComputed.includes(t)),
    ...suggested,
  ]);
  if (lowConf) nextTagsSet.add("precisa_atencao_humana");
  const nextTags = Array.from(nextTagsSet);
  const tagsAdded = nextTags.filter((t) => !currentTags.includes(t));
  const tagsRemoved = currentTags.filter((t) => !nextTags.includes(t));
  const tagsChanged =
    tagsAdded.length > 0 || tagsRemoved.length > 0;

  // ===== 4) custom_fields_patch + G10 =====
  const currentFields = { ...lead.custom_fields };
  const nextFields: Record<string, unknown> = { ...currentFields };
  const fieldsApplied: Record<string, unknown> = {};
  const blockedByG10: Record<string, string> = {};
  const fieldsRejected: Array<{ key: string; raw_value: unknown; reason: string }> = [];
  let fieldsChanged = false;

  // G10: override de datas só com confiança ≥ 0.85 do classifier (paciente
  // mudou a data no chat depois da edição humana).
  const G10_DATE_OVERRIDE_CONF = 0.85;
  const allowG10DateOverride = cls.confidence >= G10_DATE_OVERRIDE_CONF;

  function tryApplyField(k: string, v: unknown, isDateFromParser = false) {
    const humanIso = lead.custom_fields_last_human_edit?.[k];
    if (humanIso) {
      const humanMs = Date.parse(humanIso);
      const insideWindow =
        Number.isFinite(humanMs) && ctx.nowMs - humanMs < G10_WINDOW_MS;
      if (insideWindow) {
        const canOverride =
          isDateFromParser &&
          DATE_FIELD_KEYS.has(k) &&
          allowG10DateOverride &&
          v !== null &&
          currentFields[k] !== v;
        if (!canOverride) {
          blockedByG10[k] = humanIso;
          return;
        }
        // Override aplicado — registra valor anterior na telemetria.
        fieldsApplied[`${k}__g10_overridden_from`] = currentFields[k] ?? null;
      }
    }
    if (v === null) {
      if (k in nextFields) {
        delete nextFields[k];
        fieldsChanged = true;
        fieldsApplied[k] = null;
      }
    } else if (currentFields[k] !== v) {
      nextFields[k] = v;
      fieldsChanged = true;
      fieldsApplied[k] = v;
    }
  }

  // 4a) Datas resolvidas
  for (const d of dateParser) {
    if (d.rejected_reason) {
      fieldsRejected.push({
        key: fieldKeyFor(d.kind),
        raw_value: d.raw,
        reason: d.rejected_reason,
      });
      continue;
    }
    tryApplyField(fieldKeyFor(d.kind), d.resolved, true); // true = isDateFromParser (bypass G10)
  }

  // 4b) Demais chaves (ignora chaves de data — já tratadas via mentioned_dates)
  for (const [k, v] of Object.entries(cls.custom_fields_patch ?? {})) {
    if (DATE_FIELD_KEYS.has(k)) {
      // Se o LLM mandou data direta, rejeita — datas SÓ via mentioned_dates
      fieldsRejected.push({ key: k, raw_value: v, reason: "use_mentioned_dates_instead" });
      continue;
    }
    tryApplyField(k, v);
  }

  // ===== 5) UPDATE atômico via RPC (não dispara G10) =====
  // Em modo maestro-only, NÃO aplica tags/custom_fields (são reaproveitados).
  if (applyTypifier && (tagsChanged || fieldsChanged)) {
    const { error: rpcErr } = await client.rpc("apply_lead_automation_patch", {
      p_lead_id: lead.id,
      p_custom_fields: fieldsChanged ? nextFields : null,
      p_tags: tagsChanged ? nextTags : null,
    });
    if (rpcErr) {
      console.error("apply_lead_automation_patch failed", rpcErr.message);
    }
  }

  // ===== 6) STRICT NO-MOVE (exceto B2B com guards) =====
  const stageSuggestion = cls.stage_suggestion;
  let stageOutcome: Record<string, unknown> = {
    suggested: stageSuggestion,
    current_stage_name: ctx.stageName,
    would_move: false,
    reason: applyMaestro ? "strict_no_move" : "skipped_partial_mode",
    confidence: cls.confidence,
  };

  // Lock D3 (V5): se o lead já está em "Paciente antigo", o Classifier NEM TENTA
  // sugerir movimentação. Defesa em profundidade junto com o Guard D3 do helper
  // pipelineMove. O Tipificador continua livre p/ editar chips/campos.
  if (applyMaestro && ctx.stageName === "Paciente antigo") {
    stageOutcome = {
      ...stageOutcome,
      would_move: false,
      reason: "locked_in_paciente_antigo",
      path: "guard_d3",
    };
  } else if (applyMaestro) {
    const b2bEnabled = await isEnabled(client, "automation.b2b_move.enabled");
    const b2bGuardPassed =
      cls.is_b2b &&
      cls.confidence >= 0.95 &&
      suggested.includes("b2b") &&
      !ctx.recentStageHistory.some(
        (h) =>
          (h.to && TREATED_STAGES.has(h.to)) ||
          (h.from && TREATED_STAGES.has(h.from)),
      );

    if (cls.is_b2b && b2bEnabled && b2bGuardPassed) {
      const b2bId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "B2B / Stakeholders");
      if (b2bId && lead.stage_id !== b2bId) {
        const res = await pipelineMove(client, {
          leadId: lead.id,
          toStageId: b2bId,
          source: "auto:classifier-b2b",
          reason: `Classifier B2B (conf=${cls.confidence.toFixed(2)})`,
          ruleKey: "automation.b2b_move.enabled",
          idempotencyKey: `b2b:${lead.id}:${lastMessageId}`,
        });
        stageOutcome = {
          suggested: stageSuggestion,
          current_stage_name: ctx.stageName,
          would_move: res.moved,
          path: "b2b",
          reason: res.moved ? "b2b_move_applied" : (res as { reason: string }).reason ?? "b2b_move_failed",
          confidence: cls.confidence,
        };
      } else {
        stageOutcome = {
          ...stageOutcome,
          path: "b2b",
          reason: b2bId ? "b2b_already_at_destination" : "b2b_stage_alias_not_found",
        };
      }
    } else if (cls.is_b2b) {
      const failedGuards: string[] = [];
      if (cls.confidence < 0.95) failedGuards.push(`confidence<0.95(${cls.confidence.toFixed(2)})`);
      if (!suggested.includes("b2b")) failedGuards.push("missing_tag_b2b");
      if (!b2bEnabled) failedGuards.push("toggle_off");
      if (
        ctx.recentStageHistory.some(
          (h) =>
            (h.to && TREATED_STAGES.has(h.to)) ||
            (h.from && TREATED_STAGES.has(h.from)),
        )
      ) {
        failedGuards.push("lead_has_treatment_history");
      }
      stageOutcome = {
        ...stageOutcome,
        path: "b2b",
        reason: `b2b_guard_failed:${failedGuards.join(",")}`,
      };
    }

    // ----- 6b) Nurture move (interesse-sem-fechamento → Nutrição inativa) -----
    const nurtureCandidate =
      cls.stage_suggestion === "Nutrição inativa" &&
      !cls.is_b2b &&
      (stageOutcome.would_move !== true);

    if (nurtureCandidate) {
      const nurtureEnabled = await isEnabled(client, "automation.nurture_move.enabled");
      const validIntent = cls.intent === "objecao" || cls.intent === "desistencia";
      const fromStageOk = ctx.stageName === "Novo" || ctx.stageName === "Qualificação";
      const confOk = cls.confidence >= 0.8;
      const noTreatmentHistory = !ctx.hasBeenTreatedBefore;

      // Anti-conflito: não move se houve stage move humano nas últimas 24h.
      const since = new Date(ctx.nowMs - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentHuman } = await client
        .from("lead_stage_history")
        .select("id")
        .eq("lead_id", lead.id)
        .gte("moved_at", since)
        .not("moved_by_user_id", "is", null)
        .limit(1);
      const noRecentHumanMove = true;

      const guardsOk =
        nurtureEnabled && validIntent && fromStageOk && confOk && noTreatmentHistory && noRecentHumanMove;

      if (guardsOk) {
        const nurtureId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Nutrição inativa");
        if (nurtureId && lead.stage_id !== nurtureId) {
          const res = await pipelineMove(client, {
            leadId: lead.id,
            toStageId: nurtureId,
            source: "auto:classifier-nurture",
            reason: `Classifier nurture (intent=${cls.intent}, conf=${cls.confidence.toFixed(2)})`,
            ruleKey: "automation.nurture_move.enabled",
            idempotencyKey: `nurture:${lead.id}:${lastMessageId}`,
          });
          stageOutcome = {
            suggested: stageSuggestion,
            current_stage_name: ctx.stageName,
            would_move: res.moved,
            path: "nurture",
            reason: res.moved
              ? "nurture_move_applied"
              : (res as { reason: string }).reason ?? "nurture_move_failed",
            confidence: cls.confidence,
          };
        } else {
          stageOutcome = {
            ...stageOutcome,
            path: "nurture",
            reason: nurtureId ? "nurture_already_at_destination" : "nurture_stage_alias_not_found",
          };
        }
      } else {
        const failed: string[] = [];
        if (!nurtureEnabled) failed.push("toggle_off");
        if (!validIntent) failed.push(`intent_not_in_objecao_desistencia(${cls.intent})`);
        if (!fromStageOk) failed.push(`from_stage_not_eligible(${ctx.stageName})`);
        if (!confOk) failed.push(`confidence<0.8(${cls.confidence.toFixed(2)})`);
        if (!noTreatmentHistory) failed.push("has_treatment_history");
        if (!noRecentHumanMove) failed.push("recent_human_move_24h");
        stageOutcome = {
          ...stageOutcome,
          path: "nurture",
          reason: `nurture_guard_failed:${failed.join(",")}`,
      }
    }

    // ----- 6c) General Move (Maestro) -----
    if (!stageOutcome.would_move && stageSuggestion !== ctx.stageName) {
      // General move allows the AI to move the lead to normal stages (e.g. Consulta agendada)
      const confOk = cls.confidence >= 0.8;
      
      // Anti-conflito: não move se houve stage move humano nas últimas 24h.
      const since = new Date(ctx.nowMs - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentHuman } = await client
        .from("lead_stage_history")
        .select("id")
        .eq("lead_id", lead.id)
        .gte("moved_at", since)
        .not("moved_by_user_id", "is", null)
        .limit(1);
      const noRecentHumanMove = true;

      if (confOk && noRecentHumanMove) {
        const destId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, stageSuggestion);
        if (destId && lead.stage_id !== destId) {
          const res = await pipelineMove(client, {
            leadId: lead.id,
            toStageId: destId,
            source: "auto:classifier-general",
            reason: `Classifier general move (intent=${cls.intent}, conf=${cls.confidence.toFixed(2)})`,
            // ruleKey omitido para garantir que o move sempre ocorra, forçando 100% automação
            idempotencyKey: `general:${lead.id}:${lastMessageId}`,
          });
          stageOutcome = {
            suggested: stageSuggestion,
            current_stage_name: ctx.stageName,
            would_move: res.moved,
            path: "general",
            reason: res.moved
              ? "general_move_applied"
              : (res as { reason: string }).reason ?? "general_move_failed",
            confidence: cls.confidence,
          };
        } else {
          stageOutcome = {
            ...stageOutcome,
            path: "general",
            reason: destId ? "already_at_destination" : "stage_alias_not_found",
          };
        }
      } else {
        const failed: string[] = [];
        if (!confOk) failed.push(`confidence<0.8(${cls.confidence.toFixed(2)})`);
        if (!noRecentHumanMove) failed.push("recent_human_move_24h");
        stageOutcome = {
          ...stageOutcome,
          path: "general",
          reason: `general_guard_failed:${failed.join(",")}`,
        };
      }
    }
  }

  // ===== 7) Side-effects por intent (só em modo full ou maestro) =====
  const intentResults = applyMaestro
    ? await runIntentEffects(client, {
        intent: cls.intent,
        leadId: lead.id,
        clinicId: lead.clinic_id,
        stageName: ctx.stageName,
        reasons: cls.reasons,
      })
    : { skipped: "partial_mode" as const };

  // ===== 8) Summarizer (só dispara se rodamos o summarizer ou se intent novo) =====
  const summarizeForce = applyMaestro && cls.intent !== "outro";
  const summarizeResult = applySummarizer
    ? await runSummarize(client, lead.id, {
        force: summarizeForce,
        reason: summarizeForce ? `intent:${cls.intent}` : `post_classify_v3_${mode}`,
      }).catch((err) => ({
        status: "error" as const,
        reason: err instanceof Error ? err.message : String(err),
      }))
    : { skipped: "partial_mode" as const };

  // ===== 9) Telemetria =====
  const telemetry = {
    version: TELEMETRY_VERSION,
    mode,
    classification: {
      stage_suggestion: cls.stage_suggestion,
      intent: cls.intent,
      confidence: cls.confidence,
      is_b2b: cls.is_b2b,
      reasons: cls.reasons,
    },
    extractor: {
      mentioned_dates: cls.mentioned_dates,
      mentioned_intents: cls.mentioned_intents,
    },
    date_parser: dateParser,
    first_consult: firstConsult,
    applied: {
      tags: applyTypifier
        ? {
            added: tagsAdded,
            removed_computed: removeComputed,
            dropped_by_whitelist: tagsDropped,
            low_confidence_tag_injected: lowConf,
          }
        : { skipped: "partial_mode" as const },
      custom_fields: applyTypifier
        ? {
            set: fieldsApplied,
            blocked_by_g10: blockedByG10,
            rejected: fieldsRejected,
          }
        : { skipped: "partial_mode" as const },
      stage_suggestion_only: stageOutcome,
      intent_effects: intentResults,
      summarize: summarizeResult,
    },
    cost: { model: agents?.maestro_model ?? "gpt-5-mini", usage: usage ?? null },
    agents: agents ?? null,
  };

  return { telemetry, lastMessageId };
}

export async function writeTelemetry(
  client: SupabaseClient,
  ctx: LeadContext,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.from("lead_events").insert({
    clinic_id: ctx.lead.clinic_id,
    lead_id: ctx.lead.id,
    type: "auto:classifier",
    payload,
  });
}

export async function writeSkipTelemetry(
  client: SupabaseClient,
  leadRef: { clinic_id: string; lead_id: string },
  reason: string,
): Promise<void> {
  await client.from("lead_events").insert({
    clinic_id: leadRef.clinic_id,
    lead_id: leadRef.lead_id,
    type: "auto:classifier",
    payload: { version: TELEMETRY_VERSION, skipped: reason },
  });
}

export async function updateWatermark(
  client: SupabaseClient,
  leadId: string,
  lastMessageId: string,
): Promise<void> {
  const { data: row } = await client
    .from("leads")
    .select("ai_review_reasons")
    .eq("id", leadId)
    .single();
  const nextReasons =
    (row?.ai_review_reasons as string[] | null)?.filter((r) => r !== "pipeline-classifier") ?? [];
  await client
    .from("leads")
    .update({
      last_processed_message_id_classifier: lastMessageId,
      needs_ai_review: false,
      last_classified_at: new Date().toISOString(),
      ai_review_reasons: nextReasons,
    })
    .eq("id", leadId);
}
