import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, Pause, Play, User, Bot, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type LiveMsg = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
  user_name?: string;
  last_route?: string | null;
};

const KEEP = 60;
const ACTIVE_WINDOW_MS = 5 * 60_000;

export default function SupportLiveMonitor() {
  const [paused, setPaused] = useState(false);
  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [, force] = useState(0);
  const threadCache = useRef<Map<string, { user_id: string; last_route: string | null }>>(new Map());
  const nameCache = useRef<Map<string, string>>(new Map());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  async function enrichMessage(m: any): Promise<LiveMsg> {
    let tinfo = threadCache.current.get(m.thread_id);
    if (!tinfo) {
      const { data: t } = await supabase
        .from("support_chat_threads")
        .select("user_id, last_route")
        .eq("id", m.thread_id)
        .maybeSingle();
      if (t) {
        tinfo = { user_id: (t as any).user_id, last_route: (t as any).last_route };
        threadCache.current.set(m.thread_id, tinfo);
      }
    }
    let user_name: string | undefined;
    if (tinfo) {
      user_name = nameCache.current.get(tinfo.user_id);
      if (!user_name) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", tinfo.user_id)
          .maybeSingle();
        user_name = (p as any)?.full_name ?? "—";
        nameCache.current.set(tinfo.user_id, user_name!);
      }
    }
    return { ...m, user_name, last_route: tinfo?.last_route ?? null };
  }

  // initial load: last 30 messages
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("support_chat_messages")
        .select("id, thread_id, role, content, tokens_in, tokens_out, cost_usd, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      const list = (data ?? []) as any[];
      const enriched = await Promise.all(list.reverse().map(enrichMessage));
      setMessages(enriched);
      setLoading(false);
    })();
  }, []);

  // realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("support-live-monitor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_chat_messages" },
        async (payload) => {
          if (pausedRef.current) return;
          const m = await enrichMessage(payload.new as any);
          setMessages((prev) => {
            const next = [...prev, m];
            return next.length > KEEP ? next.slice(next.length - KEEP) : next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_chat_messages" },
        (payload) => {
          if (pausedRef.current) return;
          const u = payload.new as any;
          setMessages((prev) =>
            prev.map((x) =>
              x.id === u.id
                ? { ...x, content: u.content, tokens_in: u.tokens_in, tokens_out: u.tokens_out, cost_usd: Number(u.cost_usd) }
                : x,
            ),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // re-render every 30s so "ativo agora" recomputes
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // KPIs
  const now = Date.now();
  const activeThreads = new Set(
    messages.filter((m) => now - new Date(m.created_at).getTime() < ACTIVE_WINDOW_MS).map((m) => m.thread_id),
  );
  const lastMin = messages.filter((m) => now - new Date(m.created_at).getTime() < 60_000).length;
  const lastMsgAgo = messages.length
    ? Math.round((now - new Date(messages[messages.length - 1].created_at).getTime()) / 1000)
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className={cn("h-4 w-4", paused ? "text-muted-foreground" : "text-emerald-500 animate-pulse")} />
            Monitor ao vivo
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><Badge variant="secondary">{activeThreads.size}</Badge> conversa(s) ativa(s)</span>
              <span><Badge variant="secondary">{lastMin}</Badge> msg/min</span>
              {lastMsgAgo != null && (
                <span>última: <strong>{lastMsgAgo < 60 ? `${lastMsgAgo}s` : `${Math.round(lastMsgAgo / 60)}min`}</strong> atrás</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)} className="h-7">
              {paused ? <><Play className="h-3.5 w-3.5 mr-1" />Retomar</> : <><Pause className="h-3.5 w-3.5 mr-1" />Pausar</>}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Aguardando mensagens…</div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-1.5 font-mono text-xs">
            {messages.slice().reverse().map((m) => {
              const isUser = m.role === "user";
              const isAsst = m.role === "assistant";
              const Icon = isUser ? User : isAsst ? Bot : Wrench;
              const totalTok = (m.tokens_in ?? 0) + (m.tokens_out ?? 0);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start gap-2 rounded px-2 py-1.5 border-l-2",
                    isUser ? "border-l-primary bg-primary/5" : isAsst ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-amber-500 bg-amber-500/5",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", isUser ? "text-primary" : isAsst ? "text-emerald-500" : "text-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-0.5">
                      <span className="uppercase font-semibold">{m.role}</span>
                      <span className="truncate">· {m.user_name ?? "—"}</span>
                      {m.last_route && <span className="truncate">· {m.last_route}</span>}
                      <span className="ml-auto whitespace-nowrap">
                        {format(new Date(m.created_at), "HH:mm:ss", { locale: ptBR })}
                        {totalTok > 0 && ` · ${totalTok}tok · $${Number(m.cost_usd).toFixed(5)}`}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap break-words line-clamp-3 text-foreground/80">
                      {m.content || <span className="italic opacity-50">(streaming…)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
