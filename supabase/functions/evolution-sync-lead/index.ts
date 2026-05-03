// On-demand reconciliation for a single lead — fetches recent history and upserts.
import { corsHeaders, json, sb, loadSettings, evoFetch, ingestMessage } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const settings = await loadSettings();
    if (!settings?.evolution_url || !settings.evolution_api_key || !settings.evolution_instance) {
      return json({ error: "Evolution não configurada" }, 400);
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("phone")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "Lead não encontrado" }, 404);

    const remoteJid = `${lead.phone}@s.whatsapp.net`;
    const resp = await evoFetch(
      settings,
      `/chat/findMessages/${encodeURIComponent(settings.evolution_instance)}`,
      {
        method: "POST",
        body: JSON.stringify({ where: { key: { remoteJid } } }),
      },
    );
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: `findMessages ${resp.status}`, detail: text.slice(0, 300) }, 502);
    }
    const data = await resp.json().catch(() => ({}));
    const items: any[] = Array.isArray(data) ? data : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);

    let imported = 0;
    for (const it of items.slice(-50)) {
      try {
        await ingestMessage(it, "sync");
        imported++;
      } catch (e) {
        console.error("sync ingest", e);
      }
    }

    await supabase.from("webhook_events").insert({
      event_type: "SYNC_LEAD",
      source: "sync",
      payload: { lead_id, imported, total: items.length },
      processed_at: new Date().toISOString(),
      lead_id,
    });

    return json({ ok: true, imported, total: items.length });
  } catch (err) {
    console.error("sync-lead error", err);
    return json({ error: String(err) }, 500);
  }
});
