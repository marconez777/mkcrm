import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";

type Kpis = {
  revenue_month: number; revenue_total: number; overdue_total: number; overdue_count: number;
  open_count: number; paid_count_month: number; mrr: number; arr: number;
  subscriptions_active: number; subscriptions_trial: number; subscriptions_manual: number; subscriptions_past_due: number;
};
type Overdue = { invoice_id: string; clinic_id: string; clinic_name: string; amount_brl: number; due_date: string; days_overdue: number; description: string | null };
type PlanDist = { plan_code: string; plan_name: string; clinics_count: number; price_monthly: number };
type Series = { month: string; revenue: number; invoices_paid: number };
type Invoice = { id: string; clinic_id: string; amount_brl: number; status: string; due_date: string | null; paid_at: string | null; payment_method: string | null; description: string | null; issued_at: string };

const brl = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  // form
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
    if (!fClinic || !fAmount) return toast.error("Clínica e valor obrigatórios");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-invoice", {
        body: {
          action: "create",
          clinic_id: fClinic,
          amount_brl: Number(fAmount),
          status: fStatus,
          due_date: fDue || null,
          payment_method: fMethod || null,
          description: fDescription || null,
        },
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
      const { error } = await supabase.functions.invoke("admin-invoice", {
        body: { action: "mark_paid", invoice_id: id, payment_method: method },
      });
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

  const seriesMax = Math.max(1, ...series.map((s) => Number(s.revenue) || 0));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="mr-1 h-3.5 w-3.5" />Registrar pagamento / fatura</Button>
        <Button size="sm" variant="outline" onClick={exportOverdue} disabled={overdue.length === 0}><Download className="mr-1 h-3.5 w-3.5" />Exportar inadimplentes</Button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Receita do mês</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{brl(kpis?.revenue_month ?? 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">MRR</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{brl(kpis?.mrr ?? 0)}</div><div className="text-xs text-muted-foreground">ARR {brl(kpis?.arr ?? 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Inadimplência</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{brl(kpis?.overdue_total ?? 0)}</div><div className="text-xs text-muted-foreground">{kpis?.overdue_count ?? 0} faturas</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Assinaturas ativas</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{kpis?.subscriptions_active ?? 0}</div><div className="text-xs text-muted-foreground">trial {kpis?.subscriptions_trial ?? 0} · manual {kpis?.subscriptions_manual ?? 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Receita mensal (12 meses)</CardTitle></CardHeader>
        <CardContent>
          {series.length === 0 ? <div className="text-xs text-muted-foreground">Sem faturas pagas ainda.</div> : (
            <div className="flex items-end gap-2 h-32">
              {series.map((s) => {
                const h = (Number(s.revenue) / seriesMax) * 100;
                return (
                  <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary rounded-t" style={{ height: `${h}%`, minHeight: 2 }} title={brl(Number(s.revenue))} />
                    <div className="text-[10px] text-muted-foreground">{new Date(s.month).toLocaleDateString("pt-BR", { month: "short" })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Inadimplentes</CardTitle></CardHeader>
        <CardContent>
          {overdue.length === 0 ? <div className="text-xs text-muted-foreground">Nenhuma fatura vencida 🎉</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Clínica</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Atraso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {overdue.map((o) => (
                  <TableRow key={o.invoice_id}>
                    <TableCell className="font-medium">{o.clinic_name}</TableCell>
                    <TableCell>{brl(Number(o.amount_brl))}</TableCell>
                    <TableCell>{o.due_date}</TableCell>
                    <TableCell><Badge variant="destructive">{o.days_overdue}d</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => markPaid(o.invoice_id)}>Marcar paga</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => voidInvoice(o.invoice_id)}>Anular</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por plano</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Plano</TableHead><TableHead className="text-right">Clínicas</TableHead><TableHead className="text-right">MRR (estimado)</TableHead></TableRow></TableHeader>
              <TableBody>
                {dist.map((d) => (
                  <TableRow key={d.plan_code}>
                    <TableCell>{d.plan_name}</TableCell>
                    <TableCell className="text-right">{d.clinics_count}</TableCell>
                    <TableCell className="text-right">{brl(Number(d.price_monthly) * Number(d.clinics_count))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Últimas faturas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Método</TableHead></TableRow></TableHeader>
              <TableBody>
                {recent.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">Sem faturas</TableCell></TableRow>}
                {recent.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{new Date(i.issued_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{brl(Number(i.amount_brl))}</TableCell>
                    <TableCell><Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "outline"}>{i.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.payment_method ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento / fatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Clínica</Label>
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
