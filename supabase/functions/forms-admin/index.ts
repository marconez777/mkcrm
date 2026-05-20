// Authenticated CRUD for form integrations. Verifies JWT in-code.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "form";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const auth = req.headers.get("Authorization");
  if (!auth) return json(401, { error: "unauthorized" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "unauthorized" });

  // Resolve clinic + role
  const { data: membership } = await supabase
    .from("clinic_members").select("clinic_id, role").eq("user_id", user.id).maybeSingle();
  const { data: superRole } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
  const isSuper = !!superRole;
  if (!membership && !isSuper) return json(403, { error: "no clinic" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const action = body?.action as string;

  // Service role client for writes that bypass RLS
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  async function assertClinicAdmin(clinicId: string) {
    if (isSuper) return true;
    if (!membership || membership.clinic_id !== clinicId) return false;
    return ["owner", "admin"].includes(membership.role);
  }

  try {
    switch (action) {
      case "create_integration": {
        const p = z.object({
          clinic_id: z.string().uuid().optional(),
          name: z.string().min(1).max(120),
          allowed_domains: z.array(z.string()).default([]),
          default_pipeline_stage_id: z.string().uuid().nullable().optional(),
          default_tags: z.array(z.string()).default([]),
        }).parse(body);
        const clinicId = p.clinic_id || membership!.clinic_id;
        if (!(await assertClinicAdmin(clinicId))) return json(403, { error: "forbidden" });
        const slug = slugify(p.name) + "-" + Math.random().toString(36).slice(2, 6);
        const { data, error } = await admin.from("form_integrations").insert({
          clinic_id: clinicId, name: p.name, slug,
          allowed_domains: p.allowed_domains,
          default_pipeline_stage_id: p.default_pipeline_stage_id ?? null,
          default_tags: p.default_tags,
          created_by: user.id,
        }).select("*").single();
        if (error) throw error;
        return json(200, { integration: data });
      }

      case "update_integration": {
        const p = z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(120).optional(),
          allowed_domains: z.array(z.string()).optional(),
          default_pipeline_stage_id: z.string().uuid().nullable().optional(),
          default_tags: z.array(z.string()).optional(),
          status: z.enum(["active", "paused"]).optional(),
        }).parse(body);
        const { data: existing } = await admin.from("form_integrations").select("clinic_id").eq("id", p.id).single();
        if (!existing || !(await assertClinicAdmin(existing.clinic_id))) return json(403, { error: "forbidden" });
        const patch: any = {};
        for (const k of ["name", "allowed_domains", "default_pipeline_stage_id", "default_tags", "status"] as const) {
          if (p[k] !== undefined) patch[k] = p[k];
        }
        const { data, error } = await admin.from("form_integrations").update(patch).eq("id", p.id).select("*").single();
        if (error) throw error;
        return json(200, { integration: data });
      }

      case "rotate_token": {
        const p = z.object({ id: z.string().uuid() }).parse(body);
        const { data: existing } = await admin.from("form_integrations").select("clinic_id, token").eq("id", p.id).single();
        if (!existing || !(await assertClinicAdmin(existing.clinic_id))) return json(403, { error: "forbidden" });
        const newToken = "mkf_" + crypto.getRandomValues(new Uint8Array(16)).reduce((a, b) => a + b.toString(16).padStart(2, "0"), "");
        const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const { data, error } = await admin.from("form_integrations").update({
          token: newToken,
          previous_token: existing.token,
          previous_token_expires_at: expires,
        }).eq("id", p.id).select("*").single();
        if (error) throw error;
        return json(200, { integration: data });
      }

      case "delete_integration": {
        const p = z.object({ id: z.string().uuid() }).parse(body);
        const { data: existing } = await admin.from("form_integrations").select("clinic_id").eq("id", p.id).single();
        if (!existing || !(await assertClinicAdmin(existing.clinic_id))) return json(403, { error: "forbidden" });
        const { error } = await admin.from("form_integrations").delete().eq("id", p.id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "update_definition": {
        const p = z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(200).optional(),
          field_map: z.record(z.string()).optional(),
          default_pipeline_stage_id: z.string().uuid().nullable().optional(),
          default_tags: z.array(z.string()).optional(),
          active: z.boolean().optional(),
        }).parse(body);
        const { data: existing } = await admin.from("form_definitions").select("clinic_id").eq("id", p.id).single();
        if (!existing || !(await assertClinicAdmin(existing.clinic_id))) return json(403, { error: "forbidden" });
        const patch: any = {};
        for (const k of ["name", "field_map", "default_pipeline_stage_id", "default_tags", "active"] as const) {
          if (p[k] !== undefined) patch[k] = p[k];
        }
        const { data, error } = await admin.from("form_definitions").update(patch).eq("id", p.id).select("*").single();
        if (error) throw error;
        return json(200, { definition: data });
      }

      case "delete_definition": {
        const p = z.object({ id: z.string().uuid() }).parse(body);
        const { data: existing } = await admin.from("form_definitions").select("clinic_id").eq("id", p.id).single();
        if (!existing || !(await assertClinicAdmin(existing.clinic_id))) return json(403, { error: "forbidden" });
        await admin.from("form_definitions").delete().eq("id", p.id);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "unknown action" });
    }
  } catch (e: any) {
    console.error("[forms-admin] error", e);
    return json(400, { error: e?.message || String(e) });
  }
});
