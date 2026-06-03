import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Invite = { clinic_id: string; email: string; role: string; clinic_name: string | null; expired: boolean };

export default function InvitePage() {
  const { token } = useParams();
  const nav = useNavigate();
  const { session, refreshMembership } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [password, setPassword] = useState("");

  useEffect(() => { document.title = "Convite — MK CRM"; }, []);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_invite_by_token", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setInvite(null); setLoading(false); return; }
      const expired = !!row.accepted_at || new Date(row.expires_at) < new Date();
      setInvite({
        clinic_id: row.clinic_id, email: row.email, role: row.role,
        clinic_name: row.clinic_name ?? null, expired,
      });
      setLoading(false);
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    setBusy(true);
    try {
      if (!session) {
        if (mode === "signup") {
          const redirectUrl = `${window.location.origin}/invite/${token}`;
          const { error } = await supabase.auth.signUp({
            email: invite.email, password,
            options: { emailRedirectTo: redirectUrl },
          });
          if (error) throw error;
          // try sign-in immediately (auto-confirm may be off)
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
          if (signInErr) {
            toast.success("Conta criada. Verifique seu email para confirmar.");
            return;
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
          if (error) throw error;
        }
      }
      // Accept invite
      const { error: rpcErr } = await supabase.rpc("accept_clinic_invite", { _token: token });
      if (rpcErr) throw rpcErr;
      await refreshMembership();
      toast.success(`Bem-vindo(a) à ${invite.clinic_name ?? "clínica"}!`);
      const isManager = invite.role === "owner" || invite.role === "admin";
      const { data: c } = await supabase.from("clinics").select("settings").eq("id", invite.clinic_id).maybeSingle();
      const onboarded = !!(c?.settings as any)?.onboarded;
      nav(isManager && !onboarded ? "/onboarding" : "/", { replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (!invite) return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-2">Convite inválido</h1>
        <p className="text-sm text-muted-foreground">Este convite não existe ou foi revogado.</p>
      </div>
    </div>
  );

  if (invite.expired) return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-2">Convite expirado</h1>
        <p className="text-sm text-muted-foreground">Peça um novo convite ao administrador.</p>
      </div>
    </div>
  );

  const sessionEmailMismatch = session && session.user.email?.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold mb-1">Aceitar convite</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Convidado para <strong>{invite.clinic_name}</strong> como <strong>{invite.role}</strong> ({invite.email})
        </p>

        {sessionEmailMismatch ? (
          <div className="space-y-3">
            <p className="text-sm">Você está logado como <strong>{session?.user.email}</strong>, mas o convite é para <strong>{invite.email}</strong>.</p>
            <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); }}>Sair e tentar de novo</Button>
          </div>
        ) : session ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Aceitar convite
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setMode("signup")} className={`flex-1 py-1.5 rounded ${mode === "signup" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Criar conta</button>
              <button type="button" onClick={() => setMode("login")} className={`flex-1 py-1.5 rounded ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Já tenho conta</button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={invite.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{mode === "signup" ? "Definir senha" : "Senha"}</Label>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {mode === "signup" ? "Criar conta e aceitar" : "Entrar e aceitar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
