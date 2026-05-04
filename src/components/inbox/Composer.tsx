import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, Zap, Clock } from "lucide-react";
import type { Lead } from "@/types/crm";
import { useQuickReplies, applyVariables } from "@/hooks/useQuickReplies";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ScheduleMessageDialog from "./ScheduleMessageDialog";

import { getDraft, setDraft } from "@/lib/drafts";

const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😘","🤔","😎","🥳","👍","👏","🙏","🙌","💪","❤️","🔥","✨","🎉","✅","❌","⚠️","💰","📅","📞","📍","🚀","☝️","👇","👌"];

export default function Composer({ lead, onSend, seed }: { lead: Lead; onSend: (text: string) => Promise<void> | void; seed?: { text: string; n: number } | null }) {
  const [text, setText] = useState(() => getDraft(lead.id));
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickIdx, setQuickIdx] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { items: quickReplies } = useQuickReplies();

  // Persist draft per lead
  useEffect(() => { setDraft(lead.id, text); }, [text, lead.id]);
  // Reload draft when lead changes
  useEffect(() => { setText(getDraft(lead.id)); }, [lead.id]);
  // Apply suggestion seed
  useEffect(() => { if (seed) { setText(seed.text); requestAnimationFrame(() => taRef.current?.focus()); } }, [seed?.n]);


  // Quick reply trigger: text starts with "/"
  const quickQuery = text.startsWith("/") ? text.slice(1).toLowerCase() : null;
  const filteredQuick = useMemo(() => {
    if (quickQuery == null) return [];
    return quickReplies.filter(
      (q) => q.shortcut.toLowerCase().includes(quickQuery) || q.content.toLowerCase().includes(quickQuery),
    ).slice(0, 6);
  }, [quickReplies, quickQuery]);

  useEffect(() => {
    setShowQuick(filteredQuick.length > 0 && quickQuery != null);
    setQuickIdx(0);
  }, [filteredQuick.length, quickQuery]);

  // Auto-resize
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  function pickQuick(i: number) {
    const q = filteredQuick[i];
    if (!q) return;
    const filled = applyVariables(q.content, { name: lead.name, phone: lead.phone });
    setText(filled);
    setShowQuick(false);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function insertEmoji(e: string) {
    const el = taRef.current;
    if (!el) { setText((t) => t + e); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + e + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + e.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function send() {
    const v = text.trim();
    if (!v) return;
    setSending(true);
    setText("");
    try { await onSend(v); } finally { setSending(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showQuick) {
      if (e.key === "ArrowDown") { e.preventDefault(); setQuickIdx((i) => Math.min(i + 1, filteredQuick.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setQuickIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); pickQuick(quickIdx); return; }
      if (e.key === "Escape") { setShowQuick(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="relative border-t bg-card p-2">
      {showQuick && (
        <div className="absolute bottom-full left-2 right-2 mb-2 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          <div className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Respostas rápidas</div>
          {filteredQuick.map((q, i) => (
            <button
              key={q.id}
              onMouseDown={(e) => { e.preventDefault(); pickQuick(i); }}
              className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-sm", i === quickIdx ? "bg-accent" : "hover:bg-muted")}
            >
              <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">/{q.shortcut}</span>
              <span className="line-clamp-2 flex-1 text-xs">{q.content}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Emoji"><Smile className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-2">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => insertEmoji(e)} className="rounded text-lg hover:bg-muted">{e}</button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <span><Button type="button" variant="ghost" size="icon" disabled title="Em breve"><Paperclip className="h-4 w-4" /></Button></span>
          </TooltipTrigger>
          <TooltipContent>Anexos em breve</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" onClick={() => { setText("/"); requestAnimationFrame(() => taRef.current?.focus()); }} title="Respostas rápidas">
              <Zap className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Digite "/" para respostas rápidas</TooltipContent>
        </Tooltip>

        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Mensagem... (Enter envia, Shift+Enter quebra linha)"
          rows={1}
          className="max-h-40 min-h-[40px] flex-1 resize-none"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" onClick={() => setScheduleOpen(true)} title="Agendar mensagem">
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Agendar envio</TooltipContent>
        </Tooltip>

        <Button onClick={send} disabled={sending || !text.trim()} size="icon" title="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {text.length > 200 && (
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{text.length} caracteres</div>
      )}
      <ScheduleMessageDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        leadId={lead.id}
        initialText={text}
      />
    </div>
  );
}
