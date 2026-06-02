import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Sparkles, Play, MessageSquare, Beaker, ClipboardCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBuilderError } from "@/lib/builder-errors";

interface Props {
  agentId: string;
  clinicId: string | null;
  onPatchToPrompt?: (patch: string) => void;
}

type Scenario = {
  id: string;
  name: string;
  persona: string;
  opening_message: string;
  difficulty: "easy" | "medium" | "hard";
  expected_outcomes: string[];
};

type EvalResult = {
  scenario_id: string;
  transcript: Array<{ role: "lead" | "agent"; content: string }>;
  overall_score: number;
  passed: boolean;
  scores: { uso_contexto?: number; adesao_oferta?: number; tom?: number; escalacao?: number };
  strengths: string[];
  weaknesses: string[];
  suggested_patch: string;
};

const NICHE_OPTS = [
  { v: "other", l: "Outro" },
  { v: "clinic", l: "Clínica" },
  { v: "dental", l: "Odonto" },
  { v: "real_estate", l: "Imobiliária" },
  { v: "restaurant", l: "Restaurante" },
  { v: "ecommerce", l: "E-commerce" },
  { v: "saas", l: "SaaS" },
  { v: "law", l: "Advocacia" },
  { v: "education", l: "Educação" },
  { v: "aesthetics", l: "Estética" },
  { v: "agency", l: "Agência" },
  { v: "local_services", l: "Serviços locais" },
];
const GOAL_OPTS = [
  { v: "sdr", l: "SDR" },
  { v: "classifier", l: "Classificador" },
  { v: "support", l: "Suporte" },
  { v: "scheduler", l: "Agendador" },
  { v: "custom", l: "Customizado" },
];

export function TestLab({ agentId, clinicId, onPatchToPrompt }: Props) {
  // free chat
  const [chatInput, setChatInput] = useState("");
  const [chatOutput, setChatOutput] = useState("");
  const [chatting, setChatting] = useState(false);

  // scenarios
  const [niche, setNiche] = useState("other");
  const [goal, setGoal] = useState("sdr");
  const [dominantOffer, setDominantOffer] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  // evaluation
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EvalResult>>({});

  const invokeBuilder = async (action: string, payload: any) => {
    if (!clinicId) { toast.error("Clínica não identificada."); return null; }
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: { action, clinic_id: clinicId, payload },
    });
    if (error) { toast.error(parseBuilderError(error).message); return null; }
    if (!(data as any)?.ok) { toast.error((data as any)?.message ?? "Falha no Construtor."); return null; }
    return data as any;
  };

  // ----- free chat -----
  const runChat = async () => {
    if (!chatInput.trim()) return;
    setChatting(true);
    setChatOutput("");
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: { agent_id: agentId, messages: [{ role: "user", content: chatInput }] },
    });
    setChatting(false);
    if (error || (data as any)?.error) {
      setChatOutput("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    setChatOutput((data as any)?.content ?? "(vazio)");
  };

  // ----- scenarios -----
  const generateScenarios = async () => {
    setGenLoading(true);
    setScenarios([]);
    setResults({});
    const res = await invokeBuilder("generate_scenarios", {
      agent_id: agentId,
      niche, goal, dominant_offer: dominantOffer,
    });
    setGenLoading(false);
    if (!res) return;
    setScenarios(res.scenarios ?? []);
    toast.success(`${(res.scenarios ?? []).length} cenários gerados.`);
  };

  // ----- evaluation -----
  const runEval = async (s: Scenario) => {
    setRunningId(s.id);
    const res = await invokeBuilder("run_evaluation", {
      agent_id: agentId,
      scenario: s,
      max_turns: 5,
    });
    setRunningId(null);
    if (!res) return;
    setResults((prev) => ({ ...prev, [s.id]: res as EvalResult }));
  };

  const runAll = async () => {
    for (const s of scenarios) {
      await runEval(s);
    }
  };

  const diffBadge = (d: Scenario["difficulty"]) => {
    const cls = d === "hard" ? "bg-destructive/20 text-destructive"
      : d === "medium" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
      : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400";
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{d}</Badge>;
  };

  const scoreBar = (v: number | undefined) => {
    const n = Math.max(0, Math.min(5, v ?? 0));
    const pct = (n / 5) * 100;
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums">{n.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Tabs defaultValue="chat" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="chat"><MessageSquare className="mr-1 h-3.5 w-3.5" /> Chat livre</TabsTrigger>
        <TabsTrigger value="scenarios"><Beaker className="mr-1 h-3.5 w-3.5" /> Cenários</TabsTrigger>
        <TabsTrigger value="eval"><ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Avaliação</TabsTrigger>
      </TabsList>

      {/* Chat livre */}
      <TabsContent value="chat" className="space-y-3 pt-3">
        <Textarea rows={2} placeholder="Pergunte algo..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
        <Button onClick={runChat} disabled={chatting} size="sm">
          {chatting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar
        </Button>
        {chatOutput && <div className="rounded border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{chatOutput}</div>}
      </TabsContent>

      {/* Cenários */}
      <TabsContent value="scenarios" className="space-y-3 pt-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Nicho" /></SelectTrigger>
            <SelectContent>{NICHE_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Objetivo" /></SelectTrigger>
            <SelectContent>{GOAL_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-8" placeholder="Oferta principal" value={dominantOffer} onChange={(e) => setDominantOffer(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={generateScenarios} disabled={genLoading} size="sm">
            {genLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar cenários
          </Button>
          {scenarios.length > 0 && (
            <Button onClick={runAll} disabled={!!runningId} size="sm" variant="secondary">
              <Play className="mr-2 h-4 w-4" /> Rodar todos
            </Button>
          )}
        </div>
        {scenarios.map((s) => {
          const r = results[s.id];
          return (
            <div key={s.id} className="space-y-2 rounded border bg-background p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{s.name}</span>
                  {diffBadge(s.difficulty)}
                  {r && (r.passed
                    ? <Badge className="bg-emerald-600 text-[10px]">passou</Badge>
                    : <Badge variant="destructive" className="text-[10px]">falhou</Badge>)}
                </div>
                <Button size="sm" variant="ghost" onClick={() => runEval(s)} disabled={runningId === s.id}>
                  {runningId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-muted-foreground italic">{s.persona}</p>
              <div className="rounded border bg-muted/30 p-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Abertura do lead</span>
                <p>{s.opening_message}</p>
              </div>
              <details>
                <summary className="cursor-pointer text-[11px] text-muted-foreground">Critérios esperados ({s.expected_outcomes.length})</summary>
                <ul className="ml-4 list-disc space-y-0.5 pt-1">
                  {s.expected_outcomes.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </details>
              {r && (
                <div className="space-y-2 rounded border bg-muted/30 p-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div><div className="text-[10px] text-muted-foreground">Contexto</div>{scoreBar(r.scores.uso_contexto)}</div>
                    <div><div className="text-[10px] text-muted-foreground">Oferta</div>{scoreBar(r.scores.adesao_oferta)}</div>
                    <div><div className="text-[10px] text-muted-foreground">Tom</div>{scoreBar(r.scores.tom)}</div>
                    <div><div className="text-[10px] text-muted-foreground">Escalação</div>{scoreBar(r.scores.escalacao)}</div>
                  </div>
                  {r.strengths.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Acertos</div>
                      <ul className="ml-4 list-disc">{r.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  )}
                  {r.weaknesses.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-destructive">Problemas</div>
                      <ul className="ml-4 list-disc">{r.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  )}
                  {r.suggested_patch && (
                    <div className="rounded border border-primary/40 bg-primary/5 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase text-primary">Patch sugerido</span>
                        {onPatchToPrompt && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onPatchToPrompt(r.suggested_patch)}>
                            Anexar ao prompt <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap text-[11px]">{r.suggested_patch}</pre>
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">Transcrição ({r.transcript.length} turnos)</summary>
                    <div className="mt-1 space-y-1">
                      {r.transcript.map((m, i) => (
                        <div key={i} className={`rounded p-1.5 ${m.role === "lead" ? "bg-muted" : "bg-primary/10"}`}>
                          <span className="text-[10px] font-semibold uppercase opacity-60">{m.role}</span>
                          <p>{m.content}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })}
        {scenarios.length === 0 && !genLoading && (
          <p className="text-xs text-muted-foreground">Defina o contexto acima e clique em "Gerar cenários" — o Construtor cria leads simulados realistas adaptados ao seu nicho.</p>
        )}
      </TabsContent>

      {/* Resumo das avaliações */}
      <TabsContent value="eval" className="space-y-3 pt-3">
        {Object.values(results).length === 0 ? (
          <p className="text-xs text-muted-foreground">Rode pelo menos um cenário na aba "Cenários" para ver o resumo aqui.</p>
        ) : (
          <div className="space-y-2">
            {scenarios.filter((s) => results[s.id]).map((s) => {
              const r = results[s.id];
              return (
                <div key={s.id} className="flex items-center justify-between rounded border bg-background p-2 text-sm">
                  <span className="truncate">{s.name}</span>
                  <div className="flex items-center gap-2">
                    {scoreBar(r.overall_score)}
                    {r.passed
                      ? <Badge className="bg-emerald-600 text-[10px]">passou</Badge>
                      : <Badge variant="destructive" className="text-[10px]">falhou</Badge>}
                  </div>
                </div>
              );
            })}
            <div className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
              Média geral: {(Object.values(results).reduce((a, r) => a + r.overall_score, 0) / Object.values(results).length).toFixed(2)} / 5
              {" · "}
              Aprovação: {Object.values(results).filter((r) => r.passed).length}/{Object.values(results).length}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
