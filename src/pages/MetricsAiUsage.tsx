import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllByIn, fetchAllPaged } from "@/lib/fetch-all";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Coins, Activity, AlertTriangle, Download, RefreshCw, Bot, Users, MessageSquare } from "lucide-react";
import { calcCost, fmtUSD, isModelKnown } from "@/lib/ai-pricing";
import { AiSpendLimitCard } from "@/components/admin/AiSpendLimitCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineOverview } from "@/components/ai/usage/PipelineOverview";


type Row = {
  id: string;
  agent_id: string | null;
  automation_id: string | null;
  lead_id: string | null;
  thread_id: string | null;
  model: string;
  operation: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  tools_called: number;
  replied: boolean;
  error: string | null;
  source: string | null;
  provider: string | null;
  agent_step: string | null;
  error_category: string | null;
  error_details: Record<string, any> | null;
  created_at: string;
};

const PAGE_SIZE = 50;

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function MetricsAiUsage() {
  const { isSuperAdmin, membership, loading } = useAuth();
  const isClinicAdmin = membership?.role === "owner" || membership?.role === "admin";
  const allowed = isSuperAdmin || isClinicAdmin;

  const [fromDate, setFromDate] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400_000)));
  const [toDate, setToDate] = useState(() => toDateInput(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [leads, setLeads] = useState<Record<string, { name: string | null; phone: string }>>({});
  const [filterModel, setFilterModel] = useState<string>("");
  const [filterAgent, setFilterAgent] = useState<string>("");
  const [filterOp, setFilterOp] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterErrorCategory, setFilterErrorCategory] = useState<string>("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Row | null>(null);

  const load = async () => {
    setLoadingRows(true);
    const since = new Date(`${fromDate}T00:00:00`).toISOString();
    const until = new Date(`${toDate}T23:59:59.999`).toISOString();
    const list = await fetchAllPaged<Row>(
      () => supabase
        .from("ai_usage")
        .select("*")
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false }),
      1000,
      50_000,
    );
    setRows(list);
    setPage(0);
    // resolve agent + lead names
    const agentIds = Array.from(new Set(list.map((r) => r.agent_id).filter(Boolean))) as string[];
    const leadIds = Array.from(new Set(list.map((r) => r.lead_id).filter(Boolean))) as string[];
    const [aRows, lRows] = await Promise.all([
      fetchAllByIn<any>((slice) => supabase.from("ai_agents").select("id, name").in("id", slice), agentIds),
      fetchAllByIn<any>((slice) => supabase.from("leads").select("id, name, phone").in("id", slice), leadIds),
    ]);
    const am: Record<string, string> = {};
    aRows.forEach((a: any) => { am[a.id] = a.name; });
    setAgents(am);
    const lm: Record<string, { name: string | null; phone: string }> = {};
    lRows.forEach((l: any) => { lm[l.id] = { name: l.name, phone: l.phone }; });
    setLeads(lm);
    setLoadingRows(false);
  };

  useEffect(() => { if (allowed) load(); /* eslint-disable-next-line */ }, [fromDate, toDate, allowed]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterModel && r.model !== filterModel) return false;
      if (filterAgent && r.agent_id !== filterAgent) return false;
      if (filterOp && r.operation !== filterOp) return false;
      if (filterSource && (r.source ?? "unknown") !== filterSource) return false;
      if (filterErrorCategory && (r.error_category ?? "uncategorized") !== filterErrorCategory) return false;
      if (onlyErrors && r.status === "success") return false;
      if (search) {
        const q = search.toLowerCase();
        const lead = r.lead_id ? leads[r.lead_id] : null;
        const agentName = r.agent_id ? agents[r.agent_id] ?? "" : "";
        const hay = `${r.model} ${r.operation} ${r.status} ${r.source ?? ""} ${r.provider ?? ""} ${r.agent_step ?? ""} ${r.error_category ?? ""} ${r.error ?? ""} ${agentName} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterModel, filterAgent, filterOp, filterSource, filterErrorCategory, onlyErrors, search, agents, leads]);

  const stats = useMemo(() => {
    let totalCost = 0;
    let totalIn = 0;
    let totalOut = 0;
    let errors = 0;
    let unknown = 0;
    for (const r of filtered) {
      const c = calcCost(r.model, r.input_tokens, r.output_tokens);
      totalCost += c;
      totalIn += r.input_tokens ?? 0;
      totalOut += r.output_tokens ?? 0;
      if (r.status !== "success") errors++;
      if (!isModelKnown(r.model)) unknown++;
    }
    return {
      totalCost,
      totalIn,
      totalOut,
      total: totalIn + totalOut,
      calls: filtered.length,
      errors,
      avgCost: filtered.length ? totalCost / filtered.length : 0,
      unknown,
    };
  }, [filtered]);

  const byModel = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number; in: number; out: number }>();
    for (const r of filtered) {
      const cur = m.get(r.model) ?? { calls: 0, cost: 0, in: 0, out: 0 };
      cur.calls++;
      cur.cost += calcCost(r.model, r.input_tokens, r.output_tokens);
      cur.in += r.input_tokens ?? 0;
      cur.out += r.output_tokens ?? 0;
      m.set(r.model, cur);
    }
    return Array.from(m.entries())
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  const byAgent = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number; tokens: number }>();
    for (const r of filtered) {
      const k = r.agent_id ?? "__none";
      const cur = m.get(k) ?? { calls: 0, cost: 0, tokens: 0 };
      cur.calls++;
      cur.cost += calcCost(r.model, r.input_tokens, r.output_tokens);
      cur.tokens += r.total_tokens ?? (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, name: id === "__none" ? "(sem agente)" : agents[id] ?? id.slice(0, 8), ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [filtered, agents]);

  const byLead = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number }>();
    for (const r of filtered) {
      if (!r.lead_id) continue;
      const cur = m.get(r.lead_id) ?? { calls: 0, cost: 0 };
      cur.calls++;
      cur.cost += calcCost(r.model, r.input_tokens, r.output_tokens);
      m.set(r.lead_id, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v, lead: leads[id] }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);
  }, [filtered, leads]);

  const byOp = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number }>();
    for (const r of filtered) {
      const cur = m.get(r.operation) ?? { calls: 0, cost: 0 };
      cur.calls++;
      cur.cost += calcCost(r.model, r.input_tokens, r.output_tokens);
      m.set(r.operation, cur);
    }
    return Array.from(m.entries()).map(([op, v]) => ({ op, ...v })).sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  const byErrorCategory = useMemo(() => {
    const m = new Map<string, { calls: number; leads: Set<string>; last: string | null; sample: string | null }>();
    for (const r of filtered) {
      if (r.status === "success") continue;
      const key = r.error_category ?? "uncategorized";
      const cur = m.get(key) ?? { calls: 0, leads: new Set<string>(), last: null, sample: null };
      cur.calls++;
      if (r.lead_id) cur.leads.add(r.lead_id);
      if (!cur.last || r.created_at > cur.last) cur.last = r.created_at;
      if (!cur.sample && r.error) cur.sample = r.error;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([category, v]) => ({ category, calls: v.calls, leads: v.leads.size, last: v.last, sample: v.sample }))
      .sort((a, b) => b.calls - a.calls);
  }, [filtered]);

  // gráfico custo/dia × modelo
  const dailyByModel = useMemo(() => {
    const startDate = new Date(`${fromDate}T00:00:00`);
    const endDate = new Date(`${toDate}T00:00:00`);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400_000) + 1);
    const days = Math.min(totalDays, 60);
    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dayKeys.push(toDateInput(d));
    }
    const models = byModel.slice(0, 6).map((m) => m.model);
    const colors = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
    const buckets = dayKeys.map((day) => {
      const obj: Record<string, number> = { __day: 0 };
      models.forEach((m) => { obj[m] = 0; });
      return { day, ...obj };
    });
    for (const r of filtered) {
      const d = r.created_at.slice(0, 10);
      const b = buckets.find((x) => x.day === d);
      if (!b) continue;
      if (models.includes(r.model)) (b as any)[r.model] += calcCost(r.model, r.input_tokens, r.output_tokens);
    }
    const max = Math.max(0.0001, ...buckets.map((b) => models.reduce((s, m) => s + ((b as any)[m] || 0), 0)));
    return { buckets, models, colors, max };
  }, [filtered, byModel, fromDate, toDate]);

  const uniqueModels = useMemo(() => Array.from(new Set(rows.map((r) => r.model))).sort(), [rows]);
  const uniqueAgents = useMemo(() => Array.from(new Set(rows.map((r) => r.agent_id).filter(Boolean))) as string[], [rows]);
  const uniqueOps = useMemo(() => Array.from(new Set(rows.map((r) => r.operation))).sort(), [rows]);
  const uniqueSources = useMemo(() => Array.from(new Set(rows.map((r) => r.source ?? "unknown"))).sort(), [rows]);
  const uniqueErrorCategories = useMemo(
    () => Array.from(new Set(rows.filter((r) => r.status !== "success").map((r) => r.error_category ?? "uncategorized"))).sort(),
    [rows],
  );

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const exportCsv = () => {
    const lines = [
      ["data", "origem", "provider", "etapa", "categoria_erro", "modelo", "operacao", "status", "agente", "lead", "input", "output", "total", "latencia_ms", "custo_usd", "erro"].join(","),
      ...filtered.map((r) => {
        const lead = r.lead_id ? leads[r.lead_id] : null;
        const cost = calcCost(r.model, r.input_tokens, r.output_tokens);
        return [
          r.created_at,
            r.source ?? "",
            r.provider ?? "",
            r.agent_step ?? "",
            r.error_category ?? "",
          r.model,
          r.operation,
          r.status,
          r.agent_id ? (agents[r.agent_id] ?? r.agent_id) : "",
          lead ? `${lead.name ?? ""} (${lead.phone})` : "",
          r.input_tokens ?? "",
          r.output_tokens ?? "",
          r.total_tokens ?? "",
          r.latency_ms ?? "",
          cost.toFixed(6),
          (r.error ?? "").replace(/[\n,;]/g, " "),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${fromDate}_${toDate}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        {membership?.clinic_id && <AiSpendLimitCard clinicId={membership.clinic_id} />}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <PipelineOverview clinicId={membership?.clinic_id ?? null} />
          </TabsContent>
          <TabsContent value="advanced" className="mt-4 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Custos de IA</h1>
            <p className="text-xs text-muted-foreground">Histórico detalhado de chamadas para a API de IA. Visível somente para administradores.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <Input
                type="date"
                className="h-8 w-[140px]"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="date"
                className="h-8 w-[140px]"
                value={toDate}
                min={fromDate}
                max={toDateInput(new Date())}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loadingRows}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRows ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        {stats.unknown > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
            <div>
              <strong>{stats.unknown}</strong> chamadas usam modelos sem preço cadastrado — o custo dessas linhas aparece como $0. Atualize <code>src/lib/ai-pricing.ts</code>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={<Coins className="h-4 w-4" />} label="Custo total" value={fmtUSD(stats.totalCost)} />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Chamadas" value={stats.calls.toLocaleString()} />
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Tokens (in/out)" value={`${(stats.totalIn / 1000).toFixed(1)}k / ${(stats.totalOut / 1000).toFixed(1)}k`} />
          <StatCard icon={<Coins className="h-4 w-4" />} label="Custo médio" value={fmtUSD(stats.avgCost)} />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Erros" value={String(stats.errors)} />
        </div>

        {byErrorCategory.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Diagnóstico dos erros</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {byErrorCategory.map((e) => (
                <div key={e.category} className="rounded border bg-muted/20 p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant="destructive" className="text-[10px]">{friendlyErrorCategory(e.category)}</Badge>
                    <span className="text-muted-foreground">{e.calls} chamadas · {e.leads} lead{e.leads === 1 ? "" : "s"}</span>
                  </div>
                  <p className="text-muted-foreground">{errorCategoryExplanation(e.category)}</p>
                  {e.sample && <p className="mt-1 truncate font-mono text-[10px]">{e.sample}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Custo por dia (top 6 modelos)</h2>
          <div className="flex h-44 items-stretch gap-1">
            {dailyByModel.buckets.map((b: any) => {
              const total = dailyByModel.models.reduce((s, m) => s + (b[m] || 0), 0);
              const pctTotal = (total / dailyByModel.max) * 100;
              return (
                <div key={b.day} className="flex h-full flex-1 flex-col items-center gap-1" title={`${b.day}: ${fmtUSD(total)}`}>
                  <div className="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-sm" style={{ minHeight: 0 }}>
                    {dailyByModel.models.map((m, i) => {
                      const v = b[m] || 0;
                      const h = total ? (v / total) * pctTotal : 0;
                      return <div key={m} style={{ height: `${h}%`, background: dailyByModel.colors[i] }} />;
                    })}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{b.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {dailyByModel.models.map((m, i) => (
              <span key={m} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: dailyByModel.colors[i] }} />
                {m}
              </span>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Por modelo</h2>
            <RankList rows={byModel.map((m) => ({ key: m.model, label: m.model, sub: `${m.calls} chamadas · ${(m.in / 1000).toFixed(1)}k in / ${(m.out / 1000).toFixed(1)}k out`, value: fmtUSD(m.cost) }))} />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bot className="h-3.5 w-3.5" /> Por agente</h2>
            <RankList rows={byAgent.map((a) => ({ key: a.id, label: a.name, sub: `${a.calls} chamadas · ${(a.tokens / 1000).toFixed(1)}k tokens`, value: fmtUSD(a.cost) }))} />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-3.5 w-3.5" /> Top 20 leads</h2>
            <RankList rows={byLead.map((l) => ({ key: l.id, label: l.lead?.name ?? l.lead?.phone ?? l.id.slice(0, 8), sub: `${l.calls} chamadas · ${l.lead?.phone ?? ""}`, value: fmtUSD(l.cost), href: `/inbox/${l.id}` }))} />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Por operação</h2>
            <RankList rows={byOp.map((o) => ({ key: o.op, label: o.op, sub: `${o.calls} chamadas`, value: fmtUSD(o.cost) }))} />
          </Card>
        </div>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Detalhe de chamadas</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} de {rows.length}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Input className="h-8 w-44" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="h-8 rounded border bg-background px-2 text-xs" value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
                <option value="">Todos modelos</option>
                {uniqueModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="h-8 rounded border bg-background px-2 text-xs" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                <option value="">Todos agentes</option>
                {uniqueAgents.map((id) => <option key={id} value={id}>{agents[id] ?? id.slice(0, 8)}</option>)}
              </select>
              <select className="h-8 rounded border bg-background px-2 text-xs" value={filterOp} onChange={(e) => setFilterOp(e.target.value)}>
                <option value="">Todas operações</option>
                {uniqueOps.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="h-8 rounded border bg-background px-2 text-xs" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="">Todas origens</option>
                {uniqueSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="h-8 rounded border bg-background px-2 text-xs" value={filterErrorCategory} onChange={(e) => setFilterErrorCategory(e.target.value)}>
                <option value="">Todas categorias</option>
                {uniqueErrorCategories.map((c) => <option key={c} value={c}>{friendlyErrorCategory(c)}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
                Só erros
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Quando</th>
                  <th className="py-2 text-left font-medium">Modelo</th>
                  <th className="py-2 text-left font-medium">Op.</th>
                  <th className="py-2 text-left font-medium">Origem</th>
                  <th className="py-2 text-left font-medium">Erro</th>
                  <th className="py-2 text-left font-medium">Agente</th>
                  <th className="py-2 text-left font-medium">Lead</th>
                  <th className="py-2 text-right font-medium">In</th>
                  <th className="py-2 text-right font-medium">Out</th>
                  <th className="py-2 text-right font-medium">Lat.</th>
                  <th className="py-2 text-right font-medium">Custo</th>
                  <th className="py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const cost = calcCost(r.model, r.input_tokens, r.output_tokens);
                  const lead = r.lead_id ? leads[r.lead_id] : null;
                  return (
                    <tr key={r.id} className="cursor-pointer border-b hover:bg-accent/40" onClick={() => setDetail(r)}>
                      <td className="py-1.5">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-1.5 font-mono text-[11px]">{r.model}</td>
                      <td className="py-1.5">{r.operation}</td>
                      <td className="py-1.5">{r.source ?? "unknown"}</td>
                      <td className="py-1.5">{r.error_category ? <Badge variant="outline" className="text-[10px]">{friendlyErrorCategory(r.error_category)}</Badge> : "—"}</td>
                      <td className="py-1.5 max-w-32 truncate">{r.agent_id ? agents[r.agent_id] ?? "—" : "—"}</td>
                      <td className="py-1.5 max-w-32 truncate">{lead?.name ?? lead?.phone ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.input_tokens ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.output_tokens ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.latency_ms ? `${r.latency_ms}ms` : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{fmtUSD(cost)}</td>
                      <td className="py-1.5">
                        <Badge variant={r.status === "success" ? "secondary" : "destructive"} className="text-[10px]">{r.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">Sem chamadas no período / filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </Card>
          </TabsContent>
        </Tabs>
      </div>


      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[480px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes da chamada</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-2 text-xs">
              <KV k="ID" v={detail.id} />
              <KV k="Quando" v={new Date(detail.created_at).toLocaleString()} />
              <KV k="Modelo" v={detail.model} />
              <KV k="Operação" v={detail.operation} />
              <KV k="Origem" v={detail.source ?? "unknown"} />
              <KV k="Provider" v={detail.provider ?? "—"} />
              <KV k="Etapa" v={detail.agent_step ?? "—"} />
              <KV k="Status" v={detail.status} />
              <KV k="Agente" v={detail.agent_id ? `${agents[detail.agent_id] ?? "—"} (${detail.agent_id})` : "—"} />
              <KV k="Lead" v={detail.lead_id ? `${leads[detail.lead_id]?.name ?? leads[detail.lead_id]?.phone ?? "—"} (${detail.lead_id})` : "—"} />
              <KV k="Thread" v={detail.thread_id ?? "—"} />
              <KV k="Automação" v={detail.automation_id ?? "—"} />
              <KV k="Tokens" v={`in ${detail.input_tokens ?? "—"} / out ${detail.output_tokens ?? "—"} / total ${detail.total_tokens ?? "—"}`} />
              <KV k="Latência" v={detail.latency_ms ? `${detail.latency_ms} ms` : "—"} />
              <KV k="Tools chamadas" v={String(detail.tools_called)} />
              <KV k="Respondeu" v={detail.replied ? "sim" : "não"} />
              <KV k="Custo" v={fmtUSD(calcCost(detail.model, detail.input_tokens, detail.output_tokens))} />
              {detail.error_category && <KV k="Categoria" v={friendlyErrorCategory(detail.error_category)} />}
              {detail.error_category && (
                <div className="rounded border bg-muted/20 p-2">
                  <div className="mb-1 text-muted-foreground">Leitura do diagnóstico:</div>
                  <p>{errorCategoryExplanation(detail.error_category)}</p>
                  {detail.error_details && Object.keys(detail.error_details).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(detail.error_details, null, 2)}</pre>
                  )}
                </div>
              )}
              {detail.error && (
                <div className="mt-2">
                  <div className="mb-1 text-muted-foreground">Erro:</div>
                  <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px]">{detail.error}</pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
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

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-mono break-all">{v}</span>
    </div>
  );
}

function friendlyErrorCategory(category: string) {
  const map: Record<string, string> = {
    schema_validation: "Schema/JSON inválido",
    quota_or_billing: "Cota/crédito",
    rate_limit: "Rate limit",
    timeout: "Timeout",
    gateway_5xx: "Falha do provider",
    network: "Rede",
    no_provider: "Sem provider",
    uncategorized: "Sem categoria",
    unknown: "Desconhecido",
  };
  return map[category] ?? category;
}

function errorCategoryExplanation(category: string) {
  const map: Record<string, string> = {
    schema_validation: "O modelo respondeu fora do formato esperado. O pipeline deve reprocessar com backoff ou usar fallback seguro; não significa necessariamente custo alto.",
    quota_or_billing: "O provider recusou a chamada por limite de crédito/cota. O guard bloqueia novas tentativas temporariamente para evitar gasto e ruído.",
    rate_limit: "Muitas chamadas em pouco tempo. A rotina aplica espera e tenta novamente depois.",
    timeout: "A etapa demorou além do limite operacional e deve ser reprocessada.",
    gateway_5xx: "Falha temporária no provider/modelo. Normalmente é recuperável com retry.",
    network: "Falha de rede ou conexão entre a função e o provider.",
    no_provider: "Nenhum provider de IA estava disponível para a empresa.",
    uncategorized: "Erro legado sem detalhes estruturados; abra o registro para ver a mensagem bruta.",
    unknown: "Erro não mapeado; precisa de inspeção manual da mensagem bruta.",
  };
  return map[category] ?? "Erro não mapeado; precisa de inspeção manual da mensagem bruta.";
}

function RankList({ rows }: { rows: { key: string; label: string; sub?: string; value: string; href?: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  const max = Math.max(...rows.map((r) => parseFloat(r.value.replace(/[^0-9.]/g, "")) || 0));
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const v = parseFloat(r.value.replace(/[^0-9.]/g, "")) || 0;
        const pct = max ? (v / max) * 100 : 0;
        const Inner = (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums font-medium">{r.value}</span>
            </div>
            {r.sub && <div className="text-[10px] text-muted-foreground">{r.sub}</div>}
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return r.href ? (
          <a key={r.key} href={r.href} className="block hover:opacity-80">{Inner}</a>
        ) : (
          <div key={r.key}>{Inner}</div>
        );
      })}
    </div>
  );
}
