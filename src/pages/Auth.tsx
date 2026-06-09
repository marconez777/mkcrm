import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { APP_BASE_URL } from "@/lib/app-url";

type Mode = "login" | "forgot";

export default function AuthPage() {
  const { session, loading: bootLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Entrar — MK CRM"; }, []);

  if (bootLoading) return null;
  if (session) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { email: email.trim().toLowerCase(), password },
      });
      // supabase.functions.invoke surfaces non-2xx as FunctionsHttpError, but the JSON body
      // ainda chega no error.context — tentamos ler de ambos.
      const payload: any = data ?? (await (error as any)?.context?.json?.().catch(() => null));

      if (payload?.error === "locked") {
        const secs = Number(payload.retry_after_seconds ?? 0);
        const mins = Math.ceil(secs / 60);
        const human = mins >= 60 ? `${Math.ceil(mins / 60)} h` : `${mins} min`;
        toast.error(`Conta bloqueada por excesso de tentativas. Tente novamente em ${human}.`);
        return;
      }
      if (error || !payload?.ok || !payload?.session) {
        toast.error("Email ou senha inválidos.");
        return;
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setErr) throw setErr;

      // Super admin "puro" não entra pelo login normal — usa /admin/login.
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const [{ data: roleRow }, { data: memberRow }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "super_admin").maybeSingle(),
          supabase.from("clinic_members").select("clinic_id").eq("user_id", uid).maybeSingle(),
        ]);
        if (roleRow && !memberRow) {
          await supabase.auth.signOut();
          toast.error("Esta conta é de Super Admin. Use o Portal Admin para entrar.");
          return;
        }
      }

      nav(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${APP_BASE_URL}/reset-password` },
      );
      // Sempre mostra mensagem neutra para não vazar quais emails existem.
      if (error && !/rate/i.test(error.message)) {
        // só loga; usuário vê msg neutra mesmo assim
        console.warn("resetPasswordForEmail:", error.message);
      }
      toast.success("Se o email existir, enviamos um link para redefinir a senha.");
      setMode("login");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível enviar o email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">
            {mode === "login" ? "Entrar" : "Esqueci minha senha"}
          </h1>
          <p className="text-xs text-muted-foreground text-center">
            {mode === "login"
              ? "Acesso à equipe de atendimento"
              : "Enviaremos um link para você redefinir sua senha"}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <Input id="password" type="password"
                autoComplete="current-password"
                required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Entrar
            </Button>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Enviar link de redefinição
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Voltar para o login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
