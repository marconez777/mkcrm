import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";

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

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  opened: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  clicked: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  bounced: "bg-red-500/15 text-red-700 dark:text-red-400",
  complained: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function EmailLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    let q = supabase.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(500);
    if (filter !== "all") q = q.eq("status", filter);
    if (search.trim()) q = q.ilike("recipient_email", `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {["all", "sent", "delivered", "opened", "clicked", "bounced", "complained", "failed"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
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
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="pl-8 w-56"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Eventos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem logs</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.recipient_email}</TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={r.subject}>{r.subject}</TableCell>
                <TableCell className="text-xs">{r.template_slug ?? "—"}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.sent_at), "dd/MM HH:mm")}
                </TableCell>
                <TableCell className="text-xs space-x-1">
                  {r.delivered_at && <Badge variant="outline" className="text-[10px]">entregue</Badge>}
                  {r.opened_at && <Badge variant="outline" className="text-[10px]">aberto</Badge>}
                  {r.clicked_at && <Badge variant="outline" className="text-[10px]">clicado</Badge>}
                  {r.bounced_at && <Badge variant="destructive" className="text-[10px]">bounce</Badge>}
                  {r.complained_at && <Badge variant="destructive" className="text-[10px]">spam</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
