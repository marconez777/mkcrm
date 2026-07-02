import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign } from "lucide-react";

type Limits = {
  daily_limit_usd: number;
  blocked: boolean;
  blocked_reason: string | null;
};

export function CostsPanel({ agentId, clinicId }: { agentId: string; clinicId: string }) {
  const [todayUsd, setTodayUsd] = useState(0);
  const [monthUsd, setMonthUsd] = useState(0);
  const [calls24h, setCalls24h] = useState(0);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRes, monthRes, callsRes, limitsRes] = await Promise.all([
      supabase.from("ai_usage")
        .select("cost_usd")
        .eq("agent_id", agentId)
        .gte("created_at", startOfDay.toISOString()),
      supabase.from("ai_usage")
        .select("cost_usd")
        .eq("agent_id", agentId)
        .gte("created_at", startOfMonth.toISOString()),
      supabase.from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabase.from("ai_spend_limits").select("daily_limit_usd, blocked, blocked_reason").eq("clinic_id", clinicId).maybeSingle(),
    ]);

    const sum = (rows: any[]) => (rows ?? []).reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
    setTodayUsd(sum((todayRes.data as any[]) ?? []));
    setMonthUsd(sum((monthRes.data as any[]) ?? []));
    setCalls24h(callsRes.count ?? 0);
    setLimits((limitsRes.data as Limits) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, clinicId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const dailyLimit = Number(limits?.daily_limit_usd ?? 0);
  const pct = dailyLimit > 0 ? Math.min(100, (todayUsd / dailyLimit) * 100) : 0;
  const overLimit = dailyLimit > 0 && todayUsd >= dailyLimit;

  return (
    <div className="space-y-3">
      {limits?.blocked && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <Badge variant="destructive" className="mb-1">Empresa bloqueada</Badge>
          <p>{limits.blocked_reason ?? "Limite atingido. Reative em Configurações → Gastos de IA."}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Hoje" value={`US$ ${todayUsd.toFixed(4)}`} icon />
        <Stat label="Mês atual" value={`US$ ${monthUsd.toFixed(2)}`} icon />
        <Stat label="Chamadas 24h" value={String(calls24h)} />
      </div>

      {dailyLimit > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Cota diária da empresa (compartilhada): US$ {dailyLimit.toFixed(2)}
            </span>
            <Badge variant={overLimit ? "destructive" : pct > 80 ? "secondary" : "outline"} className="text-[10px]">
              {pct.toFixed(0)}%
            </Badge>
          </div>
          <Progress value={pct} className={overLimit ? "[&>div]:bg-destructive" : ""} />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Custos são somados a partir de chamadas reais ao provedor. O limite é por empresa e bloqueia
        automaticamente quando atingido (se ativado em Configurações).
      </p>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="rounded border bg-muted/20 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon && <DollarSign className="h-3 w-3" />} {label}
      </p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}
