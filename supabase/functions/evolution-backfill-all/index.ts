// Backfill ALL leads — iterates leads and calls full history import per lead.
// Designed to be run once after connecting WhatsApp, or on demand.
import { corsHeaders, json, sb, loadInstance, evoFetch, ingestMessage } from "../_shared/evolution.ts";

const PAGE_SIZE = 50;
const MAX_PAGES_PER_LEAD = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(Number(body?.limit ?? 500), 2000);
    const instanceId: string | null = body?.instance_id ?? null;

    const instance = await loadInstance(instanceId);
    if (!instance) return json({ error: "Nenhuma instância WhatsApp configurada" }, 400);

    const { data: allLeads } = instanceId
      ? await supabase.from("leads").select("id, phone").eq("whatsapp_instance_id", instanceId).limit(limit)
      : await supabase.from("leads").select("id, phone").limit(limit);

    const list = (allLeads ?? []) as Array<{ id: string; phone: string }>;

    let totalImported = 0;
    let processed = 0;
    const perLead: any[] = [];

    for (const lead of list) {
      let imported = 0;
      let totalSeen = 0;
      let pages = 0;
      const remoteJid = `${lead.phone}@s.whatsapp.net`;
      try {
        for (let page = 1; page <= MAX_PAGES_PER_LEAD; page++) {
          const resp = await evoFetch(
            instance,
            `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
            { method: "POST", body: JSON.stringify({ where: { key: { remoteJid } }, page, offset: PAGE_SIZE }) },
          );
          if (!resp.ok) break;
          const data = await resp.json().catch(() => ({}));
          const items: any[] = Array.isArray(data)
            ? data
            : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
          pages++;
          totalSeen += items.length;
          if (items.length === 0) break;
          for (const it of items) {
            try {
              const r = await ingestMessage(it, "sync", { silent: true, instanceId: instance.id });
              if ((r as any)?.isNew) imported++;
            } catch (e) { console.error("backfill ingest", e); }
          }
          if (items.length < PAGE_SIZE) break;
        }
      } catch (e) {
        console.error("backfill lead", lead.id, e);
      }
      processed++;
      totalImported += imported;
      perLead.push({ lead_id: lead.id, imported, total: totalSeen, pages });
    }

    await supabase.from("webhook_events").insert({
      event_type: "BACKFILL_ALL",
      source: "sync",
      payload: { processed, totalImported, leadCount: list.length, perLead: perLead.slice(0, 50) },
      processed_at: new Date().toISOString(),
    });

    return json({ ok: true, processed, totalImported, leads: list.length });
  } catch (err) {
    console.error("backfill-all error", err);
    return json({ error: String(err) }, 500);
  }
});
