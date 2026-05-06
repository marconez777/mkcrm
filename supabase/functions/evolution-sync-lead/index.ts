// On-demand reconciliation for a single lead.
// Modes:
//   - default (incremental): pulls latest page, stops at known timestamp
//   - full=true: paginates through ALL messages on Evolution, idempotent via external_id
import { corsHeaders, json, sb, loadInstance, evoFetch, ingestMessage, downloadAndStoreMedia } from "../_shared/evolution.ts";

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

    // Streaming NDJSON for full backfill so the UI can show live progress.
    if (full) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

          let imported = 0;
          let totalSeen = 0;
          let pages = 0;

          send({ type: "start", lead_id });

          try {
            for (let page = 1; page <= MAX_PAGES; page++) {
              const resp = await evoFetch(
                instance,
                `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
                { method: "POST", body: JSON.stringify({ where: { key: { remoteJid } }, page, offset: PAGE_SIZE }) },
              );
              if (!resp.ok) {
                const text = await resp.text();
                send({ type: "error", page, status: resp.status, detail: text.slice(0, 200) });
                if (page === 1) break;
                break;
              }
              const data = await resp.json().catch(() => ({}));
              const items: any[] = Array.isArray(data)
                ? data
                : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);

              pages++;
              totalSeen += items.length;

              let pageImported = 0;
              for (const it of items) {
                try {
                  const r: any = await ingestMessage(it, "sync", { silent: true, instanceId: instance.id });
                  if (r?.isNew) { imported++; pageImported++; }
                  if (r?.needs_media && r?.message_id) {
                    const t = downloadAndStoreMedia(r.message_id, instance, it);
                    // @ts-ignore
                    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(t);
                    else t.catch((e) => console.error("media task failed", e));
                  }
                } catch (e) { console.error("backfill ingest", e); }
              }

              send({ type: "page", page: pages, items: items.length, pageImported, imported, total: totalSeen });

              if (items.length < PAGE_SIZE) break;
            }

            await supabase.from("webhook_events").insert({
              event_type: "BACKFILL_LEAD",
              source: "sync",
              payload: { lead_id, imported, total: totalSeen, pages, full: true },
              processed_at: new Date().toISOString(),
              lead_id,
            });

            send({ type: "done", imported, total: totalSeen, pages });
          } catch (e) {
            send({ type: "error", detail: String(e) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Incremental (single page) — original behavior
    let imported = 0;
    let totalSeen = 0;
    let pages = 0;

    const resp = await evoFetch(
      instance,
      `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "POST", body: JSON.stringify({ where: { key: { remoteJid } }, page: 1, offset: PAGE_SIZE }) },
    );
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: `findMessages ${resp.status}`, detail: text.slice(0, 300) }, 502);
    }
    const data = await resp.json().catch(() => ({}));
    const items: any[] = Array.isArray(data)
      ? data
      : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
    pages = 1;
    totalSeen = items.length;
    for (const it of items) {
      try {
        if (lastTs) {
          const itTs = it?.messageTimestamp ? Number(it.messageTimestamp) * 1000 : 0;
          if (itTs && itTs <= lastTs) continue;
        }
        const r: any = await ingestMessage(it, "sync", { silent, instanceId: instance.id });
        if (r?.isNew) imported++;
        if (r?.needs_media && r?.message_id) {
          const t = downloadAndStoreMedia(r.message_id, instance, it);
          // @ts-ignore
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(t);
          else t.catch((e) => console.error("media task failed", e));
        }
      } catch (e) { console.error("sync ingest", e); }
    }

    await supabase.from("webhook_events").insert({
      event_type: "SYNC_LEAD",
      source: "sync",
      payload: { lead_id, imported, total: totalSeen, pages, full: false },
      processed_at: new Date().toISOString(),
      lead_id,
    });

    return json({ ok: true, imported, total: totalSeen, pages, full: false });
  } catch (err) {
    console.error("sync-lead error", err);
    return json({ error: String(err) }, 500);
  }
});
