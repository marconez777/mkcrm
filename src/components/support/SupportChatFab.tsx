import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Minus, Send, Loader2, RotateCcw, ArrowRight, Target, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { parseAssistantContent, highlightElement, type ContentPart } from "@/lib/support-actions";
import { getRuntimeErrors } from "@/lib/support-runtime-watcher";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; id?: string; rating?: -1 | 1 | null };
type FabState = "closed" | "minimized" | "open";

const STORAGE_KEY = "support-chat-state";
const HIDDEN_PREFIXES = ["/auth", "/onboarding", "/site/"];

function buildScreenContext(pathname: string) {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((el) => (el.textContent ?? "").trim())
    .filter(Boolean).slice(0, 12);
  const buttons = Array.from(document.querySelectorAll("button, a[role='button']"))
    .map((el) => (el.textContent ?? "").trim())
    .filter((t) => t && t.length < 40).slice(0, 20);
  // Recent runtime issues (last 2 min), prioritize current route
  const errsCurrent = getRuntimeErrors({ sinceMs: 2 * 60_000, route: pathname });
  const errsAny = getRuntimeErrors({ sinceMs: 2 * 60_000 });
  const errs = (errsCurrent.length ? errsCurrent : errsAny).map((e) => ({
    kind: e.kind,
    message: e.message,
    status: e.status,
    url: e.url,
  }));
  return {
    route: pathname,
    page_title: document.title,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    headings,
    buttons,
    runtime_errors: errs,
  };
}

export default function SupportChatFab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<FabState>("closed");
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.state) setState(s.state);
        if (Array.isArray(s.messages)) setMessages(s.messages);
        if (s.threadId) setThreadId(s.threadId);
      }
    } catch { /* ignore */ }
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, messages: messages.slice(-30), threadId }));
    } catch { /* ignore */ }
  }, [state, messages, threadId]);

  // check enabled
  useEffect(() => {
    if (!user) { setEnabled(false); return; }
    supabase.from("support_agent_config").select("enabled").eq("singleton", true).maybeSingle()
      .then(({ data }) => setEnabled(!!data?.enabled));
  }, [user?.id]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // global shortcut: "?" toggles the chat (ignored while typing). Esc minimizes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = !!tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (!typing && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
        e.preventDefault();
        setState((s) => (s === "open" ? "minimized" : "open"));
      } else if (e.key === "Escape" && state === "open") {
        setState("minimized");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  function exportConversation() {
    if (!messages.length) return;
    const lines = messages.map((m) => {
      const tag = m.role === "user" ? "VOCÊ" : "ALFRED";
      return `### ${tag}\n${m.content}\n`;
    });
    const header = `# Conversa MK-CRM Suporte\n${new Date().toLocaleString("pt-BR")}\nThread: ${threadId ?? "—"}\n\n---\n\n`;
    const blob = new Blob([header + lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suporte-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  const hidden = !user || !enabled || HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (hidden) return null;

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "" }]);
    setStreaming(true);

    const ctx = buildScreenContext(location.pathname);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const resp = await fetch(url, {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ thread_id: threadId, message: text, context: ctx }),
      });
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let evt: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line) { evt = null; continue; }
          if (line.startsWith("event: ")) { evt = line.slice(7).trim(); continue; }
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (evt === "meta") {
              if (j?.thread_id) setThreadId(j.thread_id);
              if (j?.assistant_message_id) {
                setMessages((m) => {
                  const out = [...m];
                  const last = out[out.length - 1];
                  if (last?.role === "assistant") out[out.length - 1] = { ...last, id: j.assistant_message_id };
                  return out;
                });
              }
              evt = null;
              continue;
            }
            const delta = j?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              acc += delta;
              setMessages((m) => {
                const out = [...m];
                const last = out[out.length - 1];
                out[out.length - 1] = { ...(last ?? {}), role: "assistant", content: acc };
                return out;
              });
            }
          } catch { /* incomplete chunk - put back */
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages((m) => {
        const out = [...m];
        out[out.length - 1] = { role: "assistant", content: `❌ Erro: ${e?.message ?? "falha desconhecida"}` };
        return out;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function resetThread() {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setInput("");
    setStreaming(false);
  }

  // Closed bubble
  if (state === "closed") {
    return (
      <button
        onClick={() => setState("open")}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        aria-label="Abrir suporte"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  // Minimized bar
  if (state === "minimized") {
    return (
      <button
        onClick={() => setState("open")}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 shadow-lg hover:scale-105 transition-transform text-sm"
      >
        <MessageCircle className="h-4 w-4" />
        Suporte (minimizado)
      </button>
    );
  }

  // Open panel
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col rounded-xl border bg-background shadow-2xl",
        "w-[380px] h-[580px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]"
      )}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Suporte via chat</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetThread} title="Nova conversa">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setState("minimized")} title="Minimizar">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setState("closed")} title="Fechar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            <p className="mb-2">👋 Oi! Sou o assistente de suporte.</p>
            <p>Pergunte qualquer coisa sobre o sistema — eu vejo onde você está e posso te guiar passo a passo.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {m.role === "assistant" ? (
                <div className="space-y-1.5">
                  <AssistantBubble
                    content={m.content || "…"}
                    onAction={(a) => {
                      if (a.kind === "go") { navigate(a.route); setState("minimized"); }
                      else if (a.kind === "click") {
                        const ok = highlightElement(a.selector);
                        if (!ok) toast.error(`Não achei "${a.selector}" nesta tela`);
                      } else if (a.kind === "step") {
                        setInput("feito"); setTimeout(send, 50);
                      }
                    }}
                  />
                  {m.id && m.content && !(streaming && i === messages.length - 1) && (
                    <FeedbackBar
                      messageId={m.id}
                      rating={m.rating ?? null}
                      onRate={async (r) => {
                        setMessages((ms) => ms.map((x, idx) => idx === i ? { ...x, rating: r } : x));
                        const { error } = await supabase.from("support_feedback").upsert(
                          { message_id: m.id!, user_id: user!.id, rating: r },
                          { onConflict: "message_id,user_id" },
                        );
                        if (error) toast.error("Não consegui registrar feedback");
                      }}
                    />
                  )}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> pensando…
          </div>
        )}
      </div>

      <div className="border-t p-2 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Digite sua dúvida…"
          rows={1}
          className="resize-none min-h-[40px] max-h-32 text-sm"
          disabled={streaming}
        />
        <Button onClick={send} disabled={streaming || !input.trim()} size="icon" className="shrink-0">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function AssistantBubble({ content, onAction }: { content: string; onAction: (a: any) => void }) {
  const parts: ContentPart[] = parseAssistantContent(content);
  return (
    <div className="space-y-2">
      {parts.map((p, i) => {
        if (p.type === "text") {
          if (!p.text.trim()) return null;
          return (
            <div key={i} className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&_ol]:my-1 [&_ul]:my-1">
              <ReactMarkdown>{p.text}</ReactMarkdown>
            </div>
          );
        }
        const a = p.action;
        const Icon = a.kind === "go" ? ArrowRight : a.kind === "click" ? Target : CheckCircle2;
        return (
          <button
            key={i}
            onClick={() => onAction(a)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs px-2.5 py-1 transition-colors mr-1.5"
          >
            <Icon className="h-3 w-3" />
            {a.kind === "step" ? `✓ ${a.label}` : a.label}
          </button>
        );
      })}
    </div>
  );
}

function FeedbackBar({ messageId, rating, onRate }: { messageId: string; rating: -1 | 1 | null; onRate: (r: -1 | 1) => void }) {
  return (
    <div className="flex items-center gap-1 pt-1 -mb-0.5 opacity-70 hover:opacity-100 transition-opacity">
      <button
        onClick={() => onRate(1)}
        className={cn(
          "p-1 rounded hover:bg-primary/10 transition-colors",
          rating === 1 && "text-primary bg-primary/15",
        )}
        title="Resposta útil"
        aria-label="Útil"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => onRate(-1)}
        className={cn(
          "p-1 rounded hover:bg-destructive/10 transition-colors",
          rating === -1 && "text-destructive bg-destructive/15",
        )}
        title="Não foi útil"
        aria-label="Não útil"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
