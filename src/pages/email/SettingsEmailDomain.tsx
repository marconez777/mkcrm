import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import DnsWizard, { type DomainLite } from "@/components/email/DnsWizard";

export default function SettingsEmailDomain() {
  const { membership, hasFeature } = useAuth();
  const clinicId = membership?.clinic_id;
  const enabled = hasFeature("email_marketing");

  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainLite[]>([]);
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!clinicId) return;
    setLoading(true);
    const [{ data: ds }, { data: c }] = await Promise.all([
      supabase
        .from("email_domains")
        .select("id,domain,status,region,dns_records,last_checked_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle(),
    ]);
    setDomains((ds ?? []) as any);
    const email = (c as any)?.settings?.email ?? {};
    setFromName(email.from_name ?? "");
    setReplyTo(email.reply_to ?? "");
    setLoading(false);
  }

  useEffect(() => {
    if (clinicId) load();
  }, [clinicId]);

  useEffect(() => {
    document.title = "Email — Configurações";
  }, []);

  async function saveDefaults() {
    if (!clinicId) return;
    setSaving(true);
    try {
      const { data: c } = await supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle();
      const settings = (c as any)?.settings ?? {};
      const next = { ...settings, email: { ...(settings.email ?? {}), from_name: fromName, reply_to: replyTo } };
      const { error } = await supabase.from("clinics").update({ settings: next }).eq("id", clinicId);
      if (error) throw error;
      toast.success("Padrões salvos");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <Link to="/settings" className="text-xs text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Voltar</Link>
        <Card className="p-6 text-center text-muted-foreground">
          <Mail className="mx-auto mb-2 h-8 w-8 opacity-50" />
          O recurso de Email Marketing não está ativo para esta clínica. Peça ao suporte para liberar.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <Link to="/settings" className="text-xs text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Voltar</Link>
        <h1 className="mt-2 text-2xl font-semibold">Domínio de Email</h1>
        <p className="text-sm text-muted-foreground">Configure o domínio que aparece como remetente dos seus emails.</p>
      </div>

      {loading ? (
        <Card className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></Card>
      ) : domains.length === 0 ? (
        <Card className="p-6 text-center space-y-2">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="text-base font-semibold">Nenhum domínio configurado</h2>
          <p className="text-sm text-muted-foreground">
            A criação do domínio é feita pelo nosso suporte. Entre em contato informando o domínio
            que deseja usar (ex.: <code>mail.suaclinica.com.br</code>) e nós abrimos para você.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {domains.map((d) => (
            <Card key={d.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{d.domain}</div>
                  <div className="text-xs text-muted-foreground">Região: {d.region}</div>
                </div>
                <Badge variant={d.status === "verified" ? "default" : "secondary"}>{d.status}</Badge>
              </div>
              <DnsWizard
                domain={d}
                onUpdated={(next) =>
                  setDomains((arr) => arr.map((x) => (x.id === next.id ? { ...x, ...next } : x)))
                }
              />
            </Card>
          ))}

          <Card className="p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Padrões de envio</h2>
              <p className="text-xs text-muted-foreground">Usados como sugestão ao criar templates.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do remetente</Label>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Clínica X" />
              </div>
              <div className="space-y-1.5">
                <Label>Reply-to</Label>
                <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="contato@suaclinica.com.br" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveDefaults} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
