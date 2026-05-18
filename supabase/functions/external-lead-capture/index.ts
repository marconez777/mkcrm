// Public edge function: receives partial form data from external clinic websites
// and upserts a lead in the CRM. Idempotent by (clinic_id, phone) and (clinic_id, email).
//
// Auth: shared secret via x-capture-token header (matches EXTERNAL_LEAD_CAPTURE_TOKEN).
// CORS: open (called from clinic marketing sites).

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-capture-token",
  "Access-Control-Max-Age": "86400",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z
  .object({
    clinic_id: z.string().uuid(),
    visitor_id: z.string().min(1).max(64).optional(),
    session_id: z.string().min(1).max(64).optional(),
    name: z.string().trim().max(120).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .max(255)
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "invalid email"
      ),
    phone: z.string().trim().max(32).optional().or(z.literal("")),
    source_page: z.string().max(255).optional(),
    form_kind: z.string().max(64).optional(),
    extra: z.record(z.unknown()).optional(),
  })
  .refine((d) => !!(d.email && d.email.trim()) || !!(d.phone && d.phone.trim()), {
    message: "email or phone is required",
  });

function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Add BR country code if missing (10 or 11 digits → 12/13)
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // Shared-secret check
  const token = req.headers.get("x-capture-token");
  const expected = Deno.env.get("EXTERNAL_LEAD_CAPTURE_TOKEN");
  if (!expected || !token || token !== expected) {
    return json(401, { error: "unauthorized" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const phone = normalizePhone(data.phone);
  const email = data.email ? data.email.trim().toLowerCase() : null;
  const name = data.name ? data.name.trim() : null;

  if (!phone && !email) {
    return json(400, { error: "email or phone is required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 1) Try match by phone, then email
  let leadId: string | null = null;
  let existing: Record<string, any> | null = null;

  if (phone) {
    const { data: byPhone } = await supabase
      .from("leads")
      .select("id, name, email, phone")
      .eq("clinic_id", data.clinic_id)
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (byPhone) {
      existing = byPhone;
      leadId = byPhone.id;
    }
  }
  if (!leadId && email) {
    const { data: byEmail } = await supabase
      .from("leads")
      .select("id, name, email, phone")
      .eq("clinic_id", data.clinic_id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail) {
      existing = byEmail;
      leadId = byEmail.id;
    }
  }

  const isNew = !leadId;

  if (isNew) {
    // Create new lead. `phone` column is NOT NULL; if only email provided, use a placeholder.
    const insertPhone = phone ?? `email:${email}`;
    const { data: created, error: insErr } = await supabase
      .from("leads")
      .insert({
        clinic_id: data.clinic_id,
        phone: insertPhone,
        email,
        name,
        landing_page: data.source_page ?? null,
        custom_fields: data.extra ? { partial_form: data.extra } : {},
      })
      .select("id")
      .single();
    if (insErr || !created) {
      console.error("[external-lead-capture] insert error", insErr);
      return json(500, { error: "failed to create lead", detail: insErr?.message });
    }
    leadId = created.id;
  } else if (existing) {
    // Enrich only empty fields
    const patch: Record<string, any> = {};
    if (name && !existing.name) patch.name = name;
    if (email && !existing.email) patch.email = email;
    if (phone && (!existing.phone || existing.phone.startsWith("email:"))) {
      patch.phone = phone;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("leads").update(patch).eq("id", leadId!);
    }
  }

  // 2) Link visitor → lead
  if (data.visitor_id && leadId) {
    await supabase
      .from("tracking_identity_links")
      .upsert(
        {
          clinic_id: data.clinic_id,
          visitor_id: data.visitor_id,
          lead_id: leadId,
          link_source: "form_partial",
        },
        { onConflict: "clinic_id,visitor_id,lead_id" }
      );
  }

  // 3) Log lead_event 'partial_form_capture' (dedupe last 60s for same form_kind)
  const fieldsPresent = [
    name ? "name" : null,
    email ? "email" : null,
    phone ? "phone" : null,
  ].filter(Boolean);

  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase
    .from("lead_events")
    .select("id, payload")
    .eq("clinic_id", data.clinic_id)
    .eq("lead_id", leadId!)
    .eq("type", "partial_form_capture")
    .gte("created_at", sixtySecAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sameAsRecent =
    recent &&
    recent.payload &&
    (recent.payload as any).form_kind === (data.form_kind ?? null) &&
    JSON.stringify((recent.payload as any).fields_present ?? []) ===
      JSON.stringify(fieldsPresent);

  if (!sameAsRecent) {
    await supabase.from("lead_events").insert({
      clinic_id: data.clinic_id,
      lead_id: leadId!,
      type: "partial_form_capture",
      payload: {
        form_kind: data.form_kind ?? null,
        source_page: data.source_page ?? null,
        fields_present: fieldsPresent,
        is_new_lead: isNew,
        extra: data.extra ?? null,
      },
    });
  }

  return json(200, { lead_id: leadId, created: isNew });
});
