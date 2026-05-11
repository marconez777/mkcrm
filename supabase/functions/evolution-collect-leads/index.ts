// Coletor de leads: varre chats da Evolution e cria leads para números que ainda não existem.
// Reaproveita ingestMessage (com fallback de pipeline) para criar o lead via última mensagem do chat.
import {
  corsHeaders,
  json,
  sb,
  loadAllInstances,
  loadInstance,
  evoFetch,
  ingestMessage,
  phoneFromKey,
  type Instance,
} from "../_shared/evolution.ts";

const MAX_CHATS_PER_INSTANCE = 500;

async function fetchChats(instance: Instance): Promise<any[]> {
  // Evolution API: POST /chat/findChats/{instance} com body {} retorna lista de chats.
  const resp = await evoFetch(
    instance,
    `/chat/findChats/${encodeURIComponent(instance.evolution_instance)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!resp.ok) {
    console.error("[collect-leads] findChats failed", instance.id, resp.status, (await resp.text()).slice(0, 200));
    return [];
  }
  const data = await resp.json().catch(() => ({}));
  const arr: any[] = Array.isArray(data) ? data : (data?.chats ?? data?.records ?? []);
  return arr.slice(0, MAX_CHATS_PER_INSTANCE);
}

async function fetchLastMessage(instance: Instance, remoteJid: string): Promise<any | null> {
  const resp = await evoFetch(
    instance,
    `/chat/findMessages/${encodeURIComponent(instance.evolution_instance)}`,
    { method: "POST", body: JSON.stringify({ where: { key: { remoteJid } }, page: 1, offset: 1 }) },
  );
  if (!resp.ok) return null;
  const data = await resp.json().catch(() => ({}));
  const items: any[] = Array.isArray(data)
    ? data
    : (data?.messages?.records ?? data?.records ?? data?.messages ?? []);
  return items[0] ?? null;
}

async function processInstance(instance: Instance) {
  const supabase = sb();
  const chats = await fetchChats(instance);
  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const chat of chats) {
    scanned++;
    try {
      const remoteJid: string | undefined = chat?.remoteJid ?? chat?.id ?? chat?.key?.remoteJid;
      if (!remoteJid || typeof remoteJid !== "string") { skipped++; continue; }
      if (remoteJid.includes("@g.us")) { skipped++; continue; }

      const phone = phoneFromKey({
        remoteJid,
        remoteJidAlt: chat?.remoteJidAlt,
        addressingMode: remoteJid.includes("@lid") ? "lid" : undefined,
      });
      if (!phone) { skipped++; continue; }

      // Já existe lead?
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", phone)
        .eq("clinic_id", instance.clinic_id)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // Busca última mensagem real para ingestar (cria lead via ingestMessage).
      const lastMsg = await fetchLastMessage(instance, remoteJid);
      if (!lastMsg) { skipped++; continue; }

      const r = await ingestMessage(lastMsg, "sync", { silent: true, instanceId: instance.id });
      if ((r as any)?.lead_id) created++;
      else skipped++;
    } catch (e) {
      console.error("[collect-leads] chat error", e);
      errors++;
    }
  }

  console.log(`[collect-leads] instance=${instance.id} scanned=${scanned} created=${created} skipped=${skipped} errors=${errors}`);
  return { instance_id: instance.id, scanned, created, skipped, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const body = await req.json().catch(() => ({} as any));
    const instanceId: string | null = body?.instance_id ?? null;

    const instances: Instance[] = instanceId
      ? [(await loadInstance(instanceId))!].filter(Boolean) as Instance[]
      : await loadAllInstances();

    if (!instances.length) return json({ error: "Nenhuma instância configurada" }, 400);

    const perInstance: any[] = [];
    let totalCreated = 0;
    let totalScanned = 0;

    for (const inst of instances) {
      const r = await processInstance(inst);
      perInstance.push(r);
      totalCreated += r.created;
      totalScanned += r.scanned;

      try {
        await supabase.from("webhook_events").insert({
          event_type: "COLLECT_LEADS",
          source: "sync",
          payload: r,
          processed_at: new Date().toISOString(),
          clinic_id: inst.clinic_id,
        });
      } catch (_) { /* non-fatal */ }
    }

    return json({ ok: true, totalScanned, totalCreated, perInstance });
  } catch (err) {
    console.error("[collect-leads] error", err);
    return json({ error: String(err) }, 500);
  }
});
