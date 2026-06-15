import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Lead, Pipeline, Stage } from "@/types/crm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead | null;
  pipelines: Pipeline[];
  stages: Stage[];
  onMoved?: () => void;
}

export default function MoveLeadDialog({ open, onOpenChange, lead, pipelines, stages, onMoved }: Props) {
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const targetStages = useMemo(
    () => stages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.position - b.position),
    [stages, pipelineId],
  );

  useEffect(() => {
    if (!open || !lead) return;
    const firstOther = pipelines.find((p) => p.id !== lead.pipeline_id);
    setPipelineId(firstOther?.id ?? "");
    setStageId("");
  }, [open, lead, pipelines]);

  useEffect(() => {
    if (targetStages.length && !targetStages.some((s) => s.id === stageId)) {
      setStageId(targetStages[0].id);
    }
  }, [targetStages, stageId]);

  async function handleMove() {
    if (!lead || !pipelineId || !stageId) return;
    setSaving(true);
    const manualLockUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("leads")
      .update({ stage_id: stageId, pipeline_id: pipelineId, position: 0, manual_lock_until: manualLockUntil })
      .eq("id", lead.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const target = pipelines.find((p) => p.id === pipelineId);
    toast.success(`Lead movido para "${target?.name ?? "funil"}"`);
    onOpenChange(false);
    onMoved?.();
  }

  const otherPipelines = pipelines.filter((p) => p.id !== lead?.pipeline_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover lead para outro funil</DialogTitle>
        </DialogHeader>

        {otherPipelines.length === 0 ? (
          <div className="text-sm text-muted-foreground">Não há outros funis disponíveis.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Funil de destino</Label>
              <Select value={pipelineId} onValueChange={setPipelineId} disabled={saving}>
                <SelectTrigger><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
                <SelectContent>
                  {otherPipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId} disabled={saving || !targetStages.length}>
                <SelectTrigger>
                  <SelectValue placeholder={targetStages.length ? "Selecione uma etapa" : "Funil sem etapas"} />
                </SelectTrigger>
                <SelectContent>
                  {targetStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleMove} disabled={saving || !pipelineId || !stageId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
