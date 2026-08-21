import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Play, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/email/StatusBadge";
import { TablePager, PAGE_SIZE } from "@/components/email/TablePager";
import { cn } from "@/lib/utils";

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

const FILTERS = ["all", "pending", "sending", "sent", "failed", "cancelled"];

// Janela de coalescencia do realtime. Cada e-mail passa por pending -> sending
// -> sent: uma campanha de 146k gera ~438 mil eventos. Sem isso, cada um
// refazia o load() com count exact e a aba travava.
const REALTIME_REFRESH_MS = 5000;

export default function EmailQueue() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // `silent` evita piscar o spinner nas atualizacoes vindas do realtime.
  async function load(silent = false) {
    if (!silent) setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("email_queue")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, count, error } = await q;
    if (error) toast.error(error.message);
    else {
      setRows((data as QueueRow[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, clinicId]);

  // Canal separado do load(): antes ele era recriado a cada clique de pagina ou
  // filtro. E filtrado por clinica — sem o filtro, evento de qualquer tenant
  // recarregava esta tela.
  useEffect(() => {
    if (!clinicId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`email_queue_changes_${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_queue", filter: `clinic_id=eq.${clinicId}` },
        () => {
          if (timer) return; // ja ha um refresh agendado nesta janela
          timer = setTimeout(() => { timer = null; loadRef.current(true); }, REALTIME_REFRESH_MS);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [clinicId]);

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

  async function reprocess(id: string) {
    const { error } = await supabase
      .from("email_queue")
      .update({ status: "pending", scheduled_at: new Date().toISOString(), attempts: 0, error: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reagendado para agora");
    supabase.functions.invoke("process-email-queue", { body: {} }).catch(() => {});
    setTimeout(load, 800);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => { setPage(0); setFilter(s); }}
              className={cn("rounded-full h-8 px-3", filter === s && "shadow-[var(--shadow-soft)]")}
            >
              {s === "all" ? "Todos" : s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="rounded-xl">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={processNow} disabled={processing} className="rounded-xl shadow-[var(--shadow-soft)]">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Processar agora
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border/40">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-4">Destinatário</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Template</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tentativas</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Agendado</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Erro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Sem itens na fila</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className="border-0 hover:bg-muted/40 transition-colors">
                <TableCell className="text-sm py-4">
                  <div>{r.recipient_email}</div>
                  {r.recipient_name && <div className="text-xs text-muted-foreground">{r.recipient_name}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.template_slug ?? "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} size="sm" /></TableCell>
                <TableCell className="text-xs tabular-nums">{r.attempts}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.scheduled_at), { locale: ptBR, addSuffix: true })}
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--status-failed-fg))] max-w-[240px] truncate" title={r.error ?? ""}>{r.error ?? ""}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {(r.status === "failed" || r.status === "cancelled") && (
                      <Button size="sm" variant="ghost" onClick={() => reprocess(r.id)} className="text-muted-foreground hover:text-primary">Reprocessar</Button>
                    )}
                    {(r.status === "pending" || r.status === "failed") && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(r.id)} className="text-muted-foreground hover:text-destructive">Cancelar</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePager page={page} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
