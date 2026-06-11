// vision-tick — cron 10 min.
// Lê mensagens recebidas com mídia (imagem/documento) ainda não processadas
// e usa OpenAI Vision (BYOK por clínica) pra detectar comprovantes de pagamento,
// extrair valor / método / pagador, e marcar o lead.
//
// Salvaguardas:
//   - só processa clínicas com openai_status='configured'
//   - respeita manual_lock_until (não sobrescreve pagamento_confirmado humano)
//   - só images com media_url e from_me=false
//   - limites: max_vision_per_lead (lifetime do lead), daily_budget_vision (por clínica)
//   - registra cada execução em lead_ai_extraction_runs com kind='vision'
//   - se ilegível, cria evento lead_events.type='vision_unreadable' pra atendente revisar
//
// Trigger via cron OU POST manual (force=true, clinic_id, message_ids).

import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { calcCostUsd } from "../_shared/ai-pricing.ts";

interface ClinicCfg {
  manual_lock_minutes: number;
  confidence_threshold: number;
  max_vision_per_lead: number;
  daily_budget_vision: number;
  allow_overwrite_filled: boolean;
  openai_status: string;
  openai_model_vision: string;
}

const DEFAULTS: ClinicCfg = {
  manual_lock_minutes: 30,
  confidence_threshold: 0.7,
  max_vision_per_lead: 3,
  daily_budget_vision: 50,
  allow_overwrite_filled: false,
  openai_status: "empty",
  openai_model_vision: "gpt-5-mini",
};

function mergeCfg(raw: any): ClinicCfg {
  return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
}

const VISION_TOOL = {
  type: "function",
  function: {
    name: "analyze_payment_proof",
    description:
      "Analisa uma imagem enviada por um lead em uma clínica psiquiátrica. Identifica se é comprovante de pagamento e extrai os dados quando legível.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: { type: "number", description: "Confiança geral 0..1." },
        is_payment_proof: {
          type: "boolean",
          description:
            "True se a imagem é claramente um comprovante de pagamento (PIX, TED, boleto, cartão, transferência).",
        },
        readable: {
          type: "boolean",
          description: "True se o conteúdo do comprovante é legível.",
        },
        method: {
          type: ["string", "null"],
          enum: ["pix", "ted", "doc", "boleto", "cartao", "transferencia", "dinheiro", null],
        },
        amount_brl: {
          type: ["number", "null"],
          description: "Valor em reais (apenas o número, ex.: 350.00).",
        },
        paid_at: {
          type: ["string", "null"],
          description: "Data/hora ISO 8601 da transação, se visível.",
        },
        payer_name: { type: ["string", "null"] },
        receiver_name: { type: ["string", "null"] },
        transaction_id: {
          type: ["string", "null"],
          description: "ID/E2E/autenticação da transação se visível.",
        },
        notes: {
          type: ["string", "null"],
          description: "Observação curta (até 240 chars) pro atendente.",
        },
      },
      required: ["confidence", "is_payment_proof", "readable"],
    },
  },
} as const;

const SYSTEM_PROMPT = `Você analisa imagens enviadas por leads no WhatsApp de uma clínica de psiquiatria.

A imagem PODE ser:
- Comprovante de pagamento (PIX, TED/DOC, boleto pago, cartão, transferência) → is_payment_proof=true
- Documento de identidade, exame, receita, foto pessoal, screenshot diverso → is_payment_proof=false

Quando for comprovante:
- Extraia valor em reais (number puro), método, data ISO, nome do pagador, nome do recebedor e ID da transação SE estiverem visíveis. Caso contrário, null.
- readable=false se a imagem estiver borrada, cortada ou ilegível.
- Não invente valores. Confiança baixa quando os dados estão parciais.

Sempre chame analyze_payment_proof exatamente uma vez.`;

interface OpenAIUsage { prompt_tokens?: number; completion_tokens?: number; }
interface OpenAIResp {
  choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  usage?: OpenAIUsage;
  error?: { message?: string };
}

async function callOpenAIVision(
  apiKey: string,
  model: string,
  imageUrl: string,
): Promise<{ ok: boolean; data?: OpenAIResp; error?: string; status?: number }> {
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise a imagem abaixo." },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        tools: [VISION_TOOL],
        tool_choice: { type: "function", function: { name: "analyze_payment_proof" } },
        temperature: 0.1,
      }),
    });
    const data = (await r.json()) as OpenAIResp;
    if (!r.ok) {
      return { ok: false, status: r.status, error: data?.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractArgs(data: OpenAIResp): Record<string, unknown> | null {
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return null;
  try { return JSON.parse(tc.function.arguments); } catch { return null; }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

interface MsgRow {
  id: string;
  lead_id: string;
  clinic_id: string;
  media_url: string;
  media_mime: string | null;
  message_type: string;
  created_at: string;
}

async function processClinic(clinicId: string, cfg: ClinicCfg, messageIds?: string[]) {
  const supabase = sb();

  const { data: keyData } = await supabase.rpc("get_openai_key", { _clinic_id: clinicId });
  const apiKey = typeof keyData === "string" ? keyData : null;
  if (!apiKey) return { clinic_id: clinicId, processed: 0, skipped: 0, error: "no_key" };

  // budget diário (vision)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: usedToday } = await supabase
    .from("lead_ai_extraction_runs")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("kind", "vision")
    .gte("created_at", since);
  const remaining = Math.max(0, cfg.daily_budget_vision - (usedToday ?? 0));
  if (remaining === 0) {
    return { clinic_id: clinicId, processed: 0, skipped: 0, error: "daily_budget_exhausted" };
  }

  // fila: mensagens pendentes de visão
  const msgsQ = supabase
    .from("messages")
    .select("id, lead_id, clinic_id, media_url, media_mime, message_type, created_at, from_me")
    .eq("clinic_id", clinicId)
    .eq("vision_processed", false)
    .eq("from_me", false)
    .in("message_type", ["image", "document"])
    .not("media_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(Math.min(remaining, 30));
  if (messageIds?.length) msgsQ.in("id", messageIds);

  const { data: msgs, error: msgsErr } = await msgsQ;
  if (msgsErr) return { clinic_id: clinicId, error: msgsErr.message };
  if (!msgs || msgs.length === 0) return { clinic_id: clinicId, processed: 0, skipped: 0 };

  let processed = 0;
  let skipped = 0;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const m of msgs as MsgRow[]) {
    // só processa PDFs/images. PDF (document) só se mime começar com image/
    if (m.message_type === "document" && m.media_mime && !m.media_mime.startsWith("image/")) {
      await supabase.from("messages").update({ vision_processed: true }).eq("id", m.id);
      skipped++;
      continue;
    }

    // pega o lead pra checar manual_lock e contar histórico de vision desse lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id, custom_fields, manual_lock_until")
      .eq("id", m.lead_id)
      .maybeSingle();
    if (!lead) {
      await supabase.from("messages").update({ vision_processed: true }).eq("id", m.id);
      skipped++;
      continue;
    }

    const manualLocked = lead.manual_lock_until && new Date(lead.manual_lock_until) > now;

    // limite por lead (lifetime)
    const { count: perLead } = await supabase
      .from("lead_ai_extraction_runs")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", m.lead_id)
      .eq("kind", "vision");
    if ((perLead ?? 0) >= cfg.max_vision_per_lead) {
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        message_id: m.id,
        kind: "skipped",
        skipped_reason: "per_lead_vision_limit",
      });
      await supabase.from("messages").update({ vision_processed: true }).eq("id", m.id);
      skipped++;
      continue;
    }

    const r = await callOpenAIVision(apiKey, cfg.openai_model_vision, m.media_url);

    if (!r.ok) {
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        message_id: m.id,
        kind: "vision",
        model: cfg.openai_model_vision,
        error: r.error?.slice(0, 500),
      });
      if (r.status === 401) {
        await supabase
          .from("clinic_secrets")
          .update({
            openai_status: "invalid",
            openai_last_error: r.error?.slice(0, 240) ?? "401",
            openai_last_checked_at: nowIso,
          })
          .eq("clinic_id", clinicId);
        return { clinic_id: clinicId, processed, skipped, error: "invalid_key" };
      }
      // não marca vision_processed: o tick seguinte tenta de novo
      skipped++;
      continue;
    }

    const extracted = extractArgs(r.data!) ?? {};
    const confidence = typeof extracted.confidence === "number" ? Number(extracted.confidence) : 0;
    const tokensIn = r.data?.usage?.prompt_tokens ?? 0;
    const tokensOut = r.data?.usage?.completion_tokens ?? 0;
    const cost = calcCostUsd(cfg.openai_model_vision, tokensIn, tokensOut) ?? 0;

    const isProof = !!extracted.is_payment_proof;
    const readable = !!extracted.readable;
    const customFields = (lead.custom_fields ?? {}) as Record<string, unknown>;
    const fieldsSet: Record<string, unknown> = {};
    const merged = { ...customFields };

    if (isProof) {
      // sempre marca que tentou pagar quando há comprovante claro
      const canWriteTried =
        isEmpty(customFields.tentou_pagamento) ||
        (cfg.allow_overwrite_filled && confidence >= cfg.confidence_threshold);
      if (canWriteTried && !manualLocked && merged.tentou_pagamento !== true) {
        merged.tentou_pagamento = true;
        fieldsSet.tentou_pagamento = true;
      }

      // metadados do comprovante (mesclados, não sobrescrevem se já houver)
      const proofMeta = {
        method: extracted.method ?? null,
        amount_brl: extracted.amount_brl ?? null,
        paid_at: extracted.paid_at ?? null,
        payer_name: extracted.payer_name ?? null,
        receiver_name: extracted.receiver_name ?? null,
        transaction_id: extracted.transaction_id ?? null,
        confidence,
        message_id: m.id,
        analyzed_at: nowIso,
      };
      if (
        isEmpty(customFields.ultimo_comprovante) ||
        (cfg.allow_overwrite_filled && confidence >= cfg.confidence_threshold)
      ) {
        merged.ultimo_comprovante = proofMeta;
        fieldsSet.ultimo_comprovante = proofMeta;
      }
    }

    // persiste run
    await supabase.from("lead_ai_extraction_runs").insert({
      clinic_id: clinicId,
      lead_id: m.lead_id,
      message_id: m.id,
      kind: "vision",
      model: cfg.openai_model_vision,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
      fields_set: fieldsSet,
      confidence,
    });

    // atualiza lead se mudou algo
    if (Object.keys(fieldsSet).length > 0) {
      await supabase
        .from("leads")
        .update({ custom_fields: merged })
        .eq("id", m.lead_id);

      await supabase.from("lead_events").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        type: "vision_payment_proof",
        payload: {
          fields: Object.keys(fieldsSet),
          confidence,
          model: cfg.openai_model_vision,
          message_id: m.id,
          cost_usd: cost,
          method: extracted.method ?? null,
          amount_brl: extracted.amount_brl ?? null,
        },
      });
    } else if (isProof && !readable) {
      // comprovante ilegível → sinaliza pra humano via evento
      await supabase.from("lead_events").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        type: "vision_unreadable",
        payload: {
          message_id: m.id,
          confidence,
          notes: extracted.notes ?? null,
        },
      });
    }

    // marca a mensagem como processada
    await supabase.from("messages").update({ vision_processed: true }).eq("id", m.id);

    processed++;
  }

  return { clinic_id: clinicId, processed, skipped };
}

interface Body {
  clinic_id?: string;
  message_ids?: string[];
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();

  let q = supabase
    .from("clinic_secrets")
    .select("clinic_id, openai_status, clinics:clinic_id(classifier_config)");
  if (body.clinic_id) q = q.eq("clinic_id", body.clinic_id);

  const { data: secrets, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const s of (secrets ?? []) as any[]) {
    if (s.openai_status !== "configured" && !body.force) continue;
    const cfg = mergeCfg(s.clinics?.classifier_config);
    const r = await processClinic(s.clinic_id, cfg, body.message_ids);
    results.push(r);
  }

  return json({ ok: true, results });
});
