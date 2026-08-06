import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

export default function LeadDebugTab({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (cancelled) return;
      setEvents(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <ScrollArea className="h-full bg-muted/30">
      <div className="space-y-2 p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Logs Técnicos e Telemetria (Apenas Dev/Admin)</h3>
        {events.map((e) => (
          <div key={e.id} className="rounded border bg-background p-3 text-xs shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-primary">{e.type}</span>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-[10px]">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
