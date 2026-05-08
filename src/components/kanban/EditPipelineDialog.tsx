import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"sales" | "internal">("sales");
  const [instanceId, setInstanceId] = useState<string>("none");
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
    setInstanceId(pipeline.whatsapp_instance_id ?? "none");
    setMoveTargetPipeline("");
    setMoveTargetStage("");
    setTargetStages([]);
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_id", pipeline.id)
      .then(({ count }) => setLeadCount(count ?? 0));
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

  // Bloqueia escolher instância já vinculada a outro funil
  const usedInstances = new Set(
    pipelines.filter((p) => p.id !== pipeline.id && p.whatsapp_instance_id).map((p) => p.whatsapp_instance_id as string)
  );
  const availableInstances = whatsappInstances.filter((i) => !usedInstances.has(i.id));

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const patch: any = {
      name: name.trim(),
      kind,
      whatsapp_instance_id: kind === "sales" && instanceId !== "none" ? instanceId : null,
    };
    const { error } = await supabase.from("pipelines").update(patch).eq("id", pipeline!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
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
              <div className="space-y-1.5">
                <Label>Número de WhatsApp</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (não recebe leads automaticamente)</SelectItem>
                    {availableInstances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                    {pipeline.whatsapp_instance_id && !availableInstances.some(i => i.id === pipeline.whatsapp_instance_id) && (
                      <SelectItem value={pipeline.whatsapp_instance_id}>
                        {whatsappInstances.find(i => i.id === pipeline.whatsapp_instance_id)?.name ?? "Atual"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Apenas um funil por número. Instâncias já usadas em outros funis não aparecem.
                </p>
              </div>
            )}

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
