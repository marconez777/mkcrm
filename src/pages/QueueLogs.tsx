import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Ban, CheckCircle2, Clock, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useUpcomingQueue, useHistoryQueue, useQueueSummary,
  useAutomationsPaused, setAutomationsPaused, cancelQueueRow,
  type QueueRow,
} from "@/hooks/useQueueData";

const SOURCE_LABEL: Record<string, string> = {
  sequence: "Sequência", automation: "Automação", scheduled: "Agendada", reply: "Resposta IA",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    pending: { variant: "secondary", label: "Na fila" },
    sent: { variant: "default", label: "Enviado" },
    success: { variant: "default", label: "Sucesso" },
    failed: { variant: "destructive", label: "Falhou" },
    error: { variant: "destructive", label: "Erro" },
    skipped: { variant: "outline", label: "Pulado" },
    cancelled: { variant: "outline", label: "Cancelado" },
  };
  const cfg = map[status] ?? { variant: "outline", label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function QueueTable({
  rows, isLoading, canCancel, onCancel,
}: { rows: QueueRow[]; isLoading: boolean; canCancel: boolean; onCancel?: (r: QueueRow) => void }) {
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">Nada por aqui.</div>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Quando</TableHead>
            <TableHead className="w-[120px]">Origem</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden md:table-cell">Detalhe</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            {canCancel && <TableHead className="w-[80px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs whitespace-nowrap">{fmtWhen(r.when)}</TableCell>
              <TableCell><Badge variant="outline">{SOURCE_LABEL[r.source]}</Badge></TableCell>
              <TableCell>
                {r.leadId ? (
                  <Link to={`/inbox/${r.leadId}`} className="text-primary hover:underline text-sm">
                    {r.leadName ?? "(sem nome)"}
                  </Link>
                ) : <span className="text-muted-foreground text-sm">—</span>}
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[420px] truncate">
                {r.preview}
                {r.detail && <div className="text-destructive mt-1 truncate">{r.detail}</div>}
              </TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              {canCancel && (
                <TableCell className="text-right">
                  {(r.source === "scheduled" || r.source === "reply" || r.source === "sequence") && (
                    <Button size="sm" variant="ghost" onClick={() => onCancel?.(r)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function filterRows(rows: QueueRow[], { source, status, search }: { source: string; status: string; search: string }) {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (source !== "all" && r.source !== source) return false;
    if (status !== "all" && r.status !== status) return false;
    if (q && !(r.leadName ?? "").toLowerCase().includes(q) && !(r.preview ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

export default function QueueLogs() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id ?? null;
  const qc = useQueryClient();

  const summary = useQueueSummary();
  const upcoming = useUpcomingQueue();
  const history = useHistoryQueue();
  const failures = useHistoryQueue({ failedOnly: true });
  const paused = useAutomationsPaused(clinicId);

  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filters = { source, status, search };
  const upRows = useMemo(() => filterRows(upcoming.data ?? [], filters), [upcoming.data, source, status, search]);
  const histRows = useMemo(() => filterRows(history.data ?? [], filters), [history.data, source, status, search]);
  const failRows = useMemo(() => filterRows(failures.data ?? [], filters), [failures.data, source, status, search]);

  async function handlePause(v: boolean) {
    if (!clinicId) return;
    try {
      await setAutomationsPaused(clinicId, v);
      qc.invalidateQueries({ queryKey: ["clinic", clinicId, "automations_paused"] });
      toast.success(v ? "Envios automáticos pausados" : "Envios automáticos retomados");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao atualizar");
    }
  }

  async function handleCancel(row: QueueRow) {
    if (!confirm("Cancelar este envio?")) return;
    try {
      await cancelQueueRow(row);
      toast.success("Envio cancelado");
      qc.invalidateQueries({ queryKey: ["queue"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao cancelar");
    }
  }

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["queue"] });
  }

  const s = summary.data ?? { queued: 0, sent: 0, failed: 0, cancelled: 0 };

  return (
    <div className="space-y-4">
      {/* Kill switch banner */}
      <Card className={paused.data ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${paused.data ? "text-amber-600" : "text-muted-foreground"}`} />
            <div>
              <div className="font-medium text-sm">
                Envios automáticos: {paused.data ? "PAUSADOS" : "ativos"}
              </div>
              <div className="text-xs text-muted-foreground">
                Pausa sequências, automações e mensagens agendadas desta empresa. Novos envios não saem até retomar.
              </div>
            </div>
          </div>
          <Switch checked={!paused.data} onCheckedChange={(v) => handlePause(!v)} disabled={!clinicId} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="Na fila" value={s.queued} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Enviados (24h)" value={s.sent} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Falhas (24h)" value={s.failed} tone="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" />
        <StatCard icon={<Ban className="h-4 w-4" />} label="Cancelados (24h)" value={s.cancelled} tone="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="sequence">Sequências</SelectItem>
                <SelectItem value="automation">Automações</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
                <SelectItem value="reply">Respostas IA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Na fila</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="skipped">Pulado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar lead ou conteúdo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={refreshAll}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>

          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Fila ({upRows.length})</TabsTrigger>
              <TabsTrigger value="history">Histórico ({histRows.length})</TabsTrigger>
              <TabsTrigger value="failures">Falhas ({failRows.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              <QueueTable rows={upRows} isLoading={upcoming.isLoading} canCancel onCancel={handleCancel} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <QueueTable rows={histRows} isLoading={history.isLoading} canCancel={false} />
            </TabsContent>
            <TabsContent value="failures" className="mt-4">
              <QueueTable rows={failRows} isLoading={failures.isLoading} canCancel={false} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
