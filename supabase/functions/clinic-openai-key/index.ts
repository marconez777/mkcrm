// clinic-openai-key — gerencia chaves BYOK de IA (OpenAI e Gemini) por clínica.
// Actions:
//   - status: retorna status combinado de ambos provedores + active_ai_provider
//   - set:    valida a chave do provider escolhido e, se ok, salva e marca como ativo
//   - test:   testa a chave do provider escolhido
//   - clear:  remove a chave do provider escolhido
//
// Body: { action, clinic_id, provider?: "openai"|"gemini" (default "openai"), api_key? }

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

type Action = "status" | "set" | "test" | "clear";
type Provider = "openai" | "gemini";

interface Body {
  action: Action;
  clinic_id: string;
  provider?: Provider;
  api_key?: string;
}

const GEMINI_VALIDATE_MODEL = "gemini-1.5-flash";

async function callOpenAI(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.status === 401) return { ok: false, error: "Chave inválida (401)" };
    if (r.status === 429) return { ok: false, error: "Rate limit no provedor (429)" };
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function callGemini(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VALIDATE_MODEL}?key=${encodeURIComponent(apiKey)}`,
    );
    if (r.status === 400 || r.status === 401 || r.status === 403) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `Chave inválida (${r.status}): ${txt.slice(0, 160)}` };
    }
    if (r.status === 429) return { ok: false, error: "Rate limit no provedor (429)" };
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function requireClinicAccess(
  userId: string,
  clinicId: string,
  needsAdmin: boolean,
): Promise<Response | null> {
  const supabase = sb();
  const { data, error } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error || !data) return json({ error: "forbidden" }, 403);
  if (needsAdmin && !["owner", "admin"].includes(String(data.role))) {
    return json({ error: "admin_required" }, 403);
  }
  return null;
}

async function loadStatus(clinicId: string) {
  const supabase = sb();
  const { data } = await supabase
    .from("clinic_secrets")
    .select(
      "openai_status, openai_key_last4, openai_last_checked_at, openai_last_error, gemini_status, gemini_key_last4, gemini_last_checked_at, gemini_last_error, active_ai_provider, updated_at",
    )
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return data ?? {
    openai_status: "empty",
    openai_key_last4: null,
    openai_last_checked_at: null,
    openai_last_error: null,
    gemini_status: "empty",
    gemini_key_last4: null,
    gemini_last_checked_at: null,
    gemini_last_error: null,
    active_ai_provider: "openai",
    updated_at: null,
  };
}

async function upsertStatus(
  clinicId: string,
  patch: Record<string, unknown>,
) {
  const supabase = sb();
  await supabase
    .from("clinic_secrets")
    .upsert({ clinic_id: clinicId, ...patch }, { onConflict: "clinic_id" });

  if (patch.openai_status) {
    try {
      await supabase
        .from("clinics")
        .update({ classifier_config: { openai_status: patch.openai_status } })
        .eq("id", clinicId);
    } catch { /* não falha o fluxo principal */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const userId = auth as string;
  if (userId === "service_role") return json({ error: "service_role_not_allowed" }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { action, clinic_id } = body;
  const provider: Provider = body.provider === "gemini" ? "gemini" : "openai";
  if (!clinic_id || !action) return json({ error: "missing_params" }, 400);

  const needsAdmin = action === "set" || action === "clear";
  const denied = await requireClinicAccess(userId, clinic_id, needsAdmin);
  if (denied) return denied;

  if (action === "status") {
    return json(await loadStatus(clinic_id));
  }

  if (action === "clear") {
    const supabase = sb();
    const patch: Record<string, unknown> = { clinic_id };
    if (provider === "gemini") {
      patch.gemini_api_key = null;
      patch.gemini_key_last4 = null;
      patch.gemini_status = "empty";
      patch.gemini_last_checked_at = new Date().toISOString();
      patch.gemini_last_error = null;
    } else {
      patch.openai_api_key = null;
      patch.openai_key_last4 = null;
      patch.openai_status = "empty";
      patch.openai_last_checked_at = new Date().toISOString();
      patch.openai_last_error = null;
    }
    await supabase
      .from("clinic_secrets")
      .upsert(patch, { onConflict: "clinic_id" });
    return json(await loadStatus(clinic_id));
  }

  if (action === "test") {
    const supabase = sb();
    const { data } = await supabase
      .from("clinic_secrets")
      .select("openai_api_key, gemini_api_key")
      .eq("clinic_id", clinic_id)
      .maybeSingle();
    const key = (provider === "gemini" ? data?.gemini_api_key : data?.openai_api_key) as string | null;
    if (!key) return json({ ok: false, error: "no_key" }, 400);
    const r = provider === "gemini" ? await callGemini(key) : await callOpenAI(key);
    const patch: Record<string, unknown> = provider === "gemini"
      ? {
          gemini_status: r.ok ? "configured" : "invalid",
          gemini_last_checked_at: new Date().toISOString(),
          gemini_last_error: r.ok ? null : r.error ?? "unknown",
        }
      : {
          openai_status: r.ok ? "configured" : "invalid",
          openai_last_checked_at: new Date().toISOString(),
          openai_last_error: r.ok ? null : r.error ?? "unknown",
        };
    await upsertStatus(clinic_id, patch);
    return json({ ...r, status: await loadStatus(clinic_id) });
  }

  if (action === "set") {
    const key = (body.api_key ?? "").trim();
    if (!key || key.length < 20) return json({ ok: false, error: "invalid_key_format" }, 400);

    const r = provider === "gemini" ? await callGemini(key) : await callOpenAI(key);
    if (!r.ok) {
      const patch: Record<string, unknown> = provider === "gemini"
        ? {
            gemini_status: "invalid",
            gemini_last_checked_at: new Date().toISOString(),
            gemini_last_error: r.error ?? "unknown",
          }
        : {
            openai_status: "invalid",
            openai_last_checked_at: new Date().toISOString(),
            openai_last_error: r.error ?? "unknown",
          };
      await upsertStatus(clinic_id, patch);
      return json({ ok: false, error: r.error, status: await loadStatus(clinic_id) });
    }

    const last4 = key.slice(-4);
    const patch: Record<string, unknown> = { active_ai_provider: provider };
    if (provider === "gemini") {
      patch.gemini_api_key = key;
      patch.gemini_key_last4 = last4;
      patch.gemini_status = "configured";
      patch.gemini_last_checked_at = new Date().toISOString();
      patch.gemini_last_error = null;
    } else {
      patch.openai_api_key = key;
      patch.openai_key_last4 = last4;
      patch.openai_status = "configured";
      patch.openai_last_checked_at = new Date().toISOString();
      patch.openai_last_error = null;
    }
    await upsertStatus(clinic_id, patch);
    return json({ ok: true, status: await loadStatus(clinic_id) });
  }

  return json({ error: "unknown_action" }, 400);
});
