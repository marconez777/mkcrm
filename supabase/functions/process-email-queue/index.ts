// Edge Function: process-email-queue
// 1) Reaper: jobs travados em "processing" > 10min voltam para pending.
// 2) Pega até BATCH_SIZE jobs pending, marca como processing.
// 3) Envia em paralelo (chunks) via send-email.
// Backoff: quota → 9h BRT amanhã; rate-limit → respeita Retry-After.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;
const CONCURRENCY = 5;
const STALE_PROCESSING_MIN = 10;

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

    const { data: jobs } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let sent = 0, failed = 0, cancelled = 0;

    async function processJob(job: any) {
      try {
        const resp = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            clinic_id: job.clinic_id,
            template_slug: job.template_slug,
            recipient_email: job.recipient_email,
            recipient_name: job.recipient_name,
            variables: job.variables,
            related_lead_id: job.related_lead_id,
            related_lead_table: job.related_lead_table,
            force: job.force_send,
            queue_id: job.id,
          }),
        });
        const result = await resp.json().catch(() => ({}));

        if (resp.ok) {
          if ((result as any).skipped) {
            cancelled++;
            if ((result as any).reason === "already_sent") {
              await supabase
                .from("email_queue")
                .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("id", job.id);
            }
          } else {
            sent++;
            await supabase
              .from("email_queue")
              .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", job.id);
          }
        } else {
          throw new Error((result as any)?.error || `HTTP ${resp.status}`);
        }
      } catch (e) {
        failed++;
        const errMsg = e instanceof Error ? e.message : String(e);
        const lower = errMsg.toLowerCase();
        const attempts = job.attempts || 0;

        const isPermanentTemplate = lower.includes("not found or inactive");
        const isPermanentEmail = lower.includes("invalid `to` field") || lower.includes("invalid to field");
        const isPermanentDomain = lower.includes("not verified");
        const isQuota = lower.includes("daily email sending quota") || lower.includes("quota exceeded") || lower.includes("quota_reached");
        const isRateLimit = lower.includes("rate limit") || /retry after\s+\d+/i.test(errMsg);

        if (isPermanentTemplate || isPermanentEmail || isPermanentDomain) {
          await supabase
            .from("email_queue")
            .update({ status: "failed", attempts: attempts + 1, error: errMsg, updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return;
        }
        if (isQuota) {
          const tomorrow = new Date();
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(12, 0, 0, 0);
          await supabase
            .from("email_queue")
            .update({ status: "pending", scheduled_at: tomorrow.toISOString(), error: `quota: ${errMsg}`, updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return;
        }
        if (isRateLimit) {
          let waitMs = 60_000;
          const msMatch = errMsg.match(/retry after\s+(\d+)\s*ms/i);
          const sMatch = errMsg.match(/retry after\s+(\d+)\s*s/i);
          if (msMatch) waitMs = parseInt(msMatch[1], 10) + 1000;
          else if (sMatch) waitMs = parseInt(sMatch[1], 10) * 1000 + 1000;
          await supabase
            .from("email_queue")
            .update({ status: "pending", scheduled_at: new Date(Date.now() + waitMs).toISOString(), error: errMsg, updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return;
        }
        const newAttempts = attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          await supabase
            .from("email_queue")
            .update({ status: "failed", attempts: newAttempts, error: errMsg, updated_at: new Date().toISOString() })
            .eq("id", job.id);
        } else {
          const backoffMs = newAttempts === 1 ? 60_000 : newAttempts === 2 ? 5 * 60_000 : 30 * 60_000;
          await supabase
            .from("email_queue")
            .update({ status: "pending", attempts: newAttempts, scheduled_at: new Date(Date.now() + backoffMs).toISOString(), error: errMsg, updated_at: new Date().toISOString() })
            .eq("id", job.id);
        }
      }
    }

    // executa em chunks paralelos
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const chunk = (jobs as any[]).slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(processJob));
    }

    return jsonResponse({ processed: jobs.length, sent, failed, cancelled });
  } catch (e) {
    console.error("process-email-queue error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});
