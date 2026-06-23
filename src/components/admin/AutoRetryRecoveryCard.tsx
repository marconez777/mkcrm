import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = {
  day: string;
  retried_total: number;
  retried_ok: number;
  exhausted: number;
  recovery_pct: number | null;
};

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function AutoRetryRecoveryCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_pipeline_auto_retry_daily" as never)
        .select("*")
        .limit(30);
      if (error) { setError(error.message); return; }
      setRows((data ?? []) as Row[]);
    })();
  }, []);

  const last7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const r = (rows ?? []).filter((x) => new Date(x.day).getTime() > cutoff);
    const total = r.reduce((s, x) => s + (x.retried_total ?? 0), 0);
    const ok = r.reduce((s, x) => s + (x.retried_ok ?? 0), 0);
    const exhausted = r.reduce((s, x) => s + (x.exhausted ?? 0), 0);
    const pct = total > 0 ? Math.round((100 * ok) / total) : null;
    return { total, ok, exhausted, pct };
  }, [rows]);

  const chartData = useMemo(() => {
    return (rows ?? [])
      .slice()
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
      .map((r) => ({
        day: fmtDay(r.day),
        recuperados: r.retried_ok,
        esgotados: r.exhausted,
      }));
  }, [rows]);

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Recuperação por Auto-Retry</h2>
        <p className="text-xs text-muted-foreground">
          Quantos itens com erro transitório o cron `pipeline-auto-retry` salvou sem clique humano.
        </p>
      </div>
      {error && <p className="text-xs text-destructive">Erro: {error}</p>}
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Recovery 7d</div>
              <div className="text-2xl font-semibold">{last7.pct === null ? "—" : `${last7.pct}%`}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recuperados 7d</div>
              <div className="text-2xl font-semibold">{last7.ok}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Esgotados 7d</div>
              <div className="text-2xl font-semibold text-destructive">{last7.exhausted}</div>
            </div>
          </div>
          <div className="h-56 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem auto-retries no período.
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
                  <Bar dataKey="recuperados" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="esgotados" stackId="a" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
