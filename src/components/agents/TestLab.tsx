import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Sparkles, Play, MessageSquare, Beaker, ClipboardCheck, ArrowRight, AlertCircle, Trash2, Bot, User as UserIcon, ChevronDown, ChevronUp, Phone, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBuilderError } from "@/lib/builder-errors";
import type { Persona } from "@/components/agents/PersonasPanel";

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
  // free chat (multi-turn)
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Fase 10 — Lead simulado (persistido por agente no localStorage)
  type SimulatedLead = {
    name: string;
    phone: string;
    channel: "whatsapp" | "instagram" | "widget" | "sms";
    pipeline: string;
    stage: string;
    notes: string;
    custom_fields: Record<string, string>;
  };
  const DEFAULT_LEAD: SimulatedLead = {
    name: "Maria Silva",
    phone: "+55 11 90000-0000",
    channel: "whatsapp",
    pipeline: "",
    stage: "",
    notes: "",
    custom_fields: {},
  };
  const LEAD_KEY = `testlab.simulated_lead.${agentId}`;
  const [simLead, setSimLead] = useState<SimulatedLead>(DEFAULT_LEAD);
  const [leadOpen, setLeadOpen] = useState(true);
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  useEffect(() => {
    // load per-agent lead profile
    try {
      const raw = localStorage.getItem(LEAD_KEY);
      if (raw) setSimLead({ ...DEFAULT_LEAD, ...JSON.parse(raw) });
      else setSimLead(DEFAULT_LEAD);
    } catch { setSimLead(DEFAULT_LEAD); }
    // reset chat when switching agent
    setChatHistory([]);
    setChatError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(simLead)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simLead]);

  // Fase 11 — carregar personas reutilizáveis do agente / clínica
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clinicId) return;
      const { data, error } = await supabase
        .from("agent_personas")
        .select("*")
        .or(`agent_id.eq.${agentId},agent_id.is.null`)
        .order("updated_at", { ascending: false });
      if (cancelled || error) return;
      setPersonas((data ?? []) as unknown as Persona[]);
    })();
    return () => { cancelled = true; };
  }, [agentId, clinicId]);

  const loadPersona = (id: string) => {
    setSelectedPersonaId(id);
    if (!id) return;
    const p = personas.find((x) => x.id === id);
    if (!p) return;
    setSimLead({
      name: p.name,
      phone: p.phone ?? "",
      channel: (["whatsapp", "instagram", "widget", "sms"].includes(p.channel) ? p.channel : "whatsapp") as SimulatedLead["channel"],
      pipeline: simLead.pipeline,
      stage: simLead.stage,
      notes: p.persona_text ?? "",
      custom_fields: p.custom_fields ?? {},
    });
    if (p.opening_message) {
      setChatInput(p.opening_message);
    }
    toast.success(`Persona "${p.name}" carregada.`);
  };
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory, chatting]);

  // scenarios
  const [niche, setNiche] = useState("other");
  const [goal, setGoal] = useState("sdr");
  const [dominantOffer, setDominantOffer] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  // evaluation
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EvalResult>>({});

  const extractEdgeError = async (error: any, data: any): Promise<string> => {
    // supabase-js v2: error.context é a Response do edge
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      }
    } catch { /* ignore */ }
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
    return parseBuilderError(error).message || error?.message || "Erro desconhecido.";
  };

  const invokeBuilder = async (action: string, payload: any) => {
    if (!clinicId) { toast.error("Clínica não identificada."); return null; }
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: { action, clinic_id: clinicId, payload },
    });
    if (error) { toast.error(await extractEdgeError(error, data)); return null; }
    if (!(data as any)?.ok) { toast.error((data as any)?.message ?? "Falha no Construtor."); return null; }
    return data as any;
  };

  // ----- free chat -----
  const runChat = async () => {
    const text = chatInput.trim();
    if (!text || chatting) return;
    const next: ChatMsg[] = [...chatHistory, { role: "user", content: text }];
    setChatHistory(next);
    setChatInput("");
    setChatError(null);
    setChatting(true);
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: { agent_id: agentId, messages: next, simulated_lead: simLead },
    });
    setChatting(false);
    if (error || (data as any)?.error) {
      const msg = await extractEdgeError(error, data);
      setChatError(msg);
      return;
    }
    const content = (data as any)?.content ?? "(resposta vazia)";
    setChatHistory((h) => [...h, { role: "assistant", content }]);
  };

  const clearChat = () => {
    setChatHistory([]);
    setChatError(null);
    setChatInput("");
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
      <TabsContent value="chat" className="space-y-2 pt-3">
        {/* Painel: lead simulado */}
        <div className="rounded-lg border bg-card">
          <button
            type="button"
            onClick={() => setLeadOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              Lead simulado · {simLead.name || "(sem nome)"} · {simLead.channel}
            </span>
            {leadOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {leadOpen && (
            <div className="space-y-2 border-t px-3 py-3">
              <p className="text-[11px] text-muted-foreground">
                Esses dados são enviados ao agente como contexto, simulando um lead real chegando pelo WhatsApp. O agente NÃO deve pedir o que já está aqui.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input className="h-8" placeholder="Nome" value={simLead.name} onChange={(e) => setSimLead({ ...simLead, name: e.target.value })} />
                <Input className="h-8" placeholder="Telefone" value={simLead.phone} onChange={(e) => setSimLead({ ...simLead, phone: e.target.value })} />
                <Select value={simLead.channel} onValueChange={(v) => setSimLead({ ...simLead, channel: v as SimulatedLead["channel"] })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="widget">Widget do site</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input className="h-8" placeholder="Funil (opcional)" value={simLead.pipeline} onChange={(e) => setSimLead({ ...simLead, pipeline: e.target.value })} />
                <Input className="h-8" placeholder="Etapa atual (opcional)" value={simLead.stage} onChange={(e) => setSimLead({ ...simLead, stage: e.target.value })} />
              </div>
              <Textarea
                rows={2}
                placeholder="Observações sobre o lead (ex.: 'chegou via campanha de Black Friday', 'já comprou antes')"
                value={simLead.notes}
                onChange={(e) => setSimLead({ ...simLead, notes: e.target.value })}
                className="min-h-[44px] text-xs"
              />
              {/* Custom fields */}
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(simLead.custom_fields).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="gap-1 text-[10px]">
                      <span className="font-semibold">{k}:</span> {v}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const next = { ...simLead.custom_fields };
                          delete next[k];
                          setSimLead({ ...simLead, custom_fields: next });
                        }}
                      >×</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input className="h-7 text-xs" placeholder="campo" value={customKey} onChange={(e) => setCustomKey(e.target.value)} />
                  <Input className="h-7 text-xs" placeholder="valor" value={customVal} onChange={(e) => setCustomVal(e.target.value)} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      const k = customKey.trim();
                      const v = customVal.trim();
                      if (!k || !v) return;
                      setSimLead({ ...simLead, custom_fields: { ...simLead.custom_fields, [k]: v } });
                      setCustomKey(""); setCustomVal("");
                    }}
                  >+ campo</Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => setSimLead(DEFAULT_LEAD)}>
                  resetar para padrão
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-lg border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {chatHistory.length === 0 ? "Inicie uma conversa com o agente" : `${chatHistory.length} ${chatHistory.length === 1 ? "mensagem" : "mensagens"}`}
            </span>
            {chatHistory.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearChat} disabled={chatting}>
                <Trash2 className="mr-1 h-3 w-3" /> Limpar
              </Button>
            )}
          </div>


          {/* Messages */}
          <div ref={scrollRef} className="max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto p-3">
            {chatHistory.length === 0 && !chatting && (
              <div className="flex h-full items-center justify-center py-8 text-center text-xs text-muted-foreground">
                Digite uma mensagem abaixo para testar como o agente responde.
              </div>
            )}
            {chatHistory.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatting && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {chatError && (
            <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Não foi possível enviar</div>
                <div className="opacity-90">{chatError}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive hover:text-destructive" onClick={() => setChatError(null)}>
                fechar
              </Button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t p-2">
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                placeholder="Digite uma mensagem... (Enter envia, Shift+Enter quebra linha)"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    runChat();
                  }
                }}
                className="min-h-[44px] resize-none"
                disabled={chatting}
              />
              <Button onClick={runChat} disabled={chatting || !chatInput.trim()} size="icon" className="h-10 w-10 shrink-0">
                {chatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
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
