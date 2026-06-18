// supabase/functions/pipeline-classify/index.ts
//
// Marco 2 — Classifier LLM para pipeline v4.2.
//
// Lê o histórico recente do lead (desde last_processed_message_id_classifier) e
// devolve um JSON estruturado com:
//   - stage_suggestion (canon name)
//   - confidence ∈ [0,1]
//   - is_b2b (boolean)
//   - tags_suggested (string[])
//   - custom_fields_patch (object)
//   - reasons (string[])
//
// Comportamento:
//   - SEMPRE grava lead_events 'auto:classifier' com payload completo.
//   - Atualiza last_processed_message_id_classifier no fim.
//   - confidence < 0.6 → tag `precisa_atencao_humana`.
//   - is_b2b=true + automation.b2b_move.enabled + confidence ≥ 0.9 → move para
//     "B2B / Stakeholders" via pipelineMove (gate G3 já aplicado por toggle).
//   - NUNCA move para stage_suggestion automaticamente — isso é função dos
//     auditores no Marco 2.5.
//
// Tool A3 (opcional, gateada por automation.classifier.history_tool_enabled):
//   - `get_lead_history(lead_id)` — devolve resumos curtos dos últimos eventos
//     e classificações pra dar mais contexto quando o snippet recente não basta.
//
// Acessada por:
//   - Cron `pipeline-classify-tick` (a cada 1 min) → action=tick (processa fila)
//   - Invocação manual com action=lead + lead_id (smoke test)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^2";
import { generateText, tool, Output, stepCountIs } from "npm:ai@^6";
import { z } from "npm:zod@^3";
import { pipelineMove } from "../_shared/pipeline-move.ts";
import { runSummarize } from "../_shared/pipeline-summarize-core.ts";
import { runNfTask, runPaymentAlleged } from "../_shared/pipeline-tasks.ts";
import { runJudicializacao, runRenovacaoReceita, runObjectionSuggest } from "../_shared/pipeline-fase4.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "openai/gpt-5-mini";
const BATCH_LIMIT = 50;
const MAX_MSGS = 30;

type Canon =
  | "Novo"
  | "Qualificação"
  | "Consulta agendada"
  | "Tratamento agendado"
  | "Consulta finalizada"
  | "Em tratamento"
  | "Sem resposta"
  | "Nutrição inativa"
  | "Paciente antigo"
  | "B2B / Stakeholders";

const CANON_NAMES: Canon[] = [
  "Novo",
  "Qualificação",
  "Consulta agendada",
  "Tratamento agendado",
  "Consulta finalizada",
  "Em tratamento",
  "Sem resposta",
  "Nutrição inativa",
  "Paciente antigo",
  "B2B / Stakeholders",
];

const INTENT_VALUES = [
  "agendamento",
  "reagendamento",
  "duvida_geral",
  "nf_reembolso",
  "pagamento_alegado",
  "desistencia",
  "interesse_tratamento",
  "judicializacao",
  "renovacao_receita",
  "objecao",
  "outro",
] as const;

const ClassificationSchema = z.object({
  stage_suggestion: z.enum([
    "Novo",
    "Qualificação",
    "Consulta agendada",
    "Tratamento agendado",
    "Consulta finalizada",
    "Em tratamento",
    "Sem resposta",
    "Nutrição inativa",
    "Paciente antigo",
    "B2B / Stakeholders",
  ]),
  intent: z.enum(INTENT_VALUES).default("outro"),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  tags_suggested: z.array(z.string()).max(8),
  custom_fields_patch: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  reasons: z.array(z.string()).min(1).max(5),
});

type Classification = z.infer<typeof ClassificationSchema>;

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
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
  return (data?.stage_id as string) ?? null;
}

async function addTag(client: SupabaseClient, leadId: string, tag: string) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  if (current.includes(tag)) return;
  await client.from("leads").update({ tags: [...current, tag] }).eq("id", leadId);
}

function buildSystemPrompt(pipelineSummary: string): string {
  return `Você é um classificador determinístico de um pipeline de CRM médico.
Sua tarefa: ler o histórico de mensagens de um lead e devolver UMA classificação JSON.

Pipeline canônico v4.2 (use exatamente estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": secretária/atendente humano já interagiu, descobrindo demanda.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado.
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder.
- "Nutrição inativa": sem retorno há muito tempo.
- "Paciente antigo": ciclo de tratamento já encerrado.
- "B2B / Stakeholders": contato comercial/parceria, NÃO paciente.

Regras:
- confidence reflete sua certeza. Use ≤ 0.5 quando o histórico for ambíguo ou muito curto.
- is_b2b=true SOMENTE se o lead claramente representa empresa/parceiro/fornecedor.
- tags_suggested ∈ whitelist v4.2 (use apenas se realmente aplicar).
- custom_fields_patch: só inclua chaves se há evidência clara no texto.
- reasons: 1-5 frases curtas em PT-BR justificando.

Campo intent (escolha UM):
- "agendamento": lead pedindo para marcar consulta/tratamento.
- "reagendamento": lead pedindo para remarcar.
- "duvida_geral": pergunta sobre serviço, valores, planos.
- "nf_reembolso": lead pedindo nota fiscal, recibo, ou docs p/ reembolso.
- "pagamento_alegado": lead afirma ter pago/enviou comprovante (sem confirmação oficial).
- "desistencia": lead diz que não quer mais.
- "interesse_tratamento": lead demonstra interesse em começar tratamento.
- "judicializacao": lead/familiar menciona processo judicial, advogado, ação, Procon, ou ameaça legal.
- "renovacao_receita": lead pedindo renovação de receita/prescrição (paciente já tratado).
- "objecao": lead levantou objeção clara (preço, distância, medo, descrença) que pode ser respondida.
- "outro": nenhum acima se encaixa.

Contexto do pipeline atual do lead: ${pipelineSummary}`;
}

function formatMessages(msgs: Array<{ from_me: boolean; content: string | null; created_at: string }>): string {
  return msgs
    .map((m) => `[${m.created_at.slice(0, 16)}] ${m.from_me ? "ATENDENTE" : "LEAD"}: ${(m.content ?? "").slice(0, 600)}`)
    .join("\n");
}

async function classifyOne(client: SupabaseClient, leadId: string) {
  const { data: lead } = await client
    .from("leads")
    .select(
      "id, clinic_id, pipeline_id, stage_id, custom_fields, tags, last_processed_message_id_classifier",
    )
    .eq("id", leadId)
    .single();
  if (!lead) return { skipped: "lead_not_found" };
  if (!lead.pipeline_id) return { skipped: "no_pipeline" };

  // Fetch up to MAX_MSGS most recent messages
  const { data: msgs } = await client
    .from("messages")
    .select("id, from_me, content, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(MAX_MSGS);
  const orderedMsgs = (msgs ?? []).reverse();
  if (orderedMsgs.length === 0) return { skipped: "no_messages" };

  // Build pipeline summary
  const { data: stage } = await client
    .from("pipeline_stages")
    .select("name")
    .eq("id", lead.stage_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  const pipelineSummary = `stage atual=${stage?.name ?? "?"}; tags=${(lead.tags ?? []).join(",") || "nenhuma"}`;

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": LOVABLE_KEY,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  // Optional A3 tool: get_lead_history
  const historyToolEnabled = await isEnabled(client, "automation.classifier.history_tool_enabled");
  const tools = historyToolEnabled
    ? {
        get_lead_history: tool({
          description:
            "Retorna eventos passados e classificações anteriores do mesmo lead (último ano, máx 30 itens). Use quando o snippet recente não for suficiente para classificar com confiança.",
          inputSchema: z.object({ lead_id: z.string().uuid() }),
          execute: async ({ lead_id }: { lead_id: string }) => {
            if (lead_id !== leadId) return { error: "lead_id_mismatch" };
            const { data: events } = await client
              .from("lead_events")
              .select("type, payload, created_at")
              .eq("lead_id", leadId)
              .order("created_at", { ascending: false })
              .limit(30);
            return { events: events ?? [] };
          },
        }),
      }
    : undefined;

  const { output } = await generateText({
    model: gateway(MODEL),
    system: buildSystemPrompt(pipelineSummary),
    prompt: `Histórico recente do lead (id=${leadId}):\n\n${formatMessages(orderedMsgs)}\n\nClassifique agora.`,
    output: Output.object({ schema: ClassificationSchema }),
    tools,
    stopWhen: stepCountIs(50),
  });

  const cls = output as Classification;

  // Persist event
  await client.from("lead_events").insert({
    clinic_id: lead.clinic_id,
    lead_id: leadId,
    type: "auto:classifier",
    payload: cls as unknown as Record<string, unknown>,
  });

  // Apply tags from suggestion (only whitelist subset + always tag low confidence)
  if (cls.confidence < 0.6) {
    await addTag(client, leadId, "precisa_atencao_humana");
  }

  // B2B auto-move (only when toggle + high confidence)
  const b2bEnabled = await isEnabled(client, "automation.b2b_move.enabled");
  if (cls.is_b2b && b2bEnabled && cls.confidence >= 0.9) {
    const b2bId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "B2B / Stakeholders");
    if (b2bId && lead.stage_id !== b2bId) {
      await pipelineMove(client, {
        leadId,
        toStageId: b2bId,
        source: "auto:classifier-b2b",
        reason: `Classifier B2B (conf=${cls.confidence.toFixed(2)})`,
        ruleKey: "automation.b2b_move.enabled",
        idempotencyKey: `b2b:${leadId}:${orderedMsgs[orderedMsgs.length - 1].id}`,
      });
    }
  }

  // Marco 3 — task triggers a partir do intent.
  let nfTaskResult: unknown = null;
  let paymentAllegedResult: unknown = null;
  if (cls.intent === "nf_reembolso") {
    nfTaskResult = await runNfTask(client, {
      leadId,
      clinicId: lead.clinic_id,
      stageName: stage?.name ?? null,
    });
  }

  // Marco 4 — judicialização, renovação receita, sugestão objeção.
  let judResult: unknown = null;
  let renovResult: unknown = null;
  let objResult: unknown = null;
  if (cls.intent === "judicializacao") {
    judResult = await runJudicializacao(client, {
      leadId,
      clinicId: lead.clinic_id,
      reasons: cls.reasons,
    });
  }
  if (cls.intent === "renovacao_receita") {
    renovResult = await runRenovacaoReceita(client, {
      leadId,
      clinicId: lead.clinic_id,
      stageName: stage?.name ?? null,
    });
  }
  if (cls.intent === "objecao") {
    objResult = await runObjectionSuggest(client, {
      leadId,
      clinicId: lead.clinic_id,
      reasons: cls.reasons,
    });
  }
  if (cls.intent === "pagamento_alegado") {
    paymentAllegedResult = await runPaymentAlleged(client, {
      leadId,
      clinicId: lead.clinic_id,
    });
  }

  // Marco 3 — summarizer (força se intent não trivial).
  const summarizeForce = cls.intent !== "outro";
  const summarizeResult = await runSummarize(client, leadId, {
    force: summarizeForce,
    reason: summarizeForce ? `intent:${cls.intent}` : "post_classify",
  }).catch((err) => ({ status: "error" as const, reason: err instanceof Error ? err.message : String(err) }));

  // Update watermark + clear flag
  const lastMsgId = orderedMsgs[orderedMsgs.length - 1].id;
  await client
    .from("leads")
    .update({
      last_processed_message_id_classifier: lastMsgId,
      needs_ai_review: false,
      last_classified_at: new Date().toISOString(),
      ai_review_reasons: (
        await client.from("leads").select("ai_review_reasons").eq("id", leadId).single()
      ).data?.ai_review_reasons?.filter((r: string) => r !== "pipeline-classifier") ?? [],
    })
    .eq("id", leadId);

  return {
    classification: cls,
    last_message_id: lastMsgId,
    summarize: summarizeResult,
    nf_task: nfTaskResult,
    payment_alleged: paymentAllegedResult,
    judicializacao: judResult,
    renovacao_receita: renovResult,
    objection_suggest: objResult,
  };
}

async function tickQueue(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.classifier.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: leads } = await client
    .from("leads")
    .select("id")
    .eq("needs_ai_review", true)
    .lte("ai_review_queued_at", new Date().toISOString())
    .contains("ai_review_reasons", ["pipeline-classifier"])
    .limit(BATCH_LIMIT);

  const results: Array<Record<string, unknown>> = [];
  for (const l of leads ?? []) {
    try {
      const r = await classifyOne(client, l.id);
      results.push({ lead_id: l.id, ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("classify failed", l.id, msg);
      results.push({ lead_id: l.id, ok: false, error: msg });
      // Don't leave the lead in a re-poll loop forever — push queue 10 min ahead
      await client
        .from("leads")
        .update({ ai_review_queued_at: new Date(Date.now() + 10 * 60_000).toISOString() })
        .eq("id", l.id);
    }
  }
  return { processed: results.length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;
    if (body.action === "tick") {
      result = await tickQueue(client);
    } else if (body.action === "lead") {
      if (!body.lead_id) throw new Error("lead_id required");
      result = await classifyOne(client, body.lead_id);
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(JSON.stringify({ action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-classify error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
