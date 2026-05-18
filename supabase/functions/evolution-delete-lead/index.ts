import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const supabase = sb();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, phone, clinic_id")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) return json({ error: "Lead não encontrado" }, 404);

    const { error: tombstoneErr } = await supabase
      .from("deleted_leads")
      .insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        phone: lead.phone,
        deleted_by_user_id: auth === "service_role" ? null : auth,
        source: "manual",
      });
    if (tombstoneErr) throw tombstoneErr;

    const { error: deleteErr } = await supabase
      .from("leads")
      .delete()
      .eq("id", lead.id);
    if (deleteErr) throw deleteErr;

    return json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("evolution-delete-lead error", err);
    return json({ error: String(err) }, 500);
  }
});