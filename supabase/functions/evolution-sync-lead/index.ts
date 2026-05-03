// On-demand reconciliation for a single lead — fetches recent history and upserts.
import { corsHeaders, json, sb, loadInstance, evoFetch, ingestMessage } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id, silent = false } = await req.json();
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
    const resp = await evoFetch(
      instance,
      `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
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

    const { data: lastLocal } = await supabase
      .from("messages")
      .select("timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTs = lastLocal?.timestamp ? new Date(lastLocal.timestamp).getTime() : 0;

    let imported = 0;
    for (const it of items.slice(-50)) {
      try {
        const itTs = it?.messageTimestamp ? Number(it.messageTimestamp) * 1000 : 0;
        if (lastTs && itTs && itTs <= lastTs) continue;
        const r = await ingestMessage(it, "sync", { silent, instanceId: instance.id });
        if ((r as any)?.isNew) imported++;
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
