import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

type Label = "good" | "problem" | "objection" | "doubt";

const LABELS: { value: Label; name: string; color: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "good", name: "Boa", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: ThumbsUp },
  { value: "problem", name: "Problema", color: "bg-destructive/15 text-destructive", icon: AlertCircle },
  { value: "objection", name: "Objeção", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: HelpCircle },
  { value: "doubt", name: "Dúvida", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: HelpCircle },
];

type Classification = {
  id: string;
  lead_id: string;
  label: Label;
  note: string | null;
  promoted_eval_id: string | null;
  created_at: string;
};

type LeadOpt = { id: string; name: string | null; phone: string | null };

interface Props {
  agentId: string;
  clinicId: string | null;
  onProposalReady?: (proposal: unknown) => void;
}

export function ThreadLearningPanel({ agentId, clinicId, onProposalReady }: Props) {
  const [rows, setRows] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState<string>("");
  const [newLabel, setNewLabel] = useState<Label>("problem");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_thread_classifications")
      .select("id, lead_id, label, note, promoted_eval_id, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Classification[]);
    setLoading(false);
  }, [agentId]);

  const loadLeads = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("lead_id, leads:lead_id (id, name, phone)")
      .eq("bot_agent_id", agentId)
      .order("timestamp", { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    const opts: LeadOpt[] = [];
    for (const row of (data ?? []) as { lead_id: string; leads: LeadOpt | null }[]) {
      if (!row.leads || seen.has(row.leads.id)) continue;
      seen.add(row.leads.id);
      opts.push(row.leads);
    }
    setLeads(opts);
  }, [agentId]);

  useEffect(() => {
    void load();
    void loadLeads();
  }, [load, loadLeads]);

  async function addClassification() {
    if (!newLead || !clinicId) return;
    setSaving(true);
    const { error } = await supabase.from("lead_thread_classifications").insert({
      lead_id: newLead,
      agent_id: agentId,
      label: newLabel,
      note: newNote || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conversa marcada.");
    setDialogOpen(false);
    setNewLead("");
    setNewNote("");
    setNewLabel("problem");
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Remover esta marcação?")) return;
    const { error } = await supabase.from("lead_thread_classifications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removida.");
      void load();
    }
  }

  async function promote(id: string) {
    setBusyId(`${id}:promote`);
    try {
      const { data, error } = await supabase.functions.invoke("agent-learn-from-thread", {
        body: { action: "promote_to_eval", classification_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Eval criado a partir da conversa.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function askPatch(id: string) {
    setBusyId(`${id}:patch`);
    try {
      const { data, error } = await supabase.functions.invoke("agent-learn-from-thread", {
        body: { action: "request_patch", classification_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Co-piloto respondeu — confira no card 'Co-piloto'.");
      onProposalReady?.(data?.proposal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function leadLabel(id: string) {
    const l = leads.find((x) => x.id === id);
    if (!l) return id.slice(0, 8);
    return l.name || l.phone || id.slice(0, 8);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Marque conversas reais (good, problem, objeção, dúvida). Cada uma vira material de eval ou pedido de patch — PII é
          anonimizada automaticamente.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-3 w-3" /> Marcar conversa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar conversa</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Lead (conversas recentes deste agente)</label>
                <Select value={newLead} onValueChange={setNewLead}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher lead…" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma conversa recente.</div>
                    )}
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name || l.phone || l.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Classificação</label>
                <Select value={newLabel} onValueChange={(v) => setNewLabel(v as Label)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LABELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Observação (opcional)</label>
                <Textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ex.: o bot ofereceu desconto sem precisar."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={addClassification} disabled={!newLead || saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Marcar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          Nenhuma conversa marcada ainda. Use "Marcar conversa" para começar.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const meta = LABELS.find((l) => l.value === r.label)!;
            const Icon = meta.icon;
            const busy = busyId?.startsWith(r.id);
            return (
              <li key={r.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`${meta.color} gap-1 text-[10px]`}>
                        <Icon className="h-3 w-3" /> {meta.name}
                      </Badge>
                      <span className="truncate text-xs font-medium">{leadLabel(r.lead_id)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      {r.promoted_eval_id && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> eval criado
                        </Badge>
                      )}
                    </div>
                    {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promote(r.id)}
                      disabled={busy || !!r.promoted_eval_id}
                      title="Cria um eval a partir desta conversa anonimizada"
                    >
                      {busyId === `${r.id}:promote` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <GraduationCap className="h-3 w-3" />
                      )}
                      <span className="ml-1 hidden sm:inline">Eval</span>
                    </Button>
                    {r.label === "problem" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => askPatch(r.id)}
                        disabled={busy}
                        title="Pede ao co-piloto um patch a partir desta conversa"
                      >
                        {busyId === `${r.id}:patch` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        <span className="ml-1 hidden sm:inline">Patch</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
