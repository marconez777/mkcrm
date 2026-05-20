import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useConfirm } from "@/hooks/useDialogs";

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

  async function load() {
    setLoading(true);
    let q = supabase.from("email_unsubscribes").select("*").order("unsubscribed_at", { ascending: false }).limit(500);
    if (search.trim()) q = q.ilike("email", `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(email: string) {
    if (!confirm(`Remover ${email} da lista de descadastros?`)) return;
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
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="w-72"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runBackfill} disabled={backfilling}>
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Rodar backfill
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Data</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum descadastro</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.email}>
                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                <TableCell className="text-xs">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.source ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.unsubscribed_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.email)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
