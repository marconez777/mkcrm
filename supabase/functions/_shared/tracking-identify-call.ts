// Chamada interna à edge function `tracking-identify`.
// Usada pelos ingestores (formulários, captura externa, webhook) para congelar
// a atribuição do visitante no lead (tracking_lead_sources) e, na sequência,
// alimentar a origem nativa do lead.

export async function callTrackingIdentify(opts: {
  clinicSlug: string;
  visitorId: string;
  sessionId?: string | null;
  leadId: string;
  email?: string | null;
  phone?: string | null;
  sourceEvent: string;
  properties?: Record<string, unknown>;
}): Promise<boolean> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking-identify`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
        Origin: `https://${opts.clinicSlug}.internal`,
      },
      body: JSON.stringify({
        project_id: opts.clinicSlug,
        visitor_id: opts.visitorId,
        session_id: opts.sessionId ?? null,
        lead_id: opts.leadId,
        email: opts.email ?? null,
        phone: opts.phone ?? null,
        source_event: opts.sourceEvent,
        properties: opts.properties ?? {},
      }),
    });
    if (!resp.ok) {
      console.log("[tracking-identify-call] failed", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[tracking-identify-call] error", e);
    return false;
  }
}
