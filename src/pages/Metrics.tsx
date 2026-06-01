import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Bot, Clock, Coins, AlertTriangle } from "lucide-react";

type Row = {
  id: string;
  agent_id: string | null;
  model: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  tools_called: number;
  replied: boolean;
  error: string | null;
  created_at: string;
};

const RANGES = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
];

export default function Metrics() {
  const [range, setRange] = useState(RANGES[1]);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("ai_agents").select("id, name").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((a: any) => { m[a.id] = a.name; });
      setAgents(m);
    });
  }, []);

  useEffect(() => {
    const since = new Date(Date.now() - range.hours * 3600_000).toISOString();
    fetchAllPaged<any>(
      () => supabase
        .from("ai_usage")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      1000,
      50_000,
    ).then((data) => setRows(data));
  }, [range.id]);

  const stats = useMemo(() => {
    const total = rows.length;
    const replied = rows.filter((r) => r.replied).length;
    const errors = rows.filter((r) => r.status !== "success").length;
    const tokens = rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
    const latencies = rows.filter((r) => r.latency_ms).map((r) => r.latency_ms!) as number[];
    const avgLat = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const tools = rows.reduce((s, r) => s + (r.tools_called ?? 0), 0);
    const replyRate = total ? Math.round((replied / total) * 100) : 0;
    return { total, replied, errors, tokens, avgLat, tools, replyRate };
  }, [rows]);

  const byAgent = useMemo(() => {
    const map = new Map<string, { count: number; tokens: number; latency: number; replied: number }>();
    for (const r of rows) {
      const key = r.agent_id ?? "(sem agente)";
      const cur = map.get(key) ?? { count: 0, tokens: 0, latency: 0, replied: 0 };
      cur.count++;
      cur.tokens += r.total_tokens ?? 0;
      cur.latency += r.latency_ms ?? 0;
      if (r.replied) cur.replied++;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: agents[id] ?? id,
      ...v,
      avgLat: v.count ? Math.round(v.latency / v.count) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [rows, agents]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Métricas IA</h1>
          <div className="flex gap-1 rounded-md border p-1 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 ${range.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={<Activity className="h-4 w-4" />} label="Chamadas" value={String(stats.total)} />
          <StatCard icon={<Bot className="h-4 w-4" />} label="Respondeu" value={`${stats.replied} (${stats.replyRate}%)`} />
          <StatCard icon={<Coins className="h-4 w-4" />} label="Tokens" value={stats.tokens.toLocaleString()} />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Latência média" value={`${stats.avgLat} ms`} />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Tools usadas" value={String(stats.tools)} />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Erros" value={String(stats.errors)} />
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Por agente</h2>
          {byAgent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="grid grid-cols-5 gap-2 border-b pb-1 text-xs font-medium text-muted-foreground">
                <span>Agente</span><span>Chamadas</span><span>Tokens</span><span>Resp</span><span>Lat (ms)</span>
              </div>
              {byAgent.map((a) => (
                <div key={a.id} className="grid grid-cols-5 gap-2 py-1">
                  <span className="truncate">{a.name}</span>
                  <span>{a.count}</span>
                  <span>{a.tokens.toLocaleString()}</span>
                  <span>{a.replied}</span>
                  <span>{a.avgLat}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Últimas chamadas</h2>
          <div className="space-y-1 text-xs">
            {rows.slice(0, 30).map((r) => (
              <div key={r.id} className="flex items-center gap-2 border-b py-1">
                <Badge variant={r.status === "success" ? "secondary" : "destructive"} className="text-[10px]">
                  {r.status}
                </Badge>
                <span className="w-40 truncate text-muted-foreground">{r.model}</span>
                <span className="w-32 truncate">{r.agent_id ? agents[r.agent_id] ?? "—" : "—"}</span>
                <span className="w-20 text-right">{r.total_tokens ?? "—"}</span>
                <span className="w-20 text-right">{r.latency_ms ?? "—"} ms</span>
                <span className="flex-1 text-right text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            {rows.length === 0 && <p className="text-muted-foreground">Sem chamadas registradas.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </Card>
  );
}
