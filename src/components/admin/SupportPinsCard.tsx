import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pin, CheckCircle2, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Pinned = {
  id: string;
  thread_id: string;
  content: string;
  pinned_at: string;
  pinned_note: string | null;
  pinned_resolved: boolean;
  created_at: string;
  thread?: { title: string | null; last_route: string | null; user_id: string };
  user_name?: string;
};

export default function SupportPinsCard({ onOpenThread }: { onOpenThread?: (threadId: string) => void }) {
  const [items, setItems] = useState<Pinned[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("support_chat_messages" as any)
      .select("id, thread_id, content, pinned_at, pinned_note, pinned_resolved, created_at")
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false })
      .limit(50);
    if (!showResolved) q = q.eq("pinned_resolved", false);
    const { data } = await q;
    const list = ((data ?? []) as any[]) as Pinned[];

    const threadIds = Array.from(new Set(list.map((p) => p.thread_id)));
    if (threadIds.length) {
      const { data: ths } = await supabase
        .from("support_chat_threads")
        .select("id, title, last_route, user_id")
        .in("id", threadIds);
      const tmap = new Map<string, any>();
      (ths ?? []).forEach((t: any) => tmap.set(t.id, t));
      const userIds = Array.from(new Set((ths ?? []).map((t: any) => t.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nmap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => nmap.set(p.user_id, p.full_name ?? "—"));
      list.forEach((p) => {
        p.thread = tmap.get(p.thread_id);
        p.user_name = p.thread ? nmap.get(p.thread.user_id) ?? "—" : "—";
      });
    }
    setItems(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [showResolved]);

  async function unpin(id: string) {
    const { error } = await supabase.from("support_chat_messages" as any).update({
      pinned_at: null, pinned_by: null, pinned_note: null, pinned_resolved: false,
    } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Desfixado");
    load();
  }

  async function resolve(id: string) {
    const { error } = await supabase.from("support_chat_messages" as any).update({ pinned_resolved: true } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marcado como resolvido");
    load();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Pin className="h-4 w-4 text-amber-500" />
            Mensagens fixadas para revisão
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)} className="h-7 text-xs">
            {showResolved ? "Ocultar resolvidos" : "Mostrar resolvidos"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma mensagem fixada. Use o botão 📌 no monitor ao vivo ou no histórico de uma thread.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {items.map((p) => (
              <div key={p.id} className={`border rounded-md p-3 text-sm ${p.pinned_resolved ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                  <span className="font-medium">{p.user_name}</span>
                  {p.thread?.last_route && <span>· {p.thread.last_route}</span>}
                  <span>· fixada {format(new Date(p.pinned_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  {p.pinned_resolved && <Badge variant="secondary" className="ml-auto">resolvido</Badge>}
                </div>
                {p.pinned_note && (
                  <div className="text-xs italic text-amber-600 dark:text-amber-400 mb-1">"{p.pinned_note}"</div>
                )}
                <div className="text-xs whitespace-pre-wrap line-clamp-4 mb-2">{p.content || <span className="opacity-60">(vazio)</span>}</div>
                <div className="flex gap-2">
                  {onOpenThread && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenThread(p.thread_id)}>
                      Abrir thread
                    </Button>
                  )}
                  {!p.pinned_resolved && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(p.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unpin(p.id)}>
                    <X className="h-3 w-3 mr-1" /> Desfixar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
