import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, ArrowUp, ArrowDown, GitBranch, Info } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useDialogs";

export type AgentStage = {
  id: string;
  clinic_id: string;
  agent_id: string;
  order_idx: number;
  name: string;
  goal: string | null;
  system_prompt_delta: string | null;
  advance_when: string | null;
};

interface Props {
  agentId: string;
  clinicId: string | null;
}

type FormState = {
  id: string | null;
  name: string;
  goal: string;
  system_prompt_delta: string;
  advance_when: string;
};

const EMPTY: FormState = { id: null, name: "", goal: "", system_prompt_delta: "", advance_when: "" };

export function StagesPanel({ agentId, clinicId }: Props) {
  const confirm = useConfirm();
  const [stages, setStages] = useState<AgentStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_stages")
      .select("*")
      .eq("agent_id", agentId)
      .order("order_idx", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStages((data ?? []) as AgentStage[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, clinicId]);

  function openCreate() {
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(s: AgentStage) {
    setForm({
      id: s.id,
      name: s.name,
      goal: s.goal ?? "",
      system_prompt_delta: s.system_prompt_delta ?? "",
      advance_when: s.advance_when ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Dê um nome para o estágio.");
      return;
    }
    setSaving(true);
    const payload = {
      agent_id: agentId,
      name: form.name.trim(),
      goal: form.goal.trim() || null,
      system_prompt_delta: form.system_prompt_delta.trim() || null,
      advance_when: form.advance_when.trim() || null,
    };
    const res = form.id
      ? await supabase.from("agent_stages").update(payload).eq("id", form.id)
      : await supabase
          .from("agent_stages")
          .insert({ ...payload, order_idx: stages.length });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(form.id ? "Estágio atualizado." : "Estágio criado.");
    setDialogOpen(false);
    load();
  }

  async function remove(s: AgentStage) {
    const ok = await confirm({
      title: "Excluir estágio?",
      description: `"${s.name}" será removido.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("agent_stages").delete().eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estágio excluído.");
    load();
  }

  async function move(s: AgentStage, dir: -1 | 1) {
    const idx = stages.findIndex((x) => x.id === s.id);
    const swap = stages[idx + dir];
    if (!swap) return;
    const updates = [
      supabase.from("agent_stages").update({ order_idx: swap.order_idx }).eq("id", s.id),
      supabase.from("agent_stages").update({ order_idx: s.order_idx }).eq("id", swap.id),
    ];
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) {
      toast.error(err.error.message);
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Defina as etapas pelas quais a conversa passa (ex.: Abertura → Qualificação → Oferta → Agendamento).
          Por enquanto os estágios <strong>não alteram</strong> a resposta do agente — servem como mapa do funil.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo estágio
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          Nenhum estágio criado ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Timeline horizontal compacta */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 px-2 py-2">
            {stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <span className="font-mono text-muted-foreground">{i + 1}.</span>
                  {s.name}
                </Badge>
                {i < stages.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
          {/* Cards detalhados */}
          {stages.map((s, i) => (
            <div key={s.id} className="rounded-md border bg-card p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                    <span className="truncate font-semibold">{s.name}</span>
                  </div>
                  {s.goal && (
                    <p className="mt-0.5 text-xs text-muted-foreground">🎯 {s.goal}</p>
                  )}
                  {s.advance_when && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-medium">avança quando:</span> {s.advance_when}
                    </p>
                  )}
                  {s.system_prompt_delta && (
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-1.5 text-[10px]">
                      {s.system_prompt_delta}
                    </pre>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(s, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === stages.length - 1} onClick={() => move(s, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => remove(s)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar estágio" : "Novo estágio"}</DialogTitle>
            <DialogDescription className="text-xs">
              Nome do estágio + texto extra para o prompt (será injetado quando a conversa estiver neste estágio, a partir da Fase 14b).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex.: Qualificação"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Objetivo deste estágio</Label>
              <Input
                placeholder="Ex.: descobrir orçamento e prazo"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Trecho extra de prompt (delta)</Label>
              <Textarea
                rows={4}
                placeholder="Instruções específicas deste estágio. Será concatenado ao system prompt quando ativo."
                value={form.system_prompt_delta}
                onChange={(e) => setForm({ ...form, system_prompt_delta: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Quando avançar para o próximo estágio</Label>
              <Textarea
                rows={2}
                placeholder="Ex.: 'o lead disse o orçamento e a data desejada'"
                value={form.advance_when}
                onChange={(e) => setForm({ ...form, advance_when: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
