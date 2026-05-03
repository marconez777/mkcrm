import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Message } from "@/types/crm";
import { Loader2, RefreshCw, Check, CheckCheck, Clock, AlertCircle, RotateCw, Reply, X, ChevronDown } from "lucide-react";
import Composer from "./Composer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - x.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: diff > 300 ? "numeric" : undefined });
}

function StatusTicks({ m }: { m: Message }) {
  if (!m.from_me) return null;
  if (m.status === "pending") return <Clock className="h-3 w-3 opacity-60" />;
  if (m.status === "failed") return <AlertCircle className="h-3 w-3 text-destructive" />;
  const ds = (m.delivery_status ?? "").toLowerCase();
  if (ds === "read") return <CheckCheck className="h-3 w-3 text-info" />;
  if (ds === "delivered" || ds === "delivery_ack") return <CheckCheck className="h-3 w-3 opacity-60" />;
  return <Check className="h-3 w-3 opacity-60" />;
}

function mergeMessage(prev: Message[], row: Message): Message[] {
  // Match by id, or by client_message_id (optimistic → real upgrade)
  const idx = prev.findIndex(
    (m) => m.id === row.id || (!!row.client_message_id && m.client_message_id === row.client_message_id),
  );
  if (idx === -1) {
    // Insert keeping timestamp order
    const arr = prev.slice();
    let i = arr.length;
    while (i > 0 && arr[i - 1].timestamp > row.timestamp) i--;
    arr.splice(i, 0, row);
    return arr;
  }
  const cur = prev[idx] as any;
  let changed = false;
  for (const k in row) if ((row as any)[k] !== cur[k]) { changed = true; break; }
  if (!changed) return prev;
  const copy = prev.slice();
  copy[idx] = { ...cur, ...row };
  return copy;
}

export default function ChatPane({ lead }: { lead: Lead }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const leadIdRef = useRef(lead.id);
  leadIdRef.current = lead.id;

  // Load history once + subscribe with incremental patches
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setMessages([]);
    firstScrollRef.current = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", lead.id)
        .order("timestamp");
      if (!active) return;
      setMessages((data ?? []) as Message[]);
      setLoaded(true);
      // Idempotent unread reset — only write when needed (avoids realtime ping-pong)
      if ((lead.unread_count ?? 0) > 0) {
        supabase.from("leads").update({ unread_count: 0 }).eq("id", lead.id).then(() => {});
      }
    })();

    // Background reconcile (non-blocking)
    supabase.functions.invoke("evolution-sync-lead", { body: { lead_id: lead.id } }).catch(() => {});

    const ch = supabase
      .channel(`msg-${lead.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => mergeMessage(prev, p.new as Message)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => mergeMessage(prev, p.new as Message)),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== (p.old as any).id)),
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [lead.id]);

  // Auto-scroll: instant on first paint, smooth afterwards. Only after `loaded`.
  useEffect(() => {
    if (!loaded) return;
    const el = scrollerRef.current;
    if (!el) return;
    if (firstScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      firstScrollRef.current = false;
      setNewCount(0);
      return;
    }
    if (stickToBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setNewCount(0);
    } else {
      setNewCount((c) => c + 1);
    }
  }, [messages.length, loaded]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickToBottom(atBottom);
    if (atBottom) setNewCount(0);
  }

  function jumpToBottom() {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    setStickToBottom(true);
    setNewCount(0);
  }

  async function sendText(text: string) {
    const cid = crypto.randomUUID();
    const quoted = replyTo?.external_id ?? null;
    setReplyTo(null);
    const { data, error } = await supabase.functions.invoke("evolution-send", {
      body: { lead_id: lead.id, text, client_message_id: cid, quoted_external_id: quoted },
    });
    if (error || (data as any)?.error) {
      toast.error("Falha ao enviar: " + (error?.message || (data as any)?.error));
    }
  }

  async function resend(m: Message) {
    const { error } = await supabase.functions.invoke("evolution-send", {
      body: { lead_id: lead.id, text: m.content ?? "", client_message_id: m.client_message_id ?? crypto.randomUUID() },
    });
    if (error) toast.error("Falha: " + error.message);
  }

  async function syncHistory() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("evolution-sync-lead", { body: { lead_id: lead.id } });
    setSyncing(false);
    if (error) toast.error("Falha: " + error.message);
    else toast.success(`Sincronizado: ${(data as any)?.imported ?? 0} mensagens`);
  }

  const grouped = useMemo(() => {
    const out: any[] = [];
    let lastDate = "";
    let lastAuthor: boolean | null = null;
    let lastTs = 0;
    messages.forEach((m) => {
      const d = new Date(m.timestamp);
      const dKey = d.toDateString();
      if (dKey !== lastDate) {
        out.push({ kind: "date", label: dateLabel(d), key: `d-${dKey}` });
        lastDate = dKey;
        lastAuthor = null;
      }
      const ts = d.getTime();
      const isGrouped = lastAuthor === m.from_me && ts - lastTs < 2 * 60 * 1000;
      out.push({ kind: "msg", m, grouped: isGrouped, key: m.id });
      lastAuthor = m.from_me;
      lastTs = ts;
    });
    return out;
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(lead.name || lead.phone).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{lead.name || lead.phone}</div>
            <div className="text-[11px] text-muted-foreground">{lead.phone}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={syncHistory} disabled={syncing} title="Sincronizar histórico">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="scrollbar-thin relative flex-1 overflow-y-auto px-4 py-4"
        style={{ background: "hsl(var(--chat-bg))" }}
      >
        {messages.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">Sem mensagens ainda.</div>
        )}
        <div className="space-y-1">
          {grouped.map((g: any) => {
            if (g.kind === "date") {
              return (
                <div key={g.key} className="my-3 flex items-center justify-center">
                  <span className="rounded-full bg-card px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm">{g.label}</span>
                </div>
              );
            }
            const m: Message = g.m;
            const failed = m.status === "failed";
            const pending = m.status === "pending";
            const replied = m.reply_to_external_id
              ? messages.find((x) => x.external_id === m.reply_to_external_id)
              : null;
            return (
              <div key={g.key} className={cn("group flex items-end gap-1", m.from_me ? "justify-end" : "justify-start", g.grouped ? "mt-0.5" : "mt-2")}>
                {!m.from_me && (
                  <button
                    onClick={() => setReplyTo(m)}
                    className="invisible self-center rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:visible group-hover:opacity-100"
                    title="Responder"
                  ><Reply className="h-3 w-3" /></button>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-lg px-3 py-1.5 text-sm shadow-sm",
                    failed && "ring-1 ring-destructive",
                    pending && "opacity-70",
                  )}
                  style={{ background: `hsl(var(--chat-bubble-${m.from_me ? "me" : "them"}))` }}
                >
                  {replied && (
                    <div className="mb-1 border-l-2 border-primary/60 pl-2 text-[11px] text-muted-foreground line-clamp-2">
                      {replied.content || `[${replied.message_type}]`}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.content || `[${m.message_type}]`}</div>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                    <span>{fmtTime(m.timestamp)}</span>
                    <StatusTicks m={m} />
                    {failed && (
                      <button onClick={() => resend(m)} className="ml-1 inline-flex items-center gap-0.5 text-destructive hover:underline">
                        <RotateCw className="h-3 w-3" /> reenviar
                      </button>
                    )}
                  </div>
                </div>
                {m.from_me && (
                  <button
                    onClick={() => setReplyTo(m)}
                    className="invisible self-center rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:visible group-hover:opacity-100"
                    title="Responder"
                  ><Reply className="h-3 w-3" /></button>
                )}
              </div>
            );
          })}
        </div>

        {!stickToBottom && newCount > 0 && (
          <button
            onClick={jumpToBottom}
            className="sticky bottom-3 left-1/2 mx-auto flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md"
          >
            <ChevronDown className="h-3 w-3" /> {newCount} nova{newCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {replyTo && (
        <div className="flex items-start gap-2 border-t bg-muted/30 px-4 py-2 text-xs">
          <Reply className="mt-0.5 h-3 w-3 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-muted-foreground">Respondendo a {replyTo.from_me ? "você" : (lead.name || lead.phone)}</div>
            <div className="line-clamp-2 text-muted-foreground/80">{replyTo.content || `[${replyTo.message_type}]`}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="rounded p-1 hover:bg-muted"><X className="h-3 w-3" /></button>
        </div>
      )}

      <Composer lead={lead} onSend={sendText} />
    </div>
  );
}
