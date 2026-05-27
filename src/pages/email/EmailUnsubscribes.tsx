import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useConfirm } from "@/hooks/useDialogs";
import { TablePager, PAGE_SIZE } from "@/components/email/TablePager";

type Row = {
  email: string;
  clinic_id: string;
  unsubscribed_at: string;
  reason: string | null;
  source: string | null;
};

export default function EmailUnsubscribes() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("email_unsubscribes")
      .select("*", { count: "exact" })
      .order("unsubscribed_at", { ascending: false })
      .range(from, to);
    if (search.trim()) q = q.ilike("email", `%${search.trim()}%`);
    const { data, count, error } = await q;
    if (error) toast.error(error.message);
    else {
      setRows((data as Row[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  function applySearch() { setPage(0); load(); }

  async function remove(email: string) {
    if (!(await confirm({ title: "Remover descadastro?", description: `${email} voltará a poder receber e-mails.`, confirmLabel: "Remover", destructive: true }))) return;
    const { error } = await supabase.from("email_unsubscribes").delete().eq("email", email);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  async function runBackfill() {
    setBackfilling(true);
    try {
      const { error } = await supabase.functions.invoke("backfill-resend-events", { body: {} });
      if (error) throw error;
      toast.success("Backfill disparado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          placeholder="Buscar e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
          className="w-72 rounded-xl"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runBackfill} disabled={backfilling} className="rounded-xl">
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Rodar backfill
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border/40">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-4">E-mail</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Motivo</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Origem</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Data</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Nenhum descadastro</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.email} className="border-0 hover:bg-muted/40 transition-colors">
                <TableCell className="text-sm py-4 max-w-[320px] truncate" title={r.email}>{r.email}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.source ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.unsubscribed_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(r.email)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
