import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Play, Loader2 } from "lucide-react";

type Automation = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
  cooldown_hours: number;
};

const TRIGGERS = [
  { id: "no_reply_after", label: "Lead sem resposta há X horas" },
  { id: "stage_idle", label: "Lead parado num estágio há X horas" },
];

const ACTIONS = [
  { id: "ai_followup", label: "Follow-up via IA" },
  { id: "move_stage", label: "Mover de estágio" },
  { id: "send_template", label: "Enviar template" },
];

export default function Automations() {
  const [list, setList] = useState<Automation[]>([]);
  const [selected, setSelected] = useState<Automation | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: ag }, { data: st }, { data: tp }] = await Promise.all([
      supabase.from("automations").select("*").order("created_at"),
      supabase.from("ai_agents").select("id, name").eq("enabled", true),
      supabase.from("pipeline_stages").select("id, name").order("position"),
      supabase.from("message_templates").select("id, name").order("name"),
    ]);
    setList((a ?? []) as any);
    setAgents(ag ?? []);
    setStages(st ?? []);
    setTemplates(tp ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setRuns([]); return; }
    supabase
      .from("automation_runs")
      .select("*, leads(name, phone)")
      .eq("automation_id", selected.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRuns(data ?? []));
  }, [selected?.id]);

  const create = async () => {
    const { data, error } = await supabase
      .from("automations")
      .insert({
        name: "Nova automação",
        trigger_type: "no_reply_after",
        trigger_config: { hours: 24 },
        action_type: "ai_followup",
        action_config: {},
        cooldown_hours: 24,
      })
      .select("*").single();
    if (error) return toast.error(error.message);
    await load();
    setSelected(data as any);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("automations")
      .update({
        name: selected.name,
        description: selected.description,
        enabled: selected.enabled,
        trigger_type: selected.trigger_type,
        trigger_config: selected.trigger_config,
        action_type: selected.action_type,
        action_config: selected.action_config,
        cooldown_hours: selected.cooldown_hours,
      })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Automação salva");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir automação?")) return;
    await supabase.from("automations").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("automations-tick", { body: {} });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`Tick executado (${(data as any)?.summary?.length ?? 0} regras)`);
    if (selected) {
      const { data: r } = await supabase
        .from("automation_runs")
        .select("*, leads(name, phone)")
        .eq("automation_id", selected.id)
        .order("created_at", { ascending: false }).limit(20);
      setRuns(r ?? []);
    }
  };

  const updTrigger = (patch: any) =>
    selected && setSelected({ ...selected, trigger_config: { ...selected.trigger_config, ...patch } });
  const updAction = (patch: any) =>
    selected && setSelected({ ...selected, action_config: { ...selected.action_config, ...patch } });

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Automações</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={runNow} disabled={running} title="Executar agora">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="px-2">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selected?.id === a.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{a.name}</span>
              {!a.enabled && <Badge variant="outline" className="text-[10px]">off</Badge>}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">Nenhuma automação. Crie a primeira.</p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie uma automação. Elas rodam a cada 5 minutos.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <Input
                className="h-9 w-72 font-semibold"
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={save}>Salvar</Button>
              </div>
            </div>

            <Card className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <Label>Ativa</Label>
                <Switch checked={selected.enabled}
                  onCheckedChange={(v) => setSelected({ ...selected, enabled: v })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={selected.description ?? ""}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div>
                <Label>Cooldown (horas) — não dispara mais de uma vez no mesmo lead nesse período</Label>
                <Input type="number" min="1" value={selected.cooldown_hours}
                  onChange={(e) => setSelected({ ...selected, cooldown_hours: Number(e.target.value) })} />
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="font-semibold">Gatilho</h3>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={selected.trigger_type}
                onChange={(e) => setSelected({ ...selected, trigger_type: e.target.value, trigger_config: {} })}
              >
                {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>

              {selected.trigger_type === "no_reply_after" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Horas sem resposta</Label>
                    <Input type="number" min="1" value={selected.trigger_config?.hours ?? 24}
                      onChange={(e) => updTrigger({ hours: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Estágio (opcional)</Label>
                    <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={selected.trigger_config?.stage_id ?? ""}
                      onChange={(e) => updTrigger({ stage_id: e.target.value || undefined })}>
                      <option value="">— qualquer —</option>
                      {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selected.trigger_type === "stage_idle" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estágio</Label>
                    <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={selected.trigger_config?.stage_id ?? ""}
                      onChange={(e) => updTrigger({ stage_id: e.target.value })}>
                      <option value="">— escolha —</option>
                      {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Horas parado</Label>
                    <Input type="number" min="1" value={selected.trigger_config?.hours ?? 48}
                      onChange={(e) => updTrigger({ hours: Number(e.target.value) })} />
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="font-semibold">Ação</h3>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={selected.action_type}
                onChange={(e) => setSelected({ ...selected, action_type: e.target.value, action_config: {} })}
              >
                {ACTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>

              {selected.action_type === "ai_followup" && (
                <>
                  <div>
                    <Label>Agente</Label>
                    <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={selected.action_config?.agent_id ?? ""}
                      onChange={(e) => updAction({ agent_id: e.target.value })}>
                      <option value="">— escolha —</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Instrução do follow-up</Label>
                    <Textarea rows={3}
                      placeholder="Envie um follow-up educado retomando a conversa..."
                      value={selected.action_config?.prompt ?? ""}
                      onChange={(e) => updAction({ prompt: e.target.value })} />
                  </div>
                </>
              )}

              {selected.action_type === "move_stage" && (
                <div>
                  <Label>Mover para estágio</Label>
                  <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={selected.action_config?.stage_id ?? ""}
                    onChange={(e) => updAction({ stage_id: e.target.value })}>
                    <option value="">— escolha —</option>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </Card>

            <Card className="space-y-2 p-4">
              <h3 className="font-semibold">Execuções recentes</h3>
              {runs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma execução ainda.</p>}
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.leads?.name ?? r.leads?.phone ?? r.lead_id.slice(0, 8)}</span>
                    {r.detail && <span className="text-muted-foreground truncate max-w-md">{r.detail}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
