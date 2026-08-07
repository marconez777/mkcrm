import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Portal de login DEDICADO ao Super Admin da plataforma.
 * - Contas que NÃO são super_admin são deslogadas imediatamente e instruídas
 *   a usar /auth.
 * - O /auth tradicional, por sua vez, bloqueia contas que são super_admin
 *   puro e direciona pra cá.
 *
 * Manter este caminho diferente do /auth ajuda a reduzir superfície de ataque
 * (rate limit isolado, brute-force scanners genéricos não acham, e é fácil
 * proteger ainda mais no futuro — ex.: IP allowlist, 2FA obrigatório, etc.).
 */
export default function AdminLogin() {
  const { session, loading: bootLoading, isSuperAdmin, membership } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Portal Admin — Chat Funnel AI"; }, []);

  if (bootLoading) return null;
  // Já logado e é super admin puro → entra direto.
  if (session && isSuperAdmin && !membership) return <Navigate to="/admin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { email: email.trim().toLowerCase(), password },
      });
      const payload: any = data ?? (await (error as any)?.context?.json?.().catch(() => null));

      if (payload?.error === "locked") {
        const secs = Number(payload.retry_after_seconds ?? 0);
        const mins = Math.ceil(secs / 60);
        toast.error(`Conta bloqueada por excesso de tentativas. Tente novamente em ${mins} min.`);
        return;
      }
      if (error || !payload?.ok || !payload?.session) {
        toast.error("Email ou senha inválidos.");
        return;
      }

      // Seta a sessão e valida se é mesmo super admin
      const { error: setErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setErr) throw setErr;

      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error("Sessão inválida");

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!roleRow) {
        await supabase.auth.signOut();
        toast.error("Esta conta não tem acesso ao Portal Admin. Use /auth para entrar.");
        return;
      }

      nav("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-admin-border bg-admin-surface p-6 shadow-admin-card">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-primary/15 text-admin-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-admin-text">Portal Admin</h1>
          <p className="text-xs text-admin-text-muted text-center">
            Acesso restrito à administração da plataforma
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-admin-text-muted">Email</Label>
            <Input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-admin-text-muted">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password"
              required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Entrar no Portal
          </Button>
          <p className="text-[11px] text-admin-text-subtle text-center pt-2">
            Não é admin? <a href="/auth" className="underline hover:text-admin-text-muted">Login do app</a>
          </p>
        </form>
      </div>
    </div>
  );
}
