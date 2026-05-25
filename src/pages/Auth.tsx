import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";

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
      if (error) {
        const ctx: any = (error as any)?.context;
        let msg = error.message || "Falha na autenticação";
        try {
          if (ctx instanceof Response) {
            const parsed = await ctx.clone().json();
            msg = parsed?.message || parsed?.error || msg;
          } else if (typeof ctx?.body === "string") {
            const parsed = JSON.parse(ctx.body);
            msg = parsed?.message || parsed?.error || msg;
          } else if (typeof ctx?.json === "function") {
            const parsed = await ctx.json();
            msg = parsed?.message || parsed?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (!data?.access_token || !data?.refresh_token) {
        throw new Error("Resposta inválida do servidor");
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) throw sessErr;
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
        { redirectTo: `${window.location.origin}/reset-password` },
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
