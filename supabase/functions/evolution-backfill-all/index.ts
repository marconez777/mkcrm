// Backfill ALL leads — iterates leads and imports history per lead.
// Incremental: skips items older/equal to the most recent local message timestamp.
// Streams NDJSON progress so the UI can show live status.
import { corsHeaders, json, sb, loadInstance, evoFetch, ingestMessage } from "../_shared/evolution.ts";
import type { BackfillProgressEvent } from "../_shared/types.ts";

const PAGE_SIZE = 50;
const MAX_PAGES_PER_LEAD = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const body = await req.json().catch(() => ({} as any));
    const limit: number = Math.min(Number(body?.limit ?? 500), 2000);
    const instanceId: string | null = body?.instance_id ?? null;
    const stream: boolean = Boolean(body?.stream);
    const force: boolean = Boolean(body?.force); // ignore lastTs (full re-sync)

    const instance = await loadInstance(instanceId);
    if (!instance) return json({ error: "Nenhuma instância WhatsApp configurada" }, 400);

    const { data: allLeads } = instanceId
      ? await supabase.from("leads").select("id, phone").eq("whatsapp_instance_id", instanceId).limit(limit)
      : await supabase.from("leads").select("id, phone").limit(limit);

    const list = (allLeads ?? []) as Array<{ id: string; phone: string }>;

    async function processLead(lead: { id: string; phone: string }, emit?: (e: BackfillProgressEvent) => void) {
      let imported = 0;
      let totalSeen = 0;
      let pages = 0;
      const remoteJid = `${lead.phone}@s.whatsapp.net`;

      // Anchor: most recent local message timestamp; skip older items unless force
      let lastTs = 0;
      if (!force) {
        const { data: lastLocal } = await supabase
          .from("messages")
          .select("timestamp")
          .eq("lead_id", lead.id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastTs = lastLocal?.timestamp ? new Date(lastLocal.timestamp).getTime() : 0;
      }

      try {
        for (let page = 1; page <= MAX_PAGES_PER_LEAD; page++) {
          const resp = await evoFetch(
            instance,
            `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
            { method: "POST", body: JSON.stringify({ where: { key: { remoteJid } }, page, offset: PAGE_SIZE }) },
          );
          if (!resp.ok) {
            emit?.({ type: "error", page, status: resp.status, detail: (await resp.text()).slice(0, 200) });
            break;
          }
          const data = await resp.json().catch(() => ({}));
          const items: any[] = Array.isArray(data)
            ? data
            : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
          pages++;
          totalSeen += items.length;
          if (items.length === 0) break;

          let pageImported = 0;
          let hitOlder = false;
          for (const it of items) {
            try {
              if (lastTs) {
                const itTs = it?.messageTimestamp ? Number(it.messageTimestamp) * 1000 : 0;
                if (itTs && itTs <= lastTs) { hitOlder = true; continue; }
              }
              const r = await ingestMessage(it, "sync", { silent: true, instanceId: instance.id });
              if ((r as any)?.isNew) { imported++; pageImported++; }
            } catch (e) { console.error("backfill ingest", e); }
          }

          emit?.({ type: "page", page: pages, items: items.length, pageImported, imported, total: totalSeen });

          if (items.length < PAGE_SIZE) break;
          // Optimization: if every item on this page was older than lastTs, stop paginating.
          if (lastTs && hitOlder && pageImported === 0) break;
        }
      } catch (e) {
        console.error("backfill lead", lead.id, e);
      }
      return { lead_id: lead.id, imported, total: totalSeen, pages };
    }

    if (stream) {
      const body = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (e: BackfillProgressEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
          let processed = 0;
          let totalImported = 0;
          for (const lead of list) {
            const r = await processLead(lead, send);
            processed++;
            totalImported += r.imported;
            send({ type: "lead_done", ...r });
          }
          await supabase.from("webhook_events").insert({
            event_type: "BACKFILL_ALL",
            source: "sync",
            payload: { processed, totalImported, leadCount: list.length },
            processed_at: new Date().toISOString(),
            clinic_id: instance.clinic_id,
          });
          send({ type: "done", imported: totalImported, total: 0, pages: 0, processed, leads: list.length });
          controller.close();
        },
      });
      return new Response(body, {
        headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
      });
    }

    let totalImported = 0;
    let processed = 0;
    const perLead: any[] = [];
    for (const lead of list) {
      const r = await processLead(lead);
      processed++;
      totalImported += r.imported;
      perLead.push(r);
    }

    await supabase.from("webhook_events").insert({
      event_type: "BACKFILL_ALL",
      source: "sync",
      payload: { processed, totalImported, leadCount: list.length, perLead: perLead.slice(0, 50) },
      processed_at: new Date().toISOString(),
      clinic_id: instance.clinic_id,
    });

    return json({ ok: true, processed, totalImported, leads: list.length });
  } catch (err) {
    console.error("backfill-all error", err);
    return json({ error: String(err) }, 500);
  }
});
