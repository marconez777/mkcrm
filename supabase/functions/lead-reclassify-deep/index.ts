// lead-reclassify-deep — reclassificação profunda lead-a-lead (F1)
// Lê a conversa inteira de um lead e propõe stage destino + patch de custom_fields
// via Lovable AI Gateway (Gemini 3 Flash). NÃO move o lead — grava em
// lead_reclassify_proposals como status='pending'.
//
// Input (POST):
//   { lead_id: string, batch_tag: string, dry_run?: boolean }
// ou em lote:
//   { stage_id: string, batch_tag: string, limit?: number, dry_run?: boolean }

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_MESSAGES = 200;
const HALT_USD_PER_BATCH = 6;

const STAGE_DEFS: Record<string, string> = {
  "Leads de entrada":
    "Lead novo, primeiro contato; ainda não houve qualificação clínica. Sem intenção clara de agendar.",
  "Qualificação":
    "Lead demonstrou interesse claro em algum procedimento OU já tentou agendar/pagar mas ainda sem data confirmada.",
  "Consulta agendada":
    "Existe consulta (primeira, retorno, seguimento, terapia) marcada para data FUTURA confirmada pelo paciente.",
  "Consulta finalizada":
    "Consulta já aconteceu (data passada) E não há procedimento agendado nem pagamento confirmado.",
  "Procedimento agendado":
    "Procedimento (Cetamina, EMT) tem data FUTURA confirmada mas ainda não foi pago.",
  "Procedimento pago":
    "Procedimento foi pago (comprovante recebido e confirmado pelo atendente).",
  "Em tratamento":
    "Paciente em pacote ativo de sessões (Cetamina/EMT) com saldo restante.",
  "Paciente antigo":
    "Já foi atendido na clínica (consulta ou sessão concluída), sem nada novo agendado, última interação há >30 dias OU pacote zerado.",
  "Sem resposta":
    "Atendente tentou conversar e lead simplesmente parou de responder (≥7 dias) sem chegar a qualificar.",
  "Nutrição inativa":
    "Lead frio, sem interação relevante há >90 dias, sem ter virado paciente.",
  "B2B / Stakeholders":
    "Médico parceiro, fornecedor, imprensa, administrativo da clínica — NÃO é paciente potencial.",
  "Desqualificado / Fora de escopo":
    "Paciente quer procedimento que a clínica não oferece (EMDR), perfil clínico incompatível, ou contato errado.",
};

interface LeadRow {
  id: string;
  clinic_id: string;
  name: string | null;
  phone: string;
  stage_id: string;
  custom_fields: Record<string, unknown> | null;
  manual_lock_until: string | null;
  last_message_at: string | null;
}

interface MsgRow {
  from_me: boolean;
  content: string | null;
  transcript: string | null;
  media_url: string | null;
  msg_type: string | null;
  created_at: string;
}

interface Proposal {
  stage: string;
  custom_fields_patch: Record<string, unknown>;
  reasoning: string;
  confidence: number;
}

function fmtMessages(msgs: MsgRow[]): string {
  return msgs.map((m) => {
    const ts = m.created_at.slice(0, 16).replace("T", " ");
    const dir = m.from_me ? "ATENDENTE" : "LEAD";
    let body = m.content ?? "";
    if (m.media_url && !body) {
      if (m.msg_type === "audio" && m.transcript) body = `[áudio: ${m.transcript}]`;
      else if (m.msg_type === "image") body = "[imagem]";
      else if (m.msg_type === "document") body = "[documento]";
      else body = `[${m.msg_type ?? "mídia"}]`;
    } else if (m.transcript && m.msg_type === "audio") {
      body = `[áudio: ${m.transcript}]`;
    }
    return `[${ts}] ${dir}: ${body}`;
  }).join("\n");
}

function buildPrompt(lead: LeadRow, msgs: MsgRow[]): string {
  const stagesList = Object.entries(STAGE_DEFS)
    .map(([n, d]) => `- "${n}": ${d}`).join("\n");

  return `Hoje é ${new Date().toISOString().slice(0, 10)} (UTC). Você está reclassificando um lead da Clínica ÓR (psiquiatria/cetamina/EMT/terapia).

OBJETIVO: ler a conversa inteira abaixo e decidir em qual das 11 colunas o lead deve estar AGORA, ignorando completamente a coluna atual e os custom_fields atuais (que podem estar errados ou alucinados).

COLUNAS POSSÍVEIS:
${stagesList}

REGRAS CRÍTICAS:
1. NUNCA invente datas. Só preencha consulta_agendada_em / procedimento_agendado_em se a data EXATA (dia+mês) aparecer literalmente nas mensagens recentes E o lead tiver confirmado.
2. Se a última menção a agendamento for de meses atrás e a data já passou, a consulta foi REALIZADA (não está "agendada").
3. Comprovante de pagamento + atendente respondendo "Agendado/Recebido/Confirmado/OK" = pagamento_confirmado=true.
4. Paciente antigo: já fez consulta ou sessão E não há nada novo marcado E última mensagem >30 dias. NÃO confundir com "Nutrição inativa" (esse nunca virou paciente).
5. Se o lead é claramente médico parceiro / fornecedor / administrativo → "B2B / Stakeholders".
6. Se pede EMDR / procedimento não oferecido → "Desqualificado / Fora de escopo".

LEAD: ${lead.name ?? "(sem nome)"} (${lead.phone})
Última mensagem: ${lead.last_message_at ?? "nunca"}
custom_fields atual (use só como pista, pode estar errado): ${JSON.stringify(lead.custom_fields ?? {})}

CONVERSA (mais antiga → mais recente, ${msgs.length} mensagens):
${fmtMessages(msgs)}

Retorne SOMENTE via a tool call \`classify_lead\`. No campo custom_fields_patch, inclua apenas os campos que você TEM CERTEZA pela conversa (qualificacao, tipo_atendimento, status_consulta, pagamento_confirmado, consulta_agendada_em, procedimento_agendado_em, tipo_contato, is_b2b, sessao_total, saldo_sessoes_pacote). Deixe vazio se não tiver certeza.`;
}

const TOOL_DEF = {
  type: "function",
  function: {
    name: "classify_lead",
    description: "Classifica um lead numa das 11 colunas da Clínica ÓR.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["stage", "custom_fields_patch", "reasoning", "confidence"],
      properties: {
        stage: { type: "string", enum: Object.keys(STAGE_DEFS) },
        custom_fields_patch: {
          type: "object",
          description: "Patch a aplicar nos custom_fields (merge). Inclua só campos certos.",
          additionalProperties: true,
        },
        reasoning: {
          type: "string",
          description: "Justificativa de 2-4 frases citando trechos específicos da conversa.",
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
  },
};

async function callAI(prompt: string): Promise<{ proposal: Proposal; tokens_in: number; tokens_out: number; cost: number; raw: unknown }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      tools: [TOOL_DEF],
      tool_choice: { type: "function", function: { name: "classify_lead" } },
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`gateway ${r.status}: ${body.slice(0, 400)}`);
  }
  const data = await r.json() as any;
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("no tool call in response");
  let args: Proposal;
  try { args = JSON.parse(call.function.arguments); }
  catch (e) { throw new Error(`bad json in tool args: ${String(e)}`); }
  if (!args.stage || !(args.stage in STAGE_DEFS)) throw new Error(`invalid stage: ${args.stage}`);
  const tokens_in = data?.usage?.prompt_tokens ?? 0;
  const tokens_out = data?.usage?.completion_tokens ?? 0;
  // Gemini 3 Flash Preview (Lovable rate): ~$0.10/1M in, $0.40/1M out (estimate)
  const cost = (tokens_in * 0.10 + tokens_out * 0.40) / 1_000_000;
  return { proposal: args, tokens_in, tokens_out, cost, raw: data };
}

async function processLead(
  supabase: ReturnType<typeof sb>,
  lead_id: string,
  batch_tag: string,
  dry_run: boolean,
): Promise<{ status: string; lead_id: string; error?: string; proposed_stage?: string; cost?: number }> {
  const { data: leadRow, error: leErr } = await supabase
    .from("leads")
    .select("id, clinic_id, name, phone, stage_id, custom_fields, manual_lock_until, last_message_at")
    .eq("id", lead_id).maybeSingle();
  if (leErr || !leadRow) return { status: "error", lead_id, error: leErr?.message ?? "lead_not_found" };
  const lead = leadRow as LeadRow;

  if (lead.manual_lock_until && new Date(lead.manual_lock_until).getTime() > Date.now()) {
    return { status: "skipped", lead_id, error: "manual_lock_active" };
  }

  // dedup: já tem proposta pending nesse batch?
  const { data: existing } = await supabase
    .from("lead_reclassify_proposals")
    .select("id").eq("lead_id", lead_id).eq("batch_tag", batch_tag).eq("status", "pending").limit(1);
  if (existing && existing.length > 0) {
    return { status: "skipped", lead_id, error: "duplicate_pending" };
  }

  // halt por custo
  const { data: spentRows } = await supabase
    .from("lead_reclassify_proposals")
    .select("cost_usd").eq("batch_tag", batch_tag);
  const spent = (spentRows ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd ?? 0), 0);
  if (spent > HALT_USD_PER_BATCH) {
    return { status: "skipped", lead_id, error: `halt_budget:${spent.toFixed(4)}` };
  }

  // snapshot (upsert idempotente)
  await supabase.from("lead_reclassify_snapshot_2026_06").upsert({
    lead_id: lead.id,
    clinic_id: lead.clinic_id,
    stage_id: lead.stage_id,
    custom_fields: lead.custom_fields ?? {},
  }, { onConflict: "lead_id", ignoreDuplicates: true });

  // mensagens
  const { data: msgs } = await supabase
    .from("messages")
    .select("from_me, content, transcript, media_url, msg_type, created_at")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);
  const messages = (msgs ?? []) as MsgRow[];

  // resolve stage id da proposta
  const prompt = buildPrompt(lead, messages);
  let proposal: Proposal, tokens_in = 0, tokens_out = 0, cost = 0;
  try {
    const r = await callAI(prompt);
    proposal = r.proposal; tokens_in = r.tokens_in; tokens_out = r.tokens_out; cost = r.cost;
  } catch (e) {
    if (!dry_run) {
      await supabase.from("lead_reclassify_proposals").insert({
        clinic_id: lead.clinic_id, lead_id: lead.id, batch_tag,
        current_stage_id: lead.stage_id, proposed_stage_id: lead.stage_id,
        proposed_custom_fields: {}, confidence: 0, reasoning: "ai_error",
        model: MODEL, status: "error", error: String(e).slice(0, 500),
      });
    }
    return { status: "error", lead_id, error: String(e).slice(0, 200) };
  }

  // resolve stage_id pelo nome dentro do mesmo pipeline do lead
  const { data: currentStage } = await supabase
    .from("pipeline_stages").select("pipeline_id").eq("id", lead.stage_id).maybeSingle();
  if (!currentStage) return { status: "error", lead_id, error: "current_stage_not_found" };
  const { data: targetStage } = await supabase
    .from("pipeline_stages").select("id")
    .eq("pipeline_id", (currentStage as any).pipeline_id)
    .eq("name", proposal.stage).maybeSingle();
  if (!targetStage) return { status: "error", lead_id, error: `target_stage_not_in_pipeline:${proposal.stage}` };

  if (dry_run) {
    return { status: "dry_run", lead_id, proposed_stage: proposal.stage, cost };
  }

  const { error: insErr } = await supabase.from("lead_reclassify_proposals").insert({
    clinic_id: lead.clinic_id,
    lead_id: lead.id,
    batch_tag,
    current_stage_id: lead.stage_id,
    proposed_stage_id: (targetStage as any).id,
    proposed_custom_fields: proposal.custom_fields_patch ?? {},
    confidence: proposal.confidence,
    reasoning: proposal.reasoning,
    model: MODEL,
    tokens_in,
    tokens_out,
    cost_usd: cost,
    status: "pending",
  });
  if (insErr) return { status: "error", lead_id, error: insErr.message };

  return { status: "pending", lead_id, proposed_stage: proposal.stage, cost };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { lead_id?: string; stage_id?: string; batch_tag?: string; limit?: number; dry_run?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!body.batch_tag) return json({ error: "batch_tag_required" }, 400);
  const dry_run = !!body.dry_run;
  const supabase = sb();

  // modo single
  if (body.lead_id) {
    const r = await processLead(supabase, body.lead_id, body.batch_tag, dry_run);
    return json({ ok: true, dry_run, results: [r] });
  }

  // modo lote por stage
  if (body.stage_id) {
    const limit = Math.min(body.limit ?? 25, 100);
    const { data: leads } = await supabase
      .from("leads").select("id")
      .eq("stage_id", body.stage_id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    const results: unknown[] = [];
    for (const l of (leads ?? []) as Array<{ id: string }>) {
      try { results.push(await processLead(supabase, l.id, body.batch_tag, dry_run)); }
      catch (e) { results.push({ status: "error", lead_id: l.id, error: String(e).slice(0, 200) }); }
    }
    return json({ ok: true, dry_run, count: results.length, results });
  }

  return json({ error: "lead_id_or_stage_id_required" }, 400);
});
