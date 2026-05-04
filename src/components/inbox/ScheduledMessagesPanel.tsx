import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Clock, X, AlertCircle } from "lucide-react";
import { listScheduled, cancelScheduled, type ScheduledMessage } from "@/lib/scheduled-messages";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ScheduledMessagesPanel({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<ScheduledMessage[]>([]);

  const reload = useCallback(() => {
    listScheduled(leadId).then((all) => setItems(all.filter((x) => x.status === "pending" || x.status === "failed")));
  }, [leadId]);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`sched-${leadId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "scheduled_messages", filter: `lead_id=eq.${leadId}` },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId, reload]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3 w-3" /> Mensagens agendadas · {items.length}
      </div>
      <ul className="space-y-1.5">
        {items.map((s) => (
          <li key={s.id} className="group flex items-start gap-2 rounded border bg-background px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-xs">{s.content}</div>
              <div className={cn("text-[10px] mt-0.5", s.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                {s.status === "failed" ? <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" />Falhou: {s.last_error?.slice(0, 60)}</span> : fmt(s.send_at)}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => cancelScheduled(s.id)} title="Cancelar">
              <X className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
