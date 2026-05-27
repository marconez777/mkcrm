import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/email/StatusBadge";
import { TablePager, PAGE_SIZE } from "@/components/email/TablePager";
import { cn } from "@/lib/utils";

type LogRow = {
  id: string;
  recipient_email: string;
  template_slug: string | null;
  subject: string;
  status: string;
  resend_id: string | null;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  error: string | null;
};

const FILTERS = ["all", "sent", "delivered", "opened", "clicked", "bounced", "complained", "failed"];

export default function EmailLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(from, to);
    if (filter !== "all") q = q.eq("status", filter);
    if (search.trim()) q = q.ilike("recipient_email", `%${search.trim()}%`);
    const { data, count, error } = await q;
    if (error) toast.error(error.message);
    else {
      setRows((data as LogRow[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, page]);

  function applySearch() {
    setPage(0);
    load();
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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="email@..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="pl-8 w-56 rounded-xl"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border/40">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-4">Destinatário</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Assunto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Template</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Enviado</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Eventos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Sem logs</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className="border-0 hover:bg-muted/40 transition-colors">
                <TableCell className="text-sm py-4">{r.recipient_email}</TableCell>
                <TableCell className="text-sm max-w-[280px] truncate" title={r.subject}>{r.subject}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.template_slug ?? "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} size="sm" /></TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.sent_at), "dd/MM HH:mm")}
                </TableCell>
                <TableCell className="text-xs space-x-1">
                  {r.delivered_at && <StatusBadge status="delivered" size="sm" />}
                  {r.opened_at && <StatusBadge status="opened" size="sm" />}
                  {r.clicked_at && <StatusBadge status="clicked" size="sm" />}
                  {r.bounced_at && <StatusBadge status="bounced" size="sm" />}
                  {r.complained_at && <StatusBadge status="complained" size="sm" />}
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
