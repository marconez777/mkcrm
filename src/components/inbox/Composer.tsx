import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, Zap, Clock, X, FileText, Loader2, Mic, Square, Trash2 } from "lucide-react";
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
const MAX_FILES = 10;
const ACCEPT = "image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

function detectKind(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export default function Composer({ lead, onSend, seed }: { lead: Lead; onSend: (text: string) => Promise<void> | void; seed?: { text: string; n: number } | null }) {
  const [text, setText] = useState(() => getDraft(lead.id));
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickIdx, setQuickIdx] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { items: quickReplies } = useQuickReplies();

  // recording
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recCanceledRef = useRef(false);

  useEffect(() => { setDraft(lead.id, text); }, [text, lead.id]);
  useEffect(() => { setText(getDraft(lead.id)); setAttachments([]); }, [lead.id]);
  useEffect(() => { if (seed) { setText(seed.text); requestAnimationFrame(() => taRef.current?.focus()); } }, [seed?.n]);

  useEffect(() => {
    const onAttach = (e: Event) => {
      const detail = (e as CustomEvent<File | File[]>).detail;
      const files = Array.isArray(detail) ? detail : detail instanceof File ? [detail] : [];
      addFiles(files);
    };
    window.addEventListener("composer-attach-file", onAttach as EventListener);
    return () => window.removeEventListener("composer-attach-file", onAttach as EventListener);
  }, [lead.id, attachments.length]);

  // Object URLs for previews
  useEffect(() => {
    const next: Record<string, string> = {};
    attachments.forEach((f) => {
      const k = detectKind(f.type || "");
      if (k === "image" || k === "video") next[f.name + f.size] = URL.createObjectURL(f);
    });
    setPreviews(next);
    return () => { Object.values(next).forEach(URL.revokeObjectURL); };
  }, [attachments]);

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

  function addFiles(files: File[]) {
    if (!files.length) return;
    const room = MAX_FILES - attachments.length;
    if (room <= 0) { toast.error(`Máximo ${MAX_FILES} arquivos por envio`); return; }
    const accepted: File[] = [];
    for (const f of files.slice(0, room)) {
      if (f.size > MAX_FILE_SIZE) { toast.error(`"${f.name}" excede 16MB`); continue; }
      accepted.push(f);
    }
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
    if (files.length > room) toast.warning(`Apenas ${room} arquivo(s) adicionado(s) (limite ${MAX_FILES})`);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function sendAttachment(file: File, caption: string) {
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
    if (!v && attachments.length === 0) return;
    setSending(true);
    const files = attachments;
    const caption = v;
    setText("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
    try {
      if (files.length > 0) {
        // Caption goes only on the first file; rest are sent without caption
        for (let i = 0; i < files.length; i++) {
          await sendAttachment(files[i], i === 0 ? caption : "");
        }
        if (files.length > 1) toast.success(`${files.length} arquivos enviados`);
      } else {
        await onSend(v);
      }
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
      if (files.length) setAttachments(files);
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
    const fs = Array.from(e.clipboardData?.files ?? []);
    if (fs.length) { e.preventDefault(); addFiles(fs); }
  }

  // ============ Audio recording ============
  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunksRef.current = [];
      recCanceledRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        const wasCanceled = recCanceledRef.current;
        const finalMime = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(recChunksRef.current, { type: finalMime });
        recChunksRef.current = [];
        setRecording(false);
        setRecordSec(0);
        if (wasCanceled || blob.size === 0) return;
        const ext = finalMime.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: finalMime });
        addFiles([file]);
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setRecordSec(0);
      recTimerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          if (s >= 60 * 5) { stopRecording(false); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Não foi possível acessar o microfone: " + (e?.message ?? String(e)));
    }
  }

  function stopRecording(cancel: boolean) {
    recCanceledRef.current = cancel;
    const mr = recRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    recRef.current = null;
  }

  useEffect(() => () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    if (recStreamRef.current) recStreamRef.current.getTracks().forEach((t) => t.stop());
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }, []);

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

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          {attachments.map((f, idx) => {
            const k = detectKind(f.type || "");
            const url = previews[f.name + f.size];
            return (
              <div key={idx} className="group relative flex w-40 items-center gap-2 rounded border bg-background p-1.5">
                {k === "image" && url ? (
                  <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : k === "video" && url ? (
                  <video src={url} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">{k} · {(f.size / 1024).toFixed(0)} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {attachments.length > 1 && (
            <div className="flex w-full items-center justify-between px-1 pt-1 text-[10px] text-muted-foreground">
              <span>{attachments.length}/{MAX_FILES} arquivos · legenda vai no primeiro</span>
              <button onClick={() => setAttachments([])} className="hover:text-foreground">Limpar todos</button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />

      {recording ? (
        <div className="flex items-center gap-2 rounded-md border bg-destructive/10 p-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
          <span className="text-sm font-medium">Gravando… {fmtTime(recordSec)}</span>
          <span className="text-[10px] text-muted-foreground">(máx 5min)</span>
          <div className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => stopRecording(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => stopRecording(false)}>
              <Square className="mr-1 h-4 w-4" /> Parar
            </Button>
          </div>
        </div>
      ) : (
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
                <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} title="Anexar arquivos">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Anexar arquivos (até {MAX_FILES} · 16MB cada)</TooltipContent>
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
            placeholder={attachments.length ? "Adicione uma legenda (opcional)…" : "Mensagem... (Enter envia, Shift+Enter quebra linha)"}
            rows={1}
            className="max-h-40 min-h-[120px] flex-1 resize-none self-stretch"
          />

          <div className="flex flex-col gap-0.5 self-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" onClick={() => setScheduleOpen(true)} title="Agendar mensagem" disabled={attachments.length > 0}>
                  <Clock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Agendar envio</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" onClick={startRecording} title="Gravar áudio">
                  <Mic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gravar áudio</TooltipContent>
            </Tooltip>
          </div>

          <Button onClick={send} disabled={sending || (!text.trim() && attachments.length === 0)} size="icon" title="Enviar" className="self-end">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {text.length > 200 && !recording && (
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
