// supabase/functions/_shared/pipeline-summarize-core.ts
//
// Marco 3 — Summarizer.
//
// Lê histórico do lead (até MAX_MSGS_SUMMARY mensagens) e atualiza
// `leads.ai_summary` (≤800 chars) + `last_processed_message_id_summarizer`.
// Grava `lead_events` `auto:summarize`.
//
// Gates:
//  - G3: toggle `automation.summarizer.enabled`.
//  - "Should run" check: ≥MIN_NEW_MSGS novas mensagens desde watermark
//    OU intent não trivial sinalizado pelo classifier (parâmetro `force`).
// Idempotência: se watermark == última mensagem, no-op.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText } from "npm:ai@^6";
import { getClinicOpenAI } from "./clinic-openai.ts";
import { isClinicPipelineAllowed } from "./pipeline-allowlist.ts";

const MODEL = "gpt-5-mini";
const MAX_MSGS_SUMMARY = 60;
const MIN_NEW_MSGS = 3;
const MAX_SUMMARY_CHARS = 800;

export interface SummarizeResult {
  status: "ok" | "skipped" | "no_messages" | "noop";
  reason?: string;
  summary?: string;
  last_message_id?: string;
}

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

export async function runSummarize(
  client: SupabaseClient,
  leadId: string,
  opts: { force?: boolean; reason?: string } = {},
): Promise<SummarizeResult> {
  if (!(await isEnabled(client, "automation.summarizer.enabled"))) {
    return { status: "skipped", reason: "toggle_off" };
  }

  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, ai_summary, last_processed_message_id_summarizer")
    .eq("id", leadId)
    .single();
  if (!lead) return { status: "skipped", reason: "lead_not_found" };
  if (!(await isClinicPipelineAllowed(client, lead.clinic_id as string))) {
    return { status: "skipped", reason: "clinic_not_allowlisted" };
  }


  const { data: msgs } = await client
    .from("messages")
    .select("id, from_me, content, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(MAX_MSGS_SUMMARY);
  const ordered = (msgs ?? []).reverse();
  if (ordered.length === 0) return { status: "no_messages" };

  const lastMsgId = ordered[ordered.length - 1].id as string;
  const watermark = lead.last_processed_message_id_summarizer as string | null;

  if (watermark && watermark === lastMsgId) {
    return { status: "noop", reason: "no_new_messages" };
  }

  // Count new messages since watermark.
  let newCount = ordered.length;
  if (watermark) {
    const idx = ordered.findIndex((m) => m.id === watermark);
    if (idx >= 0) newCount = ordered.length - 1 - idx;
  }
  if (!opts.force && newCount < MIN_NEW_MSGS) {
    return { status: "skipped", reason: `only_${newCount}_new_msgs` };
  }

  const formatted = ordered
    .map((m) => `[${(m.created_at as string).slice(0, 16)}] ${m.from_me ? "ATENDENTE" : "LEAD"}: ${(m.content ?? "").slice(0, 500)}`)
    .join("\n");

  const ai = await getClinicOpenAI(client, lead.clinic_id as string);
  if (!ai) return { status: "skipped", reason: "no_clinic_openai_key" };

  const previous = (lead.ai_summary as string | null)?.trim() || "(sem resumo prévio)";
  const { text } = await generateText({
    model: ai.model(MODEL),
    system:
      "Você produz resumos enxutos de leads de uma clínica médica para uso interno da equipe. " +
      `Escreva PT-BR, ≤${MAX_SUMMARY_CHARS} caracteres, em parágrafo único, factual, sem opinião. ` +
      "Mencione: nome se citado, queixa/interesse principal, momento atual do funil, próximos passos pendentes, e qualquer info financeira/agendamento relevante.",
    prompt:
      `Resumo anterior do lead:\n${previous}\n\n` +
      `Histórico recente (${ordered.length} msgs):\n${formatted}\n\n` +
      `Atualize o resumo refletindo o estado mais recente. Não exceda ${MAX_SUMMARY_CHARS} caracteres.`,
  });

  const summary = (text || "").trim().slice(0, MAX_SUMMARY_CHARS);

  await client
    .from("leads")
    .update({
      ai_summary: summary,
      last_processed_message_id_summarizer: lastMsgId,
    })
    .eq("id", leadId);

  await client.from("lead_events").insert({
    clinic_id: lead.clinic_id,
    lead_id: leadId,
    type: "auto:summarize",
    payload: {
      reason: opts.reason ?? (opts.force ? "intent_trigger" : "msg_threshold"),
      new_messages: newCount,
      chars: summary.length,
    },
  });

  return { status: "ok", summary, last_message_id: lastMsgId };
}
