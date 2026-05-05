import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, CheckCircle2, AlertCircle, Loader2, RefreshCw, Activity, Wifi, WifiOff, Plus, Trash2, Zap, QrCode } from "lucide-react";
import { useHealth } from "@/hooks/useHealth";
import { Link, useSearchParams } from "react-router-dom";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppQrDialog } from "@/components/settings/WhatsAppQrDialog";

function timeAgo(iso: string | null) {
  if (!iso) return "nunca";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  return `há ${Math.floor(s / 3600)}h`;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [healing, setHealing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; state?: string; error?: string } | null>(null);
  const [counts, setCounts] = useState<{ failed: number; events24h: number; pollErrors24h: number }>({
    failed: 0,
    events24h: 0,
    pollErrors24h: 0,
  });
  const { health, overall } = useHealth();
  const [form, setForm] = useState({
    evolution_url: "",
    evolution_api_key: "",
    evolution_instance: "",
    webhook_token: "",
  });
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = form.webhook_token
    ? `https://${projectId}.supabase.co/functions/v1/evolution-webhook?token=${form.webhook_token}`
    : "";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("is_default", true)
        .maybeSingle();
      if (data) {
        setInstanceId(data.id);
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

  // Auto-open QR dialog when navigated with ?qr=1
  useEffect(() => {
    if (!loading && instanceId && searchParams.get("qr") === "1") {
      setQrOpen(true);
      searchParams.delete("qr");
      setSearchParams(searchParams, { replace: true });
    }
  }, [loading, instanceId, searchParams, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: failed }, { count: events24h }, { count: pollErrors24h }] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("webhook_events").select("id", { count: "exact", head: true }).gte("received_at", since),
        supabase.from("webhook_events").select("id", { count: "exact", head: true }).gte("received_at", since).not("error", "is", null),
      ]);
      setCounts({
        failed: failed ?? 0,
        events24h: events24h ?? 0,
        pollErrors24h: pollErrors24h ?? 0,
      });
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  async function save() {
    setSaving(true);
    const payload = {
      evolution_url: form.evolution_url.trim(),
      evolution_api_key: form.evolution_api_key.trim(),
      evolution_instance: form.evolution_instance.trim(),
    };
    let error;
    if (instanceId) {
      ({ error } = await supabase.from("whatsapp_instances").update(payload).eq("id", instanceId));
    } else {
      const { data, error: insErr } = await supabase
        .from("whatsapp_instances")
        .insert({ ...payload, name: payload.evolution_instance || "default", is_default: true })
        .select("id, webhook_token")
        .single();
      error = insErr;
      if (data) {
        setInstanceId(data.id);
        setForm((f) => ({ ...f, webhook_token: data.webhook_token }));
      }
    }
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

  async function runHealth() {
    setHealing(true);
    const { data, error } = await supabase.functions.invoke("evolution-health");
    setHealing(false);
    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Health: ${(data as any)?.connectionState ?? "?"} | webhook ${(data as any)?.webhookOk ? "OK" : "off"}`);
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const dotClass =
    overall === "ok" ? "bg-emerald-500" :
    overall === "warn" ? "bg-amber-500" :
    overall === "down" ? "bg-destructive" : "bg-muted-foreground";

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Conecte sua instância da Evolution API.</p>
        </div>

        {/* Painel de Saúde */}
        <Card className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4" /> Saúde da Conexão
            </h2>
            <div className="flex gap-2">
              <Button
                variant={health?.connection_state === "open" ? "outline" : "default"}
                size="sm"
                onClick={() => setQrOpen(true)}
                disabled={!instanceId}
              >
                <QrCode className="mr-2 h-3 w-3" />
                {health?.connection_state === "open" ? "Gerenciar conexão" : "Escanear QR Code"}
              </Button>
              <Button variant="outline" size="sm" onClick={runHealth} disabled={healing}>
                {healing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                Verificar agora
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {health?.connection_state === "open" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Estado
              </div>
              <div className="mt-1 flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                {health?.connection_state ?? "desconhecido"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                último check {timeAgo(health?.last_health_check ?? null)}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Webhook</div>
              <div className="mt-1 flex items-center gap-2 font-medium">
                {health?.webhook_ok ? (
                  <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Ativo</>
                ) : (
                  <><AlertCircle className="h-3 w-3 text-destructive" /> Inativo</>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {health?.webhook_last_error
                  ? <span className="text-destructive">{health.webhook_last_error.slice(0, 60)}</span>
                  : "auto-reativa a cada 60s"}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Eventos 24h</div>
              <div className="mt-1 text-lg font-semibold">{counts.events24h}</div>
              {counts.pollErrors24h > 0 && (
                <div className="mt-1 text-[11px] text-amber-600">{counts.pollErrors24h} c/ erro</div>
              )}
            </div>

            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Mensagens falhas</div>
              <div className="mt-1 text-lg font-semibold">{counts.failed}</div>
              {counts.failed > 0 && (
                <Link to="/inbox" className="mt-1 block text-[11px] text-primary underline">Ver na caixa</Link>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Watchdog roda a cada 60s: verifica conexão, reativa webhook se cair, e busca mensagens dos últimos 10 min via polling pra reconciliar eventos perdidos.
          </p>
        </Card>

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
            O watchdog configura este webhook automaticamente a cada 60s. Se preferir colar manual no painel da Evolution, use a URL abaixo com os eventos:
            <strong> MESSAGES_UPSERT</strong>, <strong>MESSAGES_UPDATE</strong>, <strong>CONTACTS_UPSERT</strong>, <strong>CONNECTION_UPDATE</strong>.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Campos personalizados do lead</div>
              <div className="text-sm text-muted-foreground">Defina os campos exibidos no painel de cada lead (Interesse, Procedimentos, Origem, etc.)</div>
            </div>
            <Link to="/settings/fields"><Button variant="outline">Gerenciar</Button></Link>
          </div>
        </Card>

        <QuickRepliesCard />
      </div>
    </div>
  );
}

function QuickRepliesCard() {
  const { items } = useQuickReplies();
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const sc = shortcut.trim().toLowerCase().replace(/\s+/g, "-");
    if (!sc || !content.trim()) { toast.error("Atalho e conteúdo são obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("quick_replies").insert({ shortcut: sc, content: content.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setShortcut(""); setContent("");
    toast.success("Resposta rápida criada");
  }

  async function remove(id: string) {
    await supabase.from("quick_replies").delete().eq("id", id);
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><Zap className="h-4 w-4" />Respostas rápidas</h2>
        <p className="mt-1 text-xs text-muted-foreground">Use no chat digitando <code className="rounded bg-muted px-1">/atalho</code>. Variáveis: <code className="rounded bg-muted px-1">{`{{nome}}`}</code>, <code className="rounded bg-muted px-1">{`{{primeiro_nome}}`}</code>, <code className="rounded bg-muted px-1">{`{{telefone}}`}</code>.</p>
      </div>

      <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
        <Input placeholder="atalho" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
        <Textarea rows={1} placeholder="Olá {{primeiro_nome}}, tudo bem?" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[40px]" />
        <Button onClick={add} disabled={saving} size="icon">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-1">
        {items.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma resposta rápida ainda.</div>}
        {items.map((q) => (
          <div key={q.id} className="flex items-start gap-2 rounded-md border p-2">
            <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">/{q.shortcut}</span>
            <span className="flex-1 text-xs">{q.content}</span>
            <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
