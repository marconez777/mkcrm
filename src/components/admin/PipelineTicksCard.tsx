import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";

interface TickRow {
  id: string;
  action: string;
  phase: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  ok: boolean;
  candidates: number;
  moved: number;
  not_moved: number;
  skipped_no_dest: number;
  errored: number;
  avg_ms_per_lead: number;
  p95_ms_per_lead: number;
  failure_reasons: Record<string, number>;
  error_message: string | null;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return fmtTime(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function PipelineTicksCard() {
  const [rows, setRows] = useState<TickRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error: err } = await supabase
        .from("pipeline_tick_stats" as never)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      setRows((data ?? []) as unknown as TickRow[]);
    })();

    const channel = supabase
      .channel("pipeline_tick_stats_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pipeline_tick_stats" },
        (payload) => {
          setRows((prev) => {
            const next = [payload.new as unknown as TickRow, ...(prev ?? [])];
            return next.slice(0, 50);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Agregados (últimas 24h)
  const last24 = (rows ?? []).filter(
    (r) => Date.now() - new Date(r.started_at).getTime() < 24 * 3600 * 1000,
  );
  const totalTicks = last24.length;
  const totalOk = last24.filter((r) => r.ok).length;
  const totalMoved = last24.reduce((s, r) => s + r.moved, 0);
  const totalCandidates = last24.reduce((s, r) => s + r.candidates, 0);
  const totalErrored = last24.reduce((s, r) => s + r.errored, 0);
  const avgDuration =
    totalTicks > 0
      ? Math.round(last24.reduce((s, r) => s + r.duration_ms, 0) / totalTicks)
      : 0;

  // Motivos de falha agregados
  const reasonsAgg: Record<string, number> = {};
  for (const r of last24) {
    for (const [reason, count] of Object.entries(r.failure_reasons ?? {})) {
      reasonsAgg[reason] = (reasonsAgg[reason] ?? 0) + (count as number);
    }
    if (r.error_message) {
      const key = `tick_error:${r.error_message.slice(0, 60)}`;
      reasonsAgg[key] = (reasonsAgg[key] ?? 0) + 1;
    }
  }
  const reasonsSorted = Object.entries(reasonsAgg).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Ticks do pipeline (tempo real)</h2>
        </div>
        <Badge variant="outline" className="text-xs">
          {rows === null ? "—" : `${rows.length} ticks`}
        </Badge>
      </div>

      {error && (
        <div className="mb-3 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* KPIs 24h */}
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <KPI label="Ticks 24h" value={totalTicks} />
        <KPI
          label="OK / Erro"
          value={`${totalOk} / ${totalTicks - totalOk}`}
          tone={totalTicks - totalOk > 0 ? "destructive" : "default"}
        />
        <KPI label="Candidatos" value={totalCandidates} />
        <KPI label="Movidos" value={totalMoved} tone="success" />
        <KPI label="Duração média" value={fmtDuration(avgDuration)} />
      </div>

      {/* Motivos de falha agregados */}
      {reasonsSorted.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            Motivos de falha (24h) — {totalErrored} leads com erro
          </div>
          <div className="flex flex-wrap gap-2">
            {reasonsSorted.slice(0, 12).map(([reason, count]) => (
              <Badge
                key={reason}
                variant={reason.startsWith("error") || reason.startsWith("tick_error") ? "destructive" : "secondary"}
                className="font-mono text-[11px]"
              >
                {reason} · {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de ticks */}
      {rows === null ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Nenhum tick registrado ainda. Aguardando execução do cron.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="text-xs">Início</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Duração</TableHead>
                <TableHead className="text-right text-xs">Cand.</TableHead>
                <TableHead className="text-right text-xs">Movidos</TableHead>
                <TableHead className="text-right text-xs">Erros</TableHead>
                <TableHead className="text-right text-xs">avg/lead</TableHead>
                <TableHead className="text-right text-xs">p95/lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">
                    {fmtDate(r.started_at)}
                  </TableCell>
                  <TableCell className="text-xs">{r.action}</TableCell>
                  <TableCell>
                    {r.ok ? (
                      <Badge variant="outline" className="text-[10px]">
                        ok
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]" title={r.error_message ?? ""}>
                        erro
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs font-mono ${r.duration_ms > 120_000 ? "text-destructive font-semibold" : ""}`}
                  >
                    {fmtDuration(r.duration_ms)}
                  </TableCell>
                  <TableCell className="text-right text-xs">{r.candidates}</TableCell>
                  <TableCell className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {r.moved}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.errored > 0 ? (
                      <Badge variant="destructive" className="font-mono text-[10px]">
                        {r.errored}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">
                    {r.avg_ms_per_lead > 0 ? `${r.avg_ms_per_lead}ms` : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs font-mono ${r.p95_ms_per_lead > 3000 ? "text-destructive font-semibold" : ""}`}
                  >
                    {r.p95_ms_per_lead > 0 ? `${r.p95_ms_per_lead}ms` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function KPI({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "destructive"
        ? "text-destructive"
        : "";
  return (
    <div className="rounded border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
