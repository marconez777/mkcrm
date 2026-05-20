// Public edge function: receives form submissions from external sites (WP plugin, JS snippet, custom).
// Validates integration token, auto-discovers form_definition on first sight, upserts lead, logs submission.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-form-token",
  "Access-Control-Max-Age": "86400",
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extra, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  form_key: z.string().min(1).max(128),
  form_name: z.string().max(200).optional(),
  source_page: z.string().max(500).optional(),
  fields: z.record(z.unknown()).default({}),
  visitor_id: z.string().max(64).optional(),
  session_id: z.string().max(64).optional(),
});

const FIELD_ALIASES = {
  name: ["name", "nome", "fullname", "full_name", "your-name", "first_name", "firstname"],
  email: ["email", "e-mail", "your-email", "mail"],
  phone: ["phone", "telefone", "tel", "celular", "whatsapp", "wpp", "your-phone", "your-tel", "mobile"],
  message: ["message", "mensagem", "your-message", "msg", "comments", "comentario"],
};

function pickField(fields: Record<string, unknown>, fieldMap: Record<string, string>, key: string): string | null {
  // 1) explicit map
  const mapped = fieldMap?.[key];
  if (mapped && fields[mapped] != null && String(fields[mapped]).trim()) return String(fields[mapped]).trim();
  // 2) aliases
  const aliases = (FIELD_ALIASES as any)[key] || [];
  const lowerKeys = Object.keys(fields).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {} as Record<string, string>);
  for (const a of aliases) {
    const realKey = lowerKeys[a];
    if (realKey && fields[realKey] != null && String(fields[realKey]).trim()) return String(fields[realKey]).trim();
  }
  // 3) substring match
  for (const a of aliases) {
    const found = Object.keys(fields).find((k) => k.toLowerCase().includes(a));
    if (found && fields[found] != null && String(fields[found]).trim()) return String(fields[found]).trim();
  }
  return null;
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return allowed.some((d) => {
      const dn = d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      return host === dn || host.endsWith("." + dn);
    });
  } catch { return false; }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const token = req.headers.get("x-form-token") || new URL(req.url).searchParams.get("token");
  if (!token) return json(401, { error: "missing token" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Find integration by token (current or previous within grace)
  const { data: integration } = await supabase
    .from("form_integrations")
    .select("*")
    .or(`token.eq.${token},previous_token.eq.${token}`)
    .maybeSingle();

  if (!integration) return json(401, { error: "invalid token" });
  if (integration.status !== "active") return json(403, { error: "integration paused" });
  if (integration.previous_token === token && integration.previous_token_expires_at && new Date(integration.previous_token_expires_at) < new Date()) {
    return json(401, { error: "token expired" });
  }
  if (!originAllowed(origin, integration.allowed_domains || [])) {
    return json(403, { error: "origin not allowed" });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: parsed.error.flatten() });
  const data = parsed.data;

  // Get or auto-create form_definition
  let { data: def } = await supabase
    .from("form_definitions")
    .select("*")
    .eq("integration_id", integration.id)
    .eq("form_key", data.form_key)
    .maybeSingle();

  if (!def) {
    const { data: created } = await supabase
      .from("form_definitions")
      .insert({
        clinic_id: integration.clinic_id,
        integration_id: integration.id,
        form_key: data.form_key,
        name: data.form_name || data.form_key,
        source_page: data.source_page ?? null,
        field_map: {},
      })
      .select("*")
      .single();
    def = created;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent") || null;

  // Extract lead fields
  const fieldMap = (def?.field_map as Record<string, string>) || {};
  const name = pickField(data.fields, fieldMap, "name");
  const emailRaw = pickField(data.fields, fieldMap, "email");
  const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw.toLowerCase() : null;
  const phone = normalizePhone(pickField(data.fields, fieldMap, "phone"));
  const message = pickField(data.fields, fieldMap, "message");

  let leadId: string | null = null;
  let isNew = false;
  let submissionStatus: "ok" | "no_contact" | "error" = "ok";
  let submissionError: string | null = null;

  try {
    if (!phone && !email) {
      submissionStatus = "no_contact";
      submissionError = "neither phone nor email provided";
    } else {
      // Match existing
      let existing: any = null;
      if (phone) {
        const { data: r } = await supabase.from("leads").select("id, name, email, phone")
          .eq("clinic_id", integration.clinic_id).eq("phone", phone).maybeSingle();
        existing = r;
      }
      if (!existing && email) {
        const { data: r } = await supabase.from("leads").select("id, name, email, phone")
          .eq("clinic_id", integration.clinic_id).ilike("email", email).maybeSingle();
        existing = r;
      }

      if (existing) {
        leadId = existing.id;
        const patch: Record<string, any> = {};
        if (name && !existing.name) patch.name = name;
        if (email && !existing.email) patch.email = email;
        if (phone && (!existing.phone || existing.phone.startsWith("email:"))) patch.phone = phone;
        if (Object.keys(patch).length) await supabase.from("leads").update(patch).eq("id", leadId!);
      } else {
        const stageId = def?.default_pipeline_stage_id || integration.default_pipeline_stage_id || null;
        const tags = [...new Set([...(integration.default_tags || []), ...((def?.default_tags as string[]) || [])])];
        const { data: created, error: insErr } = await supabase.from("leads").insert({
          clinic_id: integration.clinic_id,
          phone: phone ?? `email:${email}`,
          email,
          name,
          stage_id: stageId,
          tags: tags.length ? tags : undefined,
          landing_page: data.source_page ?? null,
          form_source: `form:${def?.name || data.form_key}`,
          custom_fields: { form_submission: data.fields },
        }).select("id").single();
        if (insErr) throw insErr;
        leadId = created!.id;
        isNew = true;
      }

      // Link visitor → lead
      if (data.visitor_id && leadId) {
        await supabase.from("tracking_identity_links").upsert({
          clinic_id: integration.clinic_id,
          visitor_id: data.visitor_id,
          lead_id: leadId,
          link_source: "form_submission",
        }, { onConflict: "clinic_id,visitor_id,lead_id" });
      }

      // Log timeline event
      await supabase.from("lead_events").insert({
        clinic_id: integration.clinic_id,
        lead_id: leadId,
        type: "form_submission",
        payload: {
          integration_id: integration.id,
          form_key: data.form_key,
          form_name: def?.name || data.form_name || data.form_key,
          source_page: data.source_page ?? null,
          message,
          fields: data.fields,
          is_new_lead: isNew,
        },
      });
    }
  } catch (e: any) {
    submissionStatus = "error";
    submissionError = e?.message || String(e);
    console.error("[forms-ingest] error", e);
  }

  // Always log the submission
  await supabase.from("form_submissions").insert({
    clinic_id: integration.clinic_id,
    integration_id: integration.id,
    form_definition_id: def?.id ?? null,
    form_key: data.form_key,
    source_page: data.source_page ?? null,
    payload: data.fields,
    ip, user_agent: ua,
    lead_id: leadId,
    is_new_lead: isNew,
    status: submissionStatus,
    error: submissionError,
  });

  // Update counters
  if (submissionStatus === "ok") {
    await supabase.from("form_integrations")
      .update({ total_submissions: (integration.total_submissions ?? 0) + 1, last_submission_at: new Date().toISOString() })
      .eq("id", integration.id);
    if (def) {
      await supabase.from("form_definitions")
        .update({ total_submissions: (def.total_submissions ?? 0) + 1, last_submission_at: new Date().toISOString() })
        .eq("id", def.id);
    }
  }

  return json(200, {
    ok: submissionStatus === "ok",
    status: submissionStatus,
    lead_id: leadId,
    is_new_lead: isNew,
  });
});
