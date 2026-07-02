import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

type Row = {
  id: string; clinic_id: string | null; actor_user_id: string | null;
  action: string; entity: string | null; entity_id: string | null;
  diff: any; created_at: string;
  clinic?: { name: string } | null;
};

export default function AuditPanel({ clinics }: { clinics?: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fClinic, setFClinic] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("audit_log")
        .select("*, clinic:clinics(name)")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search) q = q.ilike("action", `%${search}%`);
      if (fClinic !== "all") {
        if (fClinic === "none") q = q.is("clinic_id", null);
        else q = q.eq("clinic_id", fClinic);
      }
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as any) ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, fClinic]);

  function exportCsv() {
    downloadCsv(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => ({
      created_at: r.created_at, clinic: r.clinic?.name ?? "", action: r.action,
      entity: r.entity, entity_id: r.entity_id, diff: r.diff,
    })));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrar por ação…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Select value={fClinic} onValueChange={setFClinic}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            <SelectItem value="none">Sem empresa</SelectItem>
            {clinics?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Buscar</Button>
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-3.5 w-3.5" />CSV</Button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</Button>
          Página {page + 1}
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => p + 1)}>›</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Diff</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{loading ? "Carregando…" : "Sem registros"}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{r.clinic?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="font-medium text-sm">{r.action}</TableCell>
                <TableCell className="text-xs">{r.entity ?? "—"}{r.entity_id ? <span className="text-muted-foreground"> · {r.entity_id.slice(0, 8)}</span> : null}</TableCell>
                <TableCell className="text-[11px] font-mono max-w-md truncate text-muted-foreground" title={JSON.stringify(r.diff)}>
                  {r.diff ? JSON.stringify(r.diff).slice(0, 80) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
