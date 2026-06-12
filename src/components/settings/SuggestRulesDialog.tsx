import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

interface Pipeline { id: string; name: string }
interface Stage { id: string; name: string; pipeline_id: string }

interface Suggestion {
  name: string;
  target_stage_id: string;
  priority: number;
  rationale: string;
  conditions: Array<{ field: string; op: string; value?: unknown }>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  pipelines: Pipeline[];
  stages: Stage[];
  defaultPipelineId?: string;
  onImported: () => void;
}

export default function SuggestRulesDialog({
  open, onOpenChange, clinicId, pipelines, stages, defaultPipelineId, onImported,
}: Props) {
  const [pipelineId, setPipelineId] = useState(defaultPipelineId ?? "");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPipelineId(defaultPipelineId ?? pipelines[0]?.id ?? "");
      setSuggestions([]);
      setSelected(new Set());
      setWarning(null);
    }
  }, [open, defaultPipelineId, pipelines]);

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "—";

  async function fetchSuggestions() {
    if (!pipelineId) { toast.error("Selecione um pipeline"); return; }
    setLoading(true);
    setSuggestions([]);
    setSelected(new Set());
    setWarning(null);
    try {
      const { data, error } = await supabase.functions.invoke("field-rules-suggest", {
        body: { clinic_id: clinicId, pipeline_id: pipelineId },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.error === "ai_credits_exhausted") {
        toast.error("Créditos de IA esgotados. Adicione saldo no workspace.");
        return;
      }
      if (d?.error === "rate_limited") {
        toast.error("Muitas requisições. Tente em alguns segundos.");
        return;
      }
      if (d?.warning) setWarning(d.warning);
      const list: Suggestion[] = d?.suggestions ?? [];
      setSuggestions(list);
      setSelected(new Set(list.map((_, i) => i)));
      if (list.length === 0 && !d?.warning) {
        toast.info("O agente não sugeriu novas regras.");
      } else if (list.length > 0) {
        toast.success(`${list.length} sugestão(ões) geradas`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function importSelected() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const rows = Array.from(selected).map((i) => {
        const s = suggestions[i];
        return {
          clinic_id: clinicId,
          pipeline_id: pipelineId,
          target_stage_id: s.target_stage_id,
          name: s.name,
          priority: s.priority,
          enabled: true,
          conditions: s.conditions as never,
        };
      });
      const { error } = await supabase.from("pipeline_field_rules").insert(rows);
      if (error) throw new Error(error.message);
      toast.success(`${rows.length} regra(s) importada(s)`);
      onImported();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Sugerir regras com IA
          </DialogTitle>
          <DialogDescription>
            O agente lê as colunas do pipeline e os campos extraídos dos seus leads recentes para sugerir regras de auto-movimento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Pipeline</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchSuggestions} disabled={loading || !pipelineId}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />}
            Gerar
          </Button>
        </div>

        {warning && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            {warning}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading && (
            <div className="text-center text-xs text-muted-foreground py-12">
              <Loader2 className="inline h-5 w-5 animate-spin mb-2" />
              <div>O agente está analisando seu pipeline…</div>
            </div>
          )}
          {!loading && suggestions.length === 0 && !warning && (
            <div className="text-center text-xs text-muted-foreground py-12 border rounded-lg">
              Clique em <strong>Gerar</strong> para receber sugestões.
            </div>
          )}
          {suggestions.map((s, i) => (
            <label
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{s.name}</span>
                  <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    prio {s.priority}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  → <strong>{stageName(s.target_stage_id)}</strong>
                </div>
                <div className="text-xs italic text-muted-foreground">{s.rationale}</div>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] font-mono">
                  {JSON.stringify(s.conditions, null, 2)}
                </pre>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {suggestions.length > 0 && (
              <>
                {selected.size} de {suggestions.length} selecionada(s)
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-2 text-xs"
                  onClick={() => setSelected(new Set(suggestions.map((_, i) => i)))}
                >
                  Todas
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-2 text-xs"
                  onClick={() => setSelected(new Set())}
                >
                  Nenhuma
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={importSelected} disabled={importing || selected.size === 0}>
              {importing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Importar selecionadas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
