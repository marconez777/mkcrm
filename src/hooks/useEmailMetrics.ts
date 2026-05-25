import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EmailMetricRow = {
  clinic_id: string;
  day: string; // YYYY-MM-DD
  template_slug: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
};

/**
 * Lê `email_metrics_daily` (agregação pré-computada por cron).
 * Use para janelas grandes (>7d) — evita o teto de 1000 linhas em `email_logs`.
 */
export function useEmailMetrics(clinicId: string | null | undefined, days: number) {
  const [rows, setRows] = useState<EmailMetricRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sinceDate = new Date();
      sinceDate.setUTCDate(sinceDate.getUTCDate() - Math.max(days, 1));
      const since = sinceDate.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("email_metrics_daily")
        .select("clinic_id,day,template_slug,sent,delivered,opened,clicked,bounced,complained,failed")
        .eq("clinic_id", clinicId)
        .gte("day", since)
        .order("day", { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as EmailMetricRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clinicId, days]);

  return { rows, loading };
}

export function aggregateMetrics(rows: EmailMetricRow[]) {
  const acc = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 };
  for (const r of rows) {
    acc.sent += r.sent;
    acc.delivered += r.delivered;
    acc.opened += r.opened;
    acc.clicked += r.clicked;
    acc.bounced += r.bounced;
    acc.complained += r.complained;
    acc.failed += r.failed;
  }
  const pct = (n: number) => (acc.sent ? Math.round((n / acc.sent) * 100) : 0);
  return {
    ...acc,
    deliveredPct: pct(acc.delivered),
    openPct: pct(acc.opened),
    clickPct: pct(acc.clicked),
    bouncePct: acc.sent ? +((acc.bounced / acc.sent) * 100).toFixed(2) : 0,
    complaintPct: acc.sent ? +((acc.complained / acc.sent) * 100).toFixed(3) : 0,
    failedPct: pct(acc.failed),
  };
}
