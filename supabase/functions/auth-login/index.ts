import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;
const LOCK_HOURS = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password || !email.includes("@")) {
    return json({ error: "invalid_credentials" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 1) Check current lockout
  const { data: lockRow } = await admin
    .from("auth_lockouts")
    .select("failed_attempts, locked_until")
    .eq("email", email)
    .maybeSingle();

  const now = new Date();
  if (lockRow?.locked_until && new Date(lockRow.locked_until) > now) {
    const minutes = Math.ceil((new Date(lockRow.locked_until).getTime() - now.getTime()) / 60000);
    return json({
      error: "account_locked",
      message: `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutes >= 60 ? Math.ceil(minutes/60) + 'h' : minutes + ' min'} ou solicite desbloqueio ao suporte.`,
      locked_until: lockRow.locked_until,
    }, 423);
  }

  // 2) Attempt password signin via anon client
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });

  if (signInErr || !signIn?.session) {
    const prevAttempts = lockRow?.failed_attempts ?? 0;
    const attempts = prevAttempts + 1;
    const willLock = attempts >= MAX_ATTEMPTS;
    const lockedUntil = willLock ? new Date(now.getTime() + LOCK_HOURS * 3600 * 1000).toISOString() : null;

    await admin.from("auth_lockouts").upsert({
      email,
      failed_attempts: attempts,
      locked_until: lockedUntil,
      last_attempt_at: now.toISOString(),
      last_ip: ip,
    }, { onConflict: "email" });

    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    return json({
      error: "invalid_credentials",
      message: willLock
        ? `Conta bloqueada por ${LOCK_HOURS} horas após ${MAX_ATTEMPTS} tentativas. Solicite desbloqueio ao suporte.`
        : `Credenciais inválidas. ${remaining} tentativa(s) restante(s) antes do bloqueio.`,
      remaining,
      locked: willLock,
    }, 401);
  }

  // 3) Success — clear lockout
  if (lockRow) {
    await admin.from("auth_lockouts").delete().eq("email", email);
  }

  return json({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  });
});
