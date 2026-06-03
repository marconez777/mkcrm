import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Building2, Users, MessageSquare, Sparkles, Mail, UserPlus } from "lucide-react";

type Overview = {
  clinics: { total: number; active: number; suspended: number; new_30d: number };
  users: { total: number; new_30d: number };
  messages_30d: { total: number; outbound: number; inbound: number };
  ai_30d: { cost_usd: number; tokens: number; requests: number };
  email_30d: { sent: number; opened: number; clicked: number; bounced: number };
  leads_30d: { total: number };
};

type TopClinic = { clinic_id: string; clinic_name: string; messages_30d: number; ai_cost_usd_30d: number; leads_30d: number };

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [top, setTop] = useState<TopClinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: ov }, { data: t }] = await Promise.all([
          supabase.rpc("admin_overview_metrics"),
          supabase.rpc("admin_top_clinics", { _limit: 10 }),
        ]);
        setData(ov as any);
        setTop((t as any) ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-sm text-muted-foreground">Sem dados.</div>;

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
  const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Clínicas" value={fmt(data.clinics.total)} hint={`${data.clinics.active} ativas · ${data.clinics.new_30d} novas em 30d`} />
        <Kpi icon={Users} label="Usuários" value={fmt(data.users.total)} hint={`${data.users.new_30d} novos em 30d`} />
        <Kpi icon={UserPlus} label="Leads (30d)" value={fmt(data.leads_30d.total)} />
        <Kpi icon={MessageSquare} label="Mensagens (30d)" value={fmt(data.messages_30d.total)} hint={`${fmt(data.messages_30d.outbound)} enviadas · ${fmt(data.messages_30d.inbound)} recebidas`} />
        <Kpi icon={Sparkles} label="IA — custo 30d" value={usd(data.ai_30d.cost_usd)} hint={`${fmt(data.ai_30d.requests)} requisições · ${fmt(data.ai_30d.tokens)} tokens`} />
        <Kpi icon={Mail} label="E-mails (30d)" value={fmt(data.email_30d.sent)} hint={`${fmt(data.email_30d.opened)} aberturas · ${fmt(data.email_30d.clicked)} cliques`} />
        <Kpi icon={Building2} label="Suspensas" value={fmt(data.clinics.suspended)} />
        <Kpi icon={Mail} label="Bounces (30d)" value={fmt(data.email_30d.bounced)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top clínicas por mensagens (30d)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead className="text-right">Custo IA</TableHead>
              <TableHead className="text-right">Leads</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {top.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>}
              {top.map((r) => (
                <TableRow key={r.clinic_id}>
                  <TableCell className="font-medium">{r.clinic_name}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.messages_30d))}</TableCell>
                  <TableCell className="text-right">{usd(Number(r.ai_cost_usd_30d))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.leads_30d))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
