// Tests Evolution API connection for a specific instance (or the default).
import { corsHeaders, json, loadInstance, evoFetch } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let instanceId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      instanceId = body?.instance_id ?? null;
    }
    const instance = await loadInstance(instanceId);
    if (!instance) {
      return json({ ok: false, error: "Configure ao menos uma instância de WhatsApp." }, 400);
    }
    const resp = await evoFetch(
      instance,
      `/instance/connectionState/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "GET" },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return json({ ok: false, status: resp.status, error: data?.message ?? "Erro Evolution", detail: data });
    }
    const state = data?.instance?.state ?? data?.state ?? "unknown";
    return json({ ok: true, state, raw: data });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
