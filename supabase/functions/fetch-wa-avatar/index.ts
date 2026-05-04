// Fetches a WhatsApp profile picture URL via Evolution and stores it on the lead.
// Body: { lead_id: string }
import { corsHeaders, json, sb, loadInstance, evoFetch } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);
    const supabase = sb();
    const { data: lead } = await supabase
      .from("leads").select("id, phone, whatsapp_instance_id, avatar_url")
      .eq("id", lead_id).single();
    if (!lead) return json({ error: "lead not found" }, 404);
    if (lead.avatar_url) return json({ ok: true, avatar_url: lead.avatar_url, cached: true });

    const instance = await loadInstance(lead.whatsapp_instance_id);
    if (!instance) return json({ error: "no instance" }, 400);

    const resp = await evoFetch(
      instance,
      `/chat/fetchProfilePictureUrl/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "POST", body: JSON.stringify({ number: lead.phone }) },
    );
    const data = await resp.json().catch(() => ({}));
    const url: string | null = (data as any)?.profilePictureUrl ?? (data as any)?.url ?? null;
    if (url) {
      await supabase.from("leads").update({ avatar_url: url }).eq("id", lead_id);
    }
    return json({ ok: true, avatar_url: url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
