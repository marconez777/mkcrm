// Lists WhatsApp groups available on an Evolution instance.
import { corsHeaders, json, sb, loadInstance, evoFetch, requireUser } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  try {
    const { instance_id } = await req.json().catch(() => ({}));
    if (!instance_id) return json({ error: "instance_id required" }, 400);

    const instance = await loadInstance(instance_id);
    if (!instance) return json({ error: "instância não encontrada" }, 404);

    const res = await evoFetch(
      instance,
      `/group/fetchAllGroups/${encodeURIComponent(instance.evolution_instance)}?getParticipants=false`,
      { method: "GET" },
    );
    if (!res.ok) {
      const t = await res.text();
      return json({ error: `evolution ${res.status}`, detail: t.slice(0, 300) }, 502);
    }
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data?.groups ?? []);
    const groups = arr
      .map((g: any) => ({
        id: g.id ?? g.remoteJid ?? g.jid,
        subject: g.subject ?? g.name ?? g.id,
        size: g.size ?? g.participantsCount ?? null,
      }))
      .filter((g: any) => typeof g.id === "string" && g.id.endsWith("@g.us"));

    return json({ ok: true, groups });
  } catch (e) {
    console.error("evolution-fetch-groups", e);
    return json({ error: String(e) }, 500);
  }
});
