import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/layouts/AdminShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { PipelineErrorsCard } from "@/components/admin/PipelineErrorsCard";
import { ProviderHealthCard } from "@/components/admin/ProviderHealthCard";


// G2 — Pipeline health admin page.
// Lê 3 views read-only criadas em G1:
//  - v_maestro_outcomes_daily
//  - v_classify_health_daily
//  - v_ai_cost_daily
// As views já filtram via is_super_admin() — RLS embutida.

type OutcomeRow = { day: string; outcome: string; n: number };
type HealthRow = {
  day: string;
  operation: string;
  calls: number;
  errors: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  cost_usd: number | null;
};
type CostRow = {
  day: string;
  operation: string;
  calls: number;
  cost_usd: number | null;
  tokens: number | null;
};

const OUTCOME_COLORS: Record<string, string> = {
  applied: "hsl(var(--primary))",
  strict_blocked: "hsl(var(--muted-foreground))",
  low_confidence: "hsl(var(--destructive))",
  no_signal: "hsl(var(--accent-foreground))",
  skipped_partial_mode: "hsl(var(--secondary-foreground))",
  unknown: "hsl(var(--border))",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AdminPipelineHealth() {
  const [outcomes, setOutcomes] = useState<OutcomeRow[] | null>(null);
  const [health, setHealth] = useState<HealthRow[] | null>(null);
  const [cost, setCost] = useState<CostRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [o, h, c] = await Promise.all([
        supabase.from("v_maestro_outcomes_daily" as never).select("*").limit(1000),
        supabase.from("v_classify_health_daily" as never).select("*").limit(1000),
        supabase.from("v_ai_cost_daily" as never).select("*").limit(1000),
      ]);
      if (cancelled) return;
      if (o.error || h.error || c.error) {
        setError(o.error?.message || h.error?.message || c.error?.message || "erro");
        return;
      }
      setOutcomes((o.data ?? []) as OutcomeRow[]);
      setHealth((h.data ?? []) as HealthRow[]);
      setCost((c.data ?? []) as CostRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // KPI cards (últimas 24h)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayOutcomes = (outcomes ?? []).filter((r) => r.day.slice(0, 10) === today);
  const todayClassify = todayOutcomes.reduce((s, r) => s + r.n, 0);
  const todayApplied = todayOutcomes
    .filter((r) => r.outcome === "applied")
    .reduce((s, r) => s + r.n, 0);
  const appliedPct = todayClassify > 0 ? Math.round((todayApplied / todayClassify) * 100) : 0;
  const todayCost = (cost ?? [])
    .filter((r) => r.day.slice(0, 10) === today)
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  // Chart data: pivot outcomes por dia (14d), 1 série por outcome
  const chartData = useMemo(() => {
    const recent = (outcomes ?? []).filter((r) => {
      const d = new Date(r.day).getTime();
      return d > Date.now() - 14 * 86_400_000;
    });
    const byDay = new Map<string, Record<string, number | string>>();
    for (const r of recent) {
      const day = r.day.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day: formatDay(day) });
      byDay.get(day)![r.outcome] = r.n;
    }
    return Array.from(byDay.values()).sort((a, b) =>
      String(a.day).localeCompare(String(b.day)),
    );
  }, [outcomes]);

  const outcomeKeys = useMemo(() => {
    const set = new Set<string>();
    (outcomes ?? []).forEach((r) => set.add(r.outcome));
    return Array.from(set);
  }, [outcomes]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pipeline Health"
        description="Telemetria do classifier (últimos 30 dias). Atualiza ao carregar."
      />

      {error && (
        <Card className="p-4 border-destructive/40 text-destructive">
          Erro ao carregar views: {error}. Confirme que o usuário é super_admin.
        </Card>
      )}
      <PipelineErrorsCard />
      <ProviderHealthCard />



      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Classificações hoje</div>
          <div className="mt-1 text-2xl font-semibold">
            {outcomes === null ? <Skeleton className="h-7 w-16" /> : todayClassify}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">% applied</div>
          <div className="mt-1 text-2xl font-semibold">
            {outcomes === null ? <Skeleton className="h-7 w-16" /> : `${appliedPct}%`}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Custo IA hoje (USD)</div>
          <div className="mt-1 text-2xl font-semibold">
            {cost === null ? <Skeleton className="h-7 w-20" /> : `$${todayCost.toFixed(2)}`}
          </div>
        </Card>
      </div>

      {/* Outcomes chart */}
      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Maestro outcomes (14 dias)</h2>
          <span className="text-xs text-muted-foreground">stacked por dia</span>
        </div>
        <div className="h-72 w-full">
          {outcomes === null ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados nos últimos 14 dias.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {outcomeKeys.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="a"
                    fill={OUTCOME_COLORS[k] ?? "hsl(var(--muted))"}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Classify health table */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Saúde do classifier (14 dias)</h2>
        {health === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Erros</TableHead>
                <TableHead className="text-right">p50 (ms)</TableHead>
                <TableHead className="text-right">p95 (ms)</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health
                .filter((r) => new Date(r.day).getTime() > Date.now() - 14 * 86_400_000)
                .map((r, i) => {
                  const p95 = r.latency_p95_ms ?? 0;
                  return (
                    <TableRow key={`${r.day}-${r.operation}-${i}`}>
                      <TableCell className="text-xs">{formatDay(r.day)}</TableCell>
                      <TableCell className="text-xs">{r.operation}</TableCell>
                      <TableCell className="text-right text-xs">{r.calls}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.errors > 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            {r.errors}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.latency_p50_ms ?? "—"}</TableCell>
                      <TableCell
                        className={`text-right text-xs ${
                          p95 > 8000 ? "text-destructive font-semibold" : ""
                        }`}
                      >
                        {r.latency_p95_ms ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        ${Number(r.cost_usd ?? 0).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {health.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Sem chamadas no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Cost by operation */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Custo IA por operação (30 dias)</h2>
        {cost === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Custo (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(
                cost.reduce<
                  Record<string, { calls: number; tokens: number; cost: number }>
                >((acc, r) => {
                  const k = r.operation;
                  if (!acc[k]) acc[k] = { calls: 0, tokens: 0, cost: 0 };
                  acc[k].calls += r.calls;
                  acc[k].tokens += Number(r.tokens ?? 0);
                  acc[k].cost += Number(r.cost_usd ?? 0);
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([op, agg]) => (
                  <TableRow key={op}>
                    <TableCell className="text-xs font-mono">{op}</TableCell>
                    <TableCell className="text-right text-xs">{agg.calls}</TableCell>
                    <TableCell className="text-right text-xs">
                      {agg.tokens.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      ${agg.cost.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              {cost.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Sem custo registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
