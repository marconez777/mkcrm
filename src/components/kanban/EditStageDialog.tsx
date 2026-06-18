import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Stage } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#64748b", "#ec4899",
];

interface Props {
  stage: Stage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function EditStageDialog({ stage, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color || "#6366f1");
    }
  }, [stage]);

  async function save() {
    if (!stage || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("pipeline_stages")
      .update({ name: name.trim(), color })
      .eq("id", stage.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Etapa atualizada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar etapa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-28 font-mono text-xs"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
