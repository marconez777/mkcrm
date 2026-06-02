import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, Check, X, AlertTriangle, Undo2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PromptDiff } from "@/components/agents/PromptDiff";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Patch = {
  system_prompt?: string;
  temperature?: number;
  draft_mode?: boolean;
  rag_top_k?: number;
  debounce_seconds?: number;
  tools?: string[];
};
type Proposal = {
  message: string;
  summary?: string;
  rationale?: string;
  changes: Patch;
  has_changes: boolean;
};

interface Props {
  agentId: string;
  clinicId: string | null;
  agentSnapshot: Record<string, unknown>;
  onApplied: (patch: Patch) => void;
}

const FIELD_LABELS: Record<keyof Patch, string> = {
  system_prompt: "System prompt",
  temperature: "Temperature",
  draft_mode: "Modo rascunho",
  rag_top_k: "RAG top_k",
  debounce_seconds: "Debounce (s)",
  tools: "Ferramentas",
};

type EvalResult = { id: string; passed: boolean; response: string };
type EvalRun = {
  status: "running" | "done" | "error";
  total?: number;
  passed?: number;
  regressed?: { id: string; prompt: string; response: string }[];
  error?: string;
};

export function CopilotPanel({ agentId, clinicId, agentSnapshot, onApplied }: Props) {
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [previousSnapshot, setPreviousSnapshot] = useState<Record<string, unknown> | null>(null);
  const [reverting, setReverting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, proposal]);

  // reset when changing agent
  useEffect(() => {
    setHistory([]);
    setProposal(null);
    setInput("");
  }, [agentId]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (!clinicId) {
      toast.error("Clínica não identificada.");
      return;
    }
    const nextHistory: ChatMsg[] = [...history, { role: "user", content: text }];
    setHistory(nextHistory);
    setInput("");
    setProposal(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-builder", {
        body: {
          action: "copilot_chat",
          clinic_id: clinicId,
          payload: {
            agent: agentSnapshot,
            history: nextHistory,
          },
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        const msg = data?.message || data?.error || "Falha no Co-piloto.";
        toast.error(msg);
        setHistory((h) => [...h, { role: "assistant", content: `⚠️ ${msg}` }]);
        return;
      }
      const prop: Proposal = {
        message: data.message ?? "",
        summary: data.summary,
        rationale: data.rationale,
        changes: data.changes ?? {},
        has_changes: !!data.has_changes,
      };
      setHistory((h) => [...h, { role: "assistant", content: prop.message || "(sem resposta)" }]);
      if (prop.has_changes) setProposal(prop);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setHistory((h) => [...h, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function applyPatch() {
    if (!proposal?.has_changes || applying) return;
    setApplying(true);
    try {
      const { error } = await supabase
        .from("ai_agents")
        .update(proposal.changes as never)
        .eq("id", agentId);
      if (error) throw error;
      toast.success("Patch aplicado ao agente.");
      onApplied(proposal.changes);
      setHistory((h) => [
        ...h,
        { role: "assistant", content: `✅ Aplicado: ${proposal.summary || Object.keys(proposal.changes).join(", ")}` },
      ]);
      setProposal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  function discardPatch() {
    setProposal(null);
    setHistory((h) => [...h, { role: "assistant", content: "❌ Patch descartado." }]);
  }

  function renderValue(key: keyof Patch, val: unknown) {
    if (key === "system_prompt" && typeof val === "string") {
      const current = String(agentSnapshot.system_prompt ?? "");
      return <PromptDiff oldText={current} newText={val} />;
    }
    if (key === "tools" && Array.isArray(val)) {
      const current = Array.isArray(agentSnapshot.tools) ? (agentSnapshot.tools as unknown[]).map(String) : [];
      const next = val.map(String);
      const added = next.filter((t) => !current.includes(t));
      const removed = current.filter((t) => !next.includes(t));
      const kept = next.filter((t) => current.includes(t));
      return (
        <div className="mt-1 flex flex-wrap gap-1">
          {next.length === 0 && removed.length === 0 && (
            <span className="text-xs text-muted-foreground">(nenhuma)</span>
          )}
          {kept.map((t) => (
            <Badge key={`k-${t}`} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
          {added.map((t) => (
            <Badge key={`a-${t}`} className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px]">+ {t}</Badge>
          ))}
          {removed.map((t) => (
            <Badge key={`r-${t}`} className="bg-destructive/15 text-destructive line-through text-[10px]">− {t}</Badge>
          ))}
        </div>
      );
    }
    if ((key === "temperature" || key === "rag_top_k" || key === "debounce_seconds") && agentSnapshot[key] !== undefined) {
      return (
        <span className="font-mono text-xs">
          <span className="text-destructive line-through">{String(agentSnapshot[key])}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-emerald-700 dark:text-emerald-400">{String(val)}</span>
        </span>
      );
    }
    return <span className="font-mono text-xs">{String(val)}</span>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Converse com o Co-piloto para ajustar prompt, ferramentas e parâmetros deste agente.
      </div>

      <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3" ref={scrollRef as never}>
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ex.: "Não peça nome e telefone do lead, já temos esses dados do WhatsApp" ou "Reduza a temperature e use respostas mais curtas".
          </p>
        )}
        <div className="flex flex-col gap-2">
          {history.map((m, i) => (
            <div
              key={i}
              className={`rounded-md px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                  : "mr-auto max-w-[85%] bg-card border"
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="mr-auto flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
            </div>
          )}
        </div>
      </ScrollArea>

      {proposal?.has_changes && (
        <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Patch proposto</div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={discardPatch} disabled={applying}>
                <X className="mr-1 h-3 w-3" /> Descartar
              </Button>
              <Button size="sm" onClick={applyPatch} disabled={applying}>
                {applying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Aplicar
              </Button>
            </div>
          </div>
          {proposal.summary && <p className="mb-2 text-xs text-muted-foreground">{proposal.summary}</p>}
          <div className="flex flex-col gap-2">
            {Object.entries(proposal.changes).map(([k, v]) => (
              <div key={k} className="rounded border bg-background p-2">
                <div className="text-xs font-semibold">{FIELD_LABELS[k as keyof Patch] ?? k}</div>
                {renderValue(k as keyof Patch, v)}
              </div>
            ))}
          </div>
          {proposal.rationale && (
            <p className="mt-2 text-[11px] italic text-muted-foreground">{proposal.rationale}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Diga o que deseja ajustar no agente…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
