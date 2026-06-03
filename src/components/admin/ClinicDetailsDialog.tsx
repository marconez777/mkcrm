import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { LIMIT_DEFS, USAGE_KEY_MAP } from "@/lib/admin-plans";

type Plan = { code: string; limits: Record<string, number | null> };

export default function ClinicDetailsDialog({
  clinic,
  plans,
  onClose,
}: {
  clinic: { id: string; name: string; plan: string; settings: any; status: string; created_at: string } | null;
  plans: Plan[];
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<Record<string, any> | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    setLoading(true);
    (async () => {
      try {
        const [{ data: u }, { data: a }] = await Promise.all([
          supabase.rpc("admin_clinic_usage", { _clinic: clinic.id }),
          supabase.from("audit_log").select("*").eq("clinic_id", clinic.id).order("created_at", { ascending: false }).limit(15),
        ]);
        setUsage((u as any) ?? {});
        setAudit((a as any) ?? []);
      } finally { setLoading(false); }
    })();
  }, [clinic?.id]);

  if (!clinic) return null;

  const plan = plans.find((p) => p.code === clinic.plan);
  const effective = (k: string) => {
    const ov = clinic.settings?.limits?.[k];
    if (ov !== undefined && ov !== null) return Number(ov);
    const v = plan?.limits?.[k];
    return v === null || v === undefined ? null : Number(v);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {clinic.name}
            <Badge variant={clinic.status === "active" ? "default" : "secondary"}>{clinic.status}</Badge>
            <Badge variant="outline">{clinic.plan}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold mb-2">Uso vs limites</h3>
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

            <section>
              <h3 className="text-sm font-semibold mb-2">Auditoria recente</h3>
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
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
