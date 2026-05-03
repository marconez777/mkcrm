// On-demand reconciliation for a single lead.
// Modes:
//   - default (incremental): pulls latest page, stops at known timestamp
//   - full=true: paginates through ALL messages on Evolution, idempotent via external_id
import { corsHeaders, json, sb, loadInstance, evoFetch, ingestMessage } from "../_shared/evolution.ts";

const PAGE_SIZE = 50;
const MAX_PAGES = 200; // hard safety cap → 10k msgs/run

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id, silent = false, full = false } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const { data: lead } = await supabase
      .from("leads")
      .select("phone, whatsapp_instance_id")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "Lead não encontrado" }, 404);

    const instance = await loadInstance(lead.whatsapp_instance_id);
    if (!instance) return json({ error: "Nenhuma instância WhatsApp configurada" }, 400);

    const remoteJid = `${lead.phone}@s.whatsapp.net`;

    // Earliest local ts (used as anchor in incremental mode to skip already-have items)
    const { data: lastLocal } = await supabase
      .from("messages")
      .select("timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTs = lastLocal?.timestamp ? new Date(lastLocal.timestamp).getTime() : 0;

    let imported = 0;
    let totalSeen = 0;
    let pages = 0;

    for (let page = 1; page <= (full ? MAX_PAGES : 1); page++) {
      const resp = await evoFetch(
        instance,
        `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
        {
          method: "POST",
          body: JSON.stringify({
            where: { key: { remoteJid } },
            page,
            offset: PAGE_SIZE,
          }),
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        if (page === 1) {
          return json({ error: `findMessages ${resp.status}`, detail: text.slice(0, 300) }, 502);
        }
        break; // partial success on later pages
      }
      const data = await resp.json().catch(() => ({}));
      const items: any[] = Array.isArray(data)
        ? data
        : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);

      pages++;
      totalSeen += items.length;
      if (items.length === 0) break;

      for (const it of items) {
        try {
          // In incremental mode, skip anything older-or-equal to local newest
          if (!full && lastTs) {
            const itTs = it?.messageTimestamp ? Number(it.messageTimestamp) * 1000 : 0;
            if (itTs && itTs <= lastTs) continue;
          }
          const r = await ingestMessage(it, "sync", { silent: full || silent, instanceId: instance.id });
          if ((r as any)?.isNew) imported++;
        } catch (e) {
          console.error("sync ingest", e);
        }
      }

      if (items.length < PAGE_SIZE) break; // last page
      if (!full) break; // single page in incremental
    }

    await supabase.from("webhook_events").insert({
      event_type: full ? "BACKFILL_LEAD" : "SYNC_LEAD",
      source: "sync",
      payload: { lead_id, imported, total: totalSeen, pages, full },
      processed_at: new Date().toISOString(),
      lead_id,
    });

    return json({ ok: true, imported, total: totalSeen, pages, full });
  } catch (err) {
    console.error("sync-lead error", err);
    return json({ error: String(err) }, 500);
  }
});
