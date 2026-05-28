import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { LoadingRadialOverlay } from "@/components/ui/loading-radial";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3 } from "lucide-react";
import {
  AutomationLeadsSheet,
  type Bucket,
} from "./AutomationReportDialog";

type Campaign = {
  id: string;
  name: string;
  template_slug: string;
  status: string;
  scheduled_for: string | null;
  sent_at?: string | null;
  total_recipients: number;
};

type Stats = {
  queued: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
};

function pct(num: number, denom: number) {
  if (!denom) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

export function CampaignReportDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [stats, setStats] = useState<Stats>({
    queued: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
  });
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [sheet, setSheet] = useState<
    { bucket: Bucket; stepSlug?: string; title: string } | null
  >(null);

  const campaignId = campaign?.id ?? null;
  const relatedTable = campaignId ? `campaign_${campaignId}` : null;
  const slug = campaign?.template_slug;

  async function load() {
    if (!relatedTable) return;
    setLoading(true);
    // Conta total para % real
    const [{ count: logsCount }, { count: queueCount }] = await Promise.all([
      supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("related_lead_table", relatedTable),
      supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("related_lead_table", relatedTable),
    ]);
    const grand = (logsCount ?? 0) + (queueCount ?? 0);
    setLoadProgress({ loaded: 0, total: grand });
    let prevL = 0, prevQ = 0, sum = 0;
    const bump = (delta: number) => {
      sum = Math.min(grand, sum + delta);
      setLoadProgress({ loaded: sum, total: grand });
    };
    try {
      const [logsRows, queueRows] = await Promise.all([
        fetchAllPaged<any>(
          () => supabase
            .from("email_logs")
            .select("status, opened_at, clicked_at, recipient_email")
            .eq("related_lead_table", relatedTable),
          1000, 100_000,
          (loaded) => { bump(loaded - prevL); prevL = loaded; },
        ),
        fetchAllPaged<any>(
          () => supabase
            .from("email_queue")
            .select("status, recipient_email")
            .eq("related_lead_table", relatedTable),
          1000, 100_000,
          (loaded) => { bump(loaded - prevQ); prevQ = loaded; },
        ),
      ]);
      const logs = logsRows as any[];
      const queue = queueRows as any[];

      const sent = logs.length;
      const opened = logs.filter((l) => !!l.opened_at).length;
      const clicked = logs.filter((l) => !!l.clicked_at).length;
      const failedLogs = logs.filter((l) =>
        ["bounced", "complained", "failed"].includes(l.status)
      ).length;
      const failedQueue = queue.filter((q) => q.status === "failed").length;
      const queued = queue.filter((q) => q.status === "pending").length;

      setStats({
        queued,
        sent,
        opened,
        clicked,
        failed: failedLogs + failedQueue,
      });

      // total = união por email
      const setEmails = new Set<string>();
      for (const r of queue) setEmails.add((r.recipient_email ?? "").toLowerCase());
      for (const r of logs) setEmails.add((r.recipient_email ?? "").toLowerCase());
      setTotalRecipients(setEmails.size || campaign?.total_recipients || 0);
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }

  useEffect(() => {
    if (open && campaignId) void load();
    if (!open) {
      setStats({ queued: 0, sent: 0, opened: 0, clicked: 0, failed: 0 });
      setTotalRecipients(0);
      setSheet(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId]);

  if (!campaign) return null;

  function openSheet(bucket: Bucket, title: string) {
    setSheet({ bucket, stepSlug: slug, title });
  }

  const cards: Array<{
    key: Bucket;
    label: string;
    value: string;
    rawValue: number;
    variant: "muted" | "success" | "info" | "accent" | "destructive";
  }> = [
    { key: "queued", label: "Na fila", value: `${stats.queued}`, rawValue: stats.queued, variant: "muted" },
    { key: "sent", label: "Enviados", value: `${stats.sent}`, rawValue: stats.sent, variant: "success" },
    {
      key: "opened",
      label: "Abertos",
      value: `${stats.opened}${stats.sent ? ` (${pct(stats.opened, stats.sent)})` : ""}`,
      rawValue: stats.opened,
      variant: "info",
    },
    {
      key: "clicked",
      label: "Clicados",
      value: `${stats.clicked}${stats.sent ? ` (${pct(stats.clicked, stats.sent)})` : ""}`,
      rawValue: stats.clicked,
      variant: "accent",
    },
    {
      key: "failed",
      label: "Falharam",
      value: `${stats.failed}`,
      rawValue: stats.failed,
      variant: stats.failed > 0 ? "destructive" : "muted",
    },
  ];

  const variantClasses: Record<string, string> = {
    muted: "bg-muted text-muted-foreground hover:bg-muted/80",
    success:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
    info: "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300",
    accent:
      "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300",
    destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto relative">
          {loading && loadProgress && loadProgress.total > 500 && (
            <LoadingRadialOverlay
              value={(loadProgress.loaded / loadProgress.total) * 100}
              caption={`${loadProgress.loaded.toLocaleString("pt-BR")} de ${loadProgress.total.toLocaleString("pt-BR")} registros`}
            />
          )}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatório · {campaign.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Template:{" "}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                {campaign.template_slug}
              </code>
              {" · Status: "}
              {campaign.status}
              {campaign.scheduled_for && (
                <> · Agendada para {fmtDate(campaign.scheduled_for)}</>
              )}
              {campaign.sent_at && <> · Enviada em {fmtDate(campaign.sent_at)}</>}
            </p>
          </DialogHeader>

          <button
            type="button"
            onClick={() => openSheet("all", `${campaign.name} · Destinatários`)}
            className="w-full text-left rounded-lg border bg-muted/30 hover:bg-muted/60 transition p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Destinatários (clique para ver)
              </div>
              <div className="text-3xl font-semibold mt-1">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalRecipients}
              </div>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={c.rawValue === 0}
                onClick={() => openSheet(c.key, `${campaign.name} · ${c.label}`)}
                className={`rounded-lg p-3 text-center transition ${
                  c.rawValue > 0 ? variantClasses[c.variant] : "bg-muted/40 text-muted-foreground cursor-default"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">
                  {c.label}
                </div>
                <div className="text-lg font-semibold mt-1">{c.value}</div>
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Percentuais de Abertos e Clicados são calculados sobre o total de Enviados.
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
        automationId={null}
        relatedTable={relatedTable}
        sheet={sheet}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
