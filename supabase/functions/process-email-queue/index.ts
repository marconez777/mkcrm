// Edge Function: process-email-queue
// 1) Reaper: jobs travados em "processing" > 10min voltam para pending.
// 2) Pega até BATCH_SIZE jobs pending, marca como processing.
// 3) Envia em paralelo (chunks) via send-email.
// Backoff: quota → 9h BRT amanhã; rate-limit → respeita Retry-After.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 1000;           // Tier 4: ↑ de 400 — drena mais por ciclo
const CONCURRENCY = 5;             // Tier 4: ↑ de 2 — Resend permite 5 req/s por team
const BATCH_PARALLELISM = 5;       // Tier 4: ↑ de 3 — 5×100 = 500 emails/rajada
const STALE_PROCESSING_MIN = 10;
const SELF_TRIGGER_THRESHOLD = 100; // ↑ de 50 — evita re-trigger desnecessário com BATCH_SIZE maior
const BATCH_GROUP_MIN = 2;         // Tier 4: ↓ de 3 — agrupa em Batch API mais cedo

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const nowIso = new Date().toISOString();

    // 1) reaper — devolve jobs travados em "processing"
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MIN * 60_000).toISOString();
    await supabase
      .from("email_queue")
      .update({ status: "pending", updated_at: nowIso })
      .eq("status", "processing")
      .lt("updated_at", staleCutoff);

    // R-7: prioridade primeiro (1=auth/urgente, 5=padrão, 9=baixa), depois horário
    const { data: jobs } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!jobs?.length) return jsonResponse({ processed: 0 });

    const ids = jobs.map((j: any) => j.id);
    await supabase
      .from("email_queue")
      .update({ status: "processing", updated_at: nowIso })
      .in("id", ids)
      .eq("status", "pending");

    const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
    const batchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-batch`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let sent = 0, failed = 0, cancelled = 0;

    // ===== Buckets para bulk-update (1 query por status no fim) =====
    const sentNow: string[] = [];               // status='sent'
    const failedTerminal: Array<{ id: string; attempts: number; error: string }> = [];
    const rescheduled: Array<{ id: string; attempts: number; scheduled_at: string; error: string }> = [];

    function bucketFailure(job: any, errMsg: string) {
      failed++;
      const lower = errMsg.toLowerCase();
      const attempts = job.attempts || 0;
      const isPermanentTemplate = lower.includes("not found or inactive");
      const isPermanentEmail = lower.includes("invalid `to` field") || lower.includes("invalid to field");
      const isPermanentDomain = lower.includes("not verified");
      const isQuota = lower.includes("daily email sending quota") || lower.includes("quota exceeded") || lower.includes("quota_reached");
      const isRateLimit = lower.includes("rate limit") || /retry after\s+\d+/i.test(errMsg);

      if (isPermanentTemplate || isPermanentEmail || isPermanentDomain) {
        failedTerminal.push({ id: job.id, attempts: attempts + 1, error: errMsg });
        return;
      }
      if (isQuota) {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(12, 0, 0, 0);
        rescheduled.push({ id: job.id, attempts, scheduled_at: tomorrow.toISOString(), error: `quota: ${errMsg}` });
        return;
      }
      if (isRateLimit) {
        // backoff base + jitter (até 200ms) — evita "trovejada" no próximo tick
        let waitMs = 60_000;
        const msMatch = errMsg.match(/retry after\s+(\d+)\s*ms/i);
        const sMatch = errMsg.match(/retry after\s+(\d+)\s*s/i);
        if (msMatch) waitMs = parseInt(msMatch[1], 10) + 1000;
        else if (sMatch) waitMs = parseInt(sMatch[1], 10) * 1000 + 1000;
        waitMs += Math.floor(Math.random() * 200);
        rescheduled.push({ id: job.id, attempts, scheduled_at: new Date(Date.now() + waitMs).toISOString(), error: errMsg });
        return;
      }
      const newAttempts = attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        failedTerminal.push({ id: job.id, attempts: newAttempts, error: errMsg });
      } else {
        // exponencial + jitter
        const base = newAttempts === 1 ? 60_000 : newAttempts === 2 ? 5 * 60_000 : 30 * 60_000;
        const backoffMs = base + Math.floor(Math.random() * 1000);
        rescheduled.push({ id: job.id, attempts: newAttempts, scheduled_at: new Date(Date.now() + backoffMs).toISOString(), error: errMsg });
      }
    }

    async function processJob(job: any) {
      try {
        const resp = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            clinic_id: job.clinic_id, template_slug: job.template_slug,
            recipient_email: job.recipient_email, recipient_name: job.recipient_name,
            variables: job.variables, related_lead_id: job.related_lead_id,
            related_lead_table: job.related_lead_table, force: job.force_send,
            queue_id: job.id, from_name_override: job.from_name_override ?? null,
            from_domain_override: job.from_domain_override ?? null,
            variant_id: job.variant_id ?? null,
            subject_override: (job.variables as any)?.subject_override ?? null,
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (resp.ok) {
          if ((result as any).skipped) {
            cancelled++;
            if ((result as any).reason === "already_sent") sentNow.push(job.id);
            // se foi cancelled de outra natureza, send-email já marcou no banco
          } else {
            sent++;
            sentNow.push(job.id);
          }
        } else {
          throw new Error((result as any)?.error || `HTTP ${resp.status}`);
        }
      } catch (e) {
        bucketFailure(job, e instanceof Error ? e.message : String(e));
      }
    }

    // ===== Agrupa para Resend Batch API =====
    const groups = new Map<string, any[]>();
    const singles: any[] = [];
    for (const job of jobs as any[]) {
      const key = `${job.clinic_id}::${job.template_slug}::${job.from_domain_override ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(job);
    }

    // monta lista de chunks (cada um vira 1 chamada Resend Batch)
    type BatchTask = { key: string; chunk: any[]; idx: number };
    const batchTasks: BatchTask[] = [];
    for (const [key, group] of groups) {
      if (group.length < BATCH_GROUP_MIN) { singles.push(...group); continue; }
      for (let i = 0; i < group.length; i += 100) {
        batchTasks.push({ key, chunk: group.slice(i, i + 100), idx: batchTasks.length });
      }
    }

    async function runBatchTask(task: BatchTask): Promise<void> {
      const { key, chunk, idx } = task;
      try {
        const resp = await fetch(batchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            clinic_id: chunk[0].clinic_id,
            template_slug: chunk[0].template_slug,
            from_domain_override: chunk[0].from_domain_override ?? null,
            idempotency_key: `proc-${chunk[0].clinic_id}-${chunk[0].template_slug}-${Date.now()}-${idx}`,
            jobs: chunk.map((j) => ({
              queue_id: j.id,
              recipient_email: j.recipient_email,
              recipient_name: j.recipient_name,
              variables: j.variables,
              related_lead_id: j.related_lead_id,
              related_lead_table: j.related_lead_table,
              force: j.force_send,
              from_name_override: j.from_name_override ?? null,
              variant_id: j.variant_id ?? null,
              subject_override: (j.variables as any)?.subject_override ?? null,
            })),
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (resp.ok) {
          sent += (result as any)?.sent ?? 0;
          cancelled += (result as any)?.skipped ?? 0;
          // send-email-batch já atualizou status no banco (bulk)
        } else {
          const msg = (result as any)?.error || `batch HTTP ${resp.status}`;
          console.warn(`batch failed (${key}):`, msg, "— fallback singular");
          for (const j of chunk) await processJob(j);
        }
      } catch (e) {
        console.warn(`batch threw (${key}), fallback singular:`, e);
        for (const j of chunk) await processJob(j);
      }
    }

    // Executa batches com paralelismo limitado (BATCH_PARALLELISM)
    for (let i = 0; i < batchTasks.length; i += BATCH_PARALLELISM) {
      const window = batchTasks.slice(i, i + BATCH_PARALLELISM);
      await Promise.all(window.map(runBatchTask));
    }

    // Singulares em chunks paralelos (CONCURRENCY pequeno — respeita 2 req/s do Resend)
    for (let i = 0; i < singles.length; i += CONCURRENCY) {
      const chunk = singles.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(processJob));
    }

    // ===== Bulk-update final (1 query por bucket) =====
    const updTs = new Date().toISOString();
    if (sentNow.length) {
      await supabase.from("email_queue")
        .update({ status: "sent", sent_at: updTs, updated_at: updTs })
        .in("id", sentNow);
    }
    if (failedTerminal.length) {
      // attempts varia por job → mantém individual mas em paralelo (geralmente poucos)
      await Promise.all(failedTerminal.map((f) =>
        supabase.from("email_queue")
          .update({ status: "failed", attempts: f.attempts, error: f.error, updated_at: updTs })
          .eq("id", f.id)
      ));
    }
    if (rescheduled.length) {
      await Promise.all(rescheduled.map((r) =>
        supabase.from("email_queue")
          .update({ status: "pending", attempts: r.attempts, scheduled_at: r.scheduled_at, error: r.error, updated_at: updTs })
          .eq("id", r.id)
      ));
    }


    // R-3: self-trigger se a fila estiver cheia (drena sem esperar próximo cron)
    if (jobs.length >= SELF_TRIGGER_THRESHOLD) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-email-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ source: "self-trigger" }),
      }).catch(() => {});
    }

    // R-17: registrar health check operacional ao final de cada execução
    try {
      await supabase.rpc("check_email_operational_health");
    } catch (healthErr) {
      console.warn("health check error (non-critical):", healthErr);
    }

    return jsonResponse({ processed: jobs.length, sent, failed, cancelled });
  } catch (e) {
    console.error("process-email-queue error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});
