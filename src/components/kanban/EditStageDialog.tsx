import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Stage } from "@/types/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#64748b", "#ec4899",
];

const NONE = "__none__";

interface AgentOpt { id: string; name: string }

interface Props {
  stage: Stage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export default function EditStageDialog({ stage, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [agentId, setAgentId] = useState<string>(NONE);
  const [autoReply, setAutoReply] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (!stage || !open) return;
    setName(stage.name);
    setColor(stage.color || "#6366f1");
    setLoadingAi(true);
    (async () => {
      const [agentsRes, defaultRes] = await Promise.all([
        supabase.from("ai_agents").select("id, name").eq("enabled", true).order("name"),
        supabase.from("stage_ai_defaults").select("agent_id, auto_reply").eq("stage_id", stage.id).maybeSingle(),
      ]);
      setAgents((agentsRes.data ?? []) as AgentOpt[]);
      setAgentId(defaultRes.data?.agent_id ?? NONE);
      setAutoReply(!!defaultRes.data?.auto_reply);
      setLoadingAi(false);
    })();
  }, [stage, open]);

  async function save() {
    if (!stage || !name.trim()) return;
    setSaving(true);

    const { error: stageErr } = await supabase.from("pipeline_stages")
      .update({ name: name.trim(), color })
      .eq("id", stage.id);
    if (stageErr) { setSaving(false); toast.error(stageErr.message); return; }

    if (agentId === NONE) {
      const { error } = await supabase.from("stage_ai_defaults").delete().eq("stage_id", stage.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("stage_ai_defaults").upsert(
        { stage_id: stage.id, agent_id: agentId, auto_reply: autoReply, updated_at: new Date().toISOString() },
        { onConflict: "stage_id" },
      );
      if (error) { setSaving(false); toast.error(error.message); return; }
    }

    setSaving(false);
    toast.success("Etapa atualizada");
    onSaved?.();
    onOpenChange(false);
  }

  const agentDisabled = agentId === NONE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar etapa</DialogTitle></DialogHeader>

        <Tabs defaultValue="geral">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="ia"><Sparkles className="mr-1.5 h-3.5 w-3.5" />IA</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 pt-4">
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
          </TabsContent>

          <TabsContent value="ia" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Agente de auto-resposta</Label>
              <Select value={agentId} onValueChange={(v) => { setAgentId(v); if (v === NONE) setAutoReply(false); }} disabled={loadingAi}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum (desligado)</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && !loadingAi && (
                <p className="text-xs text-muted-foreground">Nenhum agente ativo nesta conta. Crie um em Agentes IA.</p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Switch
                checked={autoReply && !agentDisabled}
                disabled={agentDisabled}
                onCheckedChange={setAutoReply}
                id="auto-reply"
              />
              <div className="space-y-0.5">
                <Label htmlFor="auto-reply" className="cursor-pointer">Responder automaticamente</Label>
                <p className="text-xs text-muted-foreground">
                  Quando um lead enviar mensagem neste estágio, o agente acima responde sozinho em poucos segundos.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
