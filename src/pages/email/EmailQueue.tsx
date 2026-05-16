import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Play, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type QueueRow = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  template_slug: string | null;
  status: string;
  attempts: number;
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  sending: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sent: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export default function EmailQueue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    let q = supabase.from("email_queue").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRows((data as QueueRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("email_queue_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_queue" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function processNow() {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("process-email-queue", { body: {} });
      if (error) throw error;
      toast.success("Processamento disparado");
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar");
    } finally {
      setProcessing(false);
    }
  }

  async function cancel(id: string) {
    const { error } = await supabase.from("email_queue").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cancelado"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {["all", "pending", "sending", "sent", "failed", "cancelled"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
              {s === "all" ? "Todos" : s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={processNow} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Processar agora
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Agendado</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem itens na fila</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <div>{r.recipient_email}</div>
                  {r.recipient_name && <div className="text-muted-foreground">{r.recipient_name}</div>}
                </TableCell>
                <TableCell className="text-xs">{r.template_slug ?? "—"}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.attempts}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.scheduled_at), { locale: ptBR, addSuffix: true })}
                </TableCell>
                <TableCell className="text-xs text-red-500 max-w-[240px] truncate" title={r.error ?? ""}>{r.error ?? ""}</TableCell>
                <TableCell>
                  {(r.status === "pending" || r.status === "failed") && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Cancelar</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
