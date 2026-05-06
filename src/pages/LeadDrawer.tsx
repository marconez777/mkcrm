import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Message } from "@/types/crm";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Loader2, Phone, Trash2, AlertCircle, RotateCw, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useStages } from "@/hooks/useCrm";
import { useAttendants } from "@/hooks/useAttendants";
import { useConfirm } from "@/hooks/useDialogs";
import ContextRail from "@/components/inbox/ContextRail";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LeadDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const open = !!lead;
  const { stages } = useStages();
  const { attendants } = useAttendants();
  const confirm = useConfirm();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!lead) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("messages").select("*").eq("lead_id", lead.id).order("timestamp");
      if (active && data) setMessages(data as Message[]);
      await supabase.from("leads").update({ unread_count: 0 }).eq("id", lead.id);
    };
    load();
    // Reconcile against Evolution in background — catches messages the webhook missed
    supabase.functions.invoke("evolution-sync-lead", { body: { lead_id: lead.id } }).catch(() => {});
    const ch = supabase.channel(`msg-${lead.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `lead_id=eq.${lead.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [lead?.id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  if (!lead) return null;

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const cid = crypto.randomUUID();
    const body = text;
    setText("");
    const { data, error } = await supabase.functions.invoke("evolution-send", { body: { lead_id: lead!.id, text: body, client_message_id: cid } });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error("Falha ao enviar: " + (error?.message || (data as any)?.error));
    }
  }

  async function resend(m: Message) {
    const { error } = await supabase.functions.invoke("evolution-send", {
      body: { lead_id: lead!.id, text: m.content ?? "", client_message_id: m.client_message_id ?? crypto.randomUUID() },
    });
    if (error) toast.error("Falha: " + error.message); else toast.success("Reenviando...");
  }

  async function syncHistory() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("evolution-sync-lead", { body: { lead_id: lead!.id } });
    setSyncing(false);
    if (error) toast.error("Falha: " + error.message);
    else toast.success(`Sincronizado: ${(data as any)?.imported ?? 0} mensagens`);
  }


  async function remove() {
    if (!(await confirm({ title: "Excluir este lead?", description: "Todo o histórico de mensagens será removido. Esta ação é irreversível.", confirmLabel: "Excluir definitivamente", destructive: true, requireTyping: "EXCLUIR" }))) return;
    await supabase.from("leads").delete().eq("id", lead!.id);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(lead.name || lead.phone).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold">{lead.name || lead.phone}</div>
              <div className="text-xs text-muted-foreground"><Phone className="mr-1 inline h-3 w-3" />{lead.phone}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={syncHistory} disabled={syncing} title="Sincronizar histórico">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </header>

        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] shrink-0 grid-cols-2">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <div ref={scrollerRef} className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4" style={{ background: "hsl(var(--chat-bg))" }}>
              {messages.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">Sem mensagens ainda.</div>}
              <div className="space-y-1.5">
                {messages.map((m) => {
                  const failed = m.status === "failed";
                  const pending = m.status === "pending";
                  return (
                    <div key={m.id} className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${failed ? "ring-1 ring-destructive" : ""} ${pending ? "opacity-70" : ""}`}
                        style={{ background: `hsl(var(--chat-bubble-${m.from_me ? "me" : "them"}))` }}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content || `[${m.message_type}]`}</div>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                          {failed && <AlertCircle className="h-3 w-3 text-destructive" />}
                          <span>{fmtTime(m.timestamp)}{m.from_me && ` · ${m.status}`}</span>
                          {failed && (
                            <button onClick={() => resend(m)} className="ml-1 inline-flex items-center gap-0.5 text-destructive hover:underline">
                              <RotateCw className="h-3 w-3" /> reenviar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-end gap-2 border-t bg-card p-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Mensagem..."
                rows={1}
                className="max-h-32 min-h-[40px] resize-none"
              />
              <Button onClick={send} disabled={sending || !text.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="details" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ContextRail lead={lead} stages={stages} attendants={attendants} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
