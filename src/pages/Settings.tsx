import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; state?: string; error?: string } | null>(null);
  const [form, setForm] = useState({
    evolution_url: "",
    evolution_api_key: "",
    evolution_instance: "",
    webhook_token: "",
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = form.webhook_token
    ? `https://${projectId}.supabase.co/functions/v1/evolution-webhook?token=${form.webhook_token}`
    : "";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (data) {
        setForm({
          evolution_url: data.evolution_url ?? "",
          evolution_api_key: data.evolution_api_key ?? "",
          evolution_instance: data.evolution_instance ?? "",
          webhook_token: data.webhook_token,
        });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      evolution_url: form.evolution_url.trim() || null,
      evolution_api_key: form.evolution_api_key.trim() || null,
      evolution_instance: form.evolution_instance.trim() || null,
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configurações salvas");
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("evolution-test");
    setTesting(false);
    if (error) { setTestResult({ ok: false, error: error.message }); return; }
    setTestResult(data as any);
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Conecte sua instância da Evolution API.</p>
        </div>

        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold">Evolution API</h2>
          <div className="space-y-2">
            <Label>URL da Evolution</Label>
            <Input placeholder="https://evolution.seudominio.com" value={form.evolution_url} onChange={(e) => setForm({ ...form, evolution_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>API Key (global)</Label>
            <Input type="password" placeholder="sua-api-key" value={form.evolution_api_key} onChange={(e) => setForm({ ...form, evolution_api_key: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Nome da instância</Label>
            <Input placeholder="minha-instancia" value={form.evolution_instance} onChange={(e) => setForm({ ...form, evolution_instance: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
            <Button variant="outline" onClick={test} disabled={testing}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Testar conexão</Button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${testResult.ok ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>
              {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
              <div>
                {testResult.ok ? <>Conectado. Estado da instância: <strong>{testResult.state}</strong></> : <>Falha: {testResult.error}</>}
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-3 p-6">
          <h2 className="text-base font-semibold">Webhook</h2>
          <p className="text-sm text-muted-foreground">
            Cole esta URL no painel da Evolution (Instance → Webhook) e marque os eventos:
            <strong> MESSAGES_UPSERT</strong>, <strong>MESSAGES_UPDATE</strong>, <strong>CONTACTS_UPSERT</strong>.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
