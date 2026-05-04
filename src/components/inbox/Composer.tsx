import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, Zap, Clock, X, FileText, Loader2 } from "lucide-react";
import type { Lead } from "@/types/crm";
import { useQuickReplies, applyVariables } from "@/hooks/useQuickReplies";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ScheduleMessageDialog from "./ScheduleMessageDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { getDraft, setDraft } from "@/lib/drafts";

const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😘","🤔","😎","🥳","👍","👏","🙏","🙌","💪","❤️","🔥","✨","🎉","✅","❌","⚠️","💰","📅","📞","📍","🚀","☝️","👇","👌"];
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp limit
const ACCEPT = "image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

function detectKind(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export default function Composer({ lead, onSend, seed }: { lead: Lead; onSend: (text: string) => Promise<void> | void; seed?: { text: string; n: number } | null }) {
  const [text, setText] = useState(() => getDraft(lead.id));
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickIdx, setQuickIdx] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { items: quickReplies } = useQuickReplies();

  useEffect(() => { setDraft(lead.id, text); }, [text, lead.id]);
  useEffect(() => { setText(getDraft(lead.id)); setAttachment(null); }, [lead.id]);
  useEffect(() => { if (seed) { setText(seed.text); requestAnimationFrame(() => taRef.current?.focus()); } }, [seed?.n]);

  // Object URL for image/video preview
  useEffect(() => {
    if (!attachment) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(attachment);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

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

  function onPickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande. Máximo 16MB (WhatsApp).`);
      return;
    }
    setAttachment(f);
  }

  async function sendAttachment(file: File, caption: string) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${lead.id}/${crypto.randomUUID()}-${safeName}`;
    const up = await supabase.storage.from("chat-attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (up.error) throw up.error;
    const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    const mediaUrl = pub.publicUrl;
    const kind = detectKind(file.type || "");
    const cid = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("evolution-send-media", {
      body: {
        lead_id: lead.id,
        media_url: mediaUrl,
        mime: file.type || "application/octet-stream",
        filename: file.name,
        caption,
        media_kind: kind,
        client_message_id: cid,
      },
    });
    if (error || (data as any)?.error) {
      throw new Error(error?.message || (data as any)?.error || "Falha ao enviar anexo");
    }
  }

  async function send() {
    if (sending) return;
    const v = text.trim();
    if (!v && !attachment) return;
    setSending(true);
    const file = attachment;
    const caption = v;
    setText("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    try {
      if (file) {
        await sendAttachment(file, caption);
      } else {
        await onSend(v);
      }
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
      // restore so user can retry
      if (file) setAttachment(file);
      else setText(v);
    } finally {
      setSending(false);
    }
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

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const f = e.clipboardData?.files?.[0];
    if (f) { e.preventDefault(); onPickFile(f); }
  }

  const kind = attachment ? detectKind(attachment.type || "") : null;

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

      {attachment && (
        <div className="mb-2 flex items-center gap-3 rounded-md border bg-muted/30 p-2">
          {kind === "image" && previewUrl ? (
            <img src={previewUrl} alt="" className="h-14 w-14 rounded object-cover" />
          ) : kind === "video" && previewUrl ? (
            <video src={previewUrl} className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{attachment.name}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {kind} · {(attachment.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setAttachment(null)} title="Remover anexo">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { onPickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />

      <div className="flex items-stretch gap-1">
        <div className="flex flex-col gap-0.5 self-end">
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
              <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} title="Anexar arquivo">
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Anexar arquivo (max 16MB)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setText("/"); requestAnimationFrame(() => taRef.current?.focus()); }} title="Respostas rápidas">
                <Zap className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Digite "/" para respostas rápidas</TooltipContent>
          </Tooltip>
        </div>

        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
          placeholder={attachment ? "Adicione uma legenda (opcional)…" : "Mensagem... (Enter envia, Shift+Enter quebra linha)"}
          rows={1}
          className="max-h-40 min-h-[120px] flex-1 resize-none self-stretch"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" onClick={() => setScheduleOpen(true)} title="Agendar mensagem" disabled={!!attachment}>
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Agendar envio</TooltipContent>
        </Tooltip>

        <Button onClick={send} disabled={sending || (!text.trim() && !attachment)} size="icon" title="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
