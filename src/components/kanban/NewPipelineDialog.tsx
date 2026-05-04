import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  whatsappInstances: { id: string; name: string }[];
  nextPosition: number;
  onCreated: (id: string) => void;
}

const TEMPLATES: Record<"sales" | "internal", string[]> = {
  sales: ["Novo lead", "Em conversa", "Proposta", "Fechado"],
  internal: ["A fazer", "Em andamento", "Concluído"],
};

const COLORS = ["#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#06b6d4", "#a855f7", "#ec4899"];

export default function NewPipelineDialog({ open, onOpenChange, whatsappInstances, nextPosition, onCreated }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"sales" | "internal">("sales");
  const [color, setColor] = useState(COLORS[0]);
  const [instanceId, setInstanceId] = useState<string | "none">("none");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) { toast.error("Dê um nome ao funil"); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        name: name.trim(),
        kind,
        color,
        position: nextPosition,
        whatsapp_instance_id: kind === "sales" && instanceId !== "none" ? instanceId : null,
      })
      .select("id").single();
    if (error || !data) { setCreating(false); toast.error(error?.message ?? "Erro"); return; }

    const stages = TEMPLATES[kind].map((n, i) => ({
      pipeline_id: data.id, name: n, position: i, color,
    }));
    await supabase.from("pipeline_stages").insert(stages);

    setCreating(false);
    onCreated(data.id);
    onOpenChange(false);
    setName(""); setKind("sales"); setInstanceId("none"); setColor(COLORS[0]);
    toast.success("Funil criado");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo funil</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Vendas Brasil" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Vendas (com WhatsApp)</SelectItem>
                <SelectItem value="internal">Gestão interna de processos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "sales" && (
            <div className="space-y-1.5">
              <Label>Número de WhatsApp (opcional)</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {whatsappInstances.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
