import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePipelineAllowlist } from "@/hooks/usePipelineAllowlist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, X, RotateCcw, AlertTriangle, CheckCircle2, MinusCircle, ChevronDown, ChevronRight, Eraser, Filter, FileText, Tags, Target, Sparkles, GitBranch, Calendar, MoveRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { describeReason, toneClasses, type SkipReasonInfo } from "@/lib/pipeline-skip-reasons";

type OnlyAgent = "summarizer" | "parallel" | "maestro";

type RunStatus = "queued" | "running" | "done" | "error" | "cancelled";

interface Run {
  id: string;
  clinic_id: string;
  status: RunStatus;
  parent_run_id: string | null;
  scope: Record<string, unknown> | null;
  totals: Record<string, number> | null;
  comment: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface RunItem {
  id: string;
  run_id: string;
  lead_id: string | null;
  stage_id: string | null;
  stage_name: string | null;
  step: string;
  status: "pending" | "ok" | "skipped" | "error";
  result: Record<string, unknown> | null;
  error: string | null;
  comment: string | null;
  retry_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
}

function callExecutor<T = unknown>(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string } & T> {
  return supabase.functions
    .invoke("pipeline-run-executor", { body })
    .then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data as { ok?: boolean; error?: string } & T;
    });
}

export default function PipelineRuns() {
  const { enabled, loading, clinicId } = usePipelineAllowlist();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("pipeline_runs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(50);
      const nextRuns = (data as Run[]) ?? [];
      const activeRun = nextRuns.find((r) => r.status === "queued" || r.status === "running");
      if (activeRun) {
        const res = await callExecutor<{ run?: Run }>({ action: "status", run_id: activeRun.id }).catch(() => null);
        if (res?.run) {
          const checked = nextRuns.map((r) => (r.id === activeRun.id ? res.run! : r));
          if (active) setRuns(checked);
          return;
        }
      }
      if (active) setRuns(nextRuns);
    };
    load();
    const ch = supabase
      .channel(`pipeline-runs-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_runs", filter: `clinic_id=eq.${clinicId}` },
        () => load(),
      )
      .subscribe();
    const poll = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [clinicId]);

  const handleStart = async (scope?: { pipeline_id?: string; stage_ids?: string[]; lead_ids?: string[]; top_n?: number; only_agent?: OnlyAgent }) => {
    if (!clinicId) return;
    const isScoped = !!(scope?.stage_ids?.length || scope?.lead_ids?.length || scope?.top_n || scope?.only_agent);
    if (!isScoped && !confirm("Iniciar execução do pipeline INTEIRO da clínica? Isso vai processar todos os leads em todas as colunas com o agente de IA.")) return;
    setStarting(true);
    try {
      const payload: Record<string, unknown> = { action: "start", clinic_id: clinicId };
      if (scope?.pipeline_id) payload.pipeline_id = scope.pipeline_id;
      if (scope?.stage_ids?.length) payload.stage_ids = scope.stage_ids;
      if (scope?.lead_ids?.length) payload.lead_ids = scope.lead_ids;
      if (scope?.top_n && scope.top_n > 0) payload.top_n = scope.top_n;
      if (scope?.only_agent) payload.only_agent = scope.only_agent;
      const res = await callExecutor<{ run_id?: string }>(payload);
      if (res.error) {
        toast.error(`Erro: ${res.error}`);
        return;
      }
      toast.success(isScoped ? "Execução focada iniciada" : "Execução iniciada");
      if (res.run_id) setSelectedRunId(res.run_id);
      setScopeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card className="p-6">
          <h1 className="text-lg font-semibold mb-2">Agente de pipeline não habilitado</h1>
          <p className="text-sm text-muted-foreground">
            Esta clínica ainda não está autorizada a executar o agente de IA de pipeline. Estamos validando a feature
            primeiro com a Clínica ÓR; será liberada para as demais em seguida.
          </p>
        </Card>
      </div>
    );
  }

  const activeRun = runs.find((r) => r.status === "queued" || r.status === "running");

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Execução do pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Roda o agente de IA em todos os leads, coluna por coluna. Cada passo é registrado abaixo — você pode comentar
            o que ficou errado e reprocessar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (!clinicId) return;
              if (!confirm("Limpar TODAS as classificações geradas pela IA (qualificação, procedimento, datas de consulta, pagamento, resumo) em todos os leads desta clínica?\n\nIsso NÃO apaga tags de origem (lead-site, lead-phq9), nomes, telefones, estágios, atendentes ou anotações manuais.")) return;
              if (!confirm("Tem certeza? Esta ação não pode ser desfeita. Depois execute o pipeline para reclassificar.")) return;
              setResetting(true);
              try {
                const res = await callExecutor<{ leads_reset?: number }>({ action: "reset_ai_classifications", clinic_id: clinicId });
                if (res.error) { toast.error(`Erro: ${res.error}`); return; }
                toast.success(`Classificações limpas em ${res.leads_reset ?? 0} leads`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : String(err));
              } finally {
                setResetting(false);
              }
            }}
            disabled={resetting || starting || !!activeRun}
            className="gap-2"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            Limpar classificações da IA
          </Button>
          <Button variant="outline" onClick={() => setScopeOpen(true)} disabled={starting || !!activeRun} className="gap-2">
            <Filter className="h-4 w-4" /> Executar com escopo
          </Button>
          <Button onClick={() => handleStart()} disabled={starting || !!activeRun} className="gap-2">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {activeRun ? "Execução em andamento…" : "Executar pipeline inteiro"}
          </Button>
        </div>
      </header>

      <ScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        clinicId={clinicId}
        starting={starting}
        onConfirm={handleStart}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <Card className="p-3">
          <div className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">Execuções recentes</div>
          <ScrollArea className="h-[70vh]">
            <div className="space-y-1">
              {runs.length === 0 && (
                <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma execução ainda.</p>
              )}
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={`w-full rounded-md p-2 text-left text-sm hover:bg-muted/50 ${
                    selectedRunId === r.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.totals?.leads ?? 0} leads · ok {r.totals?.ok ?? 0} · skip {r.totals?.skipped ?? 0} · err {r.totals?.error ?? 0}
                  </div>
                  {r.parent_run_id && <div className="text-[10px] text-muted-foreground">↻ reprocesso</div>}
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-4">
          {selectedRunId ? (
            <RunDetail runId={selectedRunId} clinicId={clinicId} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione uma execução para ver o detalhe.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: RunStatus | RunItem["status"]; label?: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    queued: { label: "Na fila", cls: "bg-slate-500/15 text-slate-300" },
    running: { label: "Rodando", cls: "bg-blue-500/15 text-blue-400" },
    done: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-400" },
    error: { label: "Com erro", cls: "bg-red-500/15 text-red-400" },
    cancelled: { label: "Cancelada", cls: "bg-amber-500/15 text-amber-400" },
    pending: { label: "Pendente", cls: "bg-slate-500/15 text-slate-300" },
    ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-400" },
    skipped: { label: "Skip", cls: "bg-slate-500/15 text-slate-400" },
  };
  const c = cfg[status] ?? cfg.queued;
  return <Badge variant="outline" className={`border-0 ${c.cls}`}>{label ?? c.label}</Badge>;
}

type LeadInfo = { name: string | null; phone: string | null };

function RunDetail({ runId, clinicId }: { runId: string; clinicId: string | null }) {
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<RunItem[]>([]);
  const [leadsMap, setLeadsMap] = useState<Record<string, LeadInfo>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const knownIds = new Set<string>();
    const load = async () => {
      const { data: initialRun } = await supabase.from("pipeline_runs").select("*").eq("id", runId).single();
      const currentRun = initialRun as Run | null;
      const checkedRun = currentRun?.status === "running" || currentRun?.status === "queued"
        ? await callExecutor<{ run?: Run }>({ action: "status", run_id: runId }).catch(() => null)
        : null;
      const [{ data: r }, { data: it }] = await Promise.all([
        checkedRun?.run ? Promise.resolve({ data: checkedRun.run }) : supabase.from("pipeline_runs").select("*").eq("id", runId).single(),
        supabase.from("pipeline_run_items").select("*").eq("run_id", runId).order("created_at", { ascending: true }).limit(2000),
      ]);
      if (!active) return;
      setRun((r as Run) ?? null);
      const itemsArr = (it as RunItem[]) ?? [];
      setItems(itemsArr);
      const missing = Array.from(
        new Set(itemsArr.map((x) => x.lead_id).filter((x): x is string => !!x && !knownIds.has(x)))
      );
      if (missing.length > 0) {
        missing.forEach((id) => knownIds.add(id));
        const { data: leads } = await supabase.from("leads").select("id,name,phone").in("id", missing);
        if (!active) return;
        setLeadsMap((prev) => {
          const next = { ...prev };
          for (const l of (leads ?? []) as Array<{ id: string; name: string | null; phone: string | null }>) {
            next[l.id] = { name: l.name, phone: l.phone };
          }
          return next;
        });
      }
    };
    load();
    const ch = supabase
      .channel(`pipeline-run-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_run_items", filter: `run_id=eq.${runId}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pipeline_runs", filter: `id=eq.${runId}` }, () => load())
      .subscribe();
    const interval = setInterval(() => {
      if (run?.status === "running" || run?.status === "queued") load();
    }, 4000);
    return () => {
      active = false;
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const byStage = useMemo(() => {
    const groups: Record<string, RunItem[]> = {};
    for (const it of items) {
      const k = it.stage_name ?? "—";
      (groups[k] ||= []).push(it);
    }
    return groups;
  }, [items]);

  if (!run) return <Loader2 className="h-5 w-5 animate-spin" />;

  const cancel = async () => {
    setBusy(true);
    try {
      await callExecutor({ action: "cancel", run_id: runId });
      toast.success("Cancelamento solicitado");
    } finally {
      setBusy(false);
    }
  };
  const retry = async (which: "retry_errors" | "retry_commented") => {
    setBusy(true);
    try {
      const r = await callExecutor<{ run_id?: string; lead_count?: number }>({ action: which, run_id: runId });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Reprocesso iniciado (${r.lead_count} leads)`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          <div className="text-sm text-muted-foreground">
            {run.totals?.leads ?? 0} leads · OK {run.totals?.ok ?? 0} · Skip {run.totals?.skipped ?? 0} · Erro {run.totals?.error ?? 0}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(run.status === "running" || run.status === "queued") && (
            <Button size="sm" variant="outline" onClick={cancel} disabled={busy} className="gap-1">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          )}
          {run.status === "done" || run.status === "error" || run.status === "cancelled" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => retry("retry_errors")} disabled={busy} className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Reprocessar erros
              </Button>
              <Button size="sm" variant="outline" onClick={() => retry("retry_commented")} disabled={busy} className="gap-1">
                <RotateCcw className="h-3.5 w-3.5" /> Reprocessar comentados
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <ScrollArea className="h-[65vh] pr-2">
        <div className="space-y-3">
          {Object.entries(byStage).map(([stage, list]) => (
            <StageGroup key={stage} stageName={stage} items={list} leadsMap={leadsMap} clinicId={clinicId} />
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Aguardando processamento…</p>}
        </div>
      </ScrollArea>
    </div>
  );
}

function StageGroup({
  stageName, items, leadsMap, clinicId,
}: { stageName: string; items: RunItem[]; leadsMap: Record<string, LeadInfo>; clinicId: string | null }) {
  const [open, setOpen] = useState(true);
  const ok = items.filter((i) => i.status === "ok").length;
  const err = items.filter((i) => i.status === "error").length;
  const skip = items.filter((i) => i.status === "skipped").length;
  return (
    <div className="rounded-md border border-border/60">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/40">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 text-left">{stageName}</span>
        <span className="text-xs text-muted-foreground">{items.length} · ok {ok} · skip {skip} · err {err}</span>
      </button>
      {open && (
        <div className="divide-y divide-border/40">
          {items.map((it) => (
            <ItemRow key={it.id} item={it} lead={it.lead_id ? leadsMap[it.lead_id] : undefined} clinicId={clinicId} />
          ))}
        </div>
      )}
    </div>
  );
}

type ItemResult = {
  skipped?: string;
  mode?: "full" | "summarizer" | "parallel" | "typifier" | "maestro";
  classification?: {
    stage_suggestion?: string;
    intent?: string;
    confidence?: number;
    is_b2b?: boolean;
    reasons?: string[];
    tags_suggested?: string[];
    custom_fields_patch?: Record<string, unknown>;
  };
  telemetry?: {
    mode?: string;
    agents?: {
      summarizer_model?: string;
      agendador_model?: string;
      typifier_model?: string;
      movimentador_model?: string;
      maestro_model?: string;
      summary?: string;
      summary_chars?: number;
      latency_ms?: { summarizer?: number; agendador?: number; typifier?: number; movimentador?: number; maestro?: number };
      ran?: { summarizer?: boolean; agendador?: boolean; typifier?: boolean; movimentador?: boolean; maestro?: boolean };
    } | null;
    applied?: {
      tags?: { added?: string[]; removed_computed?: string[]; skipped?: string } & Record<string, unknown>;
      custom_fields?: { set?: Record<string, unknown>; skipped?: string } & Record<string, unknown>;
      stage_suggestion_only?: { suggested?: string; would_move?: boolean; reason?: string };
    };
  };
};

function AgentCard({
  icon, name, model, latencyMs, ran, status, body,
}: {
  icon: React.ReactNode;
  name: string;
  model?: string;
  latencyMs?: number;
  ran: boolean;
  status: "ok" | "error" | "skipped";
  body: React.ReactNode;
}) {
  const tone =
    status === "error" ? "border-red-500/40 bg-red-500/5"
    : !ran ? "border-border/40 bg-muted/20 opacity-60"
    : "border-border/60 bg-background/40";
  return (
    <div className={`flex flex-1 flex-col gap-1 rounded-md border p-2 text-[11px] ${tone}`}>
      <div className="flex items-center gap-1.5 font-medium">
        {icon}
        <span>{name}</span>
      </div>
      <div className="text-muted-foreground">
        {ran ? (
          <>
            <span>{model ?? "—"}</span>
            {typeof latencyMs === "number" && latencyMs > 0 && <span> · {latencyMs} ms</span>}
          </>
        ) : (
          <span className="italic">não executado</span>
        )}
      </div>
      <div className="mt-1 leading-snug">{body}</div>
    </div>
  );
}

function ReasonChip({ info }: { info: SkipReasonInfo }) {
  return (
    <span
      title={info.desc}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${toneClasses(info.tone)}`}
    >
      {info.label}
    </span>
  );
}

function ItemRow({ item, lead, clinicId }: { item: RunItem; lead?: LeadInfo; clinicId: string | null }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(item.comment ?? "");
  const [retry, setRetry] = useState(item.retry_requested);
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState<OnlyAgent | "full" | null>(null);
  useEffect(() => {
    setComment(item.comment ?? "");
    setRetry(item.retry_requested);
  }, [item.id, item.comment, item.retry_requested]);

  const result = (item.result ?? null) as ItemResult | null;
  const skipReasonRaw = result?.skipped ?? (item.status === "error" ? item.error ?? null : null);
  const skipInfo = skipReasonRaw ? describeReason(skipReasonRaw) : null;
  const agents = result?.telemetry?.agents ?? null;
  const cls = result?.classification ?? null;
  const applied = result?.telemetry?.applied ?? null;
  const stepLabel =
    item.step === "classify:summarizer" ? "🔁 só Resumidor"
    : item.step === "classify:typifier" ? "🔁 só Tipificador"
    : item.step === "classify:maestro" ? "🔁 só Maestro"
    : null;

  const icon =
    item.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : item.status === "error" ? <AlertTriangle className="h-4 w-4 text-red-400" />
    : item.status === "skipped" ? <MinusCircle className="h-4 w-4 text-slate-400" />
    : <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;

  const save = async () => {
    setSaving(true);
    try {
      await callExecutor({ action: "comment", item_id: item.id, comment, retry_requested: retry });
      toast.success("Comentário salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const rerun = async (agent: OnlyAgent | "full") => {
    if (!clinicId || !item.lead_id) return;
    setRerunning(agent);
    try {
      const payload: Record<string, unknown> = {
        action: "start",
        clinic_id: clinicId,
        lead_ids: [item.lead_id],
      };
      if (agent !== "full") payload.only_agent = agent;
      const res = await callExecutor<{ run_id?: string }>(payload);
      if (res.error) toast.error(`Erro: ${res.error}`);
      else toast.success(agent === "full" ? "Reprocessando lead (pipeline completo)" : `Reprocessando só ${agent}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRerunning(null);
    }
  };

  return (
    <div className="px-3 py-2 text-xs">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-2 text-left">
        {icon}
        <span className="flex-1 truncate">
          <span className="font-medium">{lead?.name || lead?.phone || (item.lead_id ? item.lead_id.slice(0, 8) : "—")}</span>
          {lead?.name && lead?.phone && <span className="ml-2 text-muted-foreground">{lead.phone}</span>}
          {stepLabel && <span className="ml-2 text-[10px] text-muted-foreground">{stepLabel}</span>}
        </span>
        {skipInfo && (item.status === "skipped" || item.status === "error") && <ReasonChip info={skipInfo} />}
        <StatusBadge status={item.status} />
        {item.retry_requested && <Badge variant="outline" className="border-amber-500/40 text-amber-400">retry</Badge>}
        {item.comment && <span className="text-amber-400">●</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded bg-muted/30 p-2">
          {/* Skip / erro detalhado */}
          {skipInfo && (
            <div className={`rounded border px-2 py-1.5 ${toneClasses(skipInfo.tone)}`}>
              <div className="text-[11px] font-medium">{skipInfo.label}</div>
              <div className="text-[11px] opacity-90">{skipInfo.desc}</div>
              {item.error && item.error !== skipReasonRaw && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] opacity-80">{item.error}</pre>
              )}
            </div>
          )}

          {/* Cards dos 3 agentes */}
          {(agents || cls) && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <AgentCard
                icon={<FileText className="h-3.5 w-3.5 text-blue-300" />}
                name="Resumidor"
                model={agents?.summarizer_model}
                latencyMs={agents?.latency_ms?.summarizer}
                ran={agents?.ran?.summarizer !== false}
                status="ok"
                body={
                  agents?.summary ? (
                    <p className="line-clamp-4 text-muted-foreground">{agents.summary}</p>
                  ) : (
                    <span className="italic text-muted-foreground">sem resumo</span>
                  )
                }
              />
              <AgentCard
                icon={<Tags className="h-3.5 w-3.5 text-violet-300" />}
                name="Tipificador"
                model={agents?.typifier_model}
                latencyMs={agents?.latency_ms?.typifier}
                ran={agents?.ran?.typifier !== false}
                status="ok"
                body={
                  applied?.tags && "added" in applied.tags ? (
                    <div className="space-y-1">
                      {applied.tags.added && applied.tags.added.length > 0 && (
                        <div><span className="text-emerald-400">+</span> {applied.tags.added.join(", ")}</div>
                      )}
                      {applied.tags.removed_computed && applied.tags.removed_computed.length > 0 && (
                        <div><span className="text-red-400">−</span> {applied.tags.removed_computed.join(", ")}</div>
                      )}
                      {(!applied.tags.added?.length && !applied.tags.removed_computed?.length) && (
                        <span className="italic text-muted-foreground">nenhuma alteração</span>
                      )}
                      {applied.custom_fields && "set" in applied.custom_fields && Object.keys(applied.custom_fields.set ?? {}).length > 0 && (
                        <div className="text-muted-foreground">
                          campos: {Object.keys(applied.custom_fields.set ?? {}).join(", ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="italic text-muted-foreground">{applied?.tags?.skipped ? "modo parcial" : "sem dados"}</span>
                  )
                }
              />
              <AgentCard
                icon={<Target className="h-3.5 w-3.5 text-amber-300" />}
                name="Maestro"
                model={agents?.maestro_model}
                latencyMs={agents?.latency_ms?.maestro}
                ran={agents?.ran?.maestro !== false}
                status="ok"
                body={
                  cls ? (
                    <div className="space-y-0.5">
                      <div><span className="text-muted-foreground">stage:</span> {cls.stage_suggestion ?? "—"}</div>
                      <div><span className="text-muted-foreground">intent:</span> {cls.intent ?? "—"}</div>
                      <div><span className="text-muted-foreground">conf:</span> {cls.confidence?.toFixed(2) ?? "—"}{cls.is_b2b ? " · b2b" : ""}</div>
                    </div>
                  ) : (
                    <span className="italic text-muted-foreground">sem decisão</span>
                  )
                }
              />
            </div>
          )}

          {/* Motivos do Maestro */}
          {cls?.reasons && cls.reasons.length > 0 && (
            <div className="rounded border border-border/40 bg-background/40 p-2 text-[11px]">
              <div className="mb-1 font-medium">Por quê?</div>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {cls.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Rerun manual */}
          {item.lead_id && clinicId && (
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-dashed border-border/50 p-1.5">
              <span className="text-[10px] text-muted-foreground">Rodar de novo:</span>
              <Button size="sm" variant="outline" disabled={!!rerunning} onClick={() => rerun("full")} className="h-6 gap-1 px-2 text-[10px]">
                {rerunning === "full" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Completo
              </Button>
              <Button size="sm" variant="outline" disabled={!!rerunning} onClick={() => rerun("summarizer")} className="h-6 gap-1 px-2 text-[10px]">
                {rerunning === "summarizer" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                Só Resumidor
              </Button>
              <Button size="sm" variant="outline" disabled={!!rerunning} onClick={() => rerun("typifier")} className="h-6 gap-1 px-2 text-[10px]">
                {rerunning === "typifier" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tags className="h-3 w-3" />}
                Só Tipificador
              </Button>
              <Button size="sm" variant="outline" disabled={!!rerunning} onClick={() => rerun("maestro")} className="h-6 gap-1 px-2 text-[10px]">
                {rerunning === "maestro" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                Só Maestro
              </Button>
            </div>
          )}

          {/* Comentário */}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="O que deu errado / o que esperava que acontecesse?"
            className="text-xs"
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={retry} onCheckedChange={(v) => setRetry(!!v)} />
              Marcar para reprocessar
            </label>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>

          {/* JSON bruto colapsado */}
          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer select-none">JSON bruto</summary>
            {item.error && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-red-400">{item.error}</pre>}
            {item.result && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(item.result, null, 2).slice(0, 4000)}
              </pre>
            )}
          </details>
        </div>
      )}
    </div>
  );
}

interface Pipeline { id: string; name: string }
interface Stage { id: string; name: string; pipeline_id: string; position: number }
interface LeadOpt { id: string; name: string | null; phone: string | null }

function ScopeDialog({
  open, onOpenChange, clinicId, starting, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string | null;
  starting: boolean;
  onConfirm: (scope: { pipeline_id?: string; stage_ids?: string[]; lead_ids?: string[]; top_n?: number; only_agent?: OnlyAgent }) => void;
}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("__all__");
  const [leadSearch, setLeadSearch] = useState("");
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, LeadOpt>>({});
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [topN, setTopN] = useState<string>("");
  const [onlyAgent, setOnlyAgent] = useState<"full" | OnlyAgent>("full");

  useEffect(() => {
    if (!open || !clinicId) return;
    (async () => {
      const { data: pls } = await supabase
        .from("pipelines").select("id, name").eq("clinic_id", clinicId).order("name");
      const list = (pls ?? []) as Pipeline[];
      setPipelines(list);
      if (list.length && !pipelineId) setPipelineId(list[0].id);
    })();
  }, [open, clinicId]);

  useEffect(() => {
    if (!pipelineId) { setStages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id, position")
        .eq("pipeline_id", pipelineId)
        .order("position");
      setStages((data ?? []) as Stage[]);
    })();
  }, [pipelineId]);

  useEffect(() => {
    if (!open || !clinicId) return;
    let active = true;
    const t = setTimeout(async () => {
      setLoadingLeads(true);
      let q = supabase
        .from("leads")
        .select("id, name, phone")
        .eq("clinic_id", clinicId)
        .is("archived_at", null)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(50);
      if (pipelineId) q = q.eq("pipeline_id", pipelineId);
      if (stageId && stageId !== "__all__") q = q.eq("stage_id", stageId);
      if (leadSearch.trim()) q = q.or(`name.ilike.%${leadSearch.trim()}%,phone.ilike.%${leadSearch.trim()}%`);
      const { data } = await q;
      if (!active) return;
      setLeads((data ?? []) as LeadOpt[]);
      setLoadingLeads(false);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [open, clinicId, pipelineId, stageId, leadSearch]);

  const selectedCount = Object.keys(selectedLeads).length;

  const submit = () => {
    const n = parseInt(topN, 10);
    onConfirm({
      pipeline_id: pipelineId || undefined,
      stage_ids: stageId && stageId !== "__all__" ? [stageId] : undefined,
      lead_ids: selectedCount > 0 ? Object.keys(selectedLeads) : undefined,
      top_n: Number.isFinite(n) && n > 0 ? n : undefined,
      only_agent: onlyAgent === "full" ? undefined : onlyAgent,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Executar com escopo</DialogTitle>
          <DialogDescription>
            Escolha o pipeline, a coluna e (opcional) leads específicos. Em cada varredura a IA também corrige tags e campos personalizados quando há evidência nas mensagens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seletor de agente */}
          <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
            <Label className="text-xs">Quais agentes rodar</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {([
                { id: "full", icon: <Sparkles className="h-3.5 w-3.5" />, title: "Completo", desc: "Os 3 agentes" },
                { id: "summarizer", icon: <FileText className="h-3.5 w-3.5" />, title: "Só Resumidor", desc: "Refaz ai_summary" },
                { id: "typifier", icon: <Tags className="h-3.5 w-3.5" />, title: "Só Tipificador", desc: "Refaz tags + campos" },
                { id: "maestro", icon: <Target className="h-3.5 w-3.5" />, title: "Só Maestro", desc: "Refaz stage + intent" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOnlyAgent(opt.id as typeof onlyAgent)}
                  className={`flex flex-col items-start gap-1 rounded-md border p-2 text-left text-xs transition ${
                    onlyAgent === opt.id ? "border-primary bg-primary/10" : "border-border/50 bg-background/30 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">{opt.icon}{opt.title}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
            {onlyAgent === "maestro" && (
              <p className="text-[11px] text-amber-400">
                ⚠ Rodar só o Maestro reaproveita as tags/campos atuais. Se o lead estiver desatualizado, rode o pipeline completo.
              </p>
            )}
            {(onlyAgent === "typifier" || onlyAgent === "maestro") && (
              <p className="text-[11px] text-muted-foreground">
                Reutiliza o ai_summary atual do lead. Se ele não existir, o lead vai falhar com missing_ai_summary.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pipeline</Label>
              <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId("__all__"); setSelectedLeads({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Coluna</Label>
              <Select value={stageId} onValueChange={(v) => { setStageId(v); setSelectedLeads({}); }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as colunas</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Quantidade do topo (opcional) — processa os N primeiros leads da coluna na mesma ordem do Kanban
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="ex: 10, 20, 50"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
                className="w-40"
              />
              <div className="flex gap-1">
                {[10, 20, 50, 100].map((n) => (
                  <Button key={n} size="sm" variant="outline" type="button" onClick={() => setTopN(String(n))} className="h-8 px-2 text-xs">
                    {n}
                  </Button>
                ))}
                {topN && (
                  <Button size="sm" variant="ghost" type="button" onClick={() => setTopN("")} className="h-8 px-2 text-xs">
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se preenchido, ignora a seleção manual de leads abaixo e roda apenas os N primeiros da coluna selecionada.
            </p>
          </div>


          <div className="space-y-1">
            <Label className="text-xs">
              Leads (opcional) — deixe vazio para processar todos da coluna · {selectedCount} selecionado(s)
            </Label>
            <Input
              placeholder="Buscar por nome ou telefone…"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
            {selectedCount > 0 && (
              <div className="flex flex-wrap gap-1 py-1">
                {Object.values(selectedLeads).map((l) => (
                  <Badge key={l.id} variant="secondary" className="gap-1">
                    {l.name ?? l.phone ?? l.id.slice(0, 6)}
                    <button onClick={() => setSelectedLeads((s) => { const n = { ...s }; delete n[l.id]; return n; })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSelectedLeads({})} className="h-6 px-2 text-xs">Limpar</Button>
              </div>
            )}
            <ScrollArea className="h-48 rounded border border-border/60">
              <div className="divide-y divide-border/40">
                {loadingLeads && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
                {!loadingLeads && leads.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum lead encontrado.</div>}
                {leads.map((l) => {
                  const checked = !!selectedLeads[l.id];
                  return (
                    <label key={l.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setSelectedLeads((s) => {
                          const n = { ...s };
                          if (v) n[l.id] = l; else delete n[l.id];
                          return n;
                        })}
                      />
                      <span className="flex-1 truncate">{l.name ?? "(sem nome)"}</span>
                      <span className="text-xs text-muted-foreground">{l.phone ?? ""}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={starting || !pipelineId} className="gap-2">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
