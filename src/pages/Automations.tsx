import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Play, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

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
  { id: "before_appointment", label: "Lembrete antes de data marcada (consulta)" },
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
  const [dateFields, setDateFields] = useState<any[]>([]);
  const [allFields, setAllFields] = useState<any[]>([]);
  const confirm = useConfirm();

  const load = async () => {
    const [a, { data: ag }, { data: st }, { data: tp }, { data: cf }] = await Promise.all([
      fetchAllPaged<any>(() => supabase.from("automations").select("*").order("created_at")),
      supabase.from("ai_agents").select("id, name").eq("enabled", true),
      supabase.from("pipeline_stages").select("id, name, pipelines!inner(is_default, kind)").eq("pipelines.is_default", true).eq("pipelines.kind", "sales").order("position"),
      supabase.from("message_templates").select("id, name").order("name"),
      supabase.from("lead_custom_fields").select("field_key, label, field_type, options").order("position"),
    ]);
    setList(a as any);
    setAgents(ag ?? []);
    setStages(st ?? []);
    setTemplates(tp ?? []);
    setAllFields(cf ?? []);
    setDateFields((cf ?? []).filter((f: any) => f.field_type === "date" || f.field_type === "datetime"));
  };

  useEffect(() => { load(); }, []);

  const loadRuns = async (automationId: string) => {
    const { data: runRows, error } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("automation_id", automationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast.error(error.message);
      setRuns([]);
      return;
    }

    const leadIds = Array.from(new Set((runRows ?? []).map((row) => row.lead_id).filter(Boolean)));
    let leadsById = new Map<string, { id: string; name: string | null; phone: string | null }>();

    if (leadIds.length > 0) {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, name, phone")
        .in("id", leadIds);

      if (leadsError) {
        toast.error(leadsError.message);
      } else {
        leadsById = new Map((leadsData ?? []).map((lead) => [lead.id, lead]));
      }
    }

    setRuns((runRows ?? []).map((row) => ({ ...row, lead: leadsById.get(row.lead_id) ?? null })));
  };

  useEffect(() => {
    if (!selected) { setRuns([]); return; }
    loadRuns(selected.id);
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
    if (!(await confirm({ title: "Excluir automação?", description: "Esta ação não pode ser desfeita.", confirmLabel: "Excluir", destructive: true }))) return;
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
    if (selected) await loadRuns(selected.id);
  };

  const updTrigger = (patch: any) =>
    selected && setSelected({ ...selected, trigger_config: { ...selected.trigger_config, ...patch } });
  const updAction = (patch: any) =>
    selected && setSelected({ ...selected, action_config: { ...selected.action_config, ...patch } });

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
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
                <div className="space-y-3">
                  <div>
                    <Label>Horas sem resposta</Label>
                    <Input type="number" min="1" value={selected.trigger_config?.hours ?? 24}
                      onChange={(e) => updTrigger({ hours: Number(e.target.value) })} />
                  </div>
                  <StageMultiSelect
                    stages={stages}
                    value={normalizeStageIds(selected.trigger_config)}
                    onChange={(ids) => updTrigger({ stage_ids: ids, stage_id: undefined })}
                    label="Estágios (deixe vazio = qualquer estágio)"
                  />
                </div>
              )}

              {selected.trigger_type === "stage_idle" && (
                <div className="space-y-3">
                  <div>
                    <Label>Horas parado</Label>
                    <Input type="number" min="1" value={selected.trigger_config?.hours ?? 48}
                      onChange={(e) => updTrigger({ hours: Number(e.target.value) })} />
                  </div>
                  <StageMultiSelect
                    stages={stages}
                    value={normalizeStageIds(selected.trigger_config)}
                    onChange={(ids) => updTrigger({ stage_ids: ids, stage_id: undefined })}
                    label="Estágios monitorados (selecione 1 ou mais)"
                  />
                </div>
              )}


              {selected.trigger_type === "before_appointment" && (
                <div className="space-y-3">
                  {dateFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum campo personalizado de data encontrado. Crie um em Configurações → Campos personalizados (tipo Data ou Data e hora).
                    </p>
                  ) : (
                    <>
                      <div>
                        <Label>Campo de data/hora da consulta</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={selected.trigger_config?.field_key ?? ""}
                          onChange={(e) => updTrigger({ field_key: e.target.value })}>
                          <option value="">— escolha —</option>
                          {dateFields.map((f) => (
                            <option key={f.field_key} value={f.field_key}>
                              {f.label} ({f.field_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Antecedência</Label>
                          <div className="flex gap-2">
                            <Input type="number" min="1"
                              value={(() => {
                                const m = Number(selected.trigger_config?.offset_minutes ?? 60);
                                const u = selected.trigger_config?.offset_unit ?? (m % 1440 === 0 ? "days" : m % 60 === 0 ? "hours" : "minutes");
                                return u === "days" ? m / 1440 : u === "hours" ? m / 60 : m;
                              })()}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                const u = selected.trigger_config?.offset_unit ?? "hours";
                                const m = u === "days" ? n * 1440 : u === "hours" ? n * 60 : n;
                                updTrigger({ offset_minutes: m });
                              }} />
                            <select className="h-9 rounded-md border bg-background px-2 text-sm"
                              value={selected.trigger_config?.offset_unit ?? (((selected.trigger_config?.offset_minutes ?? 60) % 1440 === 0) ? "days" : "hours")}
                              onChange={(e) => updTrigger({ offset_unit: e.target.value })}>
                              <option value="minutes">min</option>
                              <option value="hours">horas</option>
                              <option value="days">dias</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label>Hora preferencial (opcional)</Label>
                          <Input type="time"
                            value={selected.trigger_config?.preferred_time ?? ""}
                            onChange={(e) => updTrigger({ preferred_time: e.target.value || undefined })} />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Ideal para D-1: segura o envio até esse horário (ex.: 15:00).
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Estágio (opcional)</Label>
                          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={selected.trigger_config?.stage_id ?? ""}
                            onChange={(e) => updTrigger({ stage_id: e.target.value || undefined })}>
                            <option value="">— qualquer —</option>
                            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <Label>Apenas horário comercial</Label>
                            <p className="text-[11px] text-muted-foreground">Seg–Sex, 08–18h</p>
                          </div>
                          <Switch
                            checked={!!selected.trigger_config?.business_hours_only}
                            onCheckedChange={(v) => updTrigger({ business_hours_only: v })}
                          />
                        </div>
                      </div>
                      {(() => {
                        const cond = selected.trigger_config?.condition ?? {};
                        const fld = allFields.find((f) => f.field_key === cond.field_key);
                        const op = cond.op ?? "eq";
                        const setCond = (patch: any) => {
                          const next = { ...cond, ...patch };
                          if (!next.field_key) updTrigger({ condition: undefined });
                          else updTrigger({ condition: next });
                        };
                        return (
                          <div className="rounded-md border border-dashed p-3 space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Condição (opcional) — campo personalizado
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Use para diferenciar, por exemplo, teleconsulta vs. presencial. Crie uma automação para cada caso.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <select className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={cond.field_key ?? ""}
                                onChange={(e) => setCond({ field_key: e.target.value || undefined, value: undefined })}>
                                <option value="">— sem condição —</option>
                                {allFields.map((f) => (
                                  <option key={f.field_key} value={f.field_key}>{f.label}</option>
                                ))}
                              </select>
                              <select className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={op}
                                disabled={!cond.field_key}
                                onChange={(e) => setCond({ op: e.target.value })}>
                                <option value="eq">igual a</option>
                                <option value="neq">diferente de</option>
                                <option value="empty">está vazio</option>
                                <option value="not_empty">não está vazio</option>
                              </select>
                              {cond.field_key && (op === "eq" || op === "neq") && (
                                fld?.field_type === "boolean" ? (
                                  <select className="h-9 rounded-md border bg-background px-2 text-sm"
                                    value={cond.value ?? ""}
                                    onChange={(e) => setCond({ value: e.target.value })}>
                                    <option value="">— valor —</option>
                                    <option value="sim">Sim</option>
                                    <option value="nao">Não</option>
                                  </select>
                                ) : fld?.field_type === "select" && Array.isArray(fld?.options) ? (
                                  <select className="h-9 rounded-md border bg-background px-2 text-sm"
                                    value={cond.value ?? ""}
                                    onChange={(e) => setCond({ value: e.target.value })}>
                                    <option value="">— valor —</option>
                                    {fld.options.map((o: string) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <Input className="h-9" placeholder="valor"
                                    value={cond.value ?? ""}
                                    onChange={(e) => setCond({ value: e.target.value })} />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
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

              {selected.action_type === "send_template" && (
                <div>
                  <Label>Template</Label>
                  <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={selected.action_config?.template_id ?? ""}
                    onChange={(e) => updAction({ template_id: e.target.value })}>
                    <option value="">— escolha —</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Variáveis: {"{{nome}}"}, {"{{primeiro_nome}}"}, {"{{telefone}}"}, {"{{email}}"}, {"{{empresa}}"}, {"{{campo.<chave>}}"} — para campos de data use {"{{campo.data_horario:data}}"} ou {"{{campo.data_horario:hora}}"}.
                  </p>
                </div>
              )}
            </Card>

            <Card className="space-y-2 p-4">
              <h3 className="font-semibold">Execuções recentes</h3>
              {runs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma execução ainda.</p>}
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.lead?.name ?? r.lead?.phone ?? r.lead_id.slice(0, 8)}</span>
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

function normalizeStageIds(cfg: any): string[] {
  if (Array.isArray(cfg?.stage_ids)) return cfg.stage_ids.filter(Boolean);
  if (cfg?.stage_id) return [cfg.stage_id];
  return [];
}

function StageMultiSelect({
  stages, value, onChange, label,
}: {
  stages: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
        {stages.length === 0 && (
          <p className="text-xs text-muted-foreground px-1 py-2">Nenhum estágio disponível.</p>
        )}
        {stages.map((s) => {
          const checked = value.includes(s.id);
          return (
            <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(s.id)}
                className="h-4 w-4"
              />
              <span className="flex-1">{s.name}</span>
            </label>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.map((id) => {
            const s = stages.find((x) => x.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-[11px]">
                {s?.name ?? id.slice(0, 8)}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

