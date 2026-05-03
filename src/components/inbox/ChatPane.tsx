import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Message } from "@/types/crm";
import {
  Loader2, RefreshCw, Check, CheckCheck, Clock, AlertCircle, RotateCw,
  Reply, X, ChevronDown, ChevronUp, Sparkles, Search, CalendarIcon, History, WifiOff,
} from "lucide-react";
import Composer from "./Composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { Link } from "react-router-dom";

const PAGE_SIZE = 50;

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
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

const MERGE_KEYS = [
  "content", "status", "delivery_status", "reply_to_external_id",
  "timestamp", "message_type", "from_me",
  "external_id", "client_message_id", "last_error",
] as const;

function mergeMessage(prev: Message[], row: Message): Message[] {
  const idx = prev.findIndex(
    (m) => m.id === row.id || (!!row.client_message_id && m.client_message_id === row.client_message_id),
  );
  if (idx === -1) {
    const arr = prev.slice();
    let i = arr.length;
    while (i > 0 && arr[i - 1].timestamp > row.timestamp) i--;
    arr.splice(i, 0, row);
    return arr;
  }
  const cur = prev[idx] as any;
  let changed = cur.id !== row.id;
  if (!changed) {
    for (const k of MERGE_KEYS) {
      if ((row as any)[k] !== cur[k]) { changed = true; break; }
    }
  }
  if (!changed) return prev;
  const copy = prev.slice();
  copy[idx] = { ...cur, ...row };
  return copy;
}

// Highlight matched substrings with <mark>; first match in current message gets active style.
function highlight(text: string, term: string, isActive: boolean) {
  if (!term) return text;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const out: any[] = [];
  let i = 0;
  let first = true;
  while (i < text.length) {
    const idx = lower.indexOf(t, i);
    if (idx === -1) { out.push(text.slice(i)); break; }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark
        key={idx}
        className={cn(
          "rounded px-0.5",
          isActive && first ? "bg-amber-400 text-black" : "bg-amber-200/70 text-black",
        )}
      >{text.slice(idx, idx + t.length)}</mark>,
    );
    first = false;
    i = idx + t.length;
  }
  return out;
}

export default function ChatPane({ lead }: { lead: Lead }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{
    pages: number; lastPageItems: number; imported: number; total: number;
  } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [composerSeed, setComposerSeed] = useState<{ text: string; n: number } | null>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // Load most recent page
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setMessages([]);
    setSuggestions([]);
    setHasMore(true);
    firstScrollRef.current = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", lead.id)
        .order("timestamp", { ascending: false })
        .limit(PAGE_SIZE);
      if (!active) return;
      const arr = ((data ?? []) as Message[]).slice().reverse();
      setMessages(arr);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      setLoaded(true);
      if ((lead.unread_count ?? 0) > 0) {
        supabase.from("leads").update({ unread_count: 0 }).eq("id", lead.id).then(() => {});
      }
    })();

    const ch = supabase
      .channel(`msg-${lead.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => mergeMessage(prev, p.new as Message)))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => mergeMessage(prev, p.new as Message)))
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== (p.old as any).id)))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [lead.id]);

  // Load older page when sentinel hits top
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].timestamp;
    const el = scrollerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("lead_id", lead.id)
      .lt("timestamp", oldest)
      .order("timestamp", { ascending: false })
      .limit(PAGE_SIZE);
    const older = ((data ?? []) as Message[]).slice().reverse();
    if (older.length > 0) {
      setMessages((prev) => [...older, ...prev]);
      // Preserve scroll position after prepend
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      });
    }
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoadingMore(false);
  }, [lead.id, loadingMore, hasMore, messages]);

  useEffect(() => {
    if (!loaded) return;
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadOlder();
    }, { root: scrollerRef.current, rootMargin: "200px 0px 0px 0px" });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loaded, loadOlder]);

  // Auto-scroll on new messages
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

  function pulseAndScroll(messageId: string) {
    const node = document.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulseId(messageId);
    setTimeout(() => setPulseId((p) => (p === messageId ? null : p)), 1600);
  }

  async function jumpToDate(date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    // If we already loaded that day, just scroll to its first message.
    const inMem = messages.find((m) => {
      const t = new Date(m.timestamp);
      return t >= start && t < end;
    });
    if (inMem) { pulseAndScroll(inMem.id); return; }
    // Otherwise fetch a window around it and merge.
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("lead_id", lead.id)
      .gte("timestamp", start.toISOString())
      .order("timestamp", { ascending: true })
      .limit(PAGE_SIZE);
    const fetched = (data ?? []) as Message[];
    if (fetched.length === 0) {
      toast.info("Nenhuma mensagem nessa data");
      return;
    }
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      fetched.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    });
    setHasMore(true);
    requestAnimationFrame(() => pulseAndScroll(fetched[0].id));
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
  async function backfillFull() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillProgress({ pages: 0, lastPageItems: 0, imported: 0, total: 0 });
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-sync-lead`;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ lead_id: lead.id, full: true, silent: true }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} ${t.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finalEvt: any = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "page") {
              setBackfillProgress({
                pages: evt.page, lastPageItems: evt.items,
                imported: evt.imported, total: evt.total,
              });
            } else if (evt.type === "done") {
              finalEvt = evt;
            } else if (evt.type === "error") {
              toast.error("Erro na importação: " + (evt.detail ?? evt.status));
            }
          } catch { /* ignore parse */ }
        }
      }
      if (finalEvt) {
        toast.success(`Histórico importado: ${finalEvt.imported} novas (${finalEvt.total} em ${finalEvt.pages} páginas)`);
      }
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
    } finally {
      setBackfilling(false);
      // Keep progress visible briefly so users see the final numbers
      setTimeout(() => setBackfillProgress(null), 4000);
    }
  }
  async function suggest() {
    setLoadingSuggest(true);
    const { data, error } = await supabase.functions.invoke("ai-assist", { body: { lead_id: lead.id, mode: "suggest" } });
    setLoadingSuggest(false);
    if (error || (data as any)?.error) {
      toast.error("Falha IA: " + (error?.message || (data as any)?.error));
      return;
    }
    setSuggestions((data as any)?.suggestions ?? []);
  }

  // Search matches
  const matches = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return [] as Message[];
    return messages.filter((m) => (m.content ?? "").toLowerCase().includes(t));
  }, [messages, searchTerm]);

  useEffect(() => { setActiveMatch(0); }, [searchTerm]);
  useEffect(() => {
    if (matches.length === 0) return;
    const m = matches[Math.min(activeMatch, matches.length - 1)];
    if (m) pulseAndScroll(m.id);
  }, [activeMatch, matches.length]);

  // Days that have messages — for calendar marking
  const daysWithMessages = useMemo(() => {
    const s = new Set<string>();
    messages.forEach((m) => s.add(dayKey(new Date(m.timestamp))));
    return s;
  }, [messages]);

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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            onClick={() => setSearchOpen((v) => !v)}
            title="Buscar na conversa"
            className={cn(searchOpen && "bg-accent")}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Ir para data"><CalendarIcon className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="end">
              <Calendar
                mode="single"
                onSelect={(d) => d && jumpToDate(d)}
                modifiers={{ hasMsg: (d) => daysWithMessages.has(dayKey(d)) }}
                modifiersClassNames={{ hasMsg: "font-bold text-primary underline underline-offset-4" }}
                disabled={(d) => d > new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={suggest} disabled={loadingSuggest} title="Sugerir respostas (IA)" className="gap-1 text-xs">
            {loadingSuggest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Sugerir
          </Button>
          <Button variant="ghost" size="icon" onClick={backfillFull} disabled={backfilling} title="Importar histórico completo do WhatsApp">
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={syncHistory} disabled={syncing} title="Sincronizar últimas mensagens">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {backfillProgress && (
        <div className="border-b bg-primary/5 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-primary">
              {backfilling ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
              {backfilling ? "Importando histórico…" : "Importação concluída"}
            </span>
            <span className="tabular-nums text-muted-foreground">
              Página {backfillProgress.pages} · {backfillProgress.lastPageItems} msgs/pág · {backfillProgress.imported} novas / {backfillProgress.total} verificadas
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full bg-primary transition-all", backfilling && "animate-pulse")}
              style={{
                width: backfilling
                  ? `${Math.min(95, 10 + backfillProgress.pages * 5)}%`
                  : "100%",
              }}
            />
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar mensagens…"
            className="h-7 flex-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches.length > 0) setActiveMatch((i) => (i + (e.shiftKey ? -1 : 1) + matches.length) % matches.length);
              } else if (e.key === "Escape") {
                setSearchOpen(false); setSearchTerm("");
              }
            }}
          />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {matches.length === 0 ? (searchTerm ? "0" : "") : `${activeMatch + 1}/${matches.length}`}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => matches.length && setActiveMatch((i) => (i - 1 + matches.length) % matches.length)}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => matches.length && setActiveMatch((i) => (i + 1) % matches.length)}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSearchOpen(false); setSearchTerm(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="scrollbar-thin relative flex-1 overflow-y-auto px-4 py-4"
        style={{ background: "hsl(var(--chat-bg))" }}
      >
        {!loaded && (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando mensagens…
          </div>
        )}

        <div ref={topSentinelRef} />
        {loadingMore && (
          <div className="flex items-center justify-center py-2 text-[11px] text-muted-foreground">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando histórico…
          </div>
        )}
        {loaded && !hasMore && messages.length > 0 && (
          <div className="py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">início da conversa</div>
        )}

        {loaded && messages.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">Sem mensagens ainda.</div>
        )}

        <div className="space-y-1">
          {grouped.map((g: any) => {
            if (g.kind === "date") {
              return (
                <div key={g.key} className="sticky top-1 z-10 my-3 flex items-center justify-center pointer-events-none">
                  <span className="rounded-full bg-card/95 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur">
                    {g.label}
                  </span>
                </div>
              );
            }
            const m: Message = g.m;
            const failed = m.status === "failed";
            const pending = m.status === "pending";
            const replied = m.reply_to_external_id
              ? messages.find((x) => x.external_id === m.reply_to_external_id)
              : null;
            const isMatch = searchTerm && (m.content ?? "").toLowerCase().includes(searchTerm.toLowerCase());
            const isActiveMatch = isMatch && matches[activeMatch]?.id === m.id;
            const pulsing = pulseId === m.id;
            return (
              <div
                key={g.key}
                data-msg-id={m.id}
                className={cn("group flex items-end gap-1", m.from_me ? "justify-end" : "justify-start", g.grouped ? "mt-0.5" : "mt-2")}
              >
                {!m.from_me && (
                  <button onClick={() => setReplyTo(m)}
                    className="invisible self-center rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:visible group-hover:opacity-100"
                    title="Responder"><Reply className="h-3 w-3" /></button>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-lg px-3 py-1.5 text-sm shadow-sm transition-all",
                    failed && "ring-1 ring-destructive",
                    pending && "opacity-70",
                    isActiveMatch && "ring-2 ring-amber-400",
                    pulsing && "ring-2 ring-primary animate-pulse",
                  )}
                  style={{ background: `hsl(var(--chat-bubble-${m.from_me ? "me" : "them"}))` }}
                >
                  {replied && (
                    <button
                      onClick={() => pulseAndScroll(replied.id)}
                      className="mb-1 block w-full border-l-2 border-primary/60 pl-2 text-left text-[11px] text-muted-foreground line-clamp-2 hover:text-foreground"
                      title="Ir para mensagem original"
                    >
                      {replied.content || `[${replied.message_type}]`}
                    </button>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {searchTerm && m.content
                      ? highlight(m.content, searchTerm, isActiveMatch)
                      : (m.content || `[${m.message_type}]`)}
                  </div>
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
                  <button onClick={() => setReplyTo(m)}
                    className="invisible self-center rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:visible group-hover:opacity-100"
                    title="Responder"><Reply className="h-3 w-3" /></button>
                )}
              </div>
            );
          })}
        </div>

        {!stickToBottom && newCount > 0 && (
          <button onClick={jumpToBottom}
            className="sticky bottom-3 left-1/2 mx-auto flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md">
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

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-3 py-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sugestões</span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setComposerSeed({ text: s, n: (composerSeed?.n ?? 0) + 1 }); setSuggestions([]); }}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent line-clamp-1 max-w-[300px]"
              title={s}
            >
              {s}
            </button>
          ))}
          <button onClick={() => setSuggestions([])} className="ml-auto rounded p-1 hover:bg-muted text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>
      )}

      <Composer lead={lead} onSend={sendText} seed={composerSeed} />
    </div>
  );
}
