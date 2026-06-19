import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  GitBranch,
  HelpCircle,
  Inbox,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { calcCost, fmtUSD } from "@/lib/ai-pricing";
import { Link } from "react-router-dom";

// ----------------- types -----------------
type UsageRow = {
  id: string;
  lead_id: string | null;
  model: string;
  operation: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  error: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  lead_id: string;
  created_at: string;
  payload: Record<string, any>;
};

type LeadMini = { id: string; name: string | null; phone: string | null };

type QueueStats = {
  waiting: number;
  stuck: number;
  done_last_hour: number;
};

const AGENT_META: Record<string, { label: string; emoji: string; explain: string; accent: string; parallel?: boolean }> = {
  "classifier:summarizer": {
    label: "Resumidor",
    emoji: "📝",
    explain: "Lê o histórico do paciente e escreve um resumo factual do que aconteceu.",
    accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  "classifier:agendador": {
    label: "Agendador",
    emoji: "📅",
    explain: "Avalia intenção de marcar/desmarcar consulta — roda em paralelo.",
    accent: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    parallel: true,
  },
  "classifier:typifier": {
    label: "Tipificador",
    emoji: "🏷️",
    explain: "Decide tags e preenche campos personalizados — roda em paralelo.",
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    parallel: true,
  },
  "classifier:movimentador": {
    label: "Movimentador",
    emoji: "🎯",
    explain: "Avalia o estágio do funil (stage) do lead — roda em paralelo.",
    accent: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
    parallel: true,
  },
  "classifier:maestro": {
    label: "Maestro",
    emoji: "🎼",
    explain: "Valida tudo e dá a decisão final: intent, stage e confiança.",
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
};

const PIPELINE_OPS = Object.keys(AGENT_META);
const PARALLEL_OPS = PIPELINE_OPS.filter((op) => AGENT_META[op].parallel);

// ----------------- helpers -----------------
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function rowCost(r: UsageRow): number {
  if (r.cost_usd != null) return Number(r.cost_usd);
  return calcCost(r.model, r.input_tokens, r.output_tokens);
}

function friendlySkip(reason: string | null | undefined): { label: string; tone: "warn" | "error" | "info" } {
  if (!reason) return { label: "Classificada", tone: "info" };
  if (reason.startsWith("agent_error:")) return { label: "Erro no agente IA", tone: "error" };
  const map: Record<string, string> = {
    clinic_not_allowlisted: "Clínica não habilitada",
    no_new_messages: "Sem mensagens novas",
    no_messages: "Lead sem mensagens",
    no_pipeline: "Sem pipeline configurado",
    lead_not_found: "Lead não encontrado",
    no_clinic_openai_key: "Sem chave OpenAI da clínica",
    classifier_disabled: "Classificador desligado",
    classifier_throttled: "Limitada por throttle",
  };
  return { label: map[reason] ?? reason, tone: "warn" };
}

// ----------------- component -----------------
export function PipelineOverview({ clinicId }: { clinicId: string | null }) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadMini>>({});
  const [queue, setQueue] = useState<QueueStats>({ waiting: 0, stuck: 0, done_last_hour: 0 });
  const [loading, setLoading] = useState(false);
  const [pausedRemote, setPausedRemote] = useState<boolean | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const since24h = useMemo(() => new Date(Date.now() - 24 * 3600_000).toISOString(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ai_usage rows: only pipeline ops, 24h
      let usageQ = supabase
        .from("ai_usage")
        .select("id, lead_id, model, operation, status, input_tokens, output_tokens, total_tokens, latency_ms, cost_usd, error, created_at")
        .in("operation", PIPELINE_OPS)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (clinicId) usageQ = usageQ.eq("clinic_id", clinicId);

      // lead_events for classifier
      let evQ = supabase
        .from("lead_events")
        .select("id, lead_id, created_at, payload")
        .eq("type", "auto:classifier")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(500);
      if (clinicId) evQ = evQ.eq("clinic_id", clinicId);

      // queue counts
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const stuckCutoff = new Date(Date.now() - 30 * 60_000).toISOString();

      let waitingQ = supabase.from("leads").select("id", { head: true, count: "exact" }).eq("needs_ai_review", true);
      let stuckQ = supabase
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("needs_ai_review", true)
        .lt("ai_review_queued_at", stuckCutoff);
      let doneQ = supabase
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .gte("last_classified_at", oneHourAgo);
      if (clinicId) {
        waitingQ = waitingQ.eq("clinic_id", clinicId);
        stuckQ = stuckQ.eq("clinic_id", clinicId);
        doneQ = doneQ.eq("clinic_id", clinicId);
      }

      const settingQ = supabase
        .from("app_settings")
        .select("value")
        .eq("key", "automation.classifier.enabled")
        .maybeSingle();

      const [uRes, eRes, wRes, sRes, dRes, setRes] = await Promise.all([usageQ, evQ, waitingQ, stuckQ, doneQ, settingQ]);

      const usageRows = (uRes.data ?? []) as UsageRow[];
      const evRows = (eRes.data ?? []) as EventRow[];
      setRows(usageRows);
      setEvents(evRows);
      setQueue({ waiting: wRes.count ?? 0, stuck: sRes.count ?? 0, done_last_hour: dRes.count ?? 0 });

      const enabledVal = String((setRes.data as { value?: unknown } | null)?.value ?? "true").toLowerCase();
      setPausedRemote(!(enabledVal === "true" || enabledVal === '"true"' || enabledVal === "1"));

      // resolve leads
      const ids = Array.from(
        new Set([...usageRows.map((r) => r.lead_id), ...evRows.map((e) => e.lead_id)].filter(Boolean)),
      ) as string[];
      if (ids.length) {
        const { data: lRows } = await supabase.from("leads").select("id, name, phone").in("id", ids);
        const m: Record<string, LeadMini> = {};
        (lRows ?? []).forEach((l: any) => {
          m[l.id] = l;
        });
        setLeads(m);
      } else {
        setLeads({});
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId, since24h]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime: queue + new events
  useEffect(() => {
    const ch = supabase
      .channel("pipeline-overview")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads", filter: clinicId ? `clinic_id=eq.${clinicId}` : undefined },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_events", filter: clinicId ? `clinic_id=eq.${clinicId}` : undefined },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clinicId, load]);

  // ---- derived ----
  const totals = useMemo(() => {
    let cost = 0;
    let tokens = 0;
    let errors = 0;
    const byOp = new Map<string, { calls: number; cost: number; tokens: number; lat: number; errors: number }>();
    for (const r of rows) {
      const c = rowCost(r);
      cost += c;
      tokens += r.total_tokens ?? 0;
      if (r.status === "error") errors++;
      const cur = byOp.get(r.operation) ?? { calls: 0, cost: 0, tokens: 0, lat: 0, errors: 0 };
      cur.calls++;
      cur.cost += c;
      cur.tokens += r.total_tokens ?? 0;
      cur.lat += r.latency_ms ?? 0;
      if (r.status === "error") cur.errors++;
      byOp.set(r.operation, cur);
    }
    const successEvents = events.filter((e) => !e.payload?.skipped).length;
    const classifiedRuns = Math.max(successEvents, Math.round(rows.length / 3));
    return {
      cost,
      tokens,
      errors,
      classifiedRuns,
      perLead: classifiedRuns ? cost / classifiedRuns : 0,
      byOp: PIPELINE_OPS.map((op) => ({ op, ...(byOp.get(op) ?? { calls: 0, cost: 0, tokens: 0, lat: 0, errors: 0 }) })),
    };
  }, [rows, events]);

  const skipReasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const s = (ev.payload?.skipped as string | undefined) ?? null;
      if (!s) continue;
      const key = s.startsWith("agent_error:") ? "agent_error" : s;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count, ...friendlySkip(reason) }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const recent = useMemo(() => events.slice(0, 30), [events]);

  const detailEvents = useMemo(
    () => (detailLeadId ? events.filter((e) => e.lead_id === detailLeadId) : []),
    [detailLeadId, events],
  );
  const detailUsage = useMemo(
    () => (detailLeadId ? rows.filter((r) => r.lead_id === detailLeadId) : []),
    [detailLeadId, rows],
  );

  // toggle classifier
  const togglePause = async () => {
    if (pausedRemote == null) return;
    const next = !pausedRemote;
    const value = next ? '"false"' : '"true"';
    await supabase.from("app_settings").upsert(
      { key: "automation.classifier.enabled", value: value as any },
      { onConflict: "key" },
    );
    setPausedRemote(next);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5">
        {/* HERO */}
        <Card className="overflow-hidden p-0">
          <div className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Sua IA nas últimas 24h</h2>
                  <InfoDot text="Visão simples do que a IA do pipeline fez no último dia. Cada lead passa por 3 mini-agentes que leem, classificam e decidem o que fazer." />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada lead é lido pelos 3 agentes (Resumidor → Tipificador → Maestro) sempre que recebe novas mensagens.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
                {pausedRemote != null && (
                  <Button
                    variant={pausedRemote ? "default" : "outline"}
                    size="sm"
                    onClick={togglePause}
                    className="gap-1"
                  >
                    {pausedRemote ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {pausedRemote ? "Retomar IA" : "Pausar IA"}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            <HeroStat
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              label="Leads classificados"
              value={totals.classifiedRuns.toLocaleString()}
              sub="nas últimas 24h"
            />
            <HeroStat
              icon={<Coins className="h-4 w-4 text-amber-500" />}
              label="Custo total"
              value={fmtUSD(totals.cost)}
              sub={`≈ ${fmtUSD(totals.perLead)} por lead`}
            />
            <HeroStat
              icon={<Inbox className="h-4 w-4 text-blue-500" />}
              label="Na fila agora"
              value={queue.waiting.toLocaleString()}
              sub={queue.stuck > 0 ? `${queue.stuck} travados >30min` : "sem travas"}
              tone={queue.stuck > 0 ? "warn" : undefined}
            />
            <HeroStat
              icon={<Zap className="h-4 w-4 text-violet-500" />}
              label="Processados/hora"
              value={queue.done_last_hour.toLocaleString()}
              sub={pausedRemote ? "⏸ pausado" : "ritmo atual"}
              tone={pausedRemote ? "warn" : undefined}
            />
          </div>
        </Card>

        {/* AGENTS BREAKDOWN */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Os 3 agentes do pipeline</h3>
            <InfoDot text="Cada classificação chama 3 modelos em sequência. Aqui você vê quanto cada um custou e quanto demorou." />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {totals.byOp.map((b) => {
              const meta = AGENT_META[b.op];
              const avgLat = b.calls ? Math.round(b.lat / b.calls) : 0;
              const pctOfTotal = totals.cost ? (b.cost / totals.cost) * 100 : 0;
              return (
                <Card key={b.op} className={`p-4 ${meta.accent} border`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg">{meta.emoji}</div>
                      <div className="mt-1 text-sm font-semibold">{meta.label}</div>
                      <p className="mt-0.5 text-[11px] opacity-80">{meta.explain}</p>
                    </div>
                    {b.errors > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {b.errors} erro{b.errors > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Stat tiny label="Custo" value={fmtUSD(b.cost)} />
                    <Stat tiny label="Chamadas" value={b.calls.toLocaleString()} />
                    <Stat tiny label="Latência média" value={avgLat ? `${avgLat}ms` : "—"} />
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
                    <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${pctOfTotal}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] opacity-70">{pctOfTotal.toFixed(0)}% do custo total</div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* RECENT EXECUTIONS + SKIP REASONS */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Últimas execuções por lead</h3>
              <InfoDot text="Cada linha = uma vez que a IA processou um lead. Clique para ver os detalhes do que ela decidiu." />
              <span className="ml-auto text-[11px] text-muted-foreground">{recent.length} eventos</span>
            </div>
            <div className="divide-y">
              {recent.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhuma execução nas últimas 24h.
                </div>
              )}
              {recent.map((ev) => {
                const lead = leads[ev.lead_id];
                const skipped = ev.payload?.skipped as string | undefined;
                const fr = friendlySkip(skipped);
                const cls = ev.payload?.classification as
                  | { stage_suggestion?: string; intent?: string; confidence?: number }
                  | undefined;
                const cost = ev.payload?.cost as { usage?: any } | undefined;
                const usageObj = cost?.usage ?? null;
                const totalCost =
                  rows.find((r) => r.lead_id === ev.lead_id && Math.abs(new Date(r.created_at).getTime() - new Date(ev.created_at).getTime()) < 30_000)
                    ?.cost_usd ?? null;
                return (
                  <button
                    key={ev.id}
                    onClick={() => setDetailLeadId(ev.lead_id)}
                    className="flex w-full items-center gap-3 py-2 text-left transition hover:bg-accent/40"
                  >
                    <span className="text-base leading-none">
                      {fr.tone === "error" ? "❌" : fr.tone === "warn" ? "⚠️" : "✅"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">
                          {lead?.name || lead?.phone || ev.lead_id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(ev.created_at)}</span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {skipped
                          ? fr.label
                          : cls?.stage_suggestion
                            ? `${cls.stage_suggestion}${cls.intent && cls.intent !== "outro" ? ` · ${cls.intent}` : ""}`
                            : "Classificada"}
                      </div>
                    </div>
                    {!skipped && cls?.confidence != null && (
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round((cls.confidence ?? 0) * 100)}% confiança
                      </Badge>
                    )}
                    {totalCost != null && totalCost > 0 && (
                      <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:inline">
                        {fmtUSD(Number(totalCost))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* SKIP REASONS */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Por que pulou um lead?</h3>
              <InfoDot text="A IA não roda em todo lead. Estes são os motivos que ela usou para pular alguns nas últimas 24h." />
            </div>
            <div className="space-y-2">
              {skipReasons.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum lead foi pulado. 🎉</p>
              )}
              {skipReasons.map((r) => (
                <div key={r.reason} className="rounded-md border bg-card p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {r.tone === "error" ? "❌ " : "⚠️ "}
                      {r.label}
                    </span>
                    <Badge variant={r.tone === "error" ? "destructive" : "secondary"} className="text-[10px]">
                      {r.count}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground">{r.reason}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* DRAWER */}
        <Sheet open={!!detailLeadId} onOpenChange={(o) => !o && setDetailLeadId(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Execução da IA</SheetTitle>
            </SheetHeader>
            {detailLeadId && (
              <LeadRunDetail
                leadId={detailLeadId}
                lead={leads[detailLeadId]}
                events={detailEvents}
                usage={detailUsage}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

// ----------------- subcomponents -----------------
function HeroStat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, tiny }: { label: string; value: string; tiny?: boolean }) {
  return (
    <div>
      <div className={`text-muted-foreground ${tiny ? "text-[10px]" : "text-xs"}`}>{label}</div>
      <div className={`tabular-nums ${tiny ? "text-xs font-semibold" : "text-sm font-semibold"}`}>{value}</div>
    </div>
  );
}

function InfoDot({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3 w-3 cursor-help text-muted-foreground/60" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function LeadRunDetail({
  leadId,
  lead,
  events,
  usage,
}: {
  leadId: string;
  lead: LeadMini | undefined;
  events: EventRow[];
  usage: UsageRow[];
}) {
  const latest = events[0];
  const cls = latest?.payload?.classification as
    | { stage_suggestion?: string; intent?: string; confidence?: number; is_b2b?: boolean; reasons?: string[] }
    | undefined;
  const agents = latest?.payload?.agents as
    | { summarizer_model?: string; typifier_model?: string; maestro_model?: string; summary?: string; latency_ms?: any }
    | undefined;
  const applied = latest?.payload?.applied as Record<string, any> | undefined;
  const skipped = latest?.payload?.skipped as string | undefined;
  const fr = friendlySkip(skipped);

  // group usage rows by run (closest to event timestamp, within 60s)
  const runUsage = useMemo(() => {
    if (!latest) return [] as UsageRow[];
    const t = new Date(latest.created_at).getTime();
    return usage.filter((r) => Math.abs(new Date(r.created_at).getTime() - t) < 60_000);
  }, [latest, usage]);

  const totalCost = runUsage.reduce((s, r) => s + rowCost(r), 0);

  return (
    <div className="mt-4 space-y-4 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">{lead?.name || lead?.phone || leadId.slice(0, 8)}</div>
          <Link to={`/inbox/${leadId}`} className="text-xs text-primary hover:underline">
            <ExternalLink className="inline h-3 w-3" /> abrir conversa
          </Link>
        </div>
        {lead?.phone && <div className="text-xs text-muted-foreground">{lead.phone}</div>}
      </div>

      {/* Status */}
      <div className="rounded-md border bg-card p-3">
        <div className="text-[11px] text-muted-foreground">Resultado da última execução</div>
        {skipped ? (
          <div className="mt-1 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Pulada — {fr.label}</span>
          </div>
        ) : (
          <div className="mt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15">
                ✅ Classificada
              </Badge>
              {cls?.stage_suggestion && <Badge variant="outline">📍 {cls.stage_suggestion}</Badge>}
              {cls?.intent && cls.intent !== "outro" && <Badge variant="outline">🎯 {cls.intent}</Badge>}
              {cls?.is_b2b && <Badge variant="outline">B2B</Badge>}
            </div>
            {cls?.confidence != null && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Confiança da IA</span>
                  <span>{Math.round((cls.confidence ?? 0) * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(cls.confidence ?? 0) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      {agents?.summary && (
        <div className="rounded-md border bg-card p-3">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Bot className="h-3 w-3" /> Resumo gerado pelo Agente 1
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{agents.summary}</p>
        </div>
      )}

      {/* 3 agentes timeline */}
      <div>
        <div className="mb-2 text-[11px] text-muted-foreground">Os 3 agentes desta execução</div>
        <div className="space-y-2">
          {PIPELINE_OPS.map((op) => {
            const meta = AGENT_META[op];
            const r = runUsage.find((x) => x.operation === op);
            const modelFromAgents =
              op === "classifier:summarizer"
                ? agents?.summarizer_model
                : op === "classifier:typifier"
                  ? agents?.typifier_model
                  : agents?.maestro_model;
            const latMap = (agents?.latency_ms ?? {}) as Record<string, number>;
            const latKey = op.split(":")[1];
            const lat = r?.latency_ms ?? latMap[latKey];
            return (
              <div key={op} className={`rounded-md border p-2 ${meta.accent}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>{meta.emoji}</span>
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">{r?.model ?? modelFromAgents ?? "—"}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[10px] opacity-80">
                  <span>{r ? fmtUSD(rowCost(r)) : "—"}</span>
                  <span>{lat ? `${lat}ms` : "—"}</span>
                  <span>
                    {(r?.input_tokens ?? 0).toLocaleString()} → {(r?.output_tokens ?? 0).toLocaleString()} tokens
                  </span>
                  {r?.status === "error" && <span className="font-semibold">erro</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-right text-[11px] text-muted-foreground">
          Total desta execução:{" "}
          <span className="font-semibold tabular-nums text-foreground">{fmtUSD(totalCost)}</span>
        </div>
      </div>

      {/* Reasons */}
      {cls?.reasons && cls.reasons.length > 0 && (
        <div className="rounded-md border bg-card p-3">
          <div className="mb-1 text-[11px] text-muted-foreground">Por que a IA decidiu assim</div>
          <ul className="list-inside list-disc space-y-1 text-xs">
            {cls.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Applied */}
      {applied && (
        <details className="rounded-md border bg-card p-3 text-xs">
          <summary className="cursor-pointer font-medium">O que foi aplicado no lead</summary>
          <div className="mt-2 space-y-2">
            {applied.tags && (
              <div>
                <div className="text-[10px] text-muted-foreground">Tags</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(applied.tags.added ?? []).map((t: string) => (
                    <Badge key={`a-${t}`} className="bg-emerald-500/15 text-emerald-700">+{t}</Badge>
                  ))}
                  {(applied.tags.removed_computed ?? []).map((t: string) => (
                    <Badge key={`r-${t}`} variant="destructive">-{t}</Badge>
                  ))}
                  {(applied.tags.low_confidence_tag_injected as boolean | undefined) && (
                    <Badge variant="outline">⚠️ baixa confiança</Badge>
                  )}
                </div>
              </div>
            )}
            {applied.custom_fields?.set && Object.keys(applied.custom_fields.set).length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground">Campos atualizados</div>
                <pre className="mt-0.5 overflow-x-auto rounded bg-muted p-2 text-[10px]">
                  {JSON.stringify(applied.custom_fields.set, null, 2)}
                </pre>
              </div>
            )}
            {applied.custom_fields?.blocked_by_g10 &&
              Object.keys(applied.custom_fields.blocked_by_g10).length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    Bloqueados (humano editou recentemente)
                  </div>
                  <pre className="mt-0.5 overflow-x-auto rounded bg-muted p-2 text-[10px]">
                    {JSON.stringify(applied.custom_fields.blocked_by_g10, null, 2)}
                  </pre>
                </div>
              )}
            {applied.stage_suggestion_only && (
              <div>
                <div className="text-[10px] text-muted-foreground">Movimentação sugerida</div>
                <pre className="mt-0.5 overflow-x-auto rounded bg-muted p-2 text-[10px]">
                  {JSON.stringify(applied.stage_suggestion_only, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}

      {/* History */}
      {events.length > 1 && (
        <div>
          <div className="mb-1 text-[11px] text-muted-foreground">Execuções anteriores (24h)</div>
          <div className="space-y-1">
            {events.slice(1, 10).map((e) => {
              const f = friendlySkip(e.payload?.skipped);
              return (
                <div key={e.id} className="flex items-center gap-2 text-[11px]">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{timeAgo(e.created_at)}</span>
                  <span>—</span>
                  <span>{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw */}
      <details className="rounded-md border bg-card p-2 text-[10px]">
        <summary className="cursor-pointer text-muted-foreground">Dados brutos (suporte)</summary>
        <pre className="mt-2 max-h-64 overflow-auto">{JSON.stringify(latest?.payload, null, 2)}</pre>
      </details>
    </div>
  );
}
