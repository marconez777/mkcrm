import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const email = emailRaw.trim().toLowerCase();

    if (!email || !password || email.length > 320 || password.length > 200) {
      return json({ error: "Email ou senha inválidos" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE);

    // 1) Verifica bloqueio atual
    const { data: lockData, error: lockErr } = await admin.rpc("check_login_lockout", { _email: email });
    if (lockErr) {
      console.error("check_login_lockout error", lockErr);
      return json({ error: "Erro interno" }, 500);
    }
    const lockRow = Array.isArray(lockData) ? lockData[0] : lockData;
    if (lockRow?.locked) {
      return json({
        error: "locked",
        message: "Conta temporariamente bloqueada por excesso de tentativas.",
        retry_after_seconds: lockRow.retry_after_seconds,
      }, 423);
    }

    // 2) Tenta login com client anon (respeita rate limit nativo do Supabase Auth)
    const anonClient = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signErr } = await anonClient.auth.signInWithPassword({ email, password });

    if (signErr || !signIn?.session) {
      // Só conta como falha se for credencial inválida; outros erros (rate limit, etc.) não contam
      const msg = signErr?.message ?? "";
      const isInvalidCreds = /invalid login credentials|invalid email or password/i.test(msg);
      if (isInvalidCreds) {
        const { data: regData } = await admin.rpc("register_failed_login", { _email: email });
        const regRow = Array.isArray(regData) ? regData[0] : regData;
        if (regRow?.locked) {
          return json({
            error: "locked",
            message: "Conta temporariamente bloqueada por excesso de tentativas.",
            retry_after_seconds: regRow.retry_after_seconds,
          }, 423);
        }
        return json({ error: "invalid_credentials", message: "Email ou senha inválidos." }, 401);
      }
      // Email não confirmado / rate limit / outros
      return json({ error: "auth_error", message: msg || "Falha na autenticação." }, 401);
    }

    // 3) Sucesso — zera lockout
    await admin.rpc("clear_login_lockout", { _email: email });

    return json({
      ok: true,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        expires_at: signIn.session.expires_at,
        expires_in: signIn.session.expires_in,
        token_type: signIn.session.token_type,
      },
    });
  } catch (e: any) {
    console.error("auth-login error", e);
    return json({ error: "internal", message: e?.message ?? "Internal error" }, 500);
  }
});
