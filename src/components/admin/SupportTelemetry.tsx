import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Eye, MessageSquare, Coins, Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Msg = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
};

type ThreadRow = {
  id: string;
  title: string | null;
  user_id: string;
  clinic_id: string | null;
  last_route: string | null;
  updated_at: string;
};

type TopThread = {
  thread_id: string;
  title: string;
  user_name: string;
  last_route: string | null;
  messages: number;
  cost_usd: number;
  tokens: number;
  last_at: string;
};

const DAYS = 30;

export default function SupportTelemetry({ monthlyCap }: { monthlyCap: number }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<Map<string, ThreadRow>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [feedback, setFeedback] = useState<Map<string, number>>(new Map()); // message_id -> rating
  const [openThread, setOpenThread] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    const { data: msgs } = await supabase
      .from("support_chat_messages")
      .select("id, thread_id, role, content, tokens_in, tokens_out, cost_usd, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    const list = (msgs ?? []) as Msg[];
    setMessages(list);

    const threadIds = Array.from(new Set(list.map((m) => m.thread_id)));
    if (threadIds.length) {
      const { data: ths } = await supabase
        .from("support_chat_threads")
        .select("id, title, user_id, clinic_id, last_route, updated_at")
        .in("id", threadIds);
      const tmap = new Map<string, ThreadRow>();
      (ths ?? []).forEach((t: any) => tmap.set(t.id, t));
      setThreads(tmap);

      const userIds = Array.from(new Set((ths ?? []).map((t: any) => t.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        const nm = new Map<string, string>();
        (profs ?? []).forEach((p: any) => nm.set(p.user_id, p.full_name ?? "—"));
        setNames(nm);
      }
    } else {
      setThreads(new Map());
      setNames(new Map());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Daily aggregation
  const daily = useMemo(() => {
    const map = new Map<string, { day: string; messages: number; cost: number; tokens: number }>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { day: key, messages: 0, cost: 0, tokens: 0 });
    }
    for (const m of messages) {
      const key = m.created_at.slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.messages += 1;
      row.cost += Number(m.cost_usd ?? 0);
      row.tokens += (m.tokens_in ?? 0) + (m.tokens_out ?? 0);
    }
    return Array.from(map.values()).map((r) => ({
      ...r,
      label: format(new Date(r.day), "dd/MM"),
      cost: Number(r.cost.toFixed(4)),
    }));
  }, [messages]);

  // Top threads by cost
  const topThreads = useMemo<TopThread[]>(() => {
    const agg = new Map<string, { messages: number; cost: number; tokens: number; last_at: string }>();
    for (const m of messages) {
      const cur = agg.get(m.thread_id) ?? { messages: 0, cost: 0, tokens: 0, last_at: m.created_at };
      cur.messages += 1;
      cur.cost += Number(m.cost_usd ?? 0);
      cur.tokens += (m.tokens_in ?? 0) + (m.tokens_out ?? 0);
      if (m.created_at > cur.last_at) cur.last_at = m.created_at;
      agg.set(m.thread_id, cur);
    }
    return Array.from(agg, ([thread_id, v]) => {
      const t = threads.get(thread_id);
      return {
        thread_id,
        title: t?.title ?? "(sem título)",
        user_name: t ? names.get(t.user_id) ?? "—" : "—",
        last_route: t?.last_route ?? null,
        messages: v.messages,
        cost_usd: Number(v.cost.toFixed(4)),
        tokens: v.tokens,
        last_at: v.last_at,
      };
    })
      .sort((a, b) => b.cost_usd - a.cost_usd || b.messages - a.messages)
      .slice(0, 15);
  }, [messages, threads, names]);

  const totals = useMemo(() => {
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();
    let cost = 0, msgs = 0, tokens = 0, users = new Set<string>();
    for (const m of messages) {
      if (m.created_at < monthStartIso) continue;
      msgs += 1;
      cost += Number(m.cost_usd ?? 0);
      tokens += (m.tokens_in ?? 0) + (m.tokens_out ?? 0);
      const t = threads.get(m.thread_id);
      if (t) users.add(t.user_id);
    }
    return { cost, msgs, tokens, users: users.size };
  }, [messages, threads]);

  if (loading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const capPct = monthlyCap > 0 ? Math.min(100, (totals.cost / monthlyCap) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Coins className="h-4 w-4" />} label="Custo no mês" value={`$${totals.cost.toFixed(4)}`} sub={`${capPct.toFixed(0)}% do teto $${monthlyCap}`} />
        <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Mensagens (mês)" value={String(totals.msgs)} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Tokens (mês)" value={totals.tokens.toLocaleString("pt-BR")} />
        <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Usuários ativos (mês)" value={String(totals.users)} />
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Uso diário (últimos {DAYS} dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: string) => name === "cost" ? [`$${Number(v).toFixed(4)}`, "Custo"] : [v, "Mensagens"]}
                />
                <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="url(#gradMsgs)" strokeWidth={2} />
                <Area type="monotone" dataKey="cost" stroke="hsl(var(--tab-amber))" fill="transparent" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top threads */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top conversas (por custo)</CardTitle>
        </CardHeader>
        <CardContent>
          {topThreads.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma conversa ainda.</div>
          ) : (
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Mensagens</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="w-32">Última</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topThreads.map((t) => (
                    <TableRow key={t.thread_id}>
                      <TableCell className="max-w-[280px] truncate" title={t.title}>{t.title}</TableCell>
                      <TableCell className="text-xs">{t.user_name}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{t.messages}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{t.tokens.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${t.cost_usd.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.last_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpenThread(t.thread_id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ThreadViewer threadId={openThread} onClose={() => setOpenThread(null)} />
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ThreadViewer({ threadId, onClose }: { threadId: string | null; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    supabase
      .from("support_chat_messages")
      .select("id, thread_id, role, content, tokens_in, tokens_out, cost_usd, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMsgs((data ?? []) as Msg[]);
        setLoading(false);
      });
  }, [threadId]);

  return (
    <Dialog open={!!threadId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico da conversa</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
          {msgs.map((m) => (
            <div key={m.id} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10 ml-8" : m.role === "assistant" ? "bg-muted mr-8" : "bg-amber-500/10 text-xs"}`}>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span className="uppercase font-semibold">{m.role}</span>
                <span>{format(new Date(m.created_at), "dd/MM HH:mm:ss", { locale: ptBR })} · {m.tokens_in}/{m.tokens_out} tok · ${Number(m.cost_usd).toFixed(5)}</span>
              </div>
              <div className="whitespace-pre-wrap break-words">{m.content || <span className="italic opacity-50">(vazio)</span>}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
