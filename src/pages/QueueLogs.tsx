import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Ban, CheckCircle2, Clock, Eye, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useUpcomingQueue, useHistoryQueue, useQueueSummary,
  useAutomationsPaused, setAutomationsPaused, cancelQueueRow,
  type QueueRow,
} from "@/hooks/useQueueData";
import { QueueDetailDialog, StatusBadge } from "@/components/queue/QueueDetailDialog";
import { explainQueueError } from "@/lib/queueErrorExplain";

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const { i18n } = useTranslation();
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value.toLocaleString(i18n.language)}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function useFmtWhen() {
  const { i18n } = useTranslation();
  return (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(i18n.language, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
}

function DetailCell({ row }: { row: QueueRow }) {
  const { t } = useTranslation();
  if (!row.detail) return <>{row.preview}</>;
  const isErr = row.status === "failed" || row.status === "error";
  const isWarn = row.status === "skipped" || row.status === "pending";
  return (
    <>
      {row.preview}
      {isErr || isWarn ? (
        <div className={`mt-1 truncate ${isErr ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
          {t(`queueLogs.errors.${explainQueueError(row.detail)}.title`)}
        </div>
      ) : (
        <div className="mt-1 truncate">{row.detail}</div>
      )}
    </>
  );
}

function QueueTable({
  rows, isLoading, canCancel, onCancel, onView,
}: { rows: QueueRow[]; isLoading: boolean; canCancel: boolean; onCancel?: (r: QueueRow) => void; onView: (r: QueueRow) => void }) {
  const { t } = useTranslation();
  const fmtWhen = useFmtWhen();
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">{t("queueLogs.table.loading")}</div>;
  if (rows.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">{t("queueLogs.table.empty")}</div>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">{t("queueLogs.table.when")}</TableHead>
            <TableHead className="w-[120px]">{t("queueLogs.table.origin")}</TableHead>
            <TableHead>{t("queueLogs.table.lead")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("queueLogs.table.detail")}</TableHead>
            <TableHead className="w-[120px]">{t("queueLogs.table.status")}</TableHead>
            <TableHead className={canCancel ? "w-[110px]" : "w-[64px]"} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => onView(r)}>
              <TableCell className="text-xs whitespace-nowrap">{fmtWhen(r.when)}</TableCell>
              <TableCell><Badge variant="outline">{t(`queueLogs.source.${r.source}`, { defaultValue: r.source })}</Badge></TableCell>
              <TableCell>
                {r.leadId ? (
                  <Link
                    to={`/inbox/${r.leadId}`}
                    className="text-primary hover:underline text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.leadName ?? t("queueLogs.table.noName")}
                  </Link>
                ) : <span className="text-muted-foreground text-sm">—</span>}
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[420px] truncate">
                <DetailCell row={r} />
              </TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  size="sm"
                  variant="ghost"
                  title={t("queueLogs.table.view")}
                  onClick={(e) => { e.stopPropagation(); onView(r); }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {canCancel && (r.source === "scheduled" || r.source === "reply" || r.source === "sequence") && (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onCancel?.(r); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
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
  const { t } = useTranslation();
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
  const [selected, setSelected] = useState<QueueRow | null>(null);

  const filters = { source, status, search };
  const upRows = useMemo(() => filterRows(upcoming.data ?? [], filters), [upcoming.data, source, status, search]);
  const histRows = useMemo(() => filterRows(history.data ?? [], filters), [history.data, source, status, search]);
  const failRows = useMemo(() => filterRows(failures.data ?? [], filters), [failures.data, source, status, search]);

  async function handlePause(v: boolean) {
    if (!clinicId) return;
    try {
      await setAutomationsPaused(clinicId, v);
      qc.invalidateQueries({ queryKey: ["clinic", clinicId, "automations_paused"] });
      toast.success(v ? t("queueLogs.paused") : t("queueLogs.resumed"));
    } catch (e: any) {
      toast.error(e.message ?? t("queueLogs.updateFailed"));
    }
  }

  async function handleCancel(row: QueueRow) {
    if (!confirm(t("queueLogs.cancelConfirm"))) return;
    try {
      await cancelQueueRow(row);
      toast.success(t("queueLogs.cancelled"));
      qc.invalidateQueries({ queryKey: ["queue"] });
    } catch (e: any) {
      toast.error(e.message ?? t("queueLogs.cancelFailed"));
    }
  }

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["queue"] });
  }

  const s = summary.data ?? { queued: 0, sent: 0, failed: 0, cancelled: 0 };

  return (
    <div className="space-y-4">
      <Card className={paused.data ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${paused.data ? "text-amber-600" : "text-muted-foreground"}`} />
            <div>
              <div className="font-medium text-sm">
                {paused.data ? t("queueLogs.automatedSendingsPaused") : t("queueLogs.automatedSendingsActive")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("queueLogs.killSwitchDescription")}
              </div>
            </div>
          </div>
          <Switch checked={!paused.data} onCheckedChange={(v) => handlePause(!v)} disabled={!clinicId} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label={t("queueLogs.stat.queued")} value={s.queued} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label={t("queueLogs.stat.sent")} value={s.sent} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={t("queueLogs.stat.failed")} value={s.failed} tone="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" />
        <StatCard icon={<Ban className="h-4 w-4" />} label={t("queueLogs.stat.cancelled")} value={s.cancelled} tone="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("queueLogs.filter.source")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("queueLogs.filter.allSources")}</SelectItem>
                <SelectItem value="sequence">{t("queueLogs.source.sequences")}</SelectItem>
                <SelectItem value="automation">{t("queueLogs.source.automations")}</SelectItem>
                <SelectItem value="scheduled">{t("queueLogs.source.scheduledPlural")}</SelectItem>
                <SelectItem value="reply">{t("queueLogs.source.replies")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("queueLogs.filter.status")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("queueLogs.filter.allStatus")}</SelectItem>
                <SelectItem value="pending">{t("queueLogs.status.pending")}</SelectItem>
                <SelectItem value="sent">{t("queueLogs.status.sent")}</SelectItem>
                <SelectItem value="success">{t("queueLogs.status.success")}</SelectItem>
                <SelectItem value="failed">{t("queueLogs.status.failed")}</SelectItem>
                <SelectItem value="error">{t("queueLogs.status.error")}</SelectItem>
                <SelectItem value="skipped">{t("queueLogs.status.skipped")}</SelectItem>
                <SelectItem value="cancelled">{t("queueLogs.status.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t("queueLogs.filter.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={refreshAll}>
                <RefreshCw className="h-4 w-4 mr-2" /> {t("queueLogs.filter.refresh")}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">{t("queueLogs.tab.upcoming")} ({upRows.length})</TabsTrigger>
              <TabsTrigger value="history">{t("queueLogs.tab.history")} ({histRows.length})</TabsTrigger>
              <TabsTrigger value="failures">{t("queueLogs.tab.failures")} ({failRows.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              <QueueTable rows={upRows} isLoading={upcoming.isLoading} canCancel onCancel={handleCancel} onView={setSelected} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <QueueTable rows={histRows} isLoading={history.isLoading} canCancel={false} onView={setSelected} />
            </TabsContent>
            <TabsContent value="failures" className="mt-4">
              <QueueTable rows={failRows} isLoading={failures.isLoading} canCancel={false} onView={setSelected} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <QueueDetailDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
