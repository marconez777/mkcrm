import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Search, AlertTriangle, Activity, Building2, AlertOctagon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIMIT_DEFS, USAGE_KEY_MAP } from "@/lib/admin-plans";
import { AdminCard } from "@/layouts/AdminShell";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type Clinic = { id: string; name: string; plan: string; settings: any };
type Plan = { code: string; limits: Record<string, number | null> };

export default function UsageLimitsPanel() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: c }, { data: p }] = await Promise.all([
          supabase.from("clinics").select("id,name,plan,settings").order("name"),
          supabase.from("plans").select("code,limits"),
        ]);
        setClinics((c as any) ?? []);
        setPlans((p as any) ?? []);
        const usageMap: Record<string, any> = {};
        await Promise.all((c ?? []).map(async (cl: any) => {
          const { data } = await supabase.rpc("admin_clinic_usage", { _clinic: cl.id });
          usageMap[cl.id] = data ?? {};
        }));
        setUsage(usageMap);
      } finally { setLoading(false); }
    })();
  }, []);

  function effectiveLimit(c: Clinic, key: string): number | null {
    const override = c.settings?.limits?.[key];
    if (override !== undefined && override !== null) return Number(override);
    const plan = plans.find((p) => p.code === c.plan);
    const lim = plan?.limits?.[key];
    return lim === null || lim === undefined ? null : Number(lim);
  }

  function pct(used: number, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.min(999, (used / limit) * 100);
  }

  // Heatmap status per cell
  function cellStatus(p: number, limit: number | null): "unlimited" | "ok" | "warn" | "near" | "over" {
    if (limit == null) return "unlimited";
    if (p >= 100) return "over";
    if (p >= 80) return "near";
    if (p >= 50) return "warn";
    return "ok";
  }

  const filteredClinics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clinics.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (planFilter !== "all" && c.plan !== planFilter) return false;
      if (statusFilter !== "all") {
        const hasOver = LIMIT_DEFS.some((l) => {
          const u = usage[c.id]?.[USAGE_KEY_MAP[l.key]] ?? 0;
          const lim = effectiveLimit(c, l.key);
          const p = pct(Number(u), lim);
          if (statusFilter === "over") return p >= 100;
          if (statusFilter === "near") return p >= 80 && p < 100;
          return false;
        });
        if (!hasOver) return false;
      }
      return true;
    });
  }, [clinics, usage, search, planFilter, statusFilter, plans]);

  const counts = useMemo(() => {
    let over = 0, near = 0;
    const offenders = new Set<string>();
    for (const c of clinics) {
      let cOver = false, cNear = false;
      for (const l of LIMIT_DEFS) {
        const u = Number(usage[c.id]?.[USAGE_KEY_MAP[l.key]] ?? 0);
        const lim = effectiveLimit(c, l.key);
        const p = pct(u, lim);
        if (p >= 100) { cOver = true; offenders.add(c.id); }
        else if (p >= 80) cNear = true;
      }
      if (cOver) over++;
      else if (cNear) near++;
    }
    return { over, near, offenders: offenders.size };
  }, [clinics, usage, plans]);

  const planCodes = useMemo(() => Array.from(new Set(clinics.map((c) => c.plan))).sort(), [clinics]);

  function exportCsv() {
    const rows = filteredClinics.map((c) => {
      const row: Record<string, any> = { clinica: c.name, plano: c.plan };
      for (const l of LIMIT_DEFS) {
        const u = Number(usage[c.id]?.[USAGE_KEY_MAP[l.key]] ?? 0);
        const lim = effectiveLimit(c, l.key);
        row[`${l.key}_uso`] = u;
        row[`${l.key}_limite`] = lim ?? "ilimitado";
        row[`${l.key}_pct`] = lim ? Math.round(pct(u, lim)) : 0;
      }
      return row;
    });
    downloadCsv(`uso-limites-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-admin-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2} tone="primary" label="Clínicas monitoradas" value={clinics.length} />
        <Kpi icon={AlertOctagon} tone="negative" label="Excedendo limite" value={counts.over} />
        <Kpi icon={AlertTriangle} tone="warning" label="Próximas (≥80%)" value={counts.near} />
        <Kpi icon={Activity} tone="accent" label="Métricas rastreadas" value={LIMIT_DEFS.length} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clínica…" className="pl-8 h-9 bg-admin-surface border-admin-border" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-admin-surface border-admin-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {planCodes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 bg-admin-surface border-admin-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="over">Excedendo</SelectItem>
            <SelectItem value="near">Próximas do limite</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto border-admin-border" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" />Exportar CSV
        </Button>
      </div>

      <p className="text-xs text-admin-text-muted">
        Limites efetivos vêm do plano da clínica; <code className="text-admin-text">clinics.settings.limits</code> sobrepõe por clínica.
        Esta tela é apenas informativa — o enforcement em runtime entra em fase 2.
      </p>

      {/* Heatmap matrix */}
      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-admin-border bg-admin-surface-2/50">
                <th className="sticky left-0 z-10 bg-admin-surface-2/95 backdrop-blur text-left px-3 py-2.5 font-semibold text-admin-text-muted whitespace-nowrap min-w-[220px]">Clínica</th>
                <th className="text-left px-3 py-2.5 font-semibold text-admin-text-muted whitespace-nowrap">Plano</th>
                {LIMIT_DEFS.map((l) => (
                  <th key={l.key} className="text-right px-2 py-2.5 font-semibold text-admin-text-muted whitespace-nowrap" title={`${l.key} · ${l.unit}`}>
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClinics.map((c, idx) => (
                <tr key={c.id} className={cn("border-b border-admin-border hover:bg-admin-surface-2/30 transition-colors", idx % 2 === 0 ? "bg-admin-surface" : "bg-admin-surface-2/20")}>
                  <td className="sticky left-0 z-10 bg-inherit font-medium text-admin-text px-3 py-2 whitespace-nowrap">
                    {c.name}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-admin-surface-2 border border-admin-border text-[10px] font-medium text-admin-text-muted uppercase tracking-wide">{c.plan}</span>
                  </td>
                  {LIMIT_DEFS.map((l) => {
                    const u = Number(usage[c.id]?.[USAGE_KEY_MAP[l.key]] ?? 0);
                    const lim = effectiveLimit(c, l.key);
                    const p = pct(u, lim);
                    const st = cellStatus(p, lim);
                    return (
                      <td key={l.key} className="text-right px-2 py-2 whitespace-nowrap">
                        <HeatCell used={u} limit={lim} pct={p} status={st} />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredClinics.length === 0 && (
                <tr>
                  <td colSpan={LIMIT_DEFS.length + 2} className="text-center py-12 text-xs text-admin-text-muted">
                    Nenhuma clínica corresponde aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className="border-t border-admin-border px-3 py-2 flex flex-wrap items-center gap-3 text-[11px] text-admin-text-subtle">
          <span className="font-semibold uppercase tracking-wider">Heatmap:</span>
          <LegendDot tone="ok" label="< 50%" />
          <LegendDot tone="warn" label="50-80%" />
          <LegendDot tone="near" label="80-100%" />
          <LegendDot tone="over" label="excedido" />
          <LegendDot tone="unlimited" label="ilimitado" />
        </div>
      </AdminCard>
    </div>
  );
}

function HeatCell({ used, limit, pct: p, status }: { used: number; limit: number | null; pct: number; status: string }) {
  const styles: Record<string, string> = {
    unlimited: "bg-admin-surface-2 text-admin-text-muted border-admin-border",
    ok: "bg-admin-positive-soft text-admin-positive border-admin-positive/20",
    warn: "bg-admin-warning-soft/60 text-admin-warning border-admin-warning/20",
    near: "bg-admin-warning-soft text-admin-warning border-admin-warning/40 font-semibold",
    over: "bg-admin-negative-soft text-admin-negative border-admin-negative/40 font-bold",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border tabular-nums text-[11px]", styles[status])}
      title={limit != null ? `${used.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")} (${p.toFixed(0)}%)` : `${used.toLocaleString("pt-BR")} (sem limite)`}
    >
      {used.toLocaleString("pt-BR")}
      <span className="opacity-60">/</span>
      {limit != null ? limit.toLocaleString("pt-BR") : "∞"}
    </span>
  );
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  const cls: Record<string, string> = {
    unlimited: "bg-admin-surface-2 border-admin-border",
    ok: "bg-admin-positive-soft border-admin-positive/30",
    warn: "bg-admin-warning-soft/60 border-admin-warning/30",
    near: "bg-admin-warning-soft border-admin-warning/40",
    over: "bg-admin-negative-soft border-admin-negative/40",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-3 w-3 rounded border", cls[tone])} />
      {label}
    </span>
  );
}

function Kpi({ icon: Icon, tone, label, value }: { icon: any; tone: "primary" | "positive" | "negative" | "warning" | "accent"; label: string; value: number }) {
  const toneCls: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    negative: "text-admin-negative bg-admin-negative-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
    accent: "text-admin-accent bg-admin-accent-soft",
  };
  return (
    <AdminCard className="p-4 flex items-center gap-3">
      <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", toneCls[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-admin-text-subtle font-medium">{label}</div>
        <div className="text-2xl font-semibold text-admin-text tabular-nums leading-tight">{value.toLocaleString("pt-BR")}</div>
      </div>
    </AdminCard>
  );
}
