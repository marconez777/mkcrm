import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, Plus, Download, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CreditCard, Sparkles, Receipt, Wallet, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { AdminCard } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

type Kpis = {
  revenue_month: number; revenue_total: number; overdue_total: number; overdue_count: number;
  open_count: number; paid_count_month: number; mrr: number; arr: number;
  subscriptions_active: number; subscriptions_trial: number; subscriptions_manual: number; subscriptions_past_due: number;
};
type Overdue = { invoice_id: string; clinic_id: string; clinic_name: string; amount_brl: number; due_date: string; days_overdue: number; description: string | null };
type PlanDist = { plan_code: string; plan_name: string; clinics_count: number; price_monthly: number };
type Series = { month: string; revenue: number; invoices_paid: number };
type Invoice = { id: string; clinic_id: string; amount_brl: number; status: string; due_date: string | null; paid_at: string | null; payment_method: string | null; description: string | null; issued_at: string };

const brl = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlFull = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (n: number) => Number(n ?? 0).toLocaleString("pt-BR");

const PIE_COLORS = [
  "hsl(var(--admin-primary))",
  "hsl(var(--admin-accent))",
  "hsl(var(--admin-positive))",
  "hsl(var(--admin-warning))",
  "hsl(var(--admin-negative))",
  "hsl(var(--admin-text-muted))",
];

function FinKpi({
  icon: Icon, label, value, hint, delta, accent = "primary", spark,
}: {
  icon: any; label: string; value: string; hint?: string; delta?: number;
  accent?: "primary" | "positive" | "negative" | "warning" | "accent";
  spark?: number[];
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
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  return (
    <div className="rounded-[var(--admin-radius)] bg-admin-surface border border-admin-border shadow-admin-card p-4">
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
          <div className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            delta >= 0 ? "text-admin-positive bg-admin-positive-soft" : "text-admin-negative bg-admin-negative-soft"
          )}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {(delta >= 0 ? "+" : "") + delta.toFixed(1)}%
          </div>
        )}
      </div>
      {data.length > 1 && (
        <div className="mt-3 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={strokeMap[accent]} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

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

export default function FinancePanel() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [dist, setDist] = useState<PlanDist[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [fClinic, setFClinic] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fStatus, setFStatus] = useState("open");
  const [fDue, setFDue] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fDescription, setFDescription] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [{ data: k }, { data: o }, { data: d }, { data: s }, { data: r }, { data: c }] = await Promise.all([
        supabase.rpc("admin_finance_kpis"),
        supabase.rpc("admin_overdue_list"),
        supabase.rpc("admin_plan_distribution"),
        supabase.rpc("admin_revenue_timeseries", { _months: 12 }),
        supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(30),
        supabase.from("clinics").select("id, name").order("name"),
      ]);
      setKpis(k as any);
      setOverdue((o as any) ?? []);
      setDist((d as any) ?? []);
      setSeries((s as any) ?? []);
      setRecent((r as any) ?? []);
      setClinics((c as any) ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createInvoice() {
    if (!fClinic || !fAmount) return toast.error("Empresa e valor obrigatórios");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-invoice", {
        body: { action: "create", clinic_id: fClinic, amount_brl: Number(fAmount), status: fStatus, due_date: fDue || null, payment_method: fMethod || null, description: fDescription || null },
      });
      if (error) throw error;
      toast.success(fStatus === "paid" ? "Pagamento registrado" : "Fatura criada");
      setOpenCreate(false);
      setFClinic(""); setFAmount(""); setFStatus("open"); setFDue(""); setFMethod(""); setFDescription("");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function markPaid(id: string) {
    const method = prompt("Método de pagamento (PIX, Transferência, Boleto…)") ?? null;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-invoice", { body: { action: "mark_paid", invoice_id: id, payment_method: method } });
      if (error) throw error;
      toast.success("Fatura marcada como paga");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function voidInvoice(id: string) {
    if (!confirm("Anular esta fatura?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-invoice", { body: { action: "void", invoice_id: id } });
      if (error) throw error;
      toast.success("Fatura anulada");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  function exportOverdue() {
    downloadCsv(`inadimplentes-${new Date().toISOString().slice(0, 10)}.csv`,
      overdue.map((o) => ({ clinica: o.clinic_name, valor_brl: o.amount_brl, vencimento: o.due_date, dias_atraso: o.days_overdue, descricao: o.description ?? "" })));
  }

  const revSpark = useMemo(() => series.map((s) => Number(s.revenue) || 0), [series]);
  const revDelta = useMemo(() => {
    if (series.length < 2) return undefined;
    const last = Number(series[series.length - 1]?.revenue) || 0;
    const prev = Number(series[series.length - 2]?.revenue) || 0;
    if (prev === 0) return last > 0 ? 100 : 0;
    return ((last - prev) / prev) * 100;
  }, [series]);

  const seriesData = useMemo(() => series.map((s) => ({
    month: new Date(s.month).toLocaleDateString("pt-BR", { month: "short" }),
    revenue: Number(s.revenue) || 0,
    invoices: Number(s.invoices_paid) || 0,
  })), [series]);

  const pieData = useMemo(() => dist.map((d) => ({
    name: d.plan_name,
    value: Number(d.price_monthly) * Number(d.clinics_count),
    clinics: Number(d.clinics_count),
  })), [dist]);
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setOpenCreate(true)} className="bg-admin-primary hover:bg-admin-primary/90 text-admin-primary-foreground">
          <Plus className="mr-1 h-3.5 w-3.5" />Registrar fatura
        </Button>
        <Button size="sm" variant="outline" onClick={exportOverdue} disabled={overdue.length === 0} className="border-admin-border">
          <Download className="mr-1 h-3.5 w-3.5" />Exportar inadimplentes
        </Button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-admin-text-muted" />}
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinKpi
          icon={DollarSign} label="MRR" accent="positive"
          value={brl(kpis?.mrr ?? 0)}
          hint={`ARR ${brl(kpis?.arr ?? 0)}`}
          spark={revSpark}
        />
        <FinKpi
          icon={Receipt} label="Receita do mês" accent="primary"
          value={brl(kpis?.revenue_month ?? 0)}
          hint={`${kpis?.paid_count_month ?? 0} faturas pagas`}
          delta={revDelta}
        />
        <FinKpi
          icon={AlertTriangle} label="Inadimplência" accent={kpis?.overdue_count ? "negative" : "positive"}
          value={brl(kpis?.overdue_total ?? 0)}
          hint={`${kpis?.overdue_count ?? 0} fatura(s) vencidas`}
        />
        <FinKpi
          icon={CreditCard} label="Assinaturas" accent="accent"
          value={fmt(kpis?.subscriptions_active ?? 0)}
          hint={`trial ${kpis?.subscriptions_trial ?? 0} · manual ${kpis?.subscriptions_manual ?? 0} · atraso ${kpis?.subscriptions_past_due ?? 0}`}
        />
      </div>

      {/* Revenue area + plan donut */}
      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard
          title="Receita mensal (12 meses)"
          className="lg:col-span-2"
          action={<span className="text-[11px] text-admin-text-subtle">faturas pagas por mês</span>}
        >
          {seriesData.length === 0 ? (
            <div className="text-center py-12 text-xs text-admin-text-muted">Sem faturas pagas ainda.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--admin-positive))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--admin-positive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--admin-text-muted))" }} axisLine={false} tickLine={false} tickFormatter={(v) => brl(v)} />
                  <Tooltip
                    formatter={(v: any) => brlFull(Number(v))}
                    contentStyle={{
                      background: "hsl(var(--admin-surface-elev))",
                      border: "1px solid hsl(var(--admin-border))",
                      borderRadius: 8, fontSize: 12, color: "hsl(var(--admin-text))",
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--admin-positive))" strokeWidth={2} fill="url(#gRev)" name="Receita" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Distribuição por plano">
          {pieData.length === 0 ? (
            <div className="text-center py-12 text-xs text-admin-text-muted">Sem planos atribuídos.</div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-44 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => brlFull(Number(v))}
                      contentStyle={{
                        background: "hsl(var(--admin-surface-elev))",
                        border: "1px solid hsl(var(--admin-border))",
                        borderRadius: 8, fontSize: 12, color: "hsl(var(--admin-text))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] text-admin-text-subtle uppercase tracking-wider">MRR estimado</div>
                  <div className="text-base font-semibold text-admin-text tabular-nums">{brl(pieTotal)}</div>
                </div>
              </div>
              <div className="mt-3 w-full space-y-1.5">
                {pieData.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-admin-text">
                      <span className="h-2 w-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {p.name}
                    </span>
                    <span className="text-admin-text-muted tabular-nums">{p.clinics} · {brl(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Overdue */}
      <SectionCard
        title="Inadimplentes"
        action={overdue.length > 0 && <Badge className="bg-admin-negative-soft text-admin-negative border-0">{overdue.length} fatura(s)</Badge>}
      >
        {overdue.length === 0 ? (
          <div className="text-center py-10 text-xs text-admin-positive flex flex-col items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Nenhuma fatura vencida. Tudo em dia.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-admin-border hover:bg-transparent">
                <TableHead>Empresa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.map((o) => (
                <TableRow key={o.invoice_id} className="border-admin-border">
                  <TableCell className="font-medium text-admin-text">{o.clinic_name}</TableCell>
                  <TableCell className="tabular-nums">{brlFull(Number(o.amount_brl))}</TableCell>
                  <TableCell className="text-xs text-admin-text-muted">{o.due_date}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "border-0",
                      o.days_overdue > 30 ? "bg-admin-negative-soft text-admin-negative" : "bg-admin-warning-soft text-admin-warning"
                    )}>{o.days_overdue}d</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" className="h-7 border-admin-border" disabled={busy} onClick={() => markPaid(o.invoice_id)}>Marcar paga</Button>
                    <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={() => voidInvoice(o.invoice_id)}>Anular</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Recent invoices */}
      <SectionCard
        title="Últimas faturas"
        action={<span className="text-[11px] text-admin-text-subtle">{recent.length} mais recentes</span>}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-admin-border hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Vencimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-admin-text-muted text-xs py-8">Sem faturas registradas.</TableCell></TableRow>
            )}
            {recent.map((i) => (
              <TableRow key={i.id} className="border-admin-border">
                <TableCell className="text-xs text-admin-text-muted whitespace-nowrap">{new Date(i.issued_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-xs text-admin-text truncate max-w-[280px]">{i.description ?? "—"}</TableCell>
                <TableCell className="tabular-nums font-medium">{brlFull(Number(i.amount_brl))}</TableCell>
                <TableCell>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs",
                    i.status === "paid" && "text-admin-positive",
                    i.status === "overdue" && "text-admin-negative",
                    i.status === "open" && "text-admin-warning",
                    i.status === "draft" && "text-admin-text-subtle",
                    i.status === "void" && "text-admin-text-subtle",
                  )}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      i.status === "paid" && "bg-admin-positive",
                      i.status === "overdue" && "bg-admin-negative",
                      i.status === "open" && "bg-admin-warning",
                      (i.status === "draft" || i.status === "void") && "bg-admin-text-subtle",
                    )} />
                    {i.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-admin-text-muted">{i.payment_method ?? "—"}</TableCell>
                <TableCell className="text-xs text-admin-text-muted">{i.due_date ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento / fatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Empresa</Label>
              <Select value={fClinic} onValueChange={setFClinic}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{clinics.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (BRL)</Label>
                <Input type="number" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paga</SelectItem>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Método</Label>
                <Input value={fMethod} onChange={(e) => setFMethod(e.target.value)} placeholder="PIX, Transferência…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={fDescription} onChange={(e) => setFDescription(e.target.value)} placeholder="Ex: Mensalidade Pro nov/26" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createInvoice} disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
