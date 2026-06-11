import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, PlayCircle, RefreshCw, Sparkles, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Run {
  id: string;
  lead_id: string;
  kind: "text" | "vision" | "audio" | "skipped";
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  fields_set: Record<string, unknown> | null;
  confidence: number | null;
  skipped_reason: string | null;
  error: string | null;
  created_at: string;
  lead?: { name: string | null; phone: string } | null;
}

interface DailyAgg { day: string; runs: number; cost: number; }

interface Props { clinicId: string; }

const FIELD_LABELS: Record<string, string> = {
  procedimento_interesse: "Procedimento",
  qualificacao: "Qualificação",
  desqualificacao_motivo: "Motivo desq.",
  demonstrou_interesse: "Interesse",
  tentou_pagamento: "Tentou pagar",
  pagamento_confirmado: "Pago",
  tentou_agendar: "Tentou agendar",
  consulta_agendada_em: "Consulta",
  nome_preferido: "Apelido",
  observacoes: "Obs.",
};

export default function ExtractorHistoryCard({ clinicId }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("lead_ai_extraction_runs")
      .select("id, lead_id, kind, model, tokens_in, tokens_out, cost_usd, fields_set, confidence, skipped_reason, error, created_at, lead:leads(name, phone)")
      .eq("clinic_id", clinicId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    setRuns((data as Run[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clinicId]);

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("extractor-tick", {
        body: { clinic_id: clinicId },
      });
      if (error) throw new Error(error.message);
      const r = (data as any)?.results?.[0];
      if (r?.error) toast.error(`Falhou: ${r.error}`);
      else toast.success(`Processados: ${r?.processed ?? 0} · Ignorados: ${r?.skipped ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao rodar");
    } finally {
      setRunning(false);
    }
  }

  // Agregação por dia
  const byDay: Record<string, DailyAgg> = {};
  for (const r of runs) {
    const day = new Date(r.created_at).toLocaleDateString("pt-BR");
    byDay[day] ??= { day, runs: 0, cost: 0 };
    byDay[day].runs += 1;
    byDay[day].cost += Number(r.cost_usd ?? 0);
  }
  const days = Object.values(byDay).sort((a, b) => b.day.localeCompare(a.day));

  const totalRuns = runs.length;
  const totalCost = runs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const totalErrors = runs.filter((r) => r.error).length;
  const totalSkipped = runs.filter((r) => r.kind === "skipped").length;

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Histórico & custos (últimos 7 dias)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Execuções do extrator de texto, visão e áudio. Custos são calculados com o preço do dia (snapshot).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <PlayCircle className="mr-2 h-3 w-3" />}
            Rodar agora
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Sparkles className="h-3 w-3" />} label="Execuções" value={String(totalRuns)} />
        <Stat icon={<DollarSign className="h-3 w-3" />} label="Custo total" value={`$${totalCost.toFixed(4)}`} />
        <Stat icon={<AlertTriangle className="h-3 w-3 text-amber-600" />} label="Ignorados" value={String(totalSkipped)} />
        <Stat icon={<AlertTriangle className="h-3 w-3 text-red-600" />} label="Erros" value={String(totalErrors)} />
      </div>

      {days.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5">Por dia</div>
          <div className="space-y-1">
            {days.map((d) => (
              <div key={d.day} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
                <span className="font-mono">{d.day}</span>
                <span className="text-muted-foreground">{d.runs} execuções</span>
                <span className="font-semibold">${d.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold mb-1.5">Últimas execuções</div>
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
        {!loading && runs.length === 0 && (
          <div className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
            Nenhuma execução ainda. Quando leads novos chegarem ou você clicar em "Rodar agora", os resultados aparecem aqui.
          </div>
        )}
        <div className="space-y-1.5 max-h-[420px] overflow-auto">
          {runs.map((r) => (
            <RunRow key={r.id} r={r} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  );
}

function RunRow({ r }: { r: Run }) {
  const ts = new Date(r.created_at).toLocaleString("pt-BR");
  const fieldKeys = r.fields_set ? Object.keys(r.fields_set) : [];
  const tone = r.error
    ? "border-red-200 bg-red-50/30"
    : r.kind === "skipped"
    ? "border-amber-200 bg-amber-50/30"
    : fieldKeys.length > 0
    ? "border-emerald-200 bg-emerald-50/30"
    : "border-muted bg-muted/20";

  return (
    <div className={`rounded border p-2 text-xs space-y-1 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KindBadge kind={r.kind} hasFields={fieldKeys.length > 0} hasError={!!r.error} />
          <span className="truncate font-medium">{r.lead?.name || r.lead?.phone || r.lead_id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground whitespace-nowrap">
          {r.model && <span className="font-mono">{r.model}</span>}
          {r.confidence !== null && <span>conf {(r.confidence * 100).toFixed(0)}%</span>}
          <span>${Number(r.cost_usd).toFixed(5)}</span>
          <span>{r.tokens_in}/{r.tokens_out} tk</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{ts}</span>
      </div>
      {fieldKeys.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {fieldKeys.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
              {FIELD_LABELS[k] ?? k}: <code>{String((r.fields_set as any)?.[k]).slice(0, 40)}</code>
            </span>
          ))}
        </div>
      )}
      {r.error && <div className="text-red-700">{r.error}</div>}
      {r.skipped_reason && <div className="text-amber-700">{r.skipped_reason}</div>}
    </div>
  );
}

function KindBadge({ kind, hasFields, hasError }: { kind: Run["kind"]; hasFields: boolean; hasError: boolean }) {
  const labels: Record<Run["kind"], string> = { text: "texto", vision: "visão", audio: "áudio", skipped: "skip" };
  const tone = hasError
    ? "bg-red-500/10 text-red-700"
    : kind === "skipped"
    ? "bg-amber-500/10 text-amber-700"
    : hasFields
    ? "bg-emerald-500/10 text-emerald-700"
    : "bg-muted text-muted-foreground";
  const Icon = hasError ? AlertTriangle : kind === "skipped" ? AlertTriangle : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      <Icon className="h-3 w-3" />
      {labels[kind]}
    </span>
  );
}
