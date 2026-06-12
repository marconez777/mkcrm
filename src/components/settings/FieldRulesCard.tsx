import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GitBranch, PlayCircle, Sparkles } from "lucide-react";
import SuggestRulesDialog from "./SuggestRulesDialog";

interface Pipeline {
  id: string;
  name: string;
}
interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
  position: number;
}
interface Rule {
  id: string;
  pipeline_id: string;
  target_stage_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: unknown;
}

const EXAMPLE_CONDITIONS = `[
  { "field": "qualificacao", "op": "equals", "value": "desqualificado" }
]`;

interface Props {
  clinicId: string;
}

export default function FieldRulesCard({ clinicId }: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // form
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(100);
  const [enabled, setEnabled] = useState(true);
  const [conditionsText, setConditionsText] = useState(EXAMPLE_CONDITIONS);

  async function load() {
    setLoading(true);
    const [{ data: pps }, { data: sts }, { data: rls }] = await Promise.all([
      supabase.from("pipelines").select("id, name").eq("clinic_id", clinicId).order("position"),
      supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id, position")
        .eq("clinic_id", clinicId)
        .order("position"),
      supabase
        .from("pipeline_field_rules")
        .select("id, pipeline_id, target_stage_id, name, priority, enabled, conditions")
        .eq("clinic_id", clinicId)
        .order("priority", { ascending: false }),
    ]);
    setPipelines((pps as Pipeline[]) ?? []);
    setStages((sts as Stage[]) ?? []);
    setRules((rls as Rule[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clinicId]);

  const stagesForPipeline = stages.filter((s) => s.pipeline_id === pipelineId);

  async function addRule() {
    if (!pipelineId || !stageId || !name.trim()) {
      toast.error("Preencha pipeline, coluna alvo e nome.");
      return;
    }
    let parsedConds: unknown;
    try {
      parsedConds = JSON.parse(conditionsText);
      if (!Array.isArray(parsedConds)) throw new Error("conditions deve ser uma lista");
    } catch (e: any) {
      toast.error(`JSON inválido: ${e.message}`);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("pipeline_field_rules").insert({
      clinic_id: clinicId,
      pipeline_id: pipelineId,
      target_stage_id: stageId,
      name: name.trim(),
      priority,
      enabled,
      conditions: parsedConds as never,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra criada");
    setName("");
    setConditionsText(EXAMPLE_CONDITIONS);
    await load();
  }

  async function toggleRule(id: string, val: boolean) {
    const { error } = await supabase
      .from("pipeline_field_rules")
      .update({ enabled: val })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  async function removeRule(id: string) {
    if (!confirm("Apagar essa regra?")) return;
    const { error } = await supabase.from("pipeline_field_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("field-rules-tick", {
        body: { clinic_id: clinicId },
      });
      if (error) throw new Error(error.message);
      const r = (data as any)?.results?.[0];
      if (r?.error) toast.error(`Falhou: ${r.error}`);
      else toast.success(`Avaliados: ${r?.evaluated ?? 0} · Movidos: ${r?.moved ?? 0}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setRunning(false);
    }
  }

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "—";
  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? "—";

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Regras de auto-movimento (Kanban)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando os campos do lead casarem com a condição, o card é movido pra coluna escolhida.
            Avaliado a cada 2 minutos. Respeita lock manual.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
            <Sparkles className="mr-2 h-3 w-3" />
            Sugerir com IA
          </Button>
          <Button size="sm" variant="secondary" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <PlayCircle className="mr-2 h-3 w-3" />}
            Rodar agora
          </Button>
        </div>
      </div>

      <SuggestRulesDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        clinicId={clinicId}
        pipelines={pipelines}
        stages={stages}
        defaultPipelineId={pipelineId}
        onImported={load}
      />

      <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Pipeline</Label>
          <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Coluna alvo</Label>
          <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {stagesForPipeline.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome da regra</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mover desqualificados" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Prioridade</Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end justify-between gap-2">
            <Label className="text-xs">Habilitada</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">
            Condições (JSON · array de <code>{`{ field, op, value }`}</code>)
          </Label>
          <Textarea
            value={conditionsText}
            onChange={(e) => setConditionsText(e.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Ops: <code>equals</code>, <code>not_equals</code>, <code>is_true</code>, <code>is_false</code>,
            <code> is_empty</code>, <code>not_empty</code>, <code>in</code>, <code>contains</code>,
            <code> gte</code>, <code>lte</code>. Lê <code>leads.custom_fields</code>.
          </p>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button size="sm" onClick={addRule} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
            Criar regra
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-6">
            <Loader2 className="inline h-4 w-4 animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6 border rounded-lg">
            Nenhuma regra ainda.
          </div>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{r.name}</span>
                  <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    prio {r.priority}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {pipelineName(r.pipeline_id)} → <strong>{stageName(r.target_stage_id)}</strong>
                </div>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] font-mono">
                  {JSON.stringify(r.conditions, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => removeRule(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
