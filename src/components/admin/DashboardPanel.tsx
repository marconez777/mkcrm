import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Loader2, Building2, Users, MessageSquare, Sparkles, Mail, UserPlus,
  TrendingUp, TrendingDown, ArrowUpRight, AlertTriangle, DollarSign, Activity, ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, BarChart, Bar, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------- Types ---------------------------------- */
type Overview = {
  clinics: { total: number; active: number; suspended: number; new_30d: number };
  users: { total: number; new_30d: number };
  messages_30d: { total: number; outbound: number; inbound: number };
  ai_30d: { cost_usd: number; tokens: number; requests: number };
  email_30d: { sent: number; opened: number; clicked: number; bounced: number };
  leads_30d: { total: number };
};
type TopClinic = { clinic_id: string; clinic_name: string; messages_30d: number; ai_cost_usd_30d: number; leads_30d: number };
type DailyPoint = { day: string; raw: string; messages: number; leads: number; ai_cost_usd: number };
type FinKpis = {
  revenue_month: number; mrr: number; arr: number;
  overdue_total: number; overdue_count: number;
  subscriptions_active: number; subscriptions_trial: number; subscriptions_past_due: number;
};

/* ------------------------------ Helpers --------------------------------- */
const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const brl = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctStr = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function splitDelta(values: number[]) {
  if (!values.length) return { delta: 0, current: 0, previous: 0 };
  const half = Math.floor(values.length / 2);
  const prev = values.slice(0, half).reduce((a, b) => a + b, 0);
  const cur = values.slice(half).reduce((a, b) => a + b, 0);
  const delta = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
  return { delta, current: cur, previous: prev };
}

/* ------------------------------- KPI Card ------------------------------- */
function KpiCard({
  icon: Icon, label, value, hint, sparkData, delta, accent = "primary", to,
}: {
  icon: any; label: string; value: string; hint?: string;
  sparkData?: number[]; delta?: number;
  accent?: "primary" | "positive" | "negative" | "warning" | "accent";
  to?: string;
}) {
  const accentMap: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    negative: "text-admin-negative bg-admin-negative-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
    accent: "text-admin-accent bg-admin-accent-soft",
  };
  const strokeMap: Record<string, string> = {
    primary: "hsl(var(--admin-primary))",
    positive: "hsl(var(--admin-positive))",
    negative: "hsl(var(--admin-negative))",
    warning: "hsl(var(--admin-warning))",
    accent: "hsl(var(--admin-accent))",
  };
  const spark = (sparkData ?? []).map((v, i) => ({ i, v }));
  const Wrap: any = to ? Link : "div";
  return (
    <Wrap
      to={to}
      className={cn(
        "group relative overflow-hidden rounded-[var(--admin-radius)] bg-admin-surface border border-admin-border shadow-admin-card p-4 transition hover:shadow-admin-elev",
        to && "cursor-pointer hover:border-admin-border-strong"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", accentMap[accent])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] uppercase tracking-wider text-admin-text-subtle font-medium">{label}</span>
          </div>
          <div className="text-2xl font-semibold text-admin-text tabular-nums leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-admin-text-muted">{hint}</div>}
        </div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              delta >= 0 ? "text-admin-positive bg-admin-positive-soft" : "text-admin-negative bg-admin-negative-soft"
            )}
            title="Variação vs período anterior"
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pctStr(delta)}
          </div>
        )}
      </div>
      {spark.length > 1 && (
        <div className="mt-3 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line type="monotone" dataKey="v" stroke={strokeMap[accent]} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {to && (
        <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-admin-text-subtle opacity-0 group-hover:opacity-100 transition" />
      )}
    </Wrap>
  );
}

/* ---------------------------- Section Card ------------------------------ */
function SectionCard({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--admin-radius)] bg-admin-surface border border-admin-border shadow-admin-card", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-admin-border">
        <h3 className="text-sm font-semibold text-admin-text">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ------------------------------ Component ------------------------------- */
const RANGES = [
  { id: 7, label: "7d" },
  { id: 30, label: "30d" },
  { id: 90, label: "90d" },
] as const;

export default function DashboardPanel() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [fin, setFin] = useState<FinKpis | null>(null);
  const [top, setTop] = useState<TopClinic[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: ov }, { data: t }, { data: d }, finRes] = await Promise.all([
          supabase.rpc("admin_overview_metrics"),
          supabase.rpc("admin_top_clinics", { _limit: 8 }),
          supabase.rpc("admin_daily_metrics", { _days: range }),
          Promise.resolve(supabase.rpc("admin_finance_kpis")).then((r) => r, () => ({ data: null as any })),
        ]);
        const fk = (finRes as any)?.data ?? null;
        if (!mounted) return;
        setData(ov as any);
        setFin((fk as any) ?? null);
        setTop((t as any) ?? []);
        setDaily(
          ((d as any) ?? []).map((r: any) => ({
            raw: r.day,
            day: new Date(r.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            messages: Number(r.messages),
            leads: Number(r.leads),
            ai_cost_usd: Number(r.ai_cost_usd),
          }))
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [range]);

  const deltas = useMemo(() => ({
    messages: splitDelta(daily.map((d) => d.messages)),
    leads: splitDelta(daily.map((d) => d.leads)),
    ai: splitDelta(daily.map((d) => d.ai_cost_usd)),
  }), [daily]);

  const sparks = useMemo(() => ({
    messages: daily.map((d) => d.messages),
    leads: daily.map((d) => d.leads),
    ai: daily.map((d) => d.ai_cost_usd),
  }), [daily]);

  const aiBudget = 50; // USD/dia — referência visual
  const topMax = Math.max(1, ...top.map((t) => Number(t.messages_30d) || 0));
  const totalEmails = data?.email_30d.sent ?? 0;
  const openRate = totalEmails > 0 ? ((data!.email_30d.opened / totalEmails) * 100) : 0;
  const bounceRate = totalEmails > 0 ? ((data!.email_30d.bounced / totalEmails) * 100) : 0;
  const churnRisk = fin?.subscriptions_past_due ?? 0;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-admin-text-muted" />
      </div>
    );
  }
  if (!data) return <div className="text-sm text-admin-text-muted">Sem dados disponíveis.</div>;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-admin-text-muted">
          Período de análise
          {loading && <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />}
        </div>
        <div className="inline-flex rounded-md border border-admin-border bg-admin-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition",
                range === r.id ? "bg-admin-primary text-admin-primary-foreground" : "text-admin-text-muted hover:text-admin-text"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign} label="MRR" accent="positive"
          value={brl(fin?.mrr ?? 0)}
          hint={`ARR ${brl(fin?.arr ?? 0)} · ${fin?.subscriptions_active ?? 0} assinaturas ativas`}
          to="/admin/finance"
        />
        <KpiCard
          icon={Building2} label="Clínicas" accent="primary"
          value={fmt(data.clinics.total)}
          hint={`${data.clinics.active} ativas · ${data.clinics.suspended} suspensas · +${data.clinics.new_30d} em 30d`}
          to="/admin/clinics"
        />
        <KpiCard
          icon={Users} label="Usuários" accent="accent"
          value={fmt(data.users.total)}
          hint={`+${data.users.new_30d} novos em 30d`}
          to="/admin/users"
        />
        <KpiCard
          icon={UserPlus} label={`Leads (${range}d)`} accent="primary"
          value={fmt(data.leads_30d.total)}
          delta={deltas.leads.delta}
          sparkData={sparks.leads}
        />
        <KpiCard
          icon={MessageSquare} label={`Mensagens (${range}d)`} accent="accent"
          value={fmt(data.messages_30d.total)}
          hint={`${fmt(data.messages_30d.outbound)} env · ${fmt(data.messages_30d.inbound)} rec`}
          delta={deltas.messages.delta}
          sparkData={sparks.messages}
        />
        <KpiCard
          icon={Sparkles} label="IA · custo 30d" accent="warning"
          value={usd(data.ai_30d.cost_usd)}
          hint={`${fmt(data.ai_30d.requests)} req · ${fmt(data.ai_30d.tokens)} tokens`}
          delta={deltas.ai.delta}
          sparkData={sparks.ai}
        />
        <KpiCard
          icon={Mail} label="E-mails (30d)" accent="primary"
          value={fmt(totalEmails)}
          hint={`abertura ${openRate.toFixed(1)}% · bounce ${bounceRate.toFixed(1)}%`}
        />
        <KpiCard
          icon={ShieldAlert} label="Risco churn" accent={churnRisk > 0 ? "negative" : "positive"}
          value={fmt(churnRisk)}
          hint={`${fmt(fin?.overdue_count ?? 0)} faturas vencidas · ${brl(fin?.overdue_total ?? 0)}`}
          to="/admin/finance"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard
          title={`Mensagens & Leads (${range}d)`}
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3 text-[11px] text-admin-text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-admin-primary" />Mensagens</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-admin-accent" />Leads</span>
            </div>
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--admin-primary))" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(var(--admin-primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--admin-accent))" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(var(--admin-accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--admin-surface-elev))",
                    border: "1px solid hsl(var(--admin-border))",
                    borderRadius: 8, fontSize: 12, color: "hsl(var(--admin-text))",
                  }}
                />
                <Area type="monotone" dataKey="messages" stroke="hsl(var(--admin-primary))" strokeWidth={2} fill="url(#gMsg)" name="Mensagens" />
                <Area type="monotone" dataKey="leads" stroke="hsl(var(--admin-accent))" strokeWidth={2} fill="url(#gLeads)" name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title={`Custo IA / dia (USD)`}
          action={<span className="text-[11px] text-admin-text-subtle">budget ${aiBudget}/d</span>}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v: any) => `$${Number(v).toFixed(2)}`}
                  contentStyle={{
                    background: "hsl(var(--admin-surface-elev))",
                    border: "1px solid hsl(var(--admin-border))",
                    borderRadius: 8, fontSize: 12, color: "hsl(var(--admin-text))",
                  }}
                />
                <ReferenceLine y={aiBudget} stroke="hsl(var(--admin-warning))" strokeDasharray="4 4" />
                <Bar dataKey="ai_cost_usd" fill="hsl(var(--admin-warning))" radius={[3, 3, 0, 0]} name="USD" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Top clinics + system health */}
      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard
          title="Top clínicas por mensagens (30d)"
          className="lg:col-span-2"
          action={<Link to="/admin/clinics" className="text-[11px] text-admin-primary hover:underline inline-flex items-center gap-0.5">Ver todas <ArrowUpRight className="h-3 w-3" /></Link>}
        >
          {top.length === 0 ? (
            <div className="text-center text-admin-text-muted text-xs py-8">Sem dados de atividade.</div>
          ) : (
            <div className="space-y-2.5">
              {top.map((r, i) => {
                const w = (Number(r.messages_30d) / topMax) * 100;
                return (
                  <div key={r.clinic_id} className="grid grid-cols-[24px_1fr_auto_auto] gap-3 items-center text-sm">
                    <span className="text-[11px] text-admin-text-subtle tabular-nums">{(i + 1).toString().padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <div className="truncate text-admin-text font-medium">{r.clinic_name}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-admin-surface-2 overflow-hidden">
                        <div className="h-full bg-admin-primary rounded-full" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-admin-text-muted tabular-nums w-16 text-right">{fmt(Number(r.leads_30d))} leads</div>
                    <div className="text-xs text-admin-text tabular-nums w-24 text-right">
                      {fmt(Number(r.messages_30d))} <span className="text-admin-text-subtle">msg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-3">
          <SectionCard title="Saúde da plataforma">
            <div className="space-y-3">
              <HealthRow icon={Activity} label="Assinaturas ativas" value={fmt(fin?.subscriptions_active ?? 0)} tone="positive" />
              <HealthRow icon={Sparkles} label="Trials" value={fmt(fin?.subscriptions_trial ?? 0)} tone="primary" />
              <HealthRow icon={AlertTriangle} label="Em atraso (past due)" value={fmt(fin?.subscriptions_past_due ?? 0)} tone={(fin?.subscriptions_past_due ?? 0) > 0 ? "negative" : "positive"} />
              <HealthRow icon={Mail} label="Bounces 30d" value={fmt(data.email_30d.bounced)} tone={data.email_30d.bounced > 0 ? "warning" : "positive"} />
            </div>
          </SectionCard>

          <SectionCard title="Alertas">
            <div className="space-y-2 text-xs">
              {(fin?.overdue_count ?? 0) > 0 && (
                <AlertLine tone="negative" text={`${fin!.overdue_count} fatura(s) vencidas — ${brl(fin!.overdue_total)}`} to="/admin/finance" />
              )}
              {data.ai_30d.cost_usd > aiBudget * 30 * 0.8 && (
                <AlertLine tone="warning" text={`Custo IA próximo do limite mensal (${usd(data.ai_30d.cost_usd)})`} to="/admin/usage" />
              )}
              {data.clinics.suspended > 0 && (
                <AlertLine tone="warning" text={`${data.clinics.suspended} clínica(s) suspensa(s)`} to="/admin/clinics" />
              )}
              {bounceRate > 5 && (
                <AlertLine tone="negative" text={`Taxa de bounce alta (${bounceRate.toFixed(1)}%)`} to="/admin/observability" />
              )}
              {(fin?.overdue_count ?? 0) === 0 && data.clinics.suspended === 0 && bounceRate <= 5 && (
                <div className="flex items-center gap-2 text-admin-positive">
                  <span className="h-1.5 w-1.5 rounded-full bg-admin-positive" /> Sem alertas críticos no momento.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Small bits ------------------------------- */
function HealthRow({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "positive" | "primary" | "negative" | "warning" }) {
  const toneCls: Record<string, string> = {
    positive: "text-admin-positive bg-admin-positive-soft",
    primary: "text-admin-primary bg-admin-primary-soft",
    negative: "text-admin-negative bg-admin-negative-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md", toneCls[tone])}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-xs text-admin-text-muted">{label}</span>
      </div>
      <span className="text-sm font-semibold text-admin-text tabular-nums">{value}</span>
    </div>
  );
}

function AlertLine({ tone, text, to }: { tone: "negative" | "warning"; text: string; to: string }) {
  const cls = tone === "negative" ? "border-admin-negative/40 bg-admin-negative-soft text-admin-negative" : "border-admin-warning/40 bg-admin-warning-soft text-admin-warning";
  return (
    <Link to={to} className={cn("flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 hover:opacity-90", cls)}>
      <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" />{text}</span>
      <ArrowUpRight className="h-3 w-3 shrink-0" />
    </Link>
  );
}
