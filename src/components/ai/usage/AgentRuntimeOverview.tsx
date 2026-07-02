import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Clock,
  Coins,
  MessageSquare,
  RefreshCw,
  Sparkles,
  XCircle,
  Users,
} from "lucide-react";
import { calcCost, fmtUSD } from "@/lib/ai-pricing";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Row = {
  id: string;
  agent_id: string | null;
  lead_id: string | null;
  model: string;
  operation: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  provider: string | null;
  source: string | null;
  replied: boolean | null;
  created_at: string;
};

type Range = "24h" | "7d" | "30d";

const RANGES: { id: Range; label: string; hours: number }[] = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
];

function rowCost(r: Row): number {
  if (r.cost_usd != null) return Number(r.cost_usd);
  return calcCost(r.model, r.input_tokens, r.output_tokens);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function AgentRuntimeOverview({ clinicId }: { clinicId: string | null }) {
  const [range, setRange] = useState<Range>("24h");
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [leads, setLeads] = useState<Record<string, { name: string | null; phone: string | null }>>({});
  const [loading, setLoading] = useState(false);

  const since = useMemo(() => {
    const hours = RANGES.find((r) => r.id === range)?.hours ?? 24;
    return new Date(Date.now() - hours * 3600_000).toISOString();
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("ai_usage")
        .select(
          "id, agent_id, lead_id, model, operation, status, input_tokens, output_tokens, total_tokens, latency_ms, cost_usd, provider, source, replied, created_at",
        )
        .eq("source", "agent-runtime")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (clinicId) q = q.eq("clinic_id", clinicId);
      const { data } = await q;
      const list = (data ?? []) as Row[];
      setRows(list);

      const agentIds = Array.from(new Set(list.map((r) => r.agent_id).filter(Boolean))) as string[];
      const leadIds = Array.from(new Set(list.map((r) => r.lead_id).filter(Boolean))) as string[];

      const [aRes, lRes] = await Promise.all([
        agentIds.length
          ? supabase.from("ai_agents").select("id, name").in("id", agentIds)
          : Promise.resolve({ data: [] as any[] }),
        leadIds.length
          ? supabase.from("leads").select("id, name, phone").in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const am: Record<string, string> = {};
      (aRes.data ?? []).forEach((a: any) => (am[a.id] = a.name ?? a.id.slice(0, 8)));
      setAgents(am);
      const lm: Record<string, { name: string | null; phone: string | null }> = {};
      (lRes.data ?? []).forEach((l: any) => (lm[l.id] = { name: l.name, phone: l.phone }));
      setLeads(lm);
    } finally {
      setLoading(false);
    }
  }, [clinicId, since]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let cost = 0;
    let tokens = 0;
    let errors = 0;
    let replies = 0;
    for (const r of rows) {
      cost += rowCost(r);
      tokens += r.total_tokens ?? 0;
      if (r.status === "error") errors++;
      if (r.replied) replies++;
    }
    return {
      cost,
      tokens,
      errors,
      calls: rows.length,
      replies,
      perReply: replies ? cost / replies : 0,
    };
  }, [rows]);

  const byAgent = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number; tokens: number; errors: number; lats: number[] }>();
    for (const r of rows) {
      const k = r.agent_id ?? "_no_agent_";
      const cur = m.get(k) ?? { calls: 0, cost: 0, tokens: 0, errors: 0, lats: [] };
      cur.calls++;
      cur.cost += rowCost(r);
      cur.tokens += r.total_tokens ?? 0;
      if (r.status === "error") cur.errors++;
      if (r.latency_ms != null) cur.lats.push(r.latency_ms);
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        name: agents[id] ?? (id === "_no_agent_" ? "Sem agente" : id.slice(0, 8)),
        calls: v.calls,
        cost: v.cost,
        tokens: v.tokens,
        errors: v.errors,
        p50: Math.round(percentile(v.lats, 50)),
        p95: Math.round(percentile(v.lats, 95)),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [rows, agents]);

  const byModel = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number; tokens: number; provider: string }>();
    for (const r of rows) {
      const k = r.model;
      const cur = m.get(k) ?? { calls: 0, cost: 0, tokens: 0, provider: r.provider ?? "—" };
      cur.calls++;
      cur.cost += rowCost(r);
      cur.tokens += r.total_tokens ?? 0;
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [rows]);

  const topLeads = useMemo(() => {
    const m = new Map<string, { cost: number; calls: number }>();
    for (const r of rows) {
      if (!r.lead_id) continue;
      const cur = m.get(r.lead_id) ?? { cost: 0, calls: 0 };
      cur.cost += rowCost(r);
      cur.calls++;
      m.set(r.lead_id, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v, lead: leads[id] }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [rows, leads]);

  const timeline = useMemo(() => {
    const bucketSize = range === "24h" ? 3600_000 : 24 * 3600_000;
    const map = new Map<number, number>();
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const b = Math.floor(t / bucketSize) * bucketSize;
      map.set(b, (map.get(b) ?? 0) + rowCost(r));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, cost]) => ({
        t,
        label: range === "24h"
          ? new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        cost: Number(cost.toFixed(5)),
      }));
  }, [rows, range]);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="border-b bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-semibold">Custos do atendimento por IA</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Soma chamadas do agente que conversa com o lead (ai-chat). Filtro: <code>source = agent-runtime</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
                <TabsList>
                  {RANGES.map((r) => (
                    <TabsTrigger key={r.id} value={r.id}>{r.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          <Stat icon={<Coins className="h-4 w-4 text-amber-500" />} label="Custo total" value={fmtUSD(totals.cost)} sub={`≈ ${fmtUSD(totals.perReply)} por resposta`} />
          <Stat icon={<MessageSquare className="h-4 w-4 text-blue-500" />} label="Respostas enviadas" value={totals.replies.toLocaleString()} sub={`${totals.calls.toLocaleString()} chamadas totais`} />
          <Stat icon={<Bot className="h-4 w-4 text-violet-500" />} label="Tokens" value={totals.tokens.toLocaleString()} />
          <Stat icon={<XCircle className="h-4 w-4 text-rose-500" />} label="Erros" value={totals.errors.toLocaleString()} tone={totals.errors > 0 ? "warn" : undefined} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Custo ao longo do tempo</h3>
        <div className="h-56 w-full">
          {timeline.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem chamadas no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtUSD(Number(v))} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => fmtUSD(Number(v))}
                />
                <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold flex items-center gap-2"><Bot className="h-4 w-4" /> Por agente</h3>
        {byAgent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chamada de agente no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Agente</th>
                  <th className="text-right">Chamadas</th>
                  <th className="text-right">Erros</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">p50 (ms)</th>
                  <th className="text-right">p95 (ms)</th>
                  <th className="text-right">Custo</th>
                </tr>
              </thead>
              <tbody>
                {byAgent.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2">{a.name}</td>
                    <td className="text-right">{a.calls}</td>
                    <td className="text-right">
                      {a.errors > 0 ? <Badge variant="destructive" className="font-mono text-[10px]">{a.errors}</Badge> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="text-right">{a.tokens.toLocaleString()}</td>
                    <td className="text-right text-xs">{a.p50 || "—"}</td>
                    <td className={`text-right text-xs ${a.p95 > 8000 ? "text-destructive font-semibold" : ""}`}>{a.p95 || "—"}</td>
                    <td className="text-right font-semibold">{fmtUSD(a.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Por modelo / provider</h3>
          {byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Modelo</th>
                  <th className="text-left">Provider</th>
                  <th className="text-right">Chamadas</th>
                  <th className="text-right">Custo</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((m) => (
                  <tr key={m.model} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{m.model}</td>
                    <td className="text-xs text-muted-foreground">{m.provider}</td>
                    <td className="text-right">{m.calls}</td>
                    <td className="text-right font-semibold">{fmtUSD(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Top 10 leads mais caros</h3>
          {topLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Lead</th>
                  <th className="text-right">Chamadas</th>
                  <th className="text-right">Custo</th>
                </tr>
              </thead>
              <tbody>
                {topLeads.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link to={`/inbox?lead=${l.id}`} className="text-primary hover:underline">
                        {l.lead?.name || l.lead?.phone || l.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-right">{l.calls}</td>
                    <td className="text-right font-semibold">{fmtUSD(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
