import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Play, Loader2, Copy, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: "stage_enter" | "webhook" | "manual";
  trigger_config: any;
  whatsapp_instance_id: string | null;
  stop_on_reply: boolean;
  cooldown_days: number;
  public_token: string;
};

type Step = {
  id: string;
  sequence_id: string;
  position: number;
  delay_minutes: number;
  template_id: string | null;
  content: string | null;
  send_window: any;
};

const TRIGGERS = [
  { id: "stage_enter", label: "Lead movido para coluna" },
  { id: "webhook", label: "Webhook do site (URL pública)" },
  { id: "manual", label: "Apenas manual (botão no lead)" },
];

const minutesToHuman = (m: number) => {
  if (m === 0) return "imediato";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

export default function Sequences() {
  const [list, setList] = useState<Sequence[]>([]);
  const [selected, setSelected] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const confirm = useConfirm();

  const load = async () => {
    const [{ data: s }, { data: st }, { data: tp }, { data: ins }] = await Promise.all([
      supabase.from("message_sequences").select("*").order("created_at"),
      supabase.from("pipeline_stages").select("id, name, pipeline_id, color").order("position"),
      supabase.from("message_templates").select("id, name, content").order("name"),
      supabase.from("whatsapp_instances").select("id, name, is_default"),
    ]);
    setList((s ?? []) as any);
    setStages(st ?? []);
    setTemplates(tp ?? []);
    setInstances(ins ?? []);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setSteps([]); setEnrollments([]); return; }
    supabase.from("message_sequence_steps").select("*").eq("sequence_id", selected.id).order("position")
      .then(({ data }) => setSteps((data ?? []) as Step[]));
    supabase.from("message_sequence_enrollments")
      .select("*, leads(name, phone)")
      .eq("sequence_id", selected.id)
      .order("started_at", { ascending: false }).limit(50)
      .then(({ data }) => setEnrollments(data ?? []));
  }, [selected?.id]);

  const create = async () => {
    const { data, error } = await supabase.from("message_sequences").insert({
      name: "Nova sequência",
      trigger_type: "manual",
      trigger_config: {},
      stop_on_reply: true,
      cooldown_days: 30,
    }).select("*").single();
    if (error) return toast.error(error.message);
    await load();
    setSelected(data as any);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase.from("message_sequences").update({
      name: selected.name,
      description: selected.description,
      enabled: selected.enabled,
      trigger_type: selected.trigger_type,
      trigger_config: selected.trigger_config,
      whatsapp_instance_id: selected.whatsapp_instance_id,
      stop_on_reply: selected.stop_on_reply,
      cooldown_days: selected.cooldown_days,
    }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Sequência salva");
    load();
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Excluir sequência?", description: "Isso cancela inscrições ativas e apaga histórico.", confirmLabel: "Excluir", destructive: true }))) return;
    await supabase.from("message_sequences").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const addStep = async () => {
    if (!selected) return;
    const pos = steps.length;
    const { data, error } = await supabase.from("message_sequence_steps").insert({
      sequence_id: selected.id,
      position: pos,
      delay_minutes: pos === 0 ? 0 : 60,
      content: "",
    }).select("*").single();
    if (error) return toast.error(error.message);
    setSteps([...steps, data as Step]);
  };

  const updateStep = async (id: string, patch: Partial<Step>) => {
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("message_sequence_steps").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteStep = async (id: string) => {
    await supabase.from("message_sequence_steps").delete().eq("id", id);
    setSteps((s) => s.filter((x) => x.id !== id));
  };

  const moveStep = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx], b = steps[target];
    await Promise.all([
      supabase.from("message_sequence_steps").update({ position: b.position }).eq("id", a.id),
      supabase.from("message_sequence_steps").update({ position: a.position }).eq("id", b.id),
    ]);
    const next = [...steps];
    [next[idx], next[target]] = [{ ...b, position: a.position }, { ...a, position: b.position }];
    setSteps(next);
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("sequence-tick", { body: {} });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`Tick: ${(data as any)?.sent ?? 0} enviadas, ${(data as any)?.failed ?? 0} falhas`);
  };

  const webhookUrl = selected?.public_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sequence-trigger`
    : "";

  const copyWebhook = () => {
    if (!selected) return;
    const snippet = `fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "${selected.public_token}",
    phone: "+5511999999999",
    name: "Nome do lead",
    tags: ["teste-depressao"]
  })
})`;
    navigator.clipboard.writeText(snippet);
    toast.success("Snippet copiado");
  };

  const copyToken = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.public_token);
    toast.success("Token copiado");
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Automação de mensagens</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={runNow} disabled={running} title="Executar agora">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="px-2">
          {list.map((a) => (
            <button key={a.id} onClick={() => setSelected(a)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selected?.id === a.id ? "bg-accent" : "hover:bg-accent/50"}`}>
              <Mail className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{a.name}</span>
              {!a.enabled && <Badge variant="outline" className="text-[10px]">off</Badge>}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">Nenhuma sequência. Crie a primeira.</p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Crie uma sequência tipo "automação de e-mails" — passos enviados em intervalos, parando quando o lead responde.
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <Input className="h-9 w-96 font-semibold" value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={save}>Salvar</Button>
              </div>
            </div>

            <Tabs defaultValue="config">
              <TabsList>
                <TabsTrigger value="config">Configuração</TabsTrigger>
                <TabsTrigger value="steps">Mensagens ({steps.length})</TabsTrigger>
                <TabsTrigger value="enrollments">Inscritos ({enrollments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-6">
                <Card className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Sequência ativa</Label>
                    <Switch checked={selected.enabled}
                      onCheckedChange={(v) => setSelected({ ...selected, enabled: v })} />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input value={selected.description ?? ""}
                      onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>WhatsApp para envio</Label>
                      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={selected.whatsapp_instance_id ?? ""}
                        onChange={(e) => setSelected({ ...selected, whatsapp_instance_id: e.target.value || null })}>
                        <option value="">— usar instância padrão do lead —</option>
                        {instances.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}{i.is_default ? " (padrão)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Cooldown (dias) — não reinscrever no mesmo lead</Label>
                      <Input type="number" min="1" value={selected.cooldown_days}
                        onChange={(e) => setSelected({ ...selected, cooldown_days: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <div>
                      <Label className="text-sm">Parar quando o lead responder</Label>
                      <p className="text-xs text-muted-foreground">Padrão de e-mail marketing — qualquer mensagem do lead cancela próximos passos.</p>
                    </div>
                    <Switch checked={selected.stop_on_reply}
                      onCheckedChange={(v) => setSelected({ ...selected, stop_on_reply: v })} />
                  </div>
                </Card>

                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold">Gatilho</h3>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={selected.trigger_type}
                    onChange={(e) => setSelected({ ...selected, trigger_type: e.target.value as any, trigger_config: {} })}>
                    {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>

                  {selected.trigger_type === "stage_enter" && (
                    <div>
                      <Label>Quando lead for movido para</Label>
                      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={selected.trigger_config?.stage_id ?? ""}
                        onChange={(e) => setSelected({ ...selected, trigger_config: { stage_id: e.target.value } })}>
                        <option value="">— escolha —</option>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  {selected.trigger_type === "webhook" && (
                    <div className="space-y-2">
                      <Label>URL pública para o site chamar</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada"); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Label>Token (envie no body)</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={selected.public_token} className="font-mono text-xs" />
                        <Button variant="outline" size="sm" onClick={copyToken}><Copy className="h-4 w-4" /></Button>
                      </div>
                      <Button variant="secondary" size="sm" onClick={copyWebhook}>
                        <Copy className="mr-1 h-4 w-4" /> Copiar snippet de fetch
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Cole o snippet no projeto do site. Campos aceitos: <code>token, phone, name, email, tags, metadata</code>.
                      </p>
                    </div>
                  )}

                  {selected.trigger_type === "manual" && (
                    <p className="text-xs text-muted-foreground">A sequência só dispara quando você inscrever um lead manualmente (botão no drawer do lead).</p>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="steps" className="space-y-3">
                {steps.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum passo. Adicione o primeiro.</p>
                )}
                {steps.map((s, idx) => (
                  <Card key={s.id} className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Passo {idx + 1}</span>
                      <Badge variant="outline">{minutesToHuman(s.delay_minutes)}{idx > 0 ? " após anterior" : ""}</Badge>
                      <div className="ml-auto flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => moveStep(idx, -1)} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteStep(s.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Atraso</Label>
                        <Input type="number" min="0" value={s.delay_minutes}
                          onChange={(e) => updateStep(s.id, { delay_minutes: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-2">
                        <Label>Template (opcional — sobrescreve texto livre)</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={s.template_id ?? ""}
                          onChange={(e) => updateStep(s.id, { template_id: e.target.value || null })}>
                          <option value="">— texto livre abaixo —</option>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label>Mensagem</Label>
                      <Textarea rows={4} value={s.content ?? ""}
                        onChange={(e) => updateStep(s.id, { content: e.target.value })}
                        placeholder="Olá {{primeiro_nome}}, tudo bem?" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Variáveis: {"{{nome}}"}, {"{{primeiro_nome}}"}, {"{{telefone}}"}, {"{{email}}"}, {"{{empresa}}"}.
                      </p>
                    </div>
                  </Card>
                ))}
                <Button variant="outline" onClick={addStep} className="w-full">
                  <Plus className="mr-1 h-4 w-4" /> Adicionar passo
                </Button>
              </TabsContent>

              <TabsContent value="enrollments" className="space-y-2">
                {enrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum lead inscrito ainda.</p>
                )}
                {enrollments.map((e: any) => (
                  <Card key={e.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{e.leads?.name ?? e.leads?.phone ?? e.lead_id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">
                        passo {e.current_step + 1} • iniciado {new Date(e.started_at).toLocaleString()}
                        {e.next_run_at && e.status === "active" && ` • próximo em ${new Date(e.next_run_at).toLocaleString()}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={e.status === "active" ? "default" : e.status === "completed" ? "secondary" : "outline"}>
                        {e.status === "active" ? "ativo" :
                         e.status === "completed" ? "concluído" :
                         e.status === "stopped_by_reply" ? "parado (resposta)" :
                         e.status === "canceled" ? "cancelado" : "falhou"}
                      </Badge>
                      {e.status === "active" && (
                        <Button variant="ghost" size="sm" onClick={async () => {
                          await supabase.from("message_sequence_enrollments")
                            .update({ status: "canceled", ended_at: new Date().toISOString() })
                            .eq("id", e.id);
                          setEnrollments((es) => es.map((x) => x.id === e.id ? { ...x, status: "canceled" } : x));
                        }}>Cancelar</Button>
                      )}
                    </div>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
