import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline, Stage } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceStage: Stage | null;
  pipelines: Pipeline[];
  onMoved?: () => void;
}

export default function MoveColumnLeadsDialog({ open, onOpenChange, sourceStage, pipelines, onMoved }: Props) {
  const [count, setCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const [targetPipeline, setTargetPipeline] = useState<string>("");
  const [targetStage, setTargetStage] = useState<string>("");
  const [targetStages, setTargetStages] = useState<Stage[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!open || !sourceStage) return;
    setTargetPipeline("");
    setTargetStage("");
    setTargetStages([]);
    setLoadingCount(true);
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage_id", sourceStage.id)
      .then(({ count }) => { setCount(count ?? 0); setLoadingCount(false); });
  }, [open, sourceStage]);

  useEffect(() => {
    if (!targetPipeline) { setTargetStages([]); setTargetStage(""); return; }
    supabase.from("pipeline_stages").select("*").eq("pipeline_id", targetPipeline).order("position")
      .then(({ data }) => {
        const stages = ((data ?? []) as Stage[]).filter((s) => s.id !== sourceStage?.id);
        setTargetStages(stages);
        setTargetStage(stages[0]?.id ?? "");
      });
  }, [targetPipeline, sourceStage?.id]);

  async function move() {
    if (!sourceStage || !targetPipeline || !targetStage) {
      toast.error("Escolha funil e etapa de destino"); return;
    }
    if (targetStage === sourceStage.id) {
      toast.error("Etapa de destino igual à origem"); return;
    }
    setMoving(true);
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_id: targetPipeline, stage_id: targetStage })
      .eq("stage_id", sourceStage.id);
    setMoving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${count} ${count === 1 ? "lead movido" : "leads movidos"}`);
    onMoved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Mover leads desta coluna
          </DialogTitle>
          <DialogDescription>
            Origem: <strong>{sourceStage?.name}</strong>
            {" — "}
            {loadingCount ? "contando…" : <><strong>{count}</strong> {count === 1 ? "lead" : "leads"}</>}
          </DialogDescription>
        </DialogHeader>

        {count === 0 && !loadingCount ? (
          <p className="text-sm text-muted-foreground">Esta coluna está vazia. Nada para mover.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Funil de destino</Label>
              <Select value={targetPipeline} onValueChange={setTargetPipeline}>
                <SelectTrigger><SelectValue placeholder="Escolha um funil" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetStages.length > 0 && (
              <div className="space-y-1.5">
                <Label>Etapa de destino</Label>
                <Select value={targetStage} onValueChange={setTargetStage}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma etapa" /></SelectTrigger>
                  <SelectContent>
                    {targetStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {count > 0 && (
            <Button onClick={move} disabled={moving || !targetStage}>
              {moving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mover {count} {count === 1 ? "lead" : "leads"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
