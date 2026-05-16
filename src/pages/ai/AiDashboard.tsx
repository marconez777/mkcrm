import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Coins, MessageSquare, Zap } from "lucide-react";

type Stats = {
  messages7d: number;
  totalTokens30d: number;
  activeAgents: number;
  activeAutomations: number;
  perDay: { day: string; count: number }[];
};

export default function AiDashboard() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      setLoading(true);
      const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [usage7, usage30, agents, autos] = await Promise.all([
        supabase.from("ai_usage").select("created_at").eq("clinic_id", clinicId).gte("created_at", since7),
        supabase.from("ai_usage").select("total_tokens").eq("clinic_id", clinicId).gte("created_at", since30),
        supabase.from("agents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("enabled", true),
        supabase.from("automations").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("enabled", true),
      ]);
      const rows = usage7.data ?? [];
      const byDay = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        byDay.set(d, 0);
      }
      rows.forEach((r: any) => {
        const d = String(r.created_at).slice(0, 10);
        if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1);
      });
      const totalTokens = (usage30.data ?? []).reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0);
      setStats({
        messages7d: rows.length,
        totalTokens30d: totalTokens,
        activeAgents: agents.count ?? 0,
        activeAutomations: autos.count ?? 0,
        perDay: Array.from(byDay.entries()).map(([day, count]) => ({ day, count })),
      });
      setLoading(false);
    })();
  }, [clinicId]);

  const max = Math.max(1, ...(stats?.perDay.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-6 py-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Mensagens IA (7d)" value={stats?.messages7d ?? 0} loading={loading} />
        <StatCard icon={Coins} label="Tokens (30d)" value={stats?.totalTokens30d ?? 0} loading={loading} />
        <StatCard icon={Bot} label="Agentes ativos" value={stats?.activeAgents ?? 0} loading={loading} />
        <StatCard icon={Zap} label="Automações ativas" value={stats?.activeAutomations ?? 0} loading={loading} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Mensagens IA por dia (últimos 7 dias)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-2">
            {stats?.perDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 2 }}
                  title={`${d.count} mensagens`}
                />
                <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tabular-nums">{loading ? "—" : value.toLocaleString("pt-BR")}</div>
        </div>
      </CardContent>
    </Card>
  );
}
