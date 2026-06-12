// extractor-tick — cron 10 min.
// Lê leads marcados (needs_ai_review=true) e usa a chave OpenAI da clínica (BYOK)
// pra preencher custom fields ainda vazios via gpt-5-nano (structured output / tool calling).
//
// Salvaguardas:
//   - só processa clínicas com openai_status='configured'
//   - respeita manual_lock_until (não sobrescreve)
//   - só preenche campos vazios, a menos que classifier_config.allow_overwrite_filled=true
//     E confidence >= threshold
//   - limites configuráveis: max_messages_per_extraction, max_extractions_per_lead_per_day,
//     daily_budget_extractions
//   - registra cada execução em lead_ai_extraction_runs (uniq (lead_id, message_id, kind))
//   - silenciosamente pula leads que excedam budget (kind=skipped)
//
// Trigger via cron OU via POST manual (force=true, clinic_id, lead_ids).

import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { calcCostUsd } from "../_shared/ai-pricing.ts";

interface ClinicCfg {
  manual_lock_minutes: number;
  confidence_threshold: number;
  max_messages_per_extraction: number;
  max_extractions_per_lead_per_day: number;
  daily_budget_extractions: number;
  allow_overwrite_filled: boolean;
  openai_status: string;
  openai_model_text: string;
}

const DEFAULTS: ClinicCfg = {
  manual_lock_minutes: 30,
  confidence_threshold: 0.7,
  max_messages_per_extraction: 8,
  max_extractions_per_lead_per_day: 3,
  daily_budget_extractions: 200,
  allow_overwrite_filled: false,
  openai_status: "empty",
  openai_model_text: "gpt-5-nano",
};

function mergeCfg(raw: any): ClinicCfg {
  return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
}

// JSON schema do tool de extração
const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_lead_fields",
    description:
      "Extrai informações estruturadas de uma conversa de WhatsApp entre uma clínica de psiquiatria e um lead. Preencha apenas o que estiver explícito ou claramente subentendido na conversa. Use null quando não tiver certeza.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: {
          type: "number",
          description: "Confiança geral na extração de 0 a 1.",
        },
        procedimento_interesse: {
          type: ["string", "null"],
          enum: [
            "cetamina",
            "emt",
            "primeira_consulta",
            "retorno",
            "seguimento",
            "terapia",
            null,
          ],
          description: "Procedimento que o lead demonstrou interesse.",
        },
        qualificacao: {
          type: ["string", "null"],
          enum: ["interessado", "em_negociacao", "desqualificado", null],
          description:
            "Estado de qualificação. 'desqualificado' apenas se pediu procedimento NÃO oferecido (ex.: EMDR).",
        },
        desqualificacao_motivo: {
          type: ["string", "null"],
          description: "Motivo curto da desqualificação, em pt-BR.",
        },
        demonstrou_interesse: { type: ["boolean", "null"] },
        tentou_pagamento: { type: ["boolean", "null"] },
        pagamento_confirmado: {
          type: ["boolean", "null"],
          description: "True só se o atendente confirmou recebimento do pagamento.",
        },
        tentou_agendar: { type: ["boolean", "null"] },
        consulta_agendada_em: {
          type: ["string", "null"],
          description: "Data/hora ISO 8601 quando o lead/clínica acordaram a consulta, se houver.",
        },
        nome_preferido: {
          type: ["string", "null"],
          description: "Nome ou primeiro nome que o lead pediu pra ser chamado, se mencionado.",
        },
        observacoes: {
          type: ["string", "null"],
          description: "Observações curtas (até 280 chars) úteis pro atendente.",
        },
      },
      required: ["confidence"],
    },
  },
} as const;

const SYSTEM_PROMPT = `Você é um extrator de dados de conversas de WhatsApp de uma clínica de psiquiatria.

Procedimentos oferecidos pela clínica:
- Infusão de Cetamina (chame de "cetamina")
- EMT (Estimulação Magnética Transcraniana — chame de "emt")
- Primeira Consulta / Avaliação inicial (chame de "primeira_consulta")
- Retorno / Reavaliação (chame de "retorno")
- Seguimento / Acompanhamento (chame de "seguimento")
- Psicoterapia / Terapia (chame de "terapia")

Procedimentos NÃO oferecidos (qualquer menção → qualificacao="desqualificado" + motivo):
- EMDR (dessensibilização e reprocessamento por movimentos oculares)
- Qualquer outro procedimento que não esteja na lista acima.

Regras:
- Use null quando a informação não estiver clara.
- Não invente datas. Só preencha consulta_agendada_em se houver uma data/hora explicitamente combinada.
- pagamento_confirmado só é true se o atendente CONFIRMOU recebimento. Lead enviando comprovante = tentou_pagamento=true.
- Confidence reflete o quão clara a informação está nas mensagens.
- Sempre chame a função extract_lead_fields exatamente uma vez.`;

interface OpenAIUsage { prompt_tokens?: number; completion_tokens?: number; }
interface OpenAIResp {
  choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  usage?: OpenAIUsage;
  error?: { message?: string };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
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
        messages,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "extract_lead_fields" } },
        // Reasoning models (gpt-5*, o1, o3, o4) only aceitam temperature=1 (default).
        ...(/^(gpt-5|o[134])/i.test(model) ? {} : { temperature: 0.1 }),
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
  try {
    return JSON.parse(tc.function.arguments);
  } catch {
    return null;
  }
}

function fieldIsEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

function applyFields(
  current: Record<string, unknown>,
  extracted: Record<string, unknown>,
  cfg: ClinicCfg,
  confidence: number,
): { merged: Record<string, unknown>; setKeys: string[] } {
  const merged = { ...current };
  const setKeys: string[] = [];
  const writable = [
    "procedimento_interesse",
    "qualificacao",
    "desqualificacao_motivo",
    "demonstrou_interesse",
    "tentou_pagamento",
    "pagamento_confirmado",
    "tentou_agendar",
    "consulta_agendada_em",
    "nome_preferido",
    "observacoes",
  ];
  for (const k of writable) {
    const newVal = extracted[k];
    if (newVal === undefined || newVal === null) continue;
    const isEmpty = fieldIsEmpty(current[k]);
    const canOverwrite =
      cfg.allow_overwrite_filled && confidence >= cfg.confidence_threshold;
    if (isEmpty || canOverwrite) {
      if (merged[k] !== newVal) {
        merged[k] = newVal;
        setKeys.push(k);
      }
    }
  }
  return { merged, setKeys };
}

interface LeadRow {
  id: string;
  clinic_id: string;
  custom_fields: Record<string, unknown> | null;
  manual_lock_until: string | null;
  ai_review_reasons: string[] | null;
  ai_review_queued_at: string | null;
  name: string | null;
  phone: string;
}

async function processClinic(clinicId: string, cfg: ClinicCfg, leadIds?: string[]) {
  const supabase = sb();

  // 1) carrega a chave
  const { data: keyData } = await supabase.rpc("get_openai_key", { _clinic_id: clinicId });
  const apiKey = typeof keyData === "string" ? keyData : null;
  if (!apiKey) return { clinic_id: clinicId, processed: 0, skipped: 0, error: "no_key" };

  // 2) budget diário
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: usedToday } = await supabase
    .from("lead_ai_extraction_runs")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("kind", "text")
    .gte("created_at", since);
  const used = usedToday ?? 0;
  const remaining = Math.max(0, cfg.daily_budget_extractions - used);
  if (remaining === 0) {
    return { clinic_id: clinicId, processed: 0, skipped: 0, error: "daily_budget_exhausted" };
  }

  // 3) leads da fila
  const leadsQ = supabase
    .from("leads")
    .select("id, clinic_id, custom_fields, manual_lock_until, ai_review_reasons, ai_review_queued_at, name, phone")
    .eq("clinic_id", clinicId)
    .eq("needs_ai_review", true)
    .order("ai_review_queued_at", { ascending: true })
    .limit(Math.min(remaining, 30));
  if (leadIds?.length) leadsQ.in("id", leadIds);

  const { data: leads, error: leadsErr } = await leadsQ;
  if (leadsErr) return { clinic_id: clinicId, error: leadsErr.message };
  if (!leads || leads.length === 0) return { clinic_id: clinicId, processed: 0, skipped: 0 };

  let processed = 0;
  let skipped = 0;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const lead of leads as LeadRow[]) {
    // manual lock
    if (lead.manual_lock_until && new Date(lead.manual_lock_until) > now) {
      // mantém na fila e segue
      skipped++;
      continue;
    }

    // limite diário por lead
    const { count: perLeadToday } = await supabase
      .from("lead_ai_extraction_runs")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("kind", "text")
      .gte("created_at", since);
    if ((perLeadToday ?? 0) >= cfg.max_extractions_per_lead_per_day) {
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        kind: "skipped",
        skipped_reason: "per_lead_daily_limit",
      });
      // tira da fila pra não ficar girando
      await supabase
        .from("leads")
        .update({ needs_ai_review: false })
        .eq("id", lead.id);
      skipped++;
      continue;
    }

    // últimas N mensagens (inbound + outbound) pra contexto
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, from_me, content, message_type, transcript, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(cfg.max_messages_per_extraction);

    const ordered = (msgs ?? []).reverse();
    const lastMessageId = ordered.length ? ordered[ordered.length - 1].id : null;

    const convo = ordered
      .map((m) => {
        const who = m.from_me ? "Atendente" : "Lead";
        let txt = (m.content ?? "").trim();
        if (!txt && m.transcript) txt = `[áudio transcrito]: ${m.transcript}`;
        if (!txt && m.message_type) txt = `[${m.message_type}]`;
        return `${who}: ${txt}`;
      })
      .join("\n");

    if (!convo.trim()) {
      skipped++;
      continue;
    }

    const userPrompt = `Conversa (mais antiga em cima, mais recente embaixo):\n\n${convo}\n\nCustom fields atuais do lead: ${JSON.stringify(lead.custom_fields ?? {})}\n\nExtraia.`;

    const r = await callOpenAI(apiKey, cfg.openai_model_text, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);

    if (!r.ok) {
      // erro -> registra mas não estoura
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        message_id: lastMessageId,
        kind: "text",
        model: cfg.openai_model_text,
        error: r.error?.slice(0, 500),
      });
      // se a chave deu 401, atualiza status
      if (r.status === 401) {
        await supabase
          .from("clinic_secrets")
          .update({ openai_status: "invalid", openai_last_error: r.error?.slice(0, 240) ?? "401", openai_last_checked_at: nowIso })
          .eq("clinic_id", clinicId);
        return { clinic_id: clinicId, processed, skipped, error: "invalid_key" };
      }
      skipped++;
      continue;
    }

    const extracted = extractArgs(r.data!) ?? {};
    const confidence = typeof extracted.confidence === "number" ? Number(extracted.confidence) : 0;
    const { merged, setKeys } = applyFields(
      lead.custom_fields ?? {},
      extracted,
      cfg,
      confidence,
    );

    const tokensIn = r.data?.usage?.prompt_tokens ?? 0;
    const tokensOut = r.data?.usage?.completion_tokens ?? 0;
    const cost = calcCostUsd(cfg.openai_model_text, tokensIn, tokensOut) ?? 0;

    // grava run
    await supabase.from("lead_ai_extraction_runs").insert({
      clinic_id: lead.clinic_id,
      lead_id: lead.id,
      message_id: lastMessageId,
      kind: "text",
      model: cfg.openai_model_text,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
      fields_set: setKeys.reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = merged[k];
        return acc;
      }, {}),
      confidence,
    });

    // atualiza o lead
    const update: Record<string, unknown> = {
      needs_ai_review: false,
      ai_review_queued_at: null,
      ai_review_reasons: [],
    };
    if (setKeys.length) update.custom_fields = merged;

    await supabase.from("leads").update(update).eq("id", lead.id);

    // evento auditável
    if (setKeys.length) {
      await supabase.from("lead_events").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        type: "ai_fields_extracted",
        payload: {
          fields: setKeys,
          confidence,
          model: cfg.openai_model_text,
          message_id: lastMessageId,
          cost_usd: cost,
        },
      });
    }

    processed++;
  }

  return { clinic_id: clinicId, processed, skipped };
}

interface Body {
  clinic_id?: string;
  lead_ids?: string[];
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();

  // Lista de clínicas com chave configurada
  let q = supabase
    .from("clinic_secrets")
    .select("clinic_id, openai_status, clinics:clinic_id(classifier_config)");
  if (body.clinic_id) q = q.eq("clinic_id", body.clinic_id);

  const { data: secrets, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const s of (secrets ?? []) as any[]) {
    if (s.openai_status !== "configured" && !body.force) continue;
    const cfg = mergeCfg((s.clinics?.classifier_config));
    if (cfg.openai_status !== "configured" && !body.force) {
      // status no clinics.classifier_config pode estar dessincronizado, mas
      // confiamos no secrets.openai_status acima
    }
    const r = await processClinic(s.clinic_id, cfg, body.lead_ids);
    results.push(r);
  }

  return json({ ok: true, results });
});
