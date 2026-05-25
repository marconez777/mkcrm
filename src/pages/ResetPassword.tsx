import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Redefinir senha — MK CRM";
    // Supabase parses the recovery token from the URL hash on load and emits
    // PASSWORD_RECOVERY; we also accept any active session because some browsers
    // auto-process the hash before this listener attaches.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecovery(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecovery(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      nav("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível redefinir a senha.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">Redefinir senha</h1>
          <p className="text-xs text-muted-foreground text-center">
            Escolha uma nova senha para acessar o CRM
          </p>
        </div>

        {!hasRecovery ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Link inválido ou expirado. Solicite um novo email de redefinição.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Voltar para o login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Nova senha</Label>
              <Input id="password" type="password" autoComplete="new-password"
                required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">Confirmar senha</Label>
              <Input id="confirm" type="password" autoComplete="new-password"
                required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
