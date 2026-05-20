import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink, BarChart3 } from "lucide-react";

type Step = { template_slug: string; delay_minutes: number };

type Automation = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  steps: Step[];
};

export type Bucket = "enrolled" | "queued" | "sent" | "opened" | "clicked" | "failed" | "all";

type StepStats = {
  slug: string;
  queued: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
};

type EmailLogRow = {
  template_slug: string | null;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  related_lead_id: string | null;
  recipient_email: string;
  sent_at: string;
};

type QueueRow = {
  template_slug: string | null;
  status: string;
  related_lead_id: string | null;
  recipient_email: string;
  scheduled_at: string;
  error: string | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead criado",
  lead_stage_changed: "Lead mudou de estágio",
  lead_tag_added: "Tag adicionada ao lead",
};

const toDays = (m: number) => Math.floor((m || 0) / 1440);

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function pct(num: number, denom: number) {
  if (!denom) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

export function AutomationReportDialog({
  automation,
  open,
  onOpenChange,
}: {
  automation: Automation | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [sheet, setSheet] = useState<{
    bucket: Bucket;
    stepSlug?: string;
    title: string;
  } | null>(null);

  const automationId = automation?.id ?? null;
  const relatedTable = automationId ? `automation_${automationId}` : null;

  async function load() {
    if (!automationId || !relatedTable) return;
    setLoading(true);
    try {
      const [{ count: enrolled }, { data: logsRows }, { data: queueRows }] =
        await Promise.all([
          supabase
            .from("email_automation_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("automation_id", automationId),
          supabase
            .from("email_logs")
            .select(
              "template_slug,status,opened_at,clicked_at,bounced_at,complained_at,related_lead_id,recipient_email,sent_at"
            )
            .eq("related_lead_table", relatedTable)
            .limit(10000),
          supabase
            .from("email_queue")
            .select(
              "template_slug,status,related_lead_id,recipient_email,scheduled_at,error"
            )
            .eq("related_lead_table", relatedTable)
            .limit(10000),
        ]);
      setEnrolledCount(enrolled ?? 0);
      setLogs((logsRows ?? []) as any);
      setQueue((queueRows ?? []) as any);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && automationId) void load();
    if (!open) {
      setLogs([]);
      setQueue([]);
      setEnrolledCount(0);
      setSheet(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, automationId]);

  const stepsStats: StepStats[] = useMemo(() => {
    if (!automation) return [];
    return automation.steps.map((s) => {
      const slug = s.template_slug;
      const logsForStep = logs.filter((l) => l.template_slug === slug);
      const queueForStep = queue.filter((q) => q.template_slug === slug);
      const sent = logsForStep.length;
      const opened = logsForStep.filter((l) => !!l.opened_at).length;
      const clicked = logsForStep.filter((l) => !!l.clicked_at).length;
      const failedLogs = logsForStep.filter((l) =>
        ["bounced", "complained", "failed"].includes(l.status)
      ).length;
      const failedQueue = queueForStep.filter((q) => q.status === "failed").length;
      const queued = queueForStep.filter((q) => q.status === "pending").length;
      return {
        slug,
        queued,
        sent,
        opened,
        clicked,
        failed: failedLogs + failedQueue,
      };
    });
  }, [automation, logs, queue]);

  if (!automation) return null;

  function openSheet(bucket: Bucket, stepSlug: string | undefined, label: string) {
    setSheet({ bucket, stepSlug, title: label });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatório · {automation.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Disparo:{" "}
              {TRIGGER_LABELS[automation.trigger_type] ?? automation.trigger_type}
              {automation.trigger_config &&
                Object.keys(automation.trigger_config).length > 0 && (
                  <>
                    {" · Filtros: "}
                    <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                      {JSON.stringify(automation.trigger_config)}
                    </code>
                  </>
                )}
            </p>
          </DialogHeader>

          <button
            type="button"
            onClick={() =>
              openSheet("enrolled", undefined, "Leads na automação")
            }
            className="w-full text-left rounded-lg border bg-muted/30 hover:bg-muted/60 transition p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Leads na automação (clique para ver)
              </div>
              <div className="text-3xl font-semibold mt-1">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  enrolledCount
                )}
              </div>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </button>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Dia</th>
                  <th className="text-left p-3 font-medium">Template</th>
                  <th className="text-center p-3 font-medium">Na fila</th>
                  <th className="text-center p-3 font-medium">Enviados</th>
                  <th className="text-center p-3 font-medium">Abertos</th>
                  <th className="text-center p-3 font-medium">Clicados</th>
                  <th className="text-center p-3 font-medium">Falharam</th>
                </tr>
              </thead>
              <tbody>
                {automation.steps.map((step, i) => {
                  const s = stepsStats[i];
                  if (!s) return null;
                  const day = toDays(step.delay_minutes);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 text-muted-foreground">+{day}d</td>
                      <td className="p-3">
                        <code className="text-[11px] text-muted-foreground">
                          {step.template_slug || "—"}
                        </code>
                      </td>
                      <CellBtn
                        value={s.queued}
                        onClick={() =>
                          openSheet("queued", step.template_slug, `${step.template_slug} · Na fila`)
                        }
                        variant="muted"
                      />
                      <CellBtn
                        value={s.sent}
                        onClick={() =>
                          openSheet("sent", step.template_slug, `${step.template_slug} · Enviados`)
                        }
                        variant="success"
                      />
                      <CellBtn
                        value={`${s.opened}${s.sent ? ` (${pct(s.opened, s.sent)})` : ""}`}
                        rawValue={s.opened}
                        onClick={() =>
                          openSheet("opened", step.template_slug, `${step.template_slug} · Abertos`)
                        }
                        variant="info"
                      />
                      <CellBtn
                        value={`${s.clicked}${s.sent ? ` (${pct(s.clicked, s.sent)})` : ""}`}
                        rawValue={s.clicked}
                        onClick={() =>
                          openSheet("clicked", step.template_slug, `${step.template_slug} · Clicados`)
                        }
                        variant="accent"
                      />
                      <CellBtn
                        value={s.failed}
                        onClick={() =>
                          openSheet("failed", step.template_slug, `${step.template_slug} · Falharam`)
                        }
                        variant={s.failed > 0 ? "destructive" : "muted"}
                      />
                    </tr>
                  );
                })}
                {automation.steps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                      Esta automação não tem passos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Percentuais de Abertos e Clicados são calculados sobre o total de Enviados de cada passo.
          </p>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Atualizar
            </Button>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AutomationLeadsSheet
        automationId={automationId}
        relatedTable={relatedTable}
        sheet={sheet}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function CellBtn({
  value,
  rawValue,
  onClick,
  variant,
}: {
  value: string | number;
  rawValue?: number;
  onClick: () => void;
  variant: "muted" | "success" | "info" | "accent" | "destructive";
}) {
  const num = rawValue ?? (typeof value === "number" ? value : 0);
  const classes: Record<typeof variant, string> = {
    muted: "bg-muted text-muted-foreground hover:bg-muted/80",
    success:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
    info:
      "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300",
    accent:
      "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300",
    destructive:
      "bg-destructive/10 text-destructive hover:bg-destructive/20",
  } as const;
  return (
    <td className="p-3 text-center">
      {num > 0 ? (
        <button
          type="button"
          onClick={onClick}
          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium transition ${classes[variant]}`}
        >
          {value}
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">{value}</span>
      )}
    </td>
  );
}

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  ts: string | null;
  ts_label: string;
  extra?: string;
};

export function AutomationLeadsSheet({
  automationId,
  relatedTable,
  sheet,
  onClose,
}: {
  automationId: string | null;
  relatedTable: string | null;
  sheet: { bucket: Bucket; stepSlug?: string; title: string } | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sheet || !relatedTable) {
      setRows([]);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchLeads({
          automationId,
          relatedTable,
          bucket: sheet.bucket,
          stepSlug: sheet.stepSlug,
        });
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
    setSearch("");
  }, [sheet, automationId, relatedTable]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <Sheet open={!!sheet} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheet?.title ?? ""}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {loading ? "Carregando..." : `${filtered.length} lead${filtered.length === 1 ? "" : "s"}`}
          </p>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum lead encontrado.
            </div>
          ) : (
            <div className="border rounded-lg divide-y">
              {filtered.map((r, i) => (
                <div key={`${r.id}-${i}`} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {r.name || "(sem nome)"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.email || "—"}
                    </div>
                    {r.extra && (
                      <div className="text-[11px] text-destructive mt-1 line-clamp-2">
                        {r.extra}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-muted-foreground">{r.ts_label}</div>
                    <div className="text-xs">{fmtDate(r.ts)}</div>
                    {r.id && r.id !== "_no_lead" && (
                      <Link
                        to={`/inbox/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        onClick={onClose}
                      >
                        Ver lead <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

async function fetchLeads(args: {
  automationId: string;
  relatedTable: string;
  bucket: Bucket;
  stepSlug?: string;
}): Promise<LeadRow[]> {
  const { automationId, relatedTable, bucket, stepSlug } = args;

  if (bucket === "enrolled") {
    const { data } = await supabase
      .from("email_automation_enrollments")
      .select("lead_id, recipient_email, enrolled_at")
      .eq("automation_id", automationId)
      .order("enrolled_at", { ascending: false })
      .limit(2000);
    const leadIds = (data ?? []).map((r: any) => r.lead_id).filter(Boolean);
    const names = await fetchLeadNames(leadIds);
    return (data ?? []).map((r: any) => ({
      id: r.lead_id ?? "_no_lead",
      name: names.get(r.lead_id) ?? null,
      email: r.recipient_email,
      ts: r.enrolled_at,
      ts_label: "Inscrito em",
    }));
  }

  if (bucket === "queued" || bucket === "failed") {
    // failed inclui email_queue.failed e email_logs failed/bounced/complained
    let queueRows: any[] = [];
    if (bucket === "queued") {
      const { data } = await supabase
        .from("email_queue")
        .select("related_lead_id, recipient_email, scheduled_at, error, status")
        .eq("related_lead_table", relatedTable)
        .eq("template_slug", stepSlug ?? "")
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true })
        .limit(2000);
      queueRows = data ?? [];
    } else {
      const { data } = await supabase
        .from("email_queue")
        .select("related_lead_id, recipient_email, scheduled_at, error, status")
        .eq("related_lead_table", relatedTable)
        .eq("template_slug", stepSlug ?? "")
        .eq("status", "failed")
        .limit(2000);
      queueRows = data ?? [];
    }

    let logRows: any[] = [];
    if (bucket === "failed") {
      const { data } = await supabase
        .from("email_logs")
        .select("related_lead_id, recipient_email, sent_at, error, status, bounced_at, complained_at")
        .eq("related_lead_table", relatedTable)
        .eq("template_slug", stepSlug ?? "")
        .in("status", ["bounced", "complained", "failed"])
        .limit(2000);
      logRows = data ?? [];
    }

    const all = [
      ...queueRows.map((r: any) => ({
        lead_id: r.related_lead_id,
        email: r.recipient_email,
        ts: r.scheduled_at,
        ts_label: bucket === "queued" ? "Agendado para" : "Falhou em",
        extra: r.error ?? undefined,
      })),
      ...logRows.map((r: any) => ({
        lead_id: r.related_lead_id,
        email: r.recipient_email,
        ts: r.bounced_at ?? r.complained_at ?? r.sent_at,
        ts_label: "Falhou em",
        extra: r.error ?? r.status,
      })),
    ];
    const leadIds = all.map((r) => r.lead_id).filter(Boolean);
    const names = await fetchLeadNames(leadIds);
    return all.map((r) => ({
      id: r.lead_id ?? "_no_lead",
      name: names.get(r.lead_id) ?? null,
      email: r.email,
      ts: r.ts,
      ts_label: r.ts_label,
      extra: r.extra,
    }));
  }

  // sent / opened / clicked → email_logs
  let q = supabase
    .from("email_logs")
    .select("related_lead_id, recipient_email, sent_at, opened_at, clicked_at")
    .eq("related_lead_table", relatedTable)
    .eq("template_slug", stepSlug ?? "")
    .limit(2000);
  if (bucket === "opened") q = q.not("opened_at", "is", null);
  if (bucket === "clicked") q = q.not("clicked_at", "is", null);
  const { data } = await q;
  const rows = data ?? [];
  const leadIds = rows.map((r: any) => r.related_lead_id).filter(Boolean);
  const names = await fetchLeadNames(leadIds);
  return rows.map((r: any) => {
    const ts =
      bucket === "opened"
        ? r.opened_at
        : bucket === "clicked"
        ? r.clicked_at
        : r.sent_at;
    const ts_label =
      bucket === "opened" ? "Aberto em" : bucket === "clicked" ? "Clicado em" : "Enviado em";
    return {
      id: r.related_lead_id ?? "_no_lead",
      name: names.get(r.related_lead_id) ?? null,
      email: r.recipient_email,
      ts,
      ts_label,
    };
  });
}

async function fetchLeadNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("leads")
    .select("id, name")
    .in("id", unique);
  return new Map((data ?? []).map((r: any) => [r.id, r.name]));
}
