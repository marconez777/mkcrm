import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LIMIT_DEFS, USAGE_KEY_MAP } from "@/lib/admin-plans";

type Plan = { code: string; name?: string; limits: Record<string, number | null> };
type Subscription = {
  id: string; plan_id: string; status: string; source: string;
  trial_ends_at: string | null; current_period_end: string | null;
  cancel_at: string | null; canceled_at: string | null;
  grant_reason: string | null; created_at: string;
};
type LogRow = {
  id: string; created_at: string; from_status: string | null; to_status: string | null;
  source: string | null; reason: string | null;
  from_plan: { code: string } | null; to_plan: { code: string } | null;
};

export default function ClinicDetailsDialog({
  clinic,
  plans,
  onClose,
  onChanged,
}: {
  clinic: { id: string; name: string; plan: string; settings: any; status: string; created_at: string } | null;
  plans: Plan[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [usage, setUsage] = useState<Record<string, any> | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<LogRow[]>([]);
  const [currentPlanCode, setCurrentPlanCode] = useState<string>(clinic?.plan ?? "");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPlan, setNewPlan] = useState<string>("");
  const [trialDays, setTrialDays] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  async function loadAll(clinicId: string) {
    setLoading(true);
    try {
      const [uRes, aRes, sRes, hRes, cRes] = await Promise.all([
        supabase.rpc("admin_clinic_usage", { _clinic: clinicId }),
        supabase.from("audit_log").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(15),
        supabase.from("clinic_subscriptions").select("*").eq("clinic_id", clinicId).eq("is_current", true).maybeSingle(),
        supabase.from("plan_change_log")
          .select("id, created_at, from_status, to_status, source, reason, from_plan:plans!plan_change_log_from_plan_id_fkey(code), to_plan:plans!plan_change_log_to_plan_id_fkey(code)")
          .eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(20),
        supabase.from("clinics").select("plan").eq("id", clinicId).maybeSingle(),
      ]);

      const firstError = uRes.error || aRes.error || sRes.error || hRes.error || cRes.error;
      if (firstError) {
        const msg = (firstError as any).message ?? String(firstError);
        const isAuth = /jwt|forbidden|permission|unauthor/i.test(msg);
        toast.error(isAuth
          ? "Sua sessão expirou. Faça login novamente para continuar."
          : `Falha ao carregar dados: ${msg}`);
      }

      setUsage((uRes.data as any) ?? {});
      setAudit((aRes.data as any) ?? []);
      setSub((sRes.data as any) ?? null);
      setHistory((hRes.data as any) ?? []);
      if ((cRes.data as any)?.plan) setCurrentPlanCode((cRes.data as any).plan);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (clinic) {
      setCurrentPlanCode(clinic.plan);
      loadAll(clinic.id);
    }
  }, [clinic?.id]);

  if (!clinic) return null;

  const plan = plans.find((p) => p.code === currentPlanCode);
  const effective = (k: string) => {
    const ov = clinic.settings?.limits?.[k];
    if (ov !== undefined && ov !== null) return Number(ov);
    const v = plan?.limits?.[k];
    return v === null || v === undefined ? null : Number(v);
  };

  async function applyPlan() {
    if (!newPlan) return toast.error("Escolha um plano");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-apply-plan", {
        body: {
          plan_code: newPlan,
          clinic_ids: [clinic!.id],
          overwrite_features: true,
          overwrite_limits: true,
          trial_days: trialDays ? Number(trialDays) : null,
          expires_at: expiresAt || null,
          grant_reason: reason || null,
        },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      if (data && typeof (data as any).applied === "number" && (data as any).applied === 0) {
        throw new Error("Nenhuma clínica foi atualizada");
      }
      setCurrentPlanCode(newPlan);
      toast.success("Plano aplicado");
      setNewPlan(""); setTrialDays(""); setExpiresAt(""); setReason("");
      await loadAll(clinic!.id);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar plano");
    } finally { setBusy(false); }
  }


  async function revokePlan() {
    if (!confirm("Revogar plano e voltar para Starter (past_due)?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-revoke-plan", {
        body: { clinic_id: clinic!.id, fallback_plan_code: "starter", reason: reason || "Revogado pelo super admin" },
      });
      if (error) throw error;
      toast.success("Plano revogado");
      await loadAll(clinic!.id);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {clinic.name}
            <Badge variant={clinic.status === "active" ? "default" : "secondary"}>{clinic.status}</Badge>
            <Badge variant="outline">{currentPlanCode}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="subscription" className="space-y-3">
            <TabsList>
              <TabsTrigger value="subscription">Plano & Assinatura</TabsTrigger>
              <TabsTrigger value="usage">Uso vs limites</TabsTrigger>
              <TabsTrigger value="audit">Auditoria</TabsTrigger>
            </TabsList>

            <TabsContent value="subscription" className="space-y-4">
              <section className="rounded-md border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Plano atual</span><span className="font-medium">{clinic.plan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{sub?.status ?? "—"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fonte</span><Badge variant="outline">{sub?.source ?? "—"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trial até</span><span>{fmt(sub?.trial_ends_at ?? null)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expira em</span><span>{fmt(sub?.cancel_at ?? null)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span className="text-right max-w-[60%] truncate">{sub?.grant_reason ?? "—"}</span></div>
              </section>

              <section className="rounded-md border p-3 space-y-3">
                <h4 className="text-sm font-semibold">Aplicar / trocar plano (concessão manual)</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Plano</Label>
                    <Select value={newPlan} onValueChange={setNewPlan}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>{plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name ?? p.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias de trial (opcional)</Label>
                    <Input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="Ex: 7" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expira em (opcional)</Label>
                    <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Motivo</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Cortesia 30d" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !newPlan} onClick={applyPlan}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Aplicar plano</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={revokePlan}>Revogar plano atual</Button>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold mb-2">Histórico de mudanças</h4>
                <div className="rounded-md border divide-y">
                  {history.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sem registros</div>}
                  {history.map((r) => (
                    <div key={r.id} className="px-3 py-2 text-xs grid grid-cols-[120px_1fr_auto] gap-2 items-baseline">
                      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      <span>
                        <span className="text-muted-foreground">{r.from_plan?.code ?? "—"}</span>
                        {" → "}
                        <span className="font-medium">{r.to_plan?.code ?? "—"}</span>
                        {r.to_status && <Badge variant="outline" className="ml-2">{r.to_status}</Badge>}
                        {r.reason && <span className="block text-muted-foreground">{r.reason}</span>}
                      </span>
                      <Badge variant="outline">{r.source ?? "—"}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="usage">
              <section>
                <div className="grid sm:grid-cols-2 gap-2">
                  {LIMIT_DEFS.map((l) => {
                    const used = Number(usage?.[USAGE_KEY_MAP[l.key]] ?? 0);
                    const lim = effective(l.key);
                    const pct = lim ? Math.min(100, (used / lim) * 100) : 0;
                    const color = !lim ? "bg-muted" : pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";
                    return (
                      <div key={l.key} className="rounded-md border p-2">
                        <div className="flex justify-between text-xs">
                          <span>{l.label}</span>
                          <span className="text-muted-foreground">{used.toLocaleString("pt-BR")} / {lim != null ? lim.toLocaleString("pt-BR") : "∞"}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${color}`} style={{ width: lim ? `${pct}%` : "100%", opacity: lim ? 1 : 0.3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="audit">
              <div className="rounded-md border divide-y">
                {audit.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sem registros</div>}
                {audit.map((r) => (
                  <div key={r.id} className="px-3 py-2 text-xs flex gap-3 items-baseline">
                    <span className="text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    <span className="font-medium">{r.action}</span>
                    <span className="text-muted-foreground truncate">{r.entity ?? ""}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
