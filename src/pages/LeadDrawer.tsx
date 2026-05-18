import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/crm";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Phone, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useStages } from "@/hooks/useCrm";
import { useAttendants } from "@/hooks/useAttendants";
import { useConfirm } from "@/hooks/useDialogs";
import { deleteLead } from "@/lib/delete-lead";
import ContextRail from "@/components/inbox/ContextRail";
import ChatPane from "@/components/inbox/ChatPane";
import LeadJourneyTab from "@/components/lead/LeadJourneyTab";
import { LeadAttributionCard } from "@/components/leads/LeadAttributionCard";

export default function LeadDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const open = !!lead;
  const { stages } = useStages();
  const { attendants } = useAttendants();
  const confirm = useConfirm();
  const [syncing, setSyncing] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  if (!lead) return null;

  async function syncHistory() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("evolution-sync-lead", { body: { lead_id: lead!.id } });
    setSyncing(false);
    if (error) toast.error("Falha: " + error.message);
    else toast.success(`Sincronizado: ${(data as any)?.imported ?? 0} mensagens`);
  }

  async function reviewWithAi() {
    if (!lead) return;
    setReviewing(true);
    try {
      // 1. Descobre o Watcher da instância do lead
      const { data: leadRow } = await supabase
        .from("leads").select("whatsapp_instance_id").eq("id", lead.id).maybeSingle();
      const instanceId = leadRow?.whatsapp_instance_id;
      if (!instanceId) { toast.error("Lead sem WhatsApp vinculado"); return; }
      const { data: inst } = await supabase
        .from("whatsapp_instances").select("watcher_agent_id").eq("id", instanceId).maybeSingle();
      const agentId = inst?.watcher_agent_id;
      if (!agentId) { toast.error("Nenhum agente vigia configurado para esta conexão"); return; }
      const { error } = await supabase.functions.invoke("ai-chat", {
        body: { agent_id: agentId, lead_id: lead.id, messages: [] },
      });
      if (error) { toast.error("Falha: " + error.message); return; }
      toast.success("Vigia revisou a conversa");
    } finally {
      setReviewing(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: "Excluir este lead?", description: "Todo o histórico de mensagens será removido. Esta ação é irreversível.", confirmLabel: "Excluir definitivamente", destructive: true, requireTyping: "EXCLUIR" }))) return;
    try {
      await deleteLead(lead.id);
      toast.success("Lead excluído");
      onClose();
    } catch (error) {
      toast.error("Falha ao excluir lead", { description: error instanceof Error ? error.message : "Tente novamente." });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
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
          <div className="flex items-center gap-1 pr-10">
            <Button variant="ghost" size="icon" onClick={reviewWithAi} disabled={reviewing} title="Revisar conversa com IA (vigia)">
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={syncHistory} disabled={syncing} title="Sincronizar histórico completo">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={remove} title="Excluir lead"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </header>

        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] shrink-0 grid-cols-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="journey">Jornada</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ChatPane lead={lead} />
          </TabsContent>

          <TabsContent value="details" className="m-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto data-[state=inactive]:hidden">
            <ContextRail lead={lead} stages={stages} attendants={attendants} />
            <div className="px-5 pb-5">
              <LeadAttributionCard leadId={lead.id} />
            </div>
          </TabsContent>

          <TabsContent value="journey" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <LeadJourneyTab leadId={lead.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
