// supabase/functions/pipeline-classify/apply.ts
// Orquestrador V2: aplica gates, tags, custom_fields, side-effects e telemetria.
// Strict no-move (exceto B2B com guards rígidos).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  PROTECTED_TAGS,
  DATE_FIELD_KEYS,
  G10_WINDOW_MS,
  type ClassificationV2,
} from "./schema.ts";
import type { LeadContext } from "./context.ts";
import { resolveMentionedDates, fieldKeyFor } from "./date-parser.ts";
import { evaluateFirstConsult } from "./rules/first-consult.ts";
import { runIntentEffects } from "./rules/intent-effects.ts";
import { runSummarize } from "../_shared/pipeline-summarize-core.ts";
import { getToggle } from "../_shared/app-settings.ts";

const TELEMETRY_VERSION = 3;

// === Transição Agendamento Humano (Junho/2026) ===
// A IA NÃO pode mais preencher datas de agendamento nem mover cards para
// estágios de agendamento/finalização. Esses campos/estágios são 100% manuais.
const HUMAN_SCHEDULING_FIELDS = new Set<string>([
  "consulta_agendada_em",
  "procedimento_agendado_em",
]);
const HUMAN_TRANSITION_REJECT_REASON = "ai_scheduling_disabled_by_human_transition";

// Campos com LOCK HUMANO PERMANENTE (sem janela G10): uma vez editados
// pela secretária, a IA nunca mais sobrescreve. Hoje cobre `origem` —
// rastreio do funil deve respeitar a verdade humana indefinidamente.
const STICKY_HUMAN_FIELDS = new Set<string>([
  "origem",
]);
const STICKY_HUMAN_REJECT_REASON = "sticky_human_field_locked";

// Campos que a IA NUNCA escreve: viraram campos nativos alimentados pelo
// tracking (leads.origin_channel / origin_label / origin_detail).
const AI_FORBIDDEN_FIELDS = new Set<string>(["origem"]);
const AI_FORBIDDEN_REJECT_REASON = "field_owned_by_tracking";

// Wrapper retrocompatível: usa helper unificado de app-settings.
async function isEnabled(
  client: SupabaseClient,
  key: string,
): Promise<boolean> {
  return getToggle(client, key);
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
    // Origem virou campo nativo do lead (leads.origin_*), derivado do tracking.
    // A IA não escreve mais nesse campo em nenhuma hipótese.
    if (AI_FORBIDDEN_FIELDS.has(k)) {
      fieldsRejected.push({ key: k, raw_value: v, reason: AI_FORBIDDEN_REJECT_REASON });
      return;
    }

    const humanIso = lead.custom_fields_last_human_edit?.[k];


    // Sticky human lock: campos como `origem` nunca podem ser sobrescritos
    // pela IA depois de uma edição humana, independente da janela G10.
    if (humanIso && STICKY_HUMAN_FIELDS.has(k)) {
      fieldsRejected.push({
        key: k,
        raw_value: v,
        reason: STICKY_HUMAN_REJECT_REASON,
      });
      return;
    }

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
    const key = fieldKeyFor(d.kind);
    if (d.rejected_reason) {
      fieldsRejected.push({
        key,
        raw_value: d.raw,
        reason: d.rejected_reason,
      });
      continue;
    }
    // Transição agendamento humano: IA detecta a data mas NÃO aplica.
    if (HUMAN_SCHEDULING_FIELDS.has(key)) {
      fieldsRejected.push({
        key,
        raw_value: d.resolved,
        reason: HUMAN_TRANSITION_REJECT_REASON,
      });
      continue;
    }
    tryApplyField(key, d.resolved, true); // true = isDateFromParser (bypass G10)
  }

  // 4b) Demais chaves (ignora chaves de data — já tratadas via mentioned_dates)
  // P10: sanitiza enums contra clinicFieldSchema antes do RPC. Sem isso, 1
  // valor inválido (ex.: qualificacao='talvez') faz o trigger
  // trg_validate_lead_custom_fields_enums abortar a RPC inteira — perdendo
  // tags válidas e custom_fields legítimos.
  const schemaByKey = new Map(
    ctx.clinicFieldSchema.map((f) => [f.field_key, f]),
  );
  for (const [k, v] of Object.entries(cls.custom_fields_patch ?? {})) {
    if (DATE_FIELD_KEYS.has(k)) {
      // Se o LLM mandou data direta, rejeita — datas SÓ via mentioned_dates
      fieldsRejected.push({ key: k, raw_value: v, reason: "use_mentioned_dates_instead" });
      continue;
    }
    const def = schemaByKey.get(k);
    if (def && def.options.length > 0 && v !== null && v !== undefined) {
      // Enum (select/multiselect): valida contra options declaradas pela clínica.
      const values = Array.isArray(v) ? v : [v];
      const invalid = values.find((x) => !def.options.includes(String(x)));
      if (invalid !== undefined) {
        fieldsRejected.push({ key: k, raw_value: v, reason: "invalid_enum" });
        continue;
      }
    }
    tryApplyField(k, v);
  }


  // ===== 5) UPDATE atômico via RPC (não dispara G10) =====
  // Em modo maestro-only, NÃO aplica tags/custom_fields (são reaproveitados).
  //
  // Removido em 12/08/2026: a trava que impedia gravar tags/campos quando o lead
  // estava em "Paciente antigo". Ela existia porque a IA movia cards e o move era
  // bloqueado nessa coluna, deixando tag órfã. Sem movimentação por IA, o motivo
  // desapareceu — e a comparação era por NOME de coluna, que quebraria sozinha no
  // rename para "Paciente Inativo". A IA agora enriquece paciente inativo como
  // qualquer outro lead. Ver docs/tenants/clinica-or/PLANO_IMPLEMENTACAO.md §5.
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

  // ===== 6) NO-MOVE — a IA nunca move card =====
  // Removido em 12/08/2026 (Etapa 1 do PLANO_IMPLEMENTACAO). Os três caminhos de
  // movimentação — auto:classifier-b2b, auto:classifier-nurture e
  // auto:classifier-general — foram apagados. A movimentação do funil é 100%
  // determinística, por gatilho.
  //
  // A sugestão do Maestro continua registrada em telemetria, sem nenhum efeito
  // sobre o card. Ver docs/tenants/clinica-or/FLUXO_ALVO.md.
  const stageOutcome: Record<string, unknown> = {
    suggested: cls.stage_suggestion,
    current_stage_name: ctx.stageName,
    would_move: false,
    reason: applyMaestro ? "strict_no_move:ai_movement_removed" : "skipped_partial_mode",
    confidence: cls.confidence,
  };

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
  // P6: outcome do Maestro consolidado para filtros em pipeline_runs sem grep no payload.
  let maestroOutcome: "applied" | "strict_blocked" | "no_signal" | "low_confidence" | "skipped_partial_mode" | "error";
  if (!applyMaestro) {
    maestroOutcome = "skipped_partial_mode";
  } else if (!cls.stage_suggestion) {
    maestroOutcome = "no_signal";
  } else if (cls.confidence < 0.6) {
    maestroOutcome = "low_confidence";
  } else if (stageOutcome.would_move === true) {
    maestroOutcome = "applied";
  } else if (typeof stageOutcome.reason === "string" && (stageOutcome.reason as string).startsWith("strict_no_move")) {
    maestroOutcome = "strict_blocked";
  } else {
    maestroOutcome = "no_signal";
  }

  const enrichedAgents = agents
    ? { ...(agents as Record<string, unknown>), maestro_outcome: maestroOutcome }
    : null;

  const telemetry = {
    version: TELEMETRY_VERSION,
    mode,
    maestro_outcome: maestroOutcome,
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
    agents: enrichedAgents,
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

  // Pega a data da última mensagem processada
  const { data: lastMsg } = await client
    .from("messages")
    .select("created_at")
    .eq("id", lastMessageId)
    .maybeSingle();

  let hasNewer = false;
  if (lastMsg?.created_at) {
    const { count } = await client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("from_me", false)
      .gt("created_at", lastMsg.created_at);
    hasNewer = (count ?? 0) > 0;
  }

  if (hasNewer) {
    // Nova mensagem do lead chegou durante o processamento.
    // Devolve a flag para a fila e libera o lock.
    if (!nextReasons.includes("pipeline-classifier")) nextReasons.push("pipeline-classifier");
    await client
      .from("leads")
      .update({
        last_processed_message_id_classifier: lastMessageId,
        ai_review_queued_at: null,
        ai_review_fail_count: 0,
        ai_review_reasons: nextReasons,
      })
      .eq("id", leadId);
  } else {
    // Nenhuma mensagem nova, fluxo normal.
    await client
      .from("leads")
      .update({
        last_processed_message_id_classifier: lastMessageId,
        needs_ai_review: false,
        ai_review_queued_at: null,
        ai_review_fail_count: 0,
        last_classified_at: new Date().toISOString(),
        ai_review_reasons: nextReasons,
      })
      .eq("id", leadId);
  }
}
