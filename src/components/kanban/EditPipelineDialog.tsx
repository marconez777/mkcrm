import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StagesManager from "./StagesManager";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  pipeline: Pipeline | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelines: Pipeline[];
  whatsappInstances: { id: string; name: string }[];
  onChanged?: () => void;
}

export default function EditPipelineDialog({ pipeline, open, onOpenChange, pipelines, whatsappInstances, onChanged }: Props) {
  const { membership, isSuperAdmin } = useAuth();
  const isProfessional = membership?.role === "professional" && !isSuperAdmin;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"sales" | "internal">("sales");
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [linkedByOther, setLinkedByOther] = useState<Map<string, string>>(new Map()); // instanceId -> pipelineId
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveTargetPipeline, setMoveTargetPipeline] = useState<string>("");
  const [moveTargetStage, setMoveTargetStage] = useState<string>("");
  const [targetStages, setTargetStages] = useState<{ id: string; name: string }[]>([]);
  const [leadCount, setLeadCount] = useState<number>(0);

  useEffect(() => {
    if (!pipeline) return;
    setName(pipeline.name);
    setKind(pipeline.kind);
    setMoveTargetPipeline("");
    setMoveTargetStage("");
    setTargetStages([]);
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_id", pipeline.id)
      .then(({ count }) => setLeadCount(count ?? 0));

    // Carrega vínculos atuais + vínculos de outros pipelines na mesma clínica
    (async () => {
      const { data: mine } = await supabase
        .from("pipeline_whatsapp_instances")
        .select("whatsapp_instance_id")
        .eq("pipeline_id", pipeline.id);
      const set = new Set<string>((mine ?? []).map((r: any) => r.whatsapp_instance_id));
      // Retro-compat: se ainda não há linha na junção, seed com a coluna legada
      if (set.size === 0 && pipeline.whatsapp_instance_id) set.add(pipeline.whatsapp_instance_id);
      setSelectedInstances(set);

      const { data: others } = await supabase
        .from("pipeline_whatsapp_instances")
        .select("whatsapp_instance_id, pipeline_id")
        .eq("clinic_id", (pipeline as any).clinic_id)
        .neq("pipeline_id", pipeline.id);
      const m = new Map<string, string>();
      (others ?? []).forEach((r: any) => m.set(r.whatsapp_instance_id, r.pipeline_id));
      setLinkedByOther(m);
    })();
  }, [pipeline]);

  useEffect(() => {
    if (!moveTargetPipeline) { setTargetStages([]); return; }
    supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", moveTargetPipeline).order("position")
      .then(({ data }) => {
        const stages = (data ?? []) as { id: string; name: string }[];
        setTargetStages(stages);
        setMoveTargetStage(stages[0]?.id ?? "");
      });
  }, [moveTargetPipeline]);

  if (!pipeline) return null;

  function toggleInstance(id: string) {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);

    const patch: any = {
      name: name.trim(),
      kind,
      // Retro-compat: primeira instância vira a "primária" da coluna legada
      whatsapp_instance_id: kind === "sales" && selectedInstances.size > 0
        ? Array.from(selectedInstances)[0]
        : null,
    };
    const { error } = await supabase.from("pipelines").update(patch).eq("id", pipeline!.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    if (kind === "sales") {
      // Diff da junção
      const { data: currentRows } = await supabase
        .from("pipeline_whatsapp_instances")
        .select("whatsapp_instance_id")
        .eq("pipeline_id", pipeline!.id);
      const current = new Set<string>((currentRows ?? []).map((r: any) => r.whatsapp_instance_id));
      const desired = selectedInstances;

      const toAdd = Array.from(desired).filter((id) => !current.has(id));
      const toRemove = Array.from(current).filter((id) => !desired.has(id));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from("pipeline_whatsapp_instances")
          .delete()
          .eq("pipeline_id", pipeline!.id)
          .in("whatsapp_instance_id", toRemove);
        if (delErr) { setSaving(false); toast.error(delErr.message); return; }
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((id) => ({
          pipeline_id: pipeline!.id,
          whatsapp_instance_id: id,
          clinic_id: (pipeline as any).clinic_id,
        }));
        const { error: insErr } = await supabase.from("pipeline_whatsapp_instances").insert(rows);
        if (insErr) { setSaving(false); toast.error(insErr.message); return; }
      }
    } else {
      // Pipeline virou "internal" — limpa vínculos
      await supabase.from("pipeline_whatsapp_instances").delete().eq("pipeline_id", pipeline!.id);
    }

    setSaving(false);
    toast.success("Funil atualizado");
    onChanged?.();
    onOpenChange(false);
  }

  async function moveAllLeads() {
    if (!moveTargetPipeline || !moveTargetStage) { toast.error("Escolha funil e etapa de destino"); return; }
    setMoving(true);
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_id: moveTargetPipeline, stage_id: moveTargetStage })
      .eq("pipeline_id", pipeline!.id);
    setMoving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${leadCount} leads movidos`);
    setLeadCount(0);
    onChanged?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Editar funil</DialogTitle></DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="stages">Etapas</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Vendas (com WhatsApp)</SelectItem>
                  <SelectItem value="internal">Gestão interna</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "sales" && (
              <div className="space-y-2">
                <Label>Números de WhatsApp</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                  {whatsappInstances.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground">Nenhuma instância disponível.</p>
                  )}
                  {whatsappInstances.map((i) => {
                    const isSelected = selectedInstances.has(i.id);
                    const takenByOther = linkedByOther.has(i.id);
                    const disabled = takenByOther && !isSelected;
                    return (
                      <label
                        key={i.id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition ${
                          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={disabled}
                          onCheckedChange={() => !disabled && toggleInstance(i.id)}
                        />
                        <span className="flex-1 truncate">{i.name}</span>
                        {takenByOther && !isSelected && (
                          <span className="text-[10px] uppercase text-muted-foreground">em outro funil</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas as mensagens recebidas por esses números entrarão neste funil e serão atendidas
                  pelo mesmo agente de IA. Cada número só pode pertencer a um funil.
                </p>
              </div>
            )}

            {!isProfessional && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRightLeft className="h-4 w-4" /> Mover leads para outro funil
                </div>
                <p className="text-xs text-muted-foreground">
                  Este funil tem <strong>{leadCount}</strong> {leadCount === 1 ? "lead" : "leads"}.
                </p>
                {leadCount > 0 && (
                  <div className="space-y-2">
                    <Select value={moveTargetPipeline} onValueChange={setMoveTargetPipeline}>
                      <SelectTrigger><SelectValue placeholder="Funil de destino" /></SelectTrigger>
                      <SelectContent>
                        {pipelines.filter((p) => p.id !== pipeline.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {targetStages.length > 0 && (
                      <Select value={moveTargetStage} onValueChange={setMoveTargetStage}>
                        <SelectTrigger><SelectValue placeholder="Etapa de destino" /></SelectTrigger>
                        <SelectContent>
                          {targetStages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="secondary" size="sm" onClick={moveAllLeads} disabled={moving || !moveTargetStage}>
                      {moving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mover {leadCount} {leadCount === 1 ? "lead" : "leads"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stages" className="pt-3">
            <StagesManager pipelineId={pipeline.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
