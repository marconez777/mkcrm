import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Message } from "@/types/crm";
import {
  Loader2, RefreshCw, Check, CheckCheck, Clock, AlertCircle, RotateCw,
  Reply, X, ChevronDown, ChevronUp, Sparkles, Search, CalendarIcon, History, WifiOff,
  StickyNote, Forward, Trash2,
} from "lucide-react";
import Composer from "./Composer";
import ForwardDialog from "./ForwardDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { Link } from "react-router-dom";
import { FUNCTIONS_URL, getFunctionHeaders } from "@/lib/supabase-env";
import { addNote, getNotes, removeNote, subscribeNotes, type InternalNote } from "@/lib/internal-notes";
import type { BackfillProgressEvent, SyncLeadResult } from "../../../supabase/functions/_shared/types";

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
  const { overall: healthStatus } = useHealth();
  const disconnected = healthStatus === "down" || healthStatus === "unknown";
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

  // Internal notes (local-only por ora)
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Forward dialog
  const [forwardText, setForwardText] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const scrollToMsgRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    setNotes(getNotes(lead.id));
    const unsub = subscribeNotes(lead.id, () => setNotes(getNotes(lead.id)));
    return unsub;
  }, [lead.id]);

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
    scrollToMsgRef.current?.(messageId);
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
    else toast.success(`Sincronizado: ${(data as SyncLeadResult | null)?.imported ?? 0} mensagens`);
  }
  async function backfillFull() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillProgress({ pages: 0, lastPageItems: 0, imported: 0, total: 0 });
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/evolution-sync-lead`, {
        method: "POST",
        headers: await getFunctionHeaders(),
        body: JSON.stringify({ lead_id: lead.id, full: true, silent: true }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} ${t.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finalEvt: Extract<BackfillProgressEvent, { type: "done" }> | null = null;
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
            const evt = JSON.parse(line) as BackfillProgressEvent;
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
    // Mescla mensagens + notas internas por timestamp.
    type Item =
      | { kind: "msg"; ts: number; m: Message }
      | { kind: "note"; ts: number; n: InternalNote };
    const merged: Item[] = [
      ...messages.map((m) => ({ kind: "msg" as const, ts: new Date(m.timestamp).getTime(), m })),
      ...notes.map((n) => ({ kind: "note" as const, ts: new Date(n.created_at).getTime(), n })),
    ].sort((a, b) => a.ts - b.ts);

    const out: any[] = [];
    let lastDate = "";
    let lastAuthor: boolean | null = null;
    let lastTs = 0;
    merged.forEach((it) => {
      const d = new Date(it.ts);
      const dKey = d.toDateString();
      if (dKey !== lastDate) {
        out.push({ kind: "date", label: dateLabel(d), key: `d-${dKey}` });
        lastDate = dKey;
        lastAuthor = null;
      }
      if (it.kind === "note") {
        out.push({ kind: "note", n: it.n, key: `n-${it.n.id}` });
        lastAuthor = null;
        lastTs = it.ts;
        return;
      }
      const isGrouped = lastAuthor === it.m.from_me && it.ts - lastTs < 2 * 60 * 1000;
      out.push({ kind: "msg", m: it.m, grouped: isGrouped, key: it.m.id });
      lastAuthor = it.m.from_me;
      lastTs = it.ts;
    });
    return out;
  }, [messages, notes]);

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
          <Popover open={noteOpen} onOpenChange={setNoteOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Adicionar nota interna" className={cn(noteOpen && "bg-accent")}>
                <StickyNote className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Nota interna (só a equipe vê)"
                rows={3}
                className="text-sm"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setNoteOpen(false); setNoteText(""); }}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const t = noteText.trim();
                    if (!t) return;
                    try {
                      await addNote(lead.id, t);
                      setNoteText("");
                      setNoteOpen(false);
                      toast.success("Nota adicionada");
                    } catch (e: any) {
                      toast.error("Falha: " + (e?.message ?? String(e)));
                    }
                  }}
                >Adicionar</Button>
              </div>
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

      {disconnected && (
        <div className="flex items-center justify-between gap-2 border-b bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            <span>WhatsApp desconectado — mensagens enviadas podem falhar.</span>
          </div>
          <Link to="/settings" className="font-medium underline-offset-2 hover:underline">Configurar</Link>
        </div>
      )}

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

      <VirtualizedMessages
        scrollerRef={scrollerRef}
        onScroll={onScroll}
        loaded={loaded}
        loadingMore={loadingMore}
        hasMore={hasMore}
        topSentinelRef={topSentinelRef}
        grouped={grouped}
        messages={messages}
        searchTerm={searchTerm}
        matches={matches}
        activeMatch={activeMatch}
        pulseId={pulseId}
        setReplyTo={setReplyTo}
        pulseAndScroll={pulseAndScroll}
        resend={resend}
        stickToBottom={stickToBottom}
        newCount={newCount}
        jumpToBottom={jumpToBottom}
        scrollToMsgRef={scrollToMsgRef}
        leadId={lead.id}
        onForward={(text: string) => setForwardText(text)}
      />

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

      <ForwardDialog
        open={!!forwardText}
        onClose={() => setForwardText(null)}
        text={forwardText ?? ""}
        excludeLeadId={lead.id}
      />
    </div>
  );
}

// ---- Virtualized message list ---------------------------------------------

type GroupedItem =
  | { kind: "date"; label: string; key: string }
  | { kind: "msg"; m: Message; grouped: boolean; key: string }
  | { kind: "note"; n: InternalNote; key: string };

function VirtualizedMessages(props: {
  scrollerRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  loaded: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  topSentinelRef: React.RefObject<HTMLDivElement>;
  grouped: GroupedItem[];
  messages: Message[];
  searchTerm: string;
  matches: Message[];
  activeMatch: number;
  pulseId: string | null;
  setReplyTo: (m: Message) => void;
  pulseAndScroll: (id: string) => void;
  resend: (m: Message) => void;
  stickToBottom: boolean;
  newCount: number;
  jumpToBottom: () => void;
  scrollToMsgRef: React.MutableRefObject<((id: string) => void) | null>;
  leadId: string;
  onForward: (text: string) => void;
}) {
  const {
    scrollerRef, onScroll, loaded, loadingMore, hasMore, topSentinelRef, grouped,
    messages, searchTerm, matches, activeMatch, pulseId,
    setReplyTo, pulseAndScroll, resend, stickToBottom, newCount, jumpToBottom, scrollToMsgRef,
    leadId, onForward,
  } = props;

  const virtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (i) => (grouped[i]?.kind === "date" ? 32 : 64),
    overscan: 12,
    getItemKey: (i) => grouped[i]?.key ?? i,
  });

  // Re-measure after layout when grouped changes (status/text updates)
  useLayoutEffect(() => { virtualizer.measure(); }, [grouped.length]);

  // Expose imperative scroll-to-message to parent
  useEffect(() => {
    scrollToMsgRef.current = (id: string) => {
      const idx = grouped.findIndex((g) => g.kind === "msg" && g.m.id === id);
      if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    };
    return () => { scrollToMsgRef.current = null; };
  }, [grouped, virtualizer, scrollToMsgRef]);

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
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

      <div style={{ height: totalSize, width: "100%", position: "relative" }}>
        {items.map((vi) => {
          const g = grouped[vi.index];
          if (!g) return null;
          return (
            <div
              key={vi.key}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              style={{
                position: "absolute", top: 0, left: 0, right: 0,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {g.kind === "date" ? (
                <div className="my-2 flex items-center justify-center pointer-events-none">
                  <span className="rounded-full bg-card/95 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur">
                    {g.label}
                  </span>
                </div>
              ) : g.kind === "note" ? (
                <NoteRow note={g.n} onRemove={(id) => removeNote(props.leadId, id)} />
              ) : (
                <MessageRow
                  m={g.m}
                  grouped={g.grouped}
                  messages={messages}
                  searchTerm={searchTerm}
                  matches={matches}
                  activeMatch={activeMatch}
                  pulseId={pulseId}
                  setReplyTo={setReplyTo}
                  pulseAndScroll={pulseAndScroll}
                  resend={resend}
                  onForward={props.onForward}
                />
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
  );
}

function NoteRow({ note, onRemove }: { note: InternalNote; onRemove: (id: string) => void }) {
  return (
    <div className="my-1.5 flex justify-center">
      <div className="group relative max-w-[80%] rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
        <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
          <StickyNote className="h-3 w-3" /> Nota interna
          <span className="ml-auto opacity-70">{fmtTime(note.created_at)}</span>
        </div>
        <div className="whitespace-pre-wrap break-words">{note.text}</div>
        <button
          onClick={() => onRemove(note.id)}
          className="absolute -right-1 -top-1 hidden rounded-full bg-card p-0.5 text-muted-foreground shadow group-hover:block hover:text-destructive"
          title="Remover nota"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function MessageRow(props: {
  m: Message;
  grouped: boolean;
  messages: Message[];
  searchTerm: string;
  matches: Message[];
  activeMatch: number;
  pulseId: string | null;
  setReplyTo: (m: Message) => void;
  pulseAndScroll: (id: string) => void;
  resend: (m: Message) => void;
  onForward: (text: string) => void;
}) {
  const { m, grouped, messages, searchTerm, matches, activeMatch, pulseId, setReplyTo, pulseAndScroll, resend, onForward } = props;
  const failed = m.status === "failed";
  const pending = m.status === "pending";
  const replied = m.reply_to_external_id
    ? messages.find((x) => x.external_id === m.reply_to_external_id)
    : null;
  const isMatch = searchTerm && (m.content ?? "").toLowerCase().includes(searchTerm.toLowerCase());
  const isActiveMatch = isMatch && matches[activeMatch]?.id === m.id;
  const pulsing = pulseId === m.id;
  const actions = (
    <div className="invisible flex flex-col gap-0.5 self-center opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
      <button onClick={() => setReplyTo(m)}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        title="Responder"><Reply className="h-3 w-3" /></button>
      {m.content && (
        <button onClick={() => onForward(m.content!)}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          title="Encaminhar"><Forward className="h-3 w-3" /></button>
      )}
    </div>
  );
  return (
    <div
      data-msg-id={m.id}
      className={cn("group flex items-end gap-1 px-0", m.from_me ? "justify-end" : "justify-start", grouped ? "pt-0.5" : "pt-2")}
    >
      {!m.from_me && actions}
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
            ? highlight(m.content, searchTerm, !!isActiveMatch)
            : (m.content || `[${m.message_type}]`)}
        </div>
        {m.message_type === "audio" && <AudioTranscript m={m} />}
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
      {m.from_me && actions}
    </div>
  );
}

function AudioTranscript({ m }: { m: Message }) {
  const initial = (m as any).raw?.transcript as string | undefined;
  const [transcript, setTranscript] = useState<string | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setTranscript(((m as any).raw?.transcript as string) ?? null); }, [m.id, (m as any).raw?.transcript]);
  async function go() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("transcribe-audio", { body: { message_id: m.id } });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error("Falha: " + (error?.message || (data as any)?.error));
      return;
    }
    setTranscript((data as any)?.transcript ?? "");
  }
  if (transcript) {
    return (
      <div className="mt-1 rounded border-l-2 border-primary/60 bg-background/40 px-2 py-1 text-[11px] italic text-foreground/80">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide text-primary">Transcrição</span>
        {transcript}
      </div>
    );
  }
  return (
    <button
      onClick={go}
      disabled={loading}
      className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? "Transcrevendo…" : "Transcrever áudio"}
    </button>
  );
}
