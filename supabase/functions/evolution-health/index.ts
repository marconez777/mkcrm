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
      { webhook: { enabled: true, url: expected, webhookByEvents: false, webhookBase64: false, events: REQUIRED_EVENTS } },
      { enabled: true, url: expected, webhookByEvents: false, webhookBase64: false, events: REQUIRED_EVENTS },
    ];
    for (const body of payloads) {
      try {
        const resp = await evoFetch(
          instance,
          `/webhook/set/${encodeURIComponent(instance.evolution_instance)}`,
          { method: "POST", body: JSON.stringify(body) },
        );
        if (resp.ok) {
          webhookOk = true;
          await resp.text();
          break;
        }
        lastError = `set ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      } catch (e) {
        lastError = `set: ${e}`;
      }
    }
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

  return { instance_id: instance.id, name: instance.name, connectionState, webhookOk, poll };
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
