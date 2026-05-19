import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";

export default function AuthPage() {
  const { session, loading: bootLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";
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
        // FunctionsHttpError exposes status via context
        const ctx: any = (error as any)?.context;
        let msg = error.message || "Falha na autenticação";
        try {
          const parsed = ctx?.body ? JSON.parse(ctx.body) : (await ctx?.json?.());
          if (parsed?.message) msg = parsed.message;
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">Entrar</h1>
          <p className="text-xs text-muted-foreground">Acesso à equipe de atendimento</p>
        </div>
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
        </form>
      </div>
    </div>
  );
}
