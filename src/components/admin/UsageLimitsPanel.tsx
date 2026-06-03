import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { LIMIT_DEFS, USAGE_KEY_MAP } from "@/lib/admin-plans";

type Clinic = { id: string; name: string; plan: string; settings: any };
type Plan = { code: string; limits: Record<string, number | null> };

export default function UsageLimitsPanel() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

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

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Limites efetivos vêm do plano da clínica; <code>clinics.settings.limits</code> sobrepõe por clínica.
        Esta tela é apenas <strong>informativa</strong> — o enforcement em runtime entra em fase 2.
      </p>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">Clínica</TableHead>
              <TableHead>Plano</TableHead>
              {LIMIT_DEFS.map((l) => <TableHead key={l.key} className="text-right whitespace-nowrap">{l.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium sticky left-0 bg-card">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.plan}</Badge></TableCell>
                {LIMIT_DEFS.map((l) => {
                  const u = usage[c.id]?.[USAGE_KEY_MAP[l.key]] ?? 0;
                  const lim = effectiveLimit(c, l.key);
                  const p = pct(Number(u), lim);
                  const variant = lim == null ? "outline" : p >= 100 ? "destructive" : p >= 80 ? "secondary" : "outline";
                  return (
                    <TableCell key={l.key} className="text-right whitespace-nowrap text-xs">
                      <Badge variant={variant as any}>
                        {Number(u).toLocaleString("pt-BR")} {lim != null ? `/ ${Number(lim).toLocaleString("pt-BR")}` : "/ ∞"}
                      </Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
