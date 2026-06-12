// clinic-openai-key — gerencia a chave OpenAI (BYOK) por clínica.
// Actions:
//   - status: retorna {status, last4, last_checked_at, last_error}
//   - set:    valida a chave com a OpenAI e, se ok, salva; retorna status
//   - test:   testa a chave atualmente salva
//   - clear:  remove a chave
//
// Segurança:
//   - tabela `clinic_secrets` só tem GRANTs pra service_role.
//   - validamos o JWT e a associação (clinic_members) antes de qualquer acesso.
//   - apenas papéis owner/admin podem set/clear (donos da chave de billing).

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

type Action = "status" | "set" | "test" | "clear";

interface Body {
  action: Action;
  clinic_id: string;
  api_key?: string;
}

const VALIDATE_MODEL = "gpt-4o-mini"; // modelo leve e barato pra ping de auth

async function callOpenAI(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // /v1/models é o endpoint mais barato pra validar a chave (sem custo de tokens)
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
    .select("openai_status, openai_key_last4, openai_last_checked_at, openai_last_error, updated_at")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return data ?? {
    openai_status: "empty",
    openai_key_last4: null,
    openai_last_checked_at: null,
    openai_last_error: null,
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

  // Sincroniza classifier_config.openai_status na clinica
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
  if (!clinic_id || !action) return json({ error: "missing_params" }, 400);

  const needsAdmin = action === "set" || action === "clear";
  const denied = await requireClinicAccess(userId, clinic_id, needsAdmin);
  if (denied) return denied;

  if (action === "status") {
    return json(await loadStatus(clinic_id));
  }

  if (action === "clear") {
    const supabase = sb();
    await supabase
      .from("clinic_secrets")
      .upsert({
        clinic_id,
        openai_api_key: null,
        openai_key_last4: null,
        openai_status: "empty",
        openai_last_checked_at: new Date().toISOString(),
        openai_last_error: null,
      }, { onConflict: "clinic_id" });
    return json(await loadStatus(clinic_id));
  }

  if (action === "test") {
    const supabase = sb();
    const { data } = await supabase
      .from("clinic_secrets")
      .select("openai_api_key")
      .eq("clinic_id", clinic_id)
      .maybeSingle();
    const key = data?.openai_api_key as string | null;
    if (!key) return json({ ok: false, error: "no_key" }, 400);
    const r = await callOpenAI(key);
    await upsertStatus(clinic_id, {
      openai_status: r.ok ? "configured" : "invalid",
      openai_last_checked_at: new Date().toISOString(),
      openai_last_error: r.ok ? null : r.error ?? "unknown",
    });
    return json({ ...r, status: await loadStatus(clinic_id) });
  }

  if (action === "set") {
    const key = (body.api_key ?? "").trim();
    if (!key || key.length < 20) return json({ ok: false, error: "invalid_key_format" }, 400);

    const r = await callOpenAI(key);
    if (!r.ok) {
      // não persiste a chave inválida
      await upsertStatus(clinic_id, {
        openai_status: "invalid",
        openai_last_checked_at: new Date().toISOString(),
        openai_last_error: r.error ?? "unknown",
      });
      return json({ ok: false, error: r.error, status: await loadStatus(clinic_id) }, 400);
    }

    const last4 = key.slice(-4);
    await upsertStatus(clinic_id, {
      openai_api_key: key,
      openai_key_last4: last4,
      openai_status: "configured",
      openai_last_checked_at: new Date().toISOString(),
      openai_last_error: null,
    });
    return json({ ok: true, status: await loadStatus(clinic_id) });
  }

  return json({ error: "unknown_action" }, 400);
});
