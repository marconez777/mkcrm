import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, Copy, MessageSquare, Wrench } from "lucide-react";
import { explainQueueError, type QueueErrorKey } from "@/lib/queueErrorExplain";
import type { QueueRow, QueueSource } from "@/hooks/useQueueData";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variants: Record<string, any> = {
    pending: "secondary", sent: "default", success: "default",
    failed: "destructive", error: "destructive",
    skipped: "outline", cancelled: "outline",
  };
  const variant = variants[status] ?? "outline";
  const label = t(`queueLogs.status.${status}`, { defaultValue: status });
  return <Badge variant={variant}>{label}</Badge>;
}

function fixCta(key: QueueErrorKey, source: QueueSource): { to: string; labelKey: string } | null {
  switch (key) {
    case "noInstance":
    case "instanceDisconnected":
    case "connectionClosed":
    case "sendUnconfirmed":
    case "sendRetriesExhausted":
    case "networkIssue":
    case "http409":
      return { to: "/settings", labelKey: "goToSettings" };
    case "missingAgent":
    case "stageMissing":
    case "unknownAction":
      return { to: "/ai/messages/automations", labelKey: "goToAutomations" };
    case "templateMissing":
    case "emptyContent":
      return source === "sequence"
        ? { to: "/ai/messages/sequences", labelKey: "goToSequences" }
        : { to: "/ai/messages/automations", labelKey: "goToAutomations" };
    default:
      return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export function QueueDetailDialog({ row, onClose }: { row: QueueRow | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [techOpen, setTechOpen] = useState(false);

  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const isError = row ? row.status === "failed" || row.status === "error" : false;
  const isWarn = row ? row.status === "skipped" || (row.status === "pending" && !!row.detail) : false;
  const showProblem = !!row?.detail && (isError || isWarn);
  const errorKey = showProblem ? explainQueueError(row?.detail) : null;
  const cta = errorKey && row ? fixCta(errorKey, row.source) : null;
  const isSent = row ? row.status === "sent" || row.status === "success" : false;

  async function copyTech() {
    if (!row?.detail) return;
    try {
      await navigator.clipboard.writeText(`${row.detail}\n\nref: ${row.refId}`);
      toast.success(t("queueLogs.dialog.copied"));
    } catch {
      /* clipboard indisponível (permissão/contexto) */
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) { setTechOpen(false); onClose(); } }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{t("queueLogs.dialog.title")}</DialogTitle>
              <DialogDescription>
                {t(`queueLogs.source.${row.source}`, { defaultValue: row.source })} · {fmtFull(row.when)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("queueLogs.dialog.origin")}>
                <Badge variant="outline">{t(`queueLogs.source.${row.source}`, { defaultValue: row.source })}</Badge>
              </Field>
              <Field label={t("queueLogs.dialog.status")}>
                <StatusBadge status={row.status} />
              </Field>
              <Field label={t("queueLogs.dialog.lead")}>
                {row.leadId ? (
                  <Link to={`/inbox/${row.leadId}`} className="text-primary hover:underline">
                    {row.leadName ?? t("queueLogs.table.noName")}
                  </Link>
                ) : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label={t("queueLogs.dialog.when")}>{fmtFull(row.when)}</Field>
            </div>

            {row.preview && (
              <Field label={t("queueLogs.dialog.content")}>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.preview}</p>
              </Field>
            )}

            {errorKey && (
              <div className={`space-y-3 rounded-lg border p-4 ${isError ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/10"}`}>
                <div className={`flex items-center gap-2 font-medium ${isError ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t(`queueLogs.errors.${errorKey}.title`)}
                </div>
                <p className="text-sm text-foreground/90">{t(`queueLogs.errors.${errorKey}.explain`)}</p>
                <div className="rounded-md border bg-background/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4 shrink-0" />
                    {t("queueLogs.dialog.howToFix")}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`queueLogs.errors.${errorKey}.fix`)}</p>
                  {cta && (
                    <Button asChild size="sm" variant="outline" className="mt-2">
                      <Link to={cta.to}>{t(`queueLogs.dialog.${cta.labelKey}`)}</Link>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isSent && row.detail && (
              <Field label={t("queueLogs.dialog.sentContent")}>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.detail}</p>
              </Field>
            )}

            {row.detail && (
              <div>
                <button
                  type="button"
                  onClick={() => setTechOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${techOpen ? "rotate-90" : ""}`} />
                  {t("queueLogs.dialog.technical")}
                </button>
                {techOpen && (
                  <div className="relative mt-2">
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 pr-10 text-xs">
                      {`${row.detail}\n\n${t("queueLogs.dialog.refId")}: ${row.refId}`}
                    </pre>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={copyTech}
                      title={t("queueLogs.dialog.copy")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              {row.leadId && (
                <Button asChild variant="outline">
                  <Link to={`/inbox/${row.leadId}`}>
                    <MessageSquare className="mr-2 h-4 w-4" /> {t("queueLogs.dialog.openLead")}
                  </Link>
                </Button>
              )}
              <Button onClick={onClose}>{t("queueLogs.dialog.close")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
