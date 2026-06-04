import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminCard } from "@/layouts/AdminShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertTriangle, AlertOctagon, Ghost, Loader2, RefreshCw, Search,
  TrendingUp, X, ExternalLink,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { cn } from "@/lib/utils";

type Usage = { feature: string; day: string; events: number; users: number; clinics: number };
type Dead = { feature: string; last_event: string | null; total_events: number };
type ErrSummary = { day: string; surface: string; severity: string; count: number };
type ErrRow = {
  id: string; created_at: string; surface: string; severity: string;
  route: string | null; function_name: string | null;
  error_message: string; error_stack: string | null;
};

const SEVERITY_META: Record<string, { label: string; tone: string; icon: any }> = {
  fatal: { label: "Fatal", tone: "bg-admin-negative-soft text-admin-negative border-admin-negative/30", icon: AlertOctagon },
  error: { label: "Error", tone: "bg-admin-negative-soft text-admin-negative border-admin-negative/30", icon: AlertOctagon },
  warn:  { label: "Warn",  tone: "bg-admin-warning-soft text-admin-warning border-admin-warning/30", icon: AlertTriangle },
  info:  { label: "Info",  tone: "bg-admin-primary-soft text-admin-primary border-admin-primary/20", icon: Activity },
};

export default function ObservabilityPanel() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [dead, setDead] = useState<Dead[]>([]);
  const [errSum, setErrSum] = useState<ErrSummary[]>([]);
  const [errors, setErrors] = useState<ErrRow[]>([]);
  const [days, setDays] = useState("7");
  const [severity, setSeverity] = useState("all");
  const [surface, setSurface] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ErrRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = Number(days);
      const [{ data: u }, { data: dd }, { data: s }] = await Promise.all([
        supabase.rpc("admin_feature_usage", { _days: d }),
        supabase.rpc("admin_dead_features", { _days: 30 }),
        supabase.rpc("admin_error_summary", { _days: d }),
      ]);
      setUsage((u as any) ?? []);
      setDead((dd as any) ?? []);
      setErrSum((s as any) ?? []);

      let q = supabase.from("error_events").select("*").order("created_at", { ascending: false }).limit(150);
      if (severity !== "all") q = q.eq("severity", severity);
      if (surface !== "all") q = q.eq("surface", surface);
      const { data: errs } = await q;
      setErrors((errs as any) ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, severity, surface]);

  const usageByFeature = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of usage) m[r.feature] = (m[r.feature] ?? 0) + Number(r.events);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [usage]);

  const usageByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of usage) m.set(r.day, (m.get(r.day) ?? 0) + Number(r.events));
    return Array.from(m, ([day, events]) => ({ day: day.slice(5), events })).sort((a, b) => a.day.localeCompare(b.day));
  }, [usage]);

  const errorsByDay = useMemo(() => {
    const m = new Map<string, { errors: number; warns: number }>();
    for (const r of errSum) {
      const k = r.day;
      const cur = m.get(k) ?? { errors: 0, warns: 0 };
      if (r.severity === "fatal" || r.severity === "error") cur.errors += Number(r.count);
      else cur.warns += Number(r.count);
      m.set(k, cur);
    }
    return Array.from(m, ([day, v]) => ({ day: day.slice(5), ...v })).sort((a, b) => a.day.localeCompare(b.day));
  }, [errSum]);

  const surfaces = useMemo(() => Array.from(new Set(errSum.map((r) => r.surface))).sort(), [errSum]);

  const filteredErrors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return errors;
    return errors.filter((e) =>
      e.error_message.toLowerCase().includes(q) ||
      (e.route ?? "").toLowerCase().includes(q) ||
      (e.function_name ?? "").toLowerCase().includes(q)
    );
  }, [errors, search]);

  const totalEvents = usage.reduce((a, r) => a + Number(r.events), 0);
  const totalErrors = errSum.reduce((a, r) => a + Number(r.count), 0);
  const fatalCount = errSum.filter((r) => r.severity === "fatal" || r.severity === "error").reduce((a, r) => a + Number(r.count), 0);
  const uniqueUsers = new Set(usage.flatMap((r) => Array.from({ length: Number(r.users) }, (_, i) => `${r.feature}-${r.day}-${i}`))).size;

  return (
    <div className="space-y-5">
      {/* Sticky filter bar */}
      <div className="sticky top-16 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-admin-bg/85 backdrop-blur border-b border-admin-border flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[150px] h-9 bg-admin-surface border-admin-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24h</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-[150px] h-9 bg-admin-surface border-admin-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidade</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="fatal">Fatal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={surface} onValueChange={setSurface}>
          <SelectTrigger className="w-[160px] h-9 bg-admin-surface border-admin-border"><SelectValue placeholder="Superfície" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas superfícies</SelectItem>
            {surfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-text-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mensagem, rota, função…"
            className="pl-8 h-9 bg-admin-surface border-admin-border"
          />
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="ml-auto border-admin-border">
          {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Atualizar
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Activity} tone="primary" label="Eventos" value={totalEvents} hint={`${usageByFeature.length} features ativas`} />
        <Kpi icon={AlertTriangle} tone="warning" label="Total de erros" value={totalErrors} hint={`${surfaces.length} superfícies`} />
        <Kpi icon={AlertOctagon} tone="negative" label="Error + Fatal" value={fatalCount} hint={totalErrors > 0 ? `${((fatalCount / totalErrors) * 100).toFixed(0)}% do total` : "—"} />
        <Kpi icon={Ghost} tone="accent" label="Features sem uso 30d" value={dead.length} hint={dead.length === 0 ? "tudo em uso 🎉" : "candidatas a remoção"} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <AdminCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-admin-text-subtle">Eventos por dia</div>
              <div className="text-xl font-semibold text-admin-text tabular-nums">{totalEvents.toLocaleString("pt-BR")}</div>
            </div>
            <TrendingUp className="h-4 w-4 text-admin-positive" />
          </div>
          <div className="h-40">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageByDay}>
                  <defs>
                    <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--admin-primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--admin-primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--admin-text-subtle))" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--admin-surface))", border: "1px solid hsl(var(--admin-border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="events" stroke="hsl(var(--admin-primary))" strokeWidth={2} fill="url(#evGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </AdminCard>

        <AdminCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-admin-text-subtle">Erros por dia</div>
              <div className="text-xl font-semibold text-admin-text tabular-nums">{totalErrors.toLocaleString("pt-BR")}</div>
            </div>
            <span className="text-[11px] text-admin-text-muted">vermelho = error/fatal</span>
          </div>
          <div className="h-40">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorsByDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--admin-text-subtle))" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--admin-surface))", border: "1px solid hsl(var(--admin-border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="warns" stackId="a" fill="hsl(var(--admin-warning))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="errors" stackId="a" fill="hsl(var(--admin-negative))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </AdminCard>
      </div>

      {/* Features usage + Dead */}
      <div className="grid lg:grid-cols-3 gap-4">
        <AdminCard className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-admin-text">Uso por feature</div>
            <div className="text-xs text-admin-text-muted">{usageByFeature.length} features</div>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : usageByFeature.length === 0 ? (
            <div className="text-xs text-admin-text-muted py-8 text-center">Sem eventos no período.</div>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-auto scrollbar-thin pr-1">
              {usageByFeature.map(([feature, events]) => {
                const max = usageByFeature[0][1] || 1;
                const pct = (events / max) * 100;
                return (
                  <div key={feature} className="grid grid-cols-[200px_1fr_80px] gap-3 items-center text-xs group">
                    <span className="font-medium truncate text-admin-text">{feature}</span>
                    <div className="h-2 rounded-full bg-admin-surface-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-admin-primary to-admin-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-right text-admin-text-muted tabular-nums">{events.toLocaleString("pt-BR")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-admin-text">Features sem uso 30d</div>
            <Ghost className="h-4 w-4 text-admin-text-subtle" />
          </div>
          {dead.length === 0 ? (
            <div className="text-xs text-admin-text-muted py-8 text-center">Tudo em uso 🎉</div>
          ) : (
            <div className="space-y-1 max-h-[360px] overflow-auto scrollbar-thin pr-1">
              {dead.map((d) => (
                <div key={d.feature} className="rounded-md border border-admin-border bg-admin-surface-2 px-2.5 py-1.5 text-xs">
                  <div className="font-medium text-admin-text truncate">{d.feature}</div>
                  <div className="text-[10px] text-admin-text-subtle mt-0.5">
                    último: {d.last_event ? new Date(d.last_event).toLocaleDateString("pt-BR") : "nunca"} · {d.total_events} eventos
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      {/* Recent errors */}
      <AdminCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-admin-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-admin-text">Erros recentes</div>
            <div className="text-[11px] text-admin-text-subtle">{filteredErrors.length} de {errors.length} eventos</div>
          </div>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : filteredErrors.length === 0 ? (
          <div className="text-xs text-admin-text-muted py-10 text-center">Sem erros registrados no filtro.</div>
        ) : (
          <div className="divide-y divide-admin-border max-h-[480px] overflow-auto scrollbar-thin">
            {filteredErrors.map((e) => {
              const meta = SEVERITY_META[e.severity] ?? SEVERITY_META.info;
              const Icon = meta.icon;
              return (
                <button
                  key={e.id}
                  onClick={() => setOpen(e)}
                  className="w-full text-left px-4 py-2.5 hover:bg-admin-surface-2 transition-colors grid grid-cols-[150px_88px_110px_1fr] gap-3 items-center text-xs"
                >
                  <span className="text-admin-text-subtle tabular-nums">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border w-fit", meta.tone)}>
                    <Icon className="h-3 w-3" />{meta.label}
                  </span>
                  <span className="text-admin-text-muted truncate">{e.surface}{e.function_name ? `·${e.function_name}` : ""}</span>
                  <span className="truncate font-medium text-admin-text">{e.error_message}</span>
                </button>
              );
            })}
          </div>
        )}
      </AdminCard>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(null)}>
          <div className="max-w-3xl w-full max-h-[85vh] overflow-auto rounded-[var(--admin-radius)] bg-admin-surface border border-admin-border shadow-admin-card" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-admin-surface border-b border-admin-border px-5 py-3 flex items-center gap-2">
              {(() => {
                const meta = SEVERITY_META[open.severity] ?? SEVERITY_META.info;
                const Icon = meta.icon;
                return (
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", meta.tone)}>
                    <Icon className="h-3 w-3" />{meta.label}
                  </span>
                );
              })()}
              <span className="text-[11px] px-1.5 py-0.5 rounded-md border border-admin-border text-admin-text-muted">{open.surface}</span>
              {open.route && <span className="text-xs text-admin-text-muted truncate"><ExternalLink className="h-3 w-3 inline mr-1" />{open.route}</span>}
              {open.function_name && <span className="text-xs text-admin-text-muted">⚙ {open.function_name}</span>}
              <button onClick={() => setOpen(null)} className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-admin-surface-2 text-admin-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm font-semibold text-admin-text">{open.error_message}</div>
              <div className="text-[11px] text-admin-text-subtle">{new Date(open.created_at).toLocaleString("pt-BR")}</div>
              <pre className="text-[11px] bg-admin-surface-2 border border-admin-border p-3 rounded-md overflow-auto whitespace-pre-wrap leading-relaxed max-h-[420px]">{open.error_stack ?? "(sem stack)"}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, hint }: { icon: any; tone: "primary" | "positive" | "negative" | "warning" | "accent"; label: string; value: number; hint?: string }) {
  const toneCls: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    negative: "text-admin-negative bg-admin-negative-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
    accent: "text-admin-accent bg-admin-accent/10",
  };
  return (
    <AdminCard className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", toneCls[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-admin-text-subtle font-medium">{label}</div>
          <div className="text-2xl font-semibold text-admin-text tabular-nums leading-tight">{value.toLocaleString("pt-BR")}</div>
          {hint && <div className="text-[10px] text-admin-text-subtle mt-0.5 truncate">{hint}</div>}
        </div>
      </div>
    </AdminCard>
  );
}
