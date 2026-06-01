import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Card } from "@/components/ui/card";
import { Activity, Clock, Users, TrendingUp, Inbox, MessageSquare } from "lucide-react";

type MsgRow = { lead_id: string; from_me: boolean; timestamp: string };
type LeadRow = { id: string; created_at: string; attendant_id: string | null; stage_id: string | null; archived_at: string | null; unread_count: number; last_message_at: string | null };

const RANGES = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
];

export default function MetricsOps() {
  const [range, setRange] = useState(RANGES[1]);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [attendants, setAttendants] = useState<{ id: string; name: string; color: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; color: string }[]>([]);

  useEffect(() => {
    const since = new Date(Date.now() - range.hours * 3600_000).toISOString();
    Promise.all([
      supabase.from("messages").select("lead_id, from_me, timestamp").gte("timestamp", since).order("timestamp", { ascending: true }).limit(5000),
      supabase.from("leads").select("id, created_at, attendant_id, stage_id, archived_at, unread_count, last_message_at").limit(2000),
      supabase.from("attendants").select("id, name, color"),
      supabase.from("pipeline_stages").select("id, name, color").order("position"),
    ]).then(([m, l, a, s]) => {
      setMsgs((m.data ?? []) as MsgRow[]);
      setLeads((l.data ?? []) as LeadRow[]);
      setAttendants((a.data ?? []) as any);
      setStages((s.data ?? []) as any);
    });
  }, [range.id]);

  const stats = useMemo(() => {
    const inbound = msgs.filter((m) => !m.from_me).length;
    const outbound = msgs.filter((m) => m.from_me).length;
    const activeLeads = new Set(msgs.map((m) => m.lead_id)).size;

    // Tempo médio de primeira resposta: por lead, primeira inbound -> primeira outbound posterior
    const byLead = new Map<string, MsgRow[]>();
    msgs.forEach((m) => {
      if (!byLead.has(m.lead_id)) byLead.set(m.lead_id, []);
      byLead.get(m.lead_id)!.push(m);
    });
    const responses: number[] = [];
    byLead.forEach((arr) => {
      let waiting: number | null = null;
      for (const m of arr) {
        const t = new Date(m.timestamp).getTime();
        if (!m.from_me && waiting === null) waiting = t;
        else if (m.from_me && waiting !== null) {
          responses.push((t - waiting) / 60000);
          waiting = null;
        }
      }
    });
    const avgRespMin = responses.length ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : 0;

    // SLA: leads com unread > 1h
    const slaBreached = leads.filter((l) =>
      !l.archived_at &&
      (l.unread_count ?? 0) > 0 &&
      l.last_message_at &&
      (Date.now() - new Date(l.last_message_at).getTime()) > 3600_000
    ).length;

    const sinceMs = Date.now() - range.hours * 3600_000;
    const newLeads = leads.filter((l) => new Date(l.created_at).getTime() >= sinceMs).length;

    return { inbound, outbound, activeLeads, avgRespMin, slaBreached, newLeads };
  }, [msgs, leads, range.id]);

  // Volume por dia
  const dailyVolume = useMemo(() => {
    const days = Math.min(range.hours / 24, 30);
    const buckets: { day: string; in: number; out: number }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      buckets.push({ day: d.toISOString().slice(0, 10), in: 0, out: 0 });
    }
    msgs.forEach((m) => {
      const k = m.timestamp.slice(0, 10);
      const b = buckets.find((x) => x.day === k);
      if (!b) return;
      if (m.from_me) b.out++; else b.in++;
    });
    const max = Math.max(1, ...buckets.map((b) => b.in + b.out));
    return { buckets, max };
  }, [msgs, range.hours]);

  // Por atendente
  const byAttendant = useMemo(() => {
    const map = new Map<string, { sent: number; leads: Set<string> }>();
    msgs.filter((m) => m.from_me).forEach((m) => {
      const lead = leads.find((l) => l.id === m.lead_id);
      const aId = lead?.attendant_id ?? "__none";
      if (!map.has(aId)) map.set(aId, { sent: 0, leads: new Set() });
      const cur = map.get(aId)!;
      cur.sent++;
      cur.leads.add(m.lead_id);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: id === "__none" ? "Não atribuído" : (attendants.find((a) => a.id === id)?.name ?? "—"),
      color: id === "__none" ? "#888" : (attendants.find((a) => a.id === id)?.color ?? "#888"),
      sent: v.sent,
      leads: v.leads.size,
    })).sort((a, b) => b.sent - a.sent);
  }, [msgs, leads, attendants]);

  // Por etapa (leads ativos)
  const byStage = useMemo(() => {
    return stages.map((s) => ({
      ...s,
      count: leads.filter((l) => l.stage_id === s.id && !l.archived_at).length,
    }));
  }, [stages, leads]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Métricas operacionais</h1>
          <div className="flex gap-1 rounded-md border p-1 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 ${range.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Recebidas" value={String(stats.inbound)} />
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Enviadas" value={String(stats.outbound)} />
          <StatCard icon={<Inbox className="h-4 w-4" />} label="Conversas ativas" value={String(stats.activeLeads)} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Novos leads" value={String(stats.newLeads)} />
          <StatCard icon={<Clock className="h-4 w-4" />} label="1ª resposta (média)" value={`${stats.avgRespMin} min`} />
          <StatCard icon={<Activity className="h-4 w-4" />} label="SLA estourado (>1h)" value={String(stats.slaBreached)} />
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Volume por dia</h2>
          <div className="flex h-40 items-end gap-1">
            {dailyVolume.buckets.map((b) => {
              const total = b.in + b.out;
              const pct = (total / dailyVolume.max) * 100;
              const inPct = total ? (b.in / total) * pct : 0;
              const outPct = total ? (b.out / total) * pct : 0;
              return (
                <div key={b.day} className="flex flex-1 flex-col items-center gap-1" title={`${b.day}: ${b.in} recebidas / ${b.out} enviadas`}>
                  <div className="flex w-full flex-1 flex-col-reverse">
                    <div style={{ height: `${inPct}%` }} className="bg-primary" />
                    <div style={{ height: `${outPct}%` }} className="bg-emerald-500" />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{b.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />Recebidas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Enviadas</span>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Por atendente</h2>
            {byAttendant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {byAttendant.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.leads} leads</span>
                    <span className="w-12 text-right tabular-nums">{a.sent}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Leads por etapa</h2>
            {byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem etapas.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {byStage.map((s) => {
                  const max = Math.max(1, ...byStage.map((x) => x.count));
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                        <span className="tabular-nums">{s.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </Card>
  );
}
