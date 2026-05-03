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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Entrar — CRM"; }, []);

  if (bootLoading) return null;
  if (session) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("signin");
      }
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
          <h1 className="text-lg font-semibold">{mode === "signin" ? "Entrar" : "Criar conta"}</h1>
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
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>Sem conta? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Criar uma</button></>
          ) : (
            <>Já tem conta? <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Entrar</button></>
          )}
        </div>
      </div>
    </div>
  );
}
