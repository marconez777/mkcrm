import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Bot,
  Coins,
  MessageSquare,
  Zap,
  AlertTriangle,
  Timer,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { calcCost, fmtUSD } from "@/lib/ai-pricing";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  agent_id: string | null;
  model: string;
  operation: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

const RANGES = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
  { id: "90d", label: "90 dias", hours: 24 * 90 },
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

export default function AiDashboard() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [range, setRange] = useState(RANGES[1]);
  const [rows, setRows] = useState<Row[]>([]);
  const [prevRows, setPrevRows] = useState<Row[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [activeAgents, setActiveAgents] = useState(0);
  const [activeAutos, setActiveAutos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      setLoading(true);
      const now = Date.now();
      const hoursMs = range.hours * 3600_000;
      const startCur = new Date(now - hoursMs).toISOString();
      const startPrev = new Date(now - 2 * hoursMs).toISOString();
      const endPrev = new Date(now - hoursMs).toISOString();

      const [cur, prev, ag, au] = await Promise.all([
        supabase
          .from("ai_usage")
          .select("id, agent_id, model, operation, status, input_tokens, output_tokens, total_tokens, latency_ms, error, created_at")
          .eq("clinic_id", clinicId)
          .gte("created_at", startCur)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("ai_usage")
          .select("id, model, input_tokens, output_tokens, status, latency_ms, created_at")
          .eq("clinic_id", clinicId)
          .gte("created_at", startPrev)
          .lt("created_at", endPrev)
          .limit(5000),
        supabase.from("ai_agents").select("id, name", { count: "exact" }).eq("clinic_id", clinicId),
        supabase.from("automations").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("enabled", true),
      ]);

      const curRows = (cur.data ?? []) as Row[];
      setRows(curRows);
      setPrevRows((prev.data ?? []) as Row[]);
      const am: Record<string, string> = {};
      (ag.data ?? []).forEach((a: any) => { am[a.id] = a.name; });
      setAgentsMap(am);
      setActiveAgents((ag.data ?? []).length);
      setActiveAutos(au.count ?? 0);
      setLoading(false);
    })();
  }, [clinicId, range.id]);

  const stats = useMemo(() => summarize(rows), [rows]);
  const prevStats = useMemo(() => summarize(prevRows), [prevRows]);

  // série temporal — granularidade dinâmica
  const series = useMemo(() => {
    const hourly = range.hours <= 24;
    const weekly = range.hours >= 24 * 60;
    const bucketSizeMs = hourly ? 3600_000 : weekly ? 7 * 86400_000 : 86400_000;
    const buckets = Math.ceil(range.hours / (bucketSizeMs / 3600_000));
    const start = Math.floor(Date.now() / bucketSizeMs) * bucketSizeMs - (buckets - 1) * bucketSizeMs;
    const data: { key: string; label: string; messages: number; tokens: number; cost: number }[] = [];
    for (let i = 0; i < buckets; i++) {
      const t = start + i * bucketSizeMs;
      const d = new Date(t);
      const label = hourly
        ? `${String(d.getHours()).padStart(2, "0")}h`
        : weekly
        ? `${d.getDate()}/${d.getMonth() + 1}`
        : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      data.push({ key: String(t), label, messages: 0, tokens: 0, cost: 0 });
    }
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const idx = Math.floor((t - start) / bucketSizeMs);
      if (idx < 0 || idx >= data.length) continue;
      data[idx].messages++;
      data[idx].tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
      data[idx].cost += calcCost(r.model, r.input_tokens, r.output_tokens);
    }
    return data;
  }, [rows, range.hours]);

  const topAgents = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.agent_id ?? "__none";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([id, calls]) => ({ id, name: id === "__none" ? "(sem agente)" : agentsMap[id] ?? id.slice(0, 8), calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5);
  }, [rows, agentsMap]);

  const byOp = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.operation, (m.get(r.operation) ?? 0) + 1);
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const recentErrors = useMemo(
    () => rows.filter((r) => r.status !== "success").slice(0, 5),
    [rows],
  );

  return (
    <div className="space-y-6 py-6">
      {/* seletor de período */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Visão geral</h2>
          <p className="text-xs text-muted-foreground">Métricas do período selecionado, comparadas ao período anterior de mesmo tamanho.</p>
        </div>
        <div className="flex gap-1 rounded-md border p-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1 transition ${range.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* cards principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Mensagens IA" value={fmtInt(stats.messages)} delta={delta(stats.messages, prevStats.messages)} loading={loading} />
        <StatCard icon={Coins} label="Tokens (in / out)" value={`${fmtCompact(stats.tokensIn)} / ${fmtCompact(stats.tokensOut)}`} delta={delta(stats.tokensIn + stats.tokensOut, prevStats.tokensIn + prevStats.tokensOut)} loading={loading} />
        <StatCard icon={Coins} label="Custo total" value={fmtUSD(stats.cost)} delta={delta(stats.cost, prevStats.cost)} loading={loading} />
        <StatCard icon={Activity} label="Custo médio / chamada" value={fmtUSD(stats.avgCost)} delta={delta(stats.avgCost, prevStats.avgCost)} loading={loading} />
        <StatCard icon={Bot} label="Agentes" value={activeAgents.toString()} loading={loading} />
        <StatCard icon={Zap} label="Automações ativas" value={activeAutos.toString()} loading={loading} />
        <StatCard icon={AlertTriangle} label="Taxa de erro" value={`${stats.errorRate.toFixed(1)}%`} delta={delta(stats.errorRate, prevStats.errorRate, true)} loading={loading} />
        <StatCard icon={Timer} label="Latência média" value={`${Math.round(stats.avgLatency)} ms`} delta={delta(stats.avgLatency, prevStats.avgLatency, true)} loading={loading} />
      </div>

      {/* gráfico principal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Mensagens & Tokens ao longo do período</CardTitle>
          <span className="text-xs text-muted-foreground">{series.length} pontos</span>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any, name: string) => {
                    if (name === "Tokens") return [fmtCompact(Number(value)), name];
                    if (name === "Custo (USD)") return [fmtUSD(Number(value)), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="messages" name="Mensagens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="tokens" name="Tokens" stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* gráficos secundários */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 agentes por chamadas</CardTitle></CardHeader>
          <CardContent>
            {topAgents.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topAgents} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="calls" name="Chamadas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por operação</CardTitle></CardHeader>
          <CardContent>
            {byOp.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byOp} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {byOp.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* erros recentes */}
      {recentErrors.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Erros recentes</CardTitle>
            <Link to="/ai/usage" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y text-xs">
              {recentErrors.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">{r.model}</Badge>
                    <span className="text-muted-foreground shrink-0">{r.agent_id ? agentsMap[r.agent_id] ?? "—" : "—"}</span>
                    <span className="truncate text-destructive">{r.error ?? r.status}</span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- helpers ----------

function summarize(rs: Row[]) {
  let tokensIn = 0, tokensOut = 0, cost = 0, errors = 0, latencySum = 0, latencyN = 0;
  for (const r of rs) {
    tokensIn += r.input_tokens ?? 0;
    tokensOut += r.output_tokens ?? 0;
    cost += calcCost(r.model, r.input_tokens, r.output_tokens);
    if (r.status !== "success") errors++;
    if (r.latency_ms) { latencySum += r.latency_ms; latencyN++; }
  }
  return {
    messages: rs.length,
    tokensIn,
    tokensOut,
    cost,
    avgCost: rs.length ? cost / rs.length : 0,
    errorRate: rs.length ? (errors / rs.length) * 100 : 0,
    avgLatency: latencyN ? latencySum / latencyN : 0,
  };
}

function delta(cur: number, prev: number, lowerIsBetter = false): { pct: number; positive: boolean } | null {
  if (!prev && !cur) return null;
  if (!prev) return { pct: 100, positive: !lowerIsBetter };
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return { pct, positive: lowerIsBetter ? !up : up };
}

function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  loading,
}: {
  icon: any;
  label: string;
  value: string;
  delta?: { pct: number; positive: boolean } | null;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-semibold tabular-nums truncate">{loading ? "—" : value}</div>
          {delta && !loading && (
            <div className={`mt-0.5 flex items-center gap-0.5 text-[10px] ${delta.positive ? "text-emerald-600" : "text-rose-600"}`}>
              {delta.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta.pct).toFixed(1)}% vs anterior
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint() {
  return <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">Sem dados no período</div>;
}
