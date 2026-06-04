import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Plug, Save, RotateCcw, Bot, DollarSign, BookOpen, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import SupportTelemetry from "./SupportTelemetry";
import SupportLiveMonitor from "./SupportLiveMonitor";
import SupportPinsCard from "./SupportPinsCard";
import { AdminCard } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";

const DEFAULT_PROMPT = `Você é o assistente de suporte do MK-CRM. Responda SEMPRE em PT-BR, direto ao ponto, em passos numerados curtos, como se explicasse para alguém com pouca paciência, zero contexto técnico e dificuldade de atenção. Frases curtas. Um passo por linha. Sem jargão.

Antes de responder qualquer coisa: leia o "Contexto da tela" abaixo. Se houver erro no console ou requisição falhada, comente primeiro e proponha a correção.

Nunca invente caminhos do app. Se não tiver certeza, use a ferramenta lookup_doc antes de responder. Quando for guiar uma ação, no primeiro passo sempre ofereça link_to_route + highlight_element apontando o botão/menu certo.

Quando o usuário pedir um fluxo (ex.: "como conecto WhatsApp"), use start_step_by_step e mande UM passo de cada vez, esperando o usuário responder "feito" antes do próximo.

Se o usuário disser que algo não funcionou, peça o print do erro (pode colar) ou use o contexto runtime já enviado. Se for bug real, use report_bug.`;

type Cfg = {
  id: string;
  enabled: boolean;
  api_key_set: boolean;
  model: string;
  temperature: number;
  monthly_cap_usd: number;
  system_prompt: string;
  kb_synced_at: string | null;
};

type DocRow = { path: string; chunks: number; updated_at: string };

export default function SupportPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [monthSpend, setMonthSpend] = useState<number | null>(null);
  const [kbStatus, setKbStatus] = useState<{ needs_sync: number; status_by_path: Record<string, string>; stale: string[]; missing: string[]; deleted: string[] } | null>(null);

  async function loadAll() {
    setLoading(true);
    const [{ data: c }, { data: spent }, { data: d }] = await Promise.all([
      supabase.from("support_agent_config").select("id, enabled, api_key, model, temperature, monthly_cap_usd, system_prompt, kb_synced_at").eq("singleton", true).maybeSingle(),
      supabase.rpc("support_chat_spent_this_month_usd"),
      supabase.from("support_documents").select("path, updated_at"),
    ]);
    const cfgRow = c ? { ...(c as any), api_key_set: !!(c as any).api_key } as Cfg : null;
    setCfg(cfgRow);
    setMonthSpend(Number(spent ?? 0));
    const grouped = new Map<string, { chunks: number; updated_at: string }>();
    for (const r of (d ?? []) as any[]) {
      const cur = grouped.get(r.path);
      if (cur) {
        cur.chunks += 1;
        if (r.updated_at > cur.updated_at) cur.updated_at = r.updated_at;
      } else grouped.set(r.path, { chunks: 1, updated_at: r.updated_at });
    }
    setDocs(Array.from(grouped, ([path, v]) => ({ path, ...v })).sort((a, b) => a.path.localeCompare(b.path)));

    // KB diff (best-effort; ignore failures)
    try {
      const { data: st } = await supabase.functions.invoke("support-kb-status", { body: {} });
      if (st && (st as any).ok) setKbStatus(st as any);
    } catch { /* ignore */ }

    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const patch: any = {
      enabled: cfg.enabled,
      model: cfg.model,
      temperature: cfg.temperature,
      monthly_cap_usd: cfg.monthly_cap_usd,
      system_prompt: cfg.system_prompt,
      updated_at: new Date().toISOString(),
    };
    if (apiKeyInput.trim()) patch.api_key = apiKeyInput.trim();
    const { error } = await supabase.from("support_agent_config").update(patch).eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Configuração salva"); setApiKeyInput(""); loadAll(); }
  }

  async function testConnection() {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("support-test-connection", {
      body: apiKeyInput.trim() ? { api_key: apiKeyInput.trim(), model: cfg?.model } : {},
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success(`OK · ${data.latency_ms}ms · ${data.model}`);
    else toast.error(`Falhou: ${data?.error ?? "erro desconhecido"}`);
  }

  async function resyncKB() {
    if (!confirm("Re-sincronizar a base de conhecimento? Isto re-embedda todos os .md e pode levar 1-2min.")) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("support-kb-sync", { body: {} });
    setSyncing(false);
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success(`KB sincronizada: ${data.files} arquivos, ${data.chunks} chunks (${data.skipped} sem mudança)`);
    else toast.error(data?.error ?? "Falha ao sincronizar");
    loadAll();
  }

  if (loading || !cfg) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const overCap = monthSpend != null && monthSpend >= cfg.monthly_cap_usd;

  return (
    <div className="space-y-4">
      {monthSpend != null && cfg.monthly_cap_usd > 0 && monthSpend / cfg.monthly_cap_usd >= 0.8 && (
        <div className={`rounded-md border px-3 py-2 text-sm ${overCap ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
          {overCap
            ? `🚫 Teto mensal atingido ($${monthSpend.toFixed(2)} / $${cfg.monthly_cap_usd}). O chat está bloqueado até você aumentar o teto ou virar o mês.`
            : `⚠️ Atenção: você já usou ${((monthSpend / cfg.monthly_cap_usd) * 100).toFixed(0)}% do teto mensal ($${monthSpend.toFixed(2)} / $${cfg.monthly_cap_usd}).`}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Configuração</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-sm">Ativo para todos os usuários</Label>
              <Switch id="enabled" checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Key OpenAI {cfg.api_key_set && <span className="text-xs text-muted-foreground">(configurada — deixe vazio para manter)</span>}</Label>
              <Input type="password" placeholder={cfg.api_key_set ? "•••••••••••• (manter)" : "sk-..."} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini (recomendado)</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperatura ({cfg.temperature})</Label>
              <Input type="number" step="0.1" min="0" max="2" value={cfg.temperature} onChange={(e) => setCfg({ ...cfg, temperature: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Teto mensal (USD)</Label>
              <Input type="number" step="1" min="0" value={cfg.monthly_cap_usd} onChange={(e) => setCfg({ ...cfg, monthly_cap_usd: Number(e.target.value) })} />
              <div className="text-xs text-muted-foreground">
                Gasto no mês: <strong className={overCap ? "text-destructive" : ""}>${(monthSpend ?? 0).toFixed(4)}</strong> / ${cfg.monthly_cap_usd}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>System prompt mestre</Label>
              <Button variant="ghost" size="sm" onClick={() => setCfg({ ...cfg, system_prompt: DEFAULT_PROMPT })}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrão
              </Button>
            </div>
            <Textarea rows={10} value={cfg.system_prompt} onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })} className="font-mono text-xs" />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || (!cfg.api_key_set && !apiKeyInput.trim())}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Base de Conhecimento</CardTitle>
            <Button onClick={resyncKB} disabled={syncing || !cfg.api_key_set} size="sm">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Re-sincronizar KB
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {docs.length} arquivos · última sincronização: {cfg.kb_synced_at ? new Date(cfg.kb_synced_at).toLocaleString("pt-BR") : "nunca"}
          </div>
        </CardHeader>
        <CardContent>
          {kbStatus && kbStatus.needs_sync > 0 && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠ KB desatualizada: {kbStatus.stale.length} alterado(s), {kbStatus.missing.length} novo(s), {kbStatus.deleted.length} removido(s). Re-sincronize para aplicar.
            </div>
          )}
          {docs.length === 0 && (!kbStatus || kbStatus.needs_sync === 0) ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum documento ingerido. Configure a API key e clique em "Re-sincronizar KB".
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-20 text-right">Chunks</TableHead>
                    <TableHead className="w-40">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const rows = [...docs];
                    // include missing (no docs yet)
                    if (kbStatus) {
                      for (const p of kbStatus.missing) {
                        if (!rows.find((r) => r.path === p)) rows.push({ path: p, chunks: 0, updated_at: "" });
                      }
                    }
                    rows.sort((a, b) => a.path.localeCompare(b.path));
                    return rows.map((d) => {
                      const st = kbStatus?.status_by_path[d.path] ?? "in_sync";
                      const stMeta: Record<string, { label: string; cls: string }> = {
                        in_sync: { label: "ok", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
                        stale: { label: "desatualizado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
                        missing: { label: "novo", cls: "bg-primary/15 text-primary" },
                        deleted: { label: "removido", cls: "bg-destructive/15 text-destructive" },
                      };
                      const sm = stMeta[st];
                      return (
                        <TableRow key={d.path}>
                          <TableCell className="font-mono text-xs">{d.path}</TableCell>
                          <TableCell><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sm.cls}`}>{sm.label}</span></TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{d.chunks}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.updated_at ? new Date(d.updated_at).toLocaleString("pt-BR") : "—"}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupportLiveMonitor />
      <SupportPinsCard />
      <SupportTelemetry monthlyCap={cfg.monthly_cap_usd} />
    </div>
  );
}
