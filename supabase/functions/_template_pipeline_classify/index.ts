// supabase/functions/_template_pipeline_classify/index.ts
// ============================================================================
// G1 — Esqueleto (template) de Agente de Pipeline por tenant.
//
// Como usar:
//   1. Copie a pasta inteira: `cp -r _template_pipeline_classify pipeline-classify-<slug>`
//   2. Troque `TENANT_SLUG` e `TENANT_CLINIC_ID` abaixo.
//   3. Cadastre o tenant em `pipeline_tenant_classifiers` (edge_function_name = "pipeline-classify-<slug>").
//   4. Ajuste `agent.ts` e `apply.ts` conforme regras do funil do cliente.
//   5. Ative com `UPDATE pipeline_tenant_classifiers SET cron_enabled=true WHERE slug='<slug>'`.
//
// O que este esqueleto já faz de graça (não reescrever):
//   • Drena fila `needs_ai_review` filtrada por `ai_review_reasons @> ['pipeline-classifier:<slug>']` (G14)
//   • Lock por lead via RPC `try_classify_lock` (G17)
//   • Backoff escalonado 2/5/30 min por falhas consecutivas
//   • Distingue erro transiente (retry) vs terminal (drop)
//   • Suporta payload `{ action:"tick", dry_run:true }` — pula `pipelineMove` sem contaminar watermark (G9)
//   • Lê `automation.<slug>.classifier_version` (v1|v2) — dark-launch de prompt novo (G16)
//   • Concorrência limitada (5 leads por tick)
//   • CORS + ações "tick" e "lead" (smoke test manual)
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { runAgent, type ClassifierVersion } from "./agent.ts";
import { applyClassification } from "./apply.ts";
import { getTenantSetting, getTenantToggle } from "../_shared/app-settings.ts";
import { isTransientAgentError } from "../_shared/classifier-ai.ts";

// ---------------------------------------------------------------------------
// TROQUE ESTAS DUAS CONSTANTES AO CLONAR
// ---------------------------------------------------------------------------
const TENANT_SLUG      = "_template_";
const TENANT_CLINIC_ID = "00000000-0000-0000-0000-000000000000";
// ---------------------------------------------------------------------------

const QUEUE_TAG       = `pipeline-classifier:${TENANT_SLUG}`;
const BATCH_LIMIT     = 50;
const CONCURRENCY     = 5;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dispatch-slug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Backoff escalonado: 1ª = 2min, 2ª = 5min, 3ª+ = 30min.
function backoffMs(fails: number): number {
  if (fails <= 1) return 2 * 60_000;
  if (fails === 2) return 5 * 60_000;
  return 30 * 60_000;
}

async function clearQueueFlag(client: SupabaseClient, leadId: string) {
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

// -----------------------------------------------------------------------------
// Processa 1 lead. Chamado pelo tick (fila) e pela ação `lead` (smoke test).
// -----------------------------------------------------------------------------
async function classifyOne(
  client: SupabaseClient,
  leadId: string,
  opts: { dryRun?: boolean; force?: boolean; version?: ClassifierVersion } = {},
) {
  // G17 — lock por lead. Evita reentrada quando um tick paralelo estoura 60s.
  const { data: locked } = await client.rpc("try_classify_lock", { _lead_id: leadId });
  if (locked === false) return { skipped: "locked_by_other_worker" };

  // Confirma tenant (defesa em profundidade — fila já filtra por slug).
  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, last_processed_message_id_classifier, last_processed_message_id_classifier_dry")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { skipped: "lead_not_found" };
  if (lead.clinic_id !== TENANT_CLINIC_ID) return { skipped: "wrong_tenant" };

  const watermarkCol = opts.dryRun
    ? "last_processed_message_id_classifier_dry"
    : "last_processed_message_id_classifier";
  const watermark = (lead as Record<string, unknown>)[watermarkCol] as string | null;

  // Carrega mensagens novas depois do watermark.
  let msgQuery = client
    .from("messages")
    .select("id, direction, body, created_at, from_me")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (watermark && !opts.force) msgQuery = msgQuery.gt("id", watermark);
  const { data: messages } = await msgQuery;

  if (!messages?.length && !opts.force) {
    await clearQueueFlag(client, leadId);
    return { skipped: "no_new_messages" };
  }

  // G16 — versão do classifier vem do setting; opts.version tem prioridade (smoke test).
  const version: ClassifierVersion = opts.version
    ?? (((await getTenantSetting(client, TENANT_SLUG, "classifier_version")) === "v2") ? "v2" : "v1");

  // Executa a esteira de micro-agentes (definida em agent.ts).
  const agentOut = await runAgent(client, { lead, messages: messages ?? [] }, { version });
  if ("error" in agentOut) {
    if (isTransientAgentError(agentOut.error)) {
      throw new Error(`agent_error_transient:${agentOut.error}`);
    }
    await clearQueueFlag(client, leadId);
    return { skipped: `agent_error:${agentOut.error}`, version };
  }

  // Aplica a classificação (mover card / tags / custom_fields) — respeitando dry_run.
  const applied = await applyClassification(client, {
    lead,
    classification: agentOut.classification,
    dryRun: !!opts.dryRun,
    tenantSlug: TENANT_SLUG,
  });

  // Avança o watermark correto (G9: dry_run avança APENAS o dry).
  const lastMessageId = messages?.[messages.length - 1]?.id ?? watermark;
  if (lastMessageId) {
    await client
      .from("leads")
      .update({ [watermarkCol]: lastMessageId })
      .eq("id", leadId);
  }

  await clearQueueFlag(client, leadId);
  return { ok: true, dry_run: !!opts.dryRun, version, applied };
}

// -----------------------------------------------------------------------------
// Tick: drena a fila do namespace `pipeline-classifier:<slug>`.
// -----------------------------------------------------------------------------
async function tick(client: SupabaseClient, opts: { dryRunOverride?: boolean } = {}) {
  if (!(await getTenantToggle(client, TENANT_SLUG, "enabled"))) {
    return { skipped: "toggle_off" };
  }
  // G9 — dry_run pode vir do payload (smoke test) OU do setting `automation.<slug>.dry_run`.
  const dryRun = opts.dryRunOverride === true
    ? true
    : await getTenantToggle(client, TENANT_SLUG, "dry_run");
  // G16 — resolve versão do classifier UMA vez por tick (evita N leituras em `app_settings`).
  const version: ClassifierVersion =
    ((await getTenantSetting(client, TENANT_SLUG, "classifier_version")) === "v2") ? "v2" : "v1";

  const { data: leads } = await client
    .from("leads")
    .select("id, ai_review_fail_count")
    .eq("clinic_id", TENANT_CLINIC_ID)
    .eq("needs_ai_review", true)
    .lte("ai_review_queued_at", new Date().toISOString())
    .contains("ai_review_reasons", [QUEUE_TAG])
    .order("ai_review_queued_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  const queue = [...(leads ?? [])];
  const results: Array<Record<string, unknown>> = [];

  async function worker() {
    while (queue.length) {
      const l = queue.shift();
      if (!l) break;
      const fails = (l.ai_review_fail_count as number | null) ?? 0;
      try {
        const r = await classifyOne(client, l.id as string, { dryRun });
        results.push({ lead_id: l.id, ok: true, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ lead_id: l.id, ok: false, error: msg });
        // Reagenda com backoff escalonado (transientes).
        const nextFails = fails + 1;
        await client
          .from("leads")
          .update({
            ai_review_queued_at: new Date(Date.now() + backoffMs(nextFails)).toISOString(),
            ai_review_fail_count: nextFails,
          })
          .eq("id", l.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { processed: results.length, dry_run: dryRun, results };
}

// -----------------------------------------------------------------------------
// HTTP handler
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;

    if (body.action === "tick") {
      result = await tick(client, { dryRunOverride: body.dry_run === true });
    } else if (body.action === "lead") {
      if (!body.lead_id) throw new Error("lead_id required");
      result = await classifyOne(client, body.lead_id, {
        dryRun: body.dry_run === true,
        force: body.force === true,
      });
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(JSON.stringify({ tenant: TENANT_SLUG, action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, tenant: TENANT_SLUG, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${TENANT_SLUG}] error:`, msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
