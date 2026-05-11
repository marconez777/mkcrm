// Watchdog: checks connection state, self-heals webhook config, and polls for missed messages.
// Iterates over ALL configured WhatsApp instances. Designed to run every 60s via pg_cron.
import {
  corsHeaders,
  json,
  sb,
  loadAllInstances,
  evoFetch,
  ingestMessage,
  REQUIRED_EVENTS,
  type Instance,
} from "../_shared/evolution.ts";

const POLL_WINDOW_MIN = 10;
// Após N minutos com conexão "open" porém sem eventos novos do WhatsApp,
// consideramos a sessão "surda" e tentamos um restart automático.
const DEAF_THRESHOLD_MIN = 15;
// Cooldown entre auto-restarts da mesma instância para evitar loop.
const AUTO_RESTART_COOLDOWN_MIN = 20;

function buildWebhookUrl(token: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  return `${base}/functions/v1/evolution-webhook?token=${token}`;
}

async function checkConnection(instance: Instance) {
  const resp = await evoFetch(
    instance,
    `/instance/connectionState/${encodeURIComponent(instance.evolution_instance)}`,
    { method: "GET" },
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`connectionState ${resp.status}: ${JSON.stringify(data)}`);
  return data?.instance?.state ?? data?.state ?? "unknown";
}

async function ensureWebhook(instance: Instance) {
  const expected = buildWebhookUrl(instance.webhook_token);
  let webhookOk = false;
  let lastError: string | null = null;

  try {
    const resp = await evoFetch(
      instance,
      `/webhook/find/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "GET" },
    );
    const data = await resp.json().catch(() => ({}));
    const enabled = data?.enabled ?? data?.webhook?.enabled;
    const url = data?.url ?? data?.webhook?.url;
    const events: string[] = data?.events ?? data?.webhook?.events ?? [];
    const hasAllEvents = REQUIRED_EVENTS.every((e) => events.includes(e));
    webhookOk = !!enabled && url === expected && hasAllEvents;
  } catch (e) {
    lastError = `find: ${e}`;
  }

  if (!webhookOk) {
    const payloads = [
      // v2.x nested webhook object (snake_case keys)
      { webhook: { enabled: true, url: expected, events: REQUIRED_EVENTS, webhook_by_events: false, webhook_base64: false } },
      // v2.x nested webhook object (camelCase keys)
      { webhook: { enabled: true, url: expected, events: REQUIRED_EVENTS, webhookByEvents: false, webhookBase64: false } },
      // v1.x flat
      { enabled: true, url: expected, events: REQUIRED_EVENTS, webhookByEvents: false, webhookBase64: false },
    ];
    const errors: string[] = [];
    for (const body of payloads) {
      try {
        const resp = await evoFetch(
          instance,
          `/webhook/set/${encodeURIComponent(instance.evolution_instance)}`,
          { method: "POST", body: JSON.stringify(body) },
        );
        const text = await resp.text();
        if (resp.ok) {
          webhookOk = true;
          break;
        }
        errors.push(`${resp.status}: ${text.slice(0, 200)}`);
      } catch (e) {
        errors.push(`exc: ${e}`);
      }
    }
    if (!webhookOk) lastError = `set tried ${payloads.length}: ${errors.join(" | ")}`;
  }

  return { webhookOk, lastError };
}

async function pollRecentMessages(instance: Instance) {
  const since = new Date(Date.now() - POLL_WINDOW_MIN * 60 * 1000).toISOString();
  const supabase = sb();

  let imported = 0;
  let skipped = 0;
  let pollError: string | null = null;

  try {
    const resp = await evoFetch(
      instance,
      `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
      {
        method: "POST",
        body: JSON.stringify({
          where: { messageTimestamp: { gte: Math.floor(Date.now() / 1000) - POLL_WINDOW_MIN * 60 } },
        }),
      },
    );
    if (!resp.ok) {
      pollError = `poll ${resp.status}`;
    } else {
      const data = await resp.json().catch(() => ({}));
      const items: any[] = Array.isArray(data) ? data : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
      for (const it of items) {
        try {
          const res = await ingestMessage(it, "poll", { instanceId: instance.id });
          if ("skipped" in res) skipped++;
          else imported++;
        } catch (e: any) {
          // Conflito de unique key (telefone duplicado por LID sem alt) → conta como skip silencioso
          if (e?.code === "23505") {
            skipped++;
          } else {
            console.error("poll ingest error", e);
          }
        }
      }
    }
  } catch (e) {
    pollError = String(e);
  }

  await supabase.from("webhook_events").insert({
    event_type: "POLL_RUN",
    source: "poll",
    payload: { instance_id: instance.id, since, imported, skipped, error: pollError },
    processed_at: new Date().toISOString(),
    error: pollError,
    clinic_id: instance.clinic_id,
  });

  return { imported, skipped, pollError };
}

async function tryAutoRestart(instance: Instance & { last_inbound_webhook_at?: string | null; last_auto_restart_at?: string | null; auto_restart_count?: number | null }): Promise<{ attempted: boolean; reason: string; ok?: boolean; error?: string }> {
  const supabase = sb();
  const now = Date.now();
  const lastInbound = instance.last_inbound_webhook_at ? new Date(instance.last_inbound_webhook_at).getTime() : 0;
  const lastRestart = instance.last_auto_restart_at ? new Date(instance.last_auto_restart_at).getTime() : 0;
  const minutesSinceInbound = lastInbound ? (now - lastInbound) / 60000 : Infinity;
  const minutesSinceRestart = lastRestart ? (now - lastRestart) / 60000 : Infinity;

  if (minutesSinceInbound < DEAF_THRESHOLD_MIN) return { attempted: false, reason: "events-recent" };
  if (minutesSinceRestart < AUTO_RESTART_COOLDOWN_MIN) return { attempted: false, reason: "cooldown" };

  try {
    const resp = await evoFetch(
      instance,
      `/instance/restart/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "POST" },
    );
    const ok = resp.ok;
    const detail = await resp.text().catch(() => "");
    await supabase
      .from("whatsapp_instances")
      .update({
        last_auto_restart_at: new Date().toISOString(),
        auto_restart_count: (instance.auto_restart_count ?? 0) + 1,
      })
      .eq("id", instance.id);
    await supabase.from("webhook_events").insert({
      event_type: "AUTO_RESTART",
      source: "poll",
      payload: {
        instance_id: instance.id,
        reason: "deaf-session",
        minutes_since_last_inbound: Math.round(minutesSinceInbound),
        ok,
        detail: detail.slice(0, 300),
      },
      processed_at: new Date().toISOString(),
      error: ok ? null : `restart ${resp.status}`,
      clinic_id: instance.clinic_id,
    });
    return { attempted: true, reason: "deaf-session", ok, error: ok ? undefined : `restart ${resp.status}` };
  } catch (e) {
    return { attempted: true, reason: "deaf-session", ok: false, error: String(e) };
  }
}

async function processInstance(instance: Instance) {
  const supabase = sb();
  let connectionState = "unknown";
  let connectionError: string | null = null;
  try {
    connectionState = await checkConnection(instance);
  } catch (e) {
    connectionError = String(e);
  }

  const { webhookOk, lastError: webhookErr } = await ensureWebhook(instance);
  const poll = connectionState === "open" ? await pollRecentMessages(instance) : { skipped: "not-open" };

  // Detecta sessão "surda": conexão aberta mas sem eventos de WhatsApp há muito tempo.
  let autoRestart: any = { attempted: false, reason: "skip" };
  if (connectionState === "open") {
    autoRestart = await tryAutoRestart(instance as any);
  }

  await supabase
    .from("whatsapp_instances")
    .update({
      connection_state: connectionState,
      last_health_check: new Date().toISOString(),
      webhook_ok: webhookOk,
      webhook_last_error: webhookErr ?? connectionError ?? null,
      webhook_last_set_at: webhookOk ? new Date().toISOString() : undefined,
      last_poll_at: new Date().toISOString(),
    })
    .eq("id", instance.id);

  return { instance_id: instance.id, name: instance.name, connectionState, webhookOk, poll, autoRestart };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const instances = await loadAllInstances();
    if (instances.length === 0) return json({ skipped: true, reason: "no-instances" });

    const results: any[] = [];
    for (const inst of instances) {
      try {
        results.push(await processInstance(inst));
      } catch (e) {
        results.push({ instance_id: inst.id, error: String(e) });
      }
    }

    try { await supabase.rpc("cleanup_webhook_events"); } catch (e) { console.error("cleanup_webhook_events", e); }

    return json({ ok: true, results });
  } catch (err) {
    console.error("evolution-health error", err);
    return json({ error: String(err) }, 500);
  }
});
