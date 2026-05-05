// Restarts an Evolution instance (preserves session).
import { corsHeaders, json, loadInstance, evoFetch } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const instance = await loadInstance(body?.instance_id ?? null);
    if (!instance) return json({ ok: false, error: "Nenhuma instância configurada." }, 400);
    const resp = await evoFetch(
      instance,
      `/instance/restart/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "POST" },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ ok: false, error: data?.message ?? "Erro ao reiniciar", detail: data }, 200);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
