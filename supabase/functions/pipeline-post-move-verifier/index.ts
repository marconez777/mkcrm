// supabase/functions/pipeline-post-move-verifier/index.ts
//
// Marco 2.5 — A2 (verificador pós-move).
//
// Recebe POST com { lead_id, from_stage_id, to_stage_id, source, rule_key }
// disparado de forma assíncrona pelo helper pipeline-move.ts logo após um
// move bem-sucedido com source LIKE 'auto:%'. NUNCA reverte; só sinaliza
// via tag `precisa_atencao_humana` + `post_move_warning` + lead_event.
//
// Gates:
//  - G3: toggle automation.post_move_verifier.enabled
//  - Whitelist seletiva: automation.post_move_verifier.rules_enabled (JSON string[])
//    Se array vazio ou null → roda para qualquer regra. Se contiver itens,
//    só roda quando `source` ou `rule_key` aparece na lista.
//  - G11: nunca cria/edita appointments nem move stages.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getClassifierAi, pickModel } from "../_shared/classifier-ai.ts";
import { isClinicPipelineAllowed } from "../_shared/pipeline-allowlist.ts";
import { generateText, Output, stepCountIs } from "npm:ai@^6";
import { z } from "npm:zod@^3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL_SPEC = { openai: "gpt-5-nano", lovable: "google/gemini-2.5-flash-lite", google: "gemini-2.5-flash-lite" };

const VerdictSchema = z.object({
  verdict: z.enum(["sim", "nao", "incerto"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

async function getSetting(
  client: SupabaseClient,
  key: string,
): Promise<string | null> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ? String(data.value) : null;
}

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const v = await getSetting(client, key);
  if (!v) return false;
  const s = v.toLowerCase();
  return s === "true" || s === "1" || s === '"true"';
}

async function getRulesWhitelist(client: SupabaseClient): Promise<string[]> {
  const raw = await getSetting(client, "automation.post_move_verifier.rules_enabled");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch (_) {
    // ignore
  }
  return [];
}

async function addTags(client: SupabaseClient, leadId: string, tags: string[]) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  const merged = Array.from(new Set([...current, ...tags]));
  if (merged.length === current.length) return;
  await client.from("leads").update({ tags: merged }).eq("id", leadId);
}

interface VerifierPayload {
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  source: string;
  rule_key?: string | null;
}

async function verifyMove(client: SupabaseClient, payload: VerifierPayload) {
  if (!(await isEnabled(client, "automation.post_move_verifier.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const whitelist = await getRulesWhitelist(client);
  if (whitelist.length > 0) {
    const allowed =
      whitelist.includes(payload.source) ||
      (payload.rule_key ? whitelist.includes(payload.rule_key) : false);
    if (!allowed) return { skipped: "not_in_whitelist" };
  }

  const { lead_id, from_stage_id, to_stage_id, source } = payload;

  // Carrega contexto enxuto: últimos 5 eventos + nomes dos stages.
  const [{ data: events }, { data: stages }, { data: lead }] = await Promise.all([
    client
      .from("lead_events")
      .select("type, payload, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("pipeline_stages")
      .select("id, name")
      .in("id", [from_stage_id, to_stage_id].filter(Boolean) as string[]),
    client.from("leads").select("clinic_id, tags, custom_fields").eq("id", lead_id).single(),
  ]);

  if (!lead) return { skipped: "lead_not_found" };
  if (!(await isClinicPipelineAllowed(client, lead.clinic_id as string))) {
    return { skipped: "clinic_not_allowlisted" };
  }

  const fromName = stages?.find((s) => s.id === from_stage_id)?.name ?? "—";
  const toName = stages?.find((s) => s.id === to_stage_id)?.name ?? to_stage_id;

  const eventLines = (events ?? [])
    .map((e) => `[${(e.created_at as string).slice(0, 16)}] ${e.type}: ${JSON.stringify(e.payload ?? {}).slice(0, 200)}`)
    .join("\n");

  const ai = await getClassifierAi(client, lead.clinic_id as string);
  if (!ai) return { skipped: "no_ai_provider" };

  const { output } = await generateText({
    model: ai.model(pickModel(ai.provider, MODEL_SPEC)),
    system:
      "Você é um revisor curto de movimentações de pipeline CRM médico. " +
      "Responda APENAS em JSON conforme o schema: verdict ∈ {sim, nao, incerto}, confidence ∈ [0,1], reason ≤ 200 chars em PT-BR. " +
      "Use 'nao' apenas quando há evidência clara de que o move foi inadequado dado o histórico.",

    prompt:
      `Move automático aplicado:\n` +
      `- regra/source: ${source}\n` +
      `- de: ${fromName}\n` +
      `- para: ${toName}\n` +
      `- tags atuais: ${(lead.tags ?? []).join(", ") || "nenhuma"}\n\n` +
      `Últimos 5 eventos do lead:\n${eventLines || "(sem eventos prévios)"}\n\n` +
      `Esse move faz sentido?`,
    output: Output.object({ schema: VerdictSchema }),
    stopWhen: stepCountIs(5),
  });

  const verdict = output as z.infer<typeof VerdictSchema>;

  await client.from("lead_events").insert({
    clinic_id: lead.clinic_id,
    lead_id,
    type: verdict.verdict === "nao" && verdict.confidence >= 0.8
      ? "post_move_disagreement"
      : "post_move_audit_ok",
    payload: {
      source,
      from_stage_id,
      to_stage_id,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      reason: verdict.reason,
    },
  });

  if (verdict.verdict === "nao" && verdict.confidence >= 0.8) {
    await addTags(client, lead_id, ["precisa_atencao_humana", "post_move_warning"]);
  }

  return { verdict };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body.lead_id || !body.to_stage_id || !body.source) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    const result = await verifyMove(client, body as VerifierPayload);
    console.log(JSON.stringify({ fn: "post-move-verifier", payload: body, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("post-move-verifier error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
