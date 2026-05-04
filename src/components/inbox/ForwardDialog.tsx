import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { useLeadsPaginated } from "@/hooks/useLeadsPaginated";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  text: string;
  excludeLeadId?: string;
};

export default function ForwardDialog({ open, onClose, text, excludeLeadId }: Props) {
  const { leads } = useLeadsPaginated();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return leads
      .filter((l) => l.id !== excludeLeadId)
      .filter((l) => {
        if (!ql) return true;
        return `${l.name ?? ""} ${l.phone}`.toLowerCase().includes(ql);
      })
      .slice(0, 50);
  }, [leads, q, excludeLeadId]);

  async function send() {
    if (!selected) return;
    setSending(true);
    try {
      const body = {
        lead_id: selected,
        text: `↪ ${text}`,
        client_message_id: crypto.randomUUID(),
      };
      const { error } = await supabase.functions.invoke("evolution-send", { body });
      if (error) throw error;
      toast.success("Mensagem encaminhada");
      onClose();
      setSelected(null);
      setQ("");
    } catch (e: any) {
      toast.error("Falha ao encaminhar: " + (e?.message ?? String(e)));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground line-clamp-3">
            {text}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar conversa…"
              className="h-9 pl-8"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma conversa</div>
            )}
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                  selected === l.id && "bg-accent",
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {(l.name || l.phone).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{l.name || l.phone}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{l.phone}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={send} disabled={!selected || sending}>
            {sending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
