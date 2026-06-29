import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, Loader2, MessageSquare, Sparkles, Users } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export default function Onboarding() {
  const nav = useNavigate();
  const { membership, loading, refreshMembership } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [clinicName, setClinicName] = useState("");
  // Step 2
  const [waName, setWaName] = useState("Principal");
  const [waUrl, setWaUrl] = useState("");
  const [waKey, setWaKey] = useState("");
  const [waInstance, setWaInstance] = useState("");
  // Step 3
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "professional" | "viewer">("professional");
  const [generated, setGenerated] = useState<{ url: string; email: string }[]>([]);

  useEffect(() => { document.title = "Onboarding — MK CRM"; }, []);
  useEffect(() => { if (membership?.clinic?.name) setClinicName(membership.clinic.name); }, [membership]);

  if (loading) return null;
  if (!membership) return <Navigate to="/" replace />;
  const canManage = membership.role === "owner" || membership.role === "admin";
  if (!canManage) return <Navigate to="/" replace />;

  async function saveClinic() {
    setBusy(true);
    try {
      const { error } = await supabase.from("clinics").update({ name: clinicName }).eq("id", membership!.clinic_id);
      if (error) throw error;
      await refreshMembership();
      setStep(2);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function saveWhatsApp() {
    setBusy(true);
    try {
      const { error } = await supabase.from("whatsapp_instances").insert({
        name: waName, evolution_url: waUrl, evolution_api_key: waKey, evolution_instance: waInstance, is_default: true,
      });
      if (error) throw error;
      toast.success("WhatsApp conectado");
      setStep(3);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function generateInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinic-invite", {
        body: { clinic_id: membership!.clinic_id, email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      setGenerated((g) => [{ url: data.invite_url, email: inviteEmail }, ...g]);
      setInviteEmail("");
      toast.success("Link gerado");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      const { data: c } = await supabase.from("clinics").select("settings").eq("id", membership!.clinic_id).maybeSingle();
      const settings = { ...(c?.settings as any ?? {}), onboarded: true, onboarded_at: new Date().toISOString() };
      await supabase.from("clinics").update({ settings }).eq("id", membership!.clinic_id);
      nav("/", { replace: true });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Bem-vindo(a) ao MK CRM</h1>
          <p className="text-sm text-muted-foreground">Vamos configurar sua empresa em 3 passos rápidos</p>
        </div>

        <Stepper step={step} />

        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold">Dados da empresa</h2>
                <p className="text-xs text-muted-foreground">Confirme o nome que aparecerá para sua equipe.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nome da empresa</Label>
                <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveClinic} disabled={busy || !clinicName.trim()}>
                  {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold">Conectar WhatsApp</h2>
                  <p className="text-xs text-muted-foreground">Use a Evolution API. Você pode pular e configurar depois em Configurações.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Apelido</Label>
                  <Input value={waName} onChange={(e) => setWaName(e.target.value)} placeholder="Ex: Recepção" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>URL Evolution</Label>
                  <Input value={waUrl} onChange={(e) => setWaUrl(e.target.value)} placeholder="https://evolution.exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>API Key</Label>
                  <Input value={waKey} onChange={(e) => setWaKey(e.target.value)} type="password" />
                </div>
                <div className="space-y-1.5">
                  <Label>Instance</Label>
                  <Input value={waInstance} onChange={(e) => setWaInstance(e.target.value)} placeholder="nome-da-instancia" />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>Pular por agora</Button>
                <Button onClick={saveWhatsApp} disabled={busy || !waUrl || !waKey || !waInstance || !waName}>
                  {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Conectar e continuar
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold">Convidar equipe</h2>
                  <p className="text-xs text-muted-foreground">Gere links de convite para profissionais da empresa. Envie por WhatsApp ou email.</p>
                </div>
              </div>

              <form onSubmit={generateInvite} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@clinica.com" />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="viewer">Visualizador</option>
                </select>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Gerar link</Button>
              </form>

              {generated.length > 0 && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium">Links gerados — envie manualmente</p>
                  {generated.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{g.email}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{g.url}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(g.url); toast.success("Link copiado"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(4)}>Pular</Button>
                <Button onClick={() => setStep(4)}>Concluir</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground">Sua empresa está configurada. Você pode ajustar tudo em Configurações depois.</p>
              </div>
              <Button onClick={finish} disabled={busy} className="w-full">
                {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Ir para o CRM
              </Button>
            </div>
          )}
        </div>

        {step < 4 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <button onClick={finish} className="underline hover:text-foreground">Pular onboarding</button>
          </p>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Empresa" },
    { n: 2, label: "WhatsApp" },
    { n: 3, label: "Equipe" },
  ];
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
            step > it.n ? "bg-primary text-primary-foreground" :
            step === it.n ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
            "bg-muted text-muted-foreground"
          }`}>
            {step > it.n ? <Check className="h-3.5 w-3.5" /> : it.n}
          </div>
          <span className={`text-xs ${step >= it.n ? "font-medium" : "text-muted-foreground"}`}>{it.label}</span>
          {i < items.length - 1 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}
