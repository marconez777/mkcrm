// Watchdog: checks connection state, self-heals webhook config, and polls for missed messages.
// Designed to be called every 60s by pg_cron.
import {
  corsHeaders,
  json,
  sb,
  loadSettings,
  evoFetch,
  ingestMessage,
  REQUIRED_EVENTS,
} from "../_shared/evolution.ts";

const POLL_WINDOW_MIN = 10;

function buildWebhookUrl(token: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  return `${base}/functions/v1/evolution-webhook?token=${token}`;
}

async function checkConnection(settings: any) {
  const resp = await evoFetch(
    settings,
    `/instance/connectionState/${encodeURIComponent(settings.evolution_instance)}`,
    { method: "GET" },
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`connectionState ${resp.status}: ${JSON.stringify(data)}`);
  return data?.instance?.state ?? data?.state ?? "unknown";
}

async function ensureWebhook(settings: any) {
  const expected = buildWebhookUrl(settings.webhook_token);
  let webhookOk = false;
  let lastError: string | null = null;

  try {
    const resp = await evoFetch(
      settings,
      `/webhook/find/${encodeURIComponent(settings.evolution_instance)}`,
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
    // Try both v1 and v2 payload shapes
    const payloads = [
      {
        webhook: {
          enabled: true,
          url: expected,
          webhookByEvents: false,
          webhookBase64: false,
          events: REQUIRED_EVENTS,
        },
      },
      {
        enabled: true,
        url: expected,
        webhookByEvents: false,
        webhookBase64: false,
        events: REQUIRED_EVENTS,
      },
    ];
    let setOk = false;
    for (const body of payloads) {
      try {
        const resp = await evoFetch(
          settings,
          `/webhook/set/${encodeURIComponent(settings.evolution_instance)}`,
          { method: "POST", body: JSON.stringify(body) },
        );
        if (resp.ok) {
          setOk = true;
          await resp.text();
          break;
        }
        lastError = `set ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      } catch (e) {
        lastError = `set: ${e}`;
      }
    }
    webhookOk = setOk;
  }

  return { webhookOk, lastError };
}

async function pollRecentMessages(settings: any) {
  const since = new Date(Date.now() - POLL_WINDOW_MIN * 60 * 1000).toISOString();
  const supabase = sb();

  // Try Evolution v2 endpoint
  const tryEndpoints = [
    {
      path: `/chat/findMessages/${encodeURIComponent(settings.evolution_instance)}`,
      body: { where: { messageTimestamp: { gte: Math.floor(Date.now() / 1000) - POLL_WINDOW_MIN * 60 } } },
    },
  ];

  let imported = 0;
  let skipped = 0;
  let pollError: string | null = null;

  for (const ep of tryEndpoints) {
    try {
      const resp = await evoFetch(settings, ep.path, {
        method: "POST",
        body: JSON.stringify(ep.body),
      });
      if (!resp.ok) {
        pollError = `poll ${resp.status}`;
        continue;
      }
      const data = await resp.json().catch(() => ({}));
      const items: any[] = Array.isArray(data) ? data : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
      for (const it of items) {
        try {
          const res = await ingestMessage(it, "poll");
          if ("skipped" in res) skipped++;
          else imported++;
        } catch (e) {
          console.error("poll ingest error", e);
        }
      }
      break;
    } catch (e) {
      pollError = String(e);
    }
  }

  // Audit row to track poll runs
  await supabase.from("webhook_events").insert({
    event_type: "POLL_RUN",
    source: "poll",
    payload: { since, imported, skipped, error: pollError },
    processed_at: new Date().toISOString(),
    error: pollError,
  });

  return { imported, skipped, pollError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const settings = await loadSettings();
    if (!settings?.evolution_url || !settings.evolution_api_key || !settings.evolution_instance) {
      return json({ skipped: true, reason: "not-configured" });
    }

    let connectionState = "unknown";
    let connectionError: string | null = null;
    try {
      connectionState = await checkConnection(settings);
    } catch (e) {
      connectionError = String(e);
    }

    const { webhookOk, lastError: webhookErr } = await ensureWebhook(settings);

    const poll = connectionState === "open" ? await pollRecentMessages(settings) : { skipped: "not-open" };

    // Cleanup old audit rows
    await supabase.rpc("cleanup_webhook_events").catch(() => {});

    await supabase
      .from("settings")
      .update({
        connection_state: connectionState,
        last_health_check: new Date().toISOString(),
        webhook_ok: webhookOk,
        webhook_last_error: webhookErr ?? connectionError ?? null,
        webhook_last_set_at: webhookOk ? new Date().toISOString() : undefined,
        last_poll_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return json({ ok: true, connectionState, webhookOk, poll });
  } catch (err) {
    console.error("evolution-health error", err);
    return json({ error: String(err) }, 500);
  }
});
