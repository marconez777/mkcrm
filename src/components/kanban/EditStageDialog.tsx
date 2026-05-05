import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Stage } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bot } from "lucide-react";
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

interface Agent { id: string; name: string; enabled: boolean }

export default function EditStageDialog({ stage, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("none");
  const [autoReply, setAutoReply] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("ai_agents").select("id,name,enabled").order("name").then(({ data }) => {
      setAgents((data || []) as Agent[]);
    });
  }, [open]);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color || "#6366f1");
      supabase.from("stage_ai_defaults").select("agent_id,auto_reply").eq("stage_id", stage.id).maybeSingle().then(({ data }) => {
        setAgentId(data?.agent_id || "none");
        setAutoReply(!!data?.auto_reply);
      });
    }
  }, [stage]);

  async function save() {
    if (!stage || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("pipeline_stages")
      .update({ name: name.trim(), color })
      .eq("id", stage.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    const payload = {
      stage_id: stage.id,
      agent_id: agentId === "none" ? null : agentId,
      auto_reply: autoReply,
    };
    const { error: e2 } = await supabase.from("stage_ai_defaults").upsert(payload, { onConflict: "stage_id" });
    setSaving(false);
    if (e2) { toast.error(e2.message); return; }
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

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" /> Agente de IA padrão
            </div>
            <p className="text-xs text-muted-foreground">
              Quando um lead entra nesta etapa, este agente é atribuído automaticamente.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Agente</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{!a.enabled && " (desativado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Resposta automática</Label>
                <p className="text-[11px] text-muted-foreground">Bot responde sozinho leads desta etapa.</p>
              </div>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} disabled={agentId === "none"} />
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
