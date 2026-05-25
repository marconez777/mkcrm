import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { useEmailMetrics, aggregateMetrics, type EmailMetricRow } from "@/hooks/useEmailMetrics";

type Domain = { id: string; domain: string; status: string };

const BOUNCE_WARN = 3; // %
const BOUNCE_BAD = 5;
const COMPLAINT_WARN = 0.05; // %
const COMPLAINT_BAD = 0.1;

function statusBadge(status: string) {
  if (status === "verified") return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />verified</Badge>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function rateBadge(value: number, warn: number, bad: number, suffix = "%") {
  const level = value >= bad ? "destructive" : value >= warn ? "warning" : "ok";
  const cls = level === "destructive"
    ? "text-destructive"
    : level === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";
  return <span className={`tabular-nums font-semibold ${cls}`}>{value}{suffix}</span>;
}

function buildSparkline(rows: EmailMetricRow[], days: number) {
  // soma envios por dia
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + r.sent);
  const out: { day: string; sent: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, sent: map.get(key) ?? 0 });
  }
  return out;
}

export function DomainHealthCard({ clinicId }: { clinicId: string | null | undefined }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const { rows } = useEmailMetrics(clinicId, 30);
  const stats = aggregateMetrics(rows);
  const spark = buildSparkline(rows, 30);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("email_domains")
      .select("id,domain,status")
      .eq("clinic_id", clinicId)
      .then(({ data }) => setDomains((data ?? []) as Domain[]));
  }, [clinicId]);

  const hasAlert = stats.bouncePct >= BOUNCE_BAD || stats.complaintPct >= COMPLAINT_BAD;
  const hasWarn = stats.bouncePct >= BOUNCE_WARN || stats.complaintPct >= COMPLAINT_WARN;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {hasAlert ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            Saúde de envio (30d)
          </div>
          <p className="text-xs text-muted-foreground">Bounces e reclamações afetam a reputação do domínio.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total enviado</div>
          <div className="text-lg font-semibold tabular-nums">{stats.sent.toLocaleString("pt-BR")}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">Taxa de bounce</div>
          <div className="text-lg">{rateBadge(stats.bouncePct, BOUNCE_WARN, BOUNCE_BAD)}</div>
          <div className="text-[11px] text-muted-foreground">{stats.bounced} bounces · limite Resend: 5%</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">Taxa de reclamação</div>
          <div className="text-lg">{rateBadge(stats.complaintPct, COMPLAINT_WARN, COMPLAINT_BAD)}</div>
          <div className="text-[11px] text-muted-foreground">{stats.complained} spam · limite Resend: 0.1%</div>
        </div>
      </div>

      {hasAlert && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <AlertTriangle className="h-3 w-3 mt-0.5 text-destructive" />
          <span>Taxas acima do limite seguro. Pause campanhas e revise listas/segmentos antes de enviar mais.</span>
        </div>
      )}
      {!hasAlert && hasWarn && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-600" />
          <span>Atenção: aproximando do limite. Monitore os próximos envios.</span>
        </div>
      )}

      <div>
        <div className="text-[11px] text-muted-foreground mb-1">Envios diários · 30d</div>
        <div className="h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs>
                <linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="sent" stroke="hsl(var(--primary))" fill="url(#gSpark)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="text-[11px] text-muted-foreground mb-2">Domínios remetentes</div>
        {domains.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhum domínio cadastrado.</div>
        ) : (
          <div className="space-y-1">
            {domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{d.domain}</span>
                {statusBadge(d.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
