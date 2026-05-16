import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, CheckCircle2, MousePointerClick, AlertTriangle } from "lucide-react";

type Log = {
  id: string;
  template_slug: string | null;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  error: string | null;
};

function statusBadge(s: string) {
  const map: Record<string, "default" | "secondary" | "destructive"> = {
    sent: "default",
    delivered: "default",
    opened: "default",
    clicked: "default",
    failed: "destructive",
    bounced: "destructive",
    complained: "destructive",
    queued: "secondary",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s}</Badge>;
}

export default function EmailDashboard() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [logs, setLogs] = useState<Log[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sentToday, setSentToday] = useState(0);
  const [quota, setQuota] = useState(1000);

  async function load() {
    if (!clinicId) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: ls }, { data: state }, { data: c }] = await Promise.all([
      supabase
        .from("email_logs")
        .select("id,template_slug,recipient_email,subject,status,sent_at,opened_at,clicked_at,bounced_at,error")
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(500),
      supabase.from("email_send_state").select("sent_today").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle(),
    ]);
    setLogs((ls ?? []) as any);
    setSentToday((state as any)?.sent_today ?? 0);
    setQuota(Number((c as any)?.settings?.email?.quota_daily ?? 1000));
  }

  useEffect(() => {
    if (clinicId) load();
  }, [clinicId]);

  useEffect(() => {
    document.title = "Email — Dashboard";
  }, []);

  const stats = useMemo(() => {
    const total = logs.length;
    const delivered = logs.filter((l) => l.status === "delivered" || l.opened_at || l.clicked_at).length;
    const opened = logs.filter((l) => l.opened_at).length;
    const clicked = logs.filter((l) => l.clicked_at).length;
    const failed = logs.filter((l) => ["failed", "bounced", "complained"].includes(l.status)).length;
    return {
      total,
      delivered,
      opened,
      clicked,
      failed,
      openPct: total ? Math.round((opened / total) * 100) : 0,
      clickPct: total ? Math.round((clicked / total) * 100) : 0,
    };
  }, [logs]);

  const templates = useMemo(() => {
    const set = new Set(logs.map((l) => l.template_slug).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (templateFilter !== "all" && l.template_slug !== templateFilter) return false;
      if (search && !l.recipient_email.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, statusFilter, templateFilter, search]);

  // simple daily aggregation
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const d = l.sent_at.slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort()
      .slice(-7);
  }, [logs]);
  const maxDay = Math.max(1, ...byDay.map(([, n]) => n));

  const quotaPct = quota > 0 ? Math.round((sentToday / quota) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email Marketing</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos últimos 7 dias.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3 w-3" />Enviados</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Entregues</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.delivered}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Abertura</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.openPct}%</div>
          <div className="text-xs text-muted-foreground">{stats.opened} aberturas</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick className="h-3 w-3" />Cliques</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.clickPct}%</div>
          <div className="text-xs text-muted-foreground">{stats.clicked} cliques</div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 md:col-span-2">
          <div className="text-sm font-semibold mb-3">Envios por dia</div>
          <div className="flex items-end gap-2 h-32">
            {byDay.length === 0 && <div className="text-xs text-muted-foreground self-center">Sem dados ainda</div>}
            {byDay.map(([d, n]) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(n / maxDay) * 100}%` }} />
                <div className="text-[10px] text-muted-foreground">{d.slice(5)}</div>
                <div className="text-[10px] tabular-nums">{n}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Cota diária</div>
          <div className="text-xs text-muted-foreground">{sentToday} / {quota} envios hoje</div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${quotaPct > 90 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(100, quotaPct)}%` }}
            />
          </div>
          {stats.failed > 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive pt-2">
              <AlertTriangle className="h-3 w-3" />{stats.failed} envios com falha nos últimos 7 dias
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold mr-2">Últimos envios</div>
          <Input
            placeholder="Buscar destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos templates</SelectItem>
              {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum envio</TableCell></TableRow>
              )}
              {filtered.slice(0, 50).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.template_slug ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.recipient_email}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate">{l.subject}</TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.sent_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
