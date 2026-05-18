// Roda 1x/dia (cron às 23:00 UTC = 20:00 BRT).
// Para cada whatsapp_instance com watcher_agent_id configurado:
//  - pega leads do watcher_pipeline_id (ou de qualquer pipeline se não configurado)
//  - ignora arquivados e estágios terminais (is_terminal = true)
//  - só enfileira se houver inbound novo desde a última classificação
// Enfileira em pending_replies e dispara o scheduled-dispatcher uma vez.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  const { data: instances, error: instErr } = await supabase
    .from("whatsapp_instances")
    .select("id, clinic_id, watcher_agent_id, watcher_pipeline_id")
    .not("watcher_agent_id", "is", null);

  if (instErr) return json({ error: instErr.message }, 500);

  const runAt = new Date().toISOString();
  const report: any[] = [];
  let totalQueued = 0;

  for (const inst of instances ?? []) {
    // Estágios terminais a excluir (ganhos/perdidos)
    let terminalStageIds: string[] = [];
    if (inst.watcher_pipeline_id) {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", inst.watcher_pipeline_id)
        .eq("is_terminal", true);
      terminalStageIds = (stages ?? []).map((s: any) => s.id);
    } else {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("clinic_id", inst.clinic_id)
        .eq("is_terminal", true);
      terminalStageIds = (stages ?? []).map((s: any) => s.id);
    }

    let q = supabase
      .from("leads")
      .select("id, last_message_at, last_classified_at, stage_id")
      .eq("whatsapp_instance_id", inst.id)
      .is("archived_at", null)
      .not("last_message_at", "is", null)
      .limit(BATCH);

    if (inst.watcher_pipeline_id) q = q.eq("pipeline_id", inst.watcher_pipeline_id);
    if (terminalStageIds.length) q = q.not("stage_id", "in", `(${terminalStageIds.join(",")})`);

    const { data: leads, error } = await q;
    if (error) {
      report.push({ instance: inst.id, error: error.message });
      continue;
    }

    let queued = 0, skipped = 0;
    for (const l of leads ?? []) {
      // Pula se não tem mensagem nova desde a última classificação
      if (l.last_classified_at && l.last_message_at && new Date(l.last_classified_at) >= new Date(l.last_message_at)) {
        skipped++;
        continue;
      }
      // Confirma ao menos um inbound (from_me=false)
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", l.id)
        .eq("from_me", false)
        .limit(1);
      if (!count) { skipped++; continue; }

      const { error: upErr } = await supabase.from("pending_replies").upsert(
        {
          lead_id: l.id, agent_id: inst.watcher_agent_id, run_at: runAt,
          clinic_id: inst.clinic_id, status: "pending", attempts: 0,
          last_error: null, claimed_at: null,
        },
        { onConflict: "lead_id,agent_id" },
      );
      if (!upErr) queued++; else skipped++;
    }

    totalQueued += queued;
    report.push({ instance: inst.id, scanned: leads?.length ?? 0, queued, skipped });
  }

  // Dispara o dispatcher uma vez para processar tudo
  if (totalQueued > 0) {
    try {
      await fetch(`${FUNCTIONS_URL}/scheduled-dispatcher`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: "{}",
      });
    } catch (e) { console.error("dispatcher kick failed", e); }
  }

  return json({ ok: true, total_queued: totalQueued, instances: report });
});
