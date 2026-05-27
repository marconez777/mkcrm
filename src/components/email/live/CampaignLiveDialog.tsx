import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Pause, X, AlertCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { RadialProgress } from "./RadialProgress";
import { LivePulseDot } from "./LivePulseDot";
import { ArtisticSpinner } from "./ArtisticSpinner";
import { ThroughputChart, type ThroughputPoint } from "./ThroughputChart";
import { useCountUp } from "@/hooks/useCountUp";

type Props = {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type CampaignSnapshot = {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  last_sent_at: string | null;
  created_at: string;
};

type FailureRow = {
  id: string;
  recipient_email: string;
  error: string | null;
  scheduled_at: string;
};

function fmtETA(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 120) return `~${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `~${h}h ${m}min`;
}

export function CampaignLiveDialog({ campaignId, open, onOpenChange }: Props) {
  const [snap, setSnap] = useState<CampaignSnapshot | null>(null);
  const [points, setPoints] = useState<ThroughputPoint[]>([]);
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [pausing, setPausing] = useState(false);

  const ewmaRef = useRef(0);
  const lastEventTsRef = useRef<number>(Date.now());
  const prevEtaRef = useRef<number | null>(null);

  async function loadAll() {
    if (!campaignId) return;
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const [{ data: c }, { data: tp }, { data: fq }] = await Promise.all([
      supabase
        .from("email_campaigns")
        .select("id,name,status,total_recipients,sent_count,failed_count,last_sent_at,created_at")
        .eq("id", campaignId)
        .maybeSingle(),
      supabase
        .from("campaign_throughput")
        .select("minute,sent,failed")
        .eq("campaign_id", campaignId)
        .gte("minute", since)
        .order("minute", { ascending: true }),
      supabase
        .from("email_queue")
        .select("id,recipient_email,error,scheduled_at")
        .eq("related_lead_table", `campaign_${campaignId}`)
        .eq("status", "failed")
        .order("scheduled_at", { ascending: false })
        .limit(20),
    ]);
    if (c) setSnap(c as CampaignSnapshot);
    setPoints(((tp ?? []) as any[]).map((r) => ({ minute: r.minute, sent: r.sent, failed: r.failed })));
    setFailures((fq ?? []) as FailureRow[]);
    lastEventTsRef.current = Date.now();
  }

  useEffect(() => {
    if (!open || !campaignId) return;
    void loadAll();

    const chCampaign = supabase
      .channel(`live-campaign-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "email_campaigns", filter: `id=eq.${campaignId}` },
        (payload) => {
          lastEventTsRef.current = Date.now();
          setSnap((prev) => ({ ...(prev ?? ({} as CampaignSnapshot)), ...(payload.new as any) }));
        }
      )
      .subscribe();

    const chTp = supabase
      .channel(`live-tp-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_throughput", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          lastEventTsRef.current = Date.now();
          const row = payload.new as any;
          if (!row?.minute) return;
          setPoints((prev) => {
            const idx = prev.findIndex((p) => p.minute === row.minute);
            const next = idx >= 0 ? [...prev] : [...prev, { minute: row.minute, sent: 0, failed: 0 }];
            const i = idx >= 0 ? idx : next.length - 1;
            next[i] = { minute: row.minute, sent: row.sent, failed: row.failed };
            const cutoff = Date.now() - 15 * 60_000;
            return next
              .filter((p) => new Date(p.minute).getTime() >= cutoff)
              .sort((a, b) => a.minute.localeCompare(b.minute));
          });
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      const stale = Date.now() - lastEventTsRef.current > 10_000;
      if (stale) void loadAll();
    }, 5000);

    return () => {
      supabase.removeChannel(chCampaign);
      supabase.removeChannel(chTp);
      clearInterval(interval);
    };
  }, [open, campaignId]);

  useEffect(() => {
    if (points.length === 0) {
      ewmaRef.current = 0;
      return;
    }
    const α = 0.3;
    let e = 0;
    for (const p of points) e = α * p.sent + (1 - α) * e;
    ewmaRef.current = e;
  }, [points]);

  const sent = snap?.sent_count ?? 0;
  const failed = snap?.failed_count ?? 0;
  const total = snap?.total_recipients ?? 0;
  const queued = Math.max(0, total - sent - failed);
  const pct = total > 0 ? (sent / total) * 100 : 0;

  const etaText = useMemo(() => {
    const minutesSinceStart =
      snap?.created_at ? (Date.now() - new Date(snap.created_at).getTime()) / 60_000 : 0;
    if (points.length < 2 || minutesSinceStart < 2) return "Calculando…";
    if (snap?.status !== "sending") return "—";
    const rate = ewmaRef.current;
    if (rate <= 0) {
      const lastPt = points[points.length - 1];
      const ageMin = (Date.now() - new Date(lastPt.minute).getTime()) / 60_000;
      if (ageMin > 3) return "Aguardando próxima rajada…";
      return "Calculando…";
    }
    const remaining = Math.max(0, total - sent);
    let etaSec = (remaining / rate) * 60;
    if (prevEtaRef.current !== null) {
      const cap = prevEtaRef.current * 1.2;
      if (etaSec > cap) etaSec = cap;
    }
    prevEtaRef.current = etaSec;
    return fmtETA(etaSec);
  }, [points, snap, sent, total]);

  const rateLabel = ewmaRef.current > 0 ? `${Math.round(ewmaRef.current).toLocaleString("pt-BR")}/min` : "—";

  const sentAnim = useCountUp(sent);
  const failedAnim = useCountUp(failed);
  const queuedAnim = useCountUp(queued);

  const isLive = snap?.status === "sending";

  async function pauseCampaign() {
    if (!campaignId) return;
    setPausing(true);
    try {
      const { error: qErr } = await supabase
        .from("email_queue")
        .update({ status: "paused" })
        .eq("status", "pending")
        .eq("related_lead_table", `campaign_${campaignId}`);
      if (qErr) throw qErr;
      const { error } = await supabase
        .from("email_campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Campanha pausada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPausing(false);
    }
  }

  if (!campaignId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle asChild>
            <div className="flex items-center gap-3 pr-8">
              <LivePulseDot active={isLive} />
              <span className="text-base">
                {isLive ? "Enviando agora" : snap?.status === "paused" ? "Pausada" : "Campanha"}
                <span className="text-muted-foreground font-normal">
                  {snap?.name ? ` · ${snap.name}` : ""}
                </span>
              </span>
              {isLive && (
                <span className="ml-auto flex items-center gap-2">
                  <ArtisticSpinner size={26} />
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="flex justify-center">
            <RadialProgress value={pct} label={`${sentAnim.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Enviados" value={sentAnim.toLocaleString("pt-BR")} tone="success" />
            <StatBox label="Falhas" value={failedAnim.toLocaleString("pt-BR")} tone={failed > 0 ? "destructive" : "muted"} />
            <StatBox label="Na fila" value={queuedAnim.toLocaleString("pt-BR")} tone="muted" />
            <StatBox label="Taxa" value={rateLabel} tone="info" icon={<TrendingUp className="h-3 w-3" />} />
            <div className="col-span-2 rounded-lg border bg-muted/30 px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ETA</div>
                <div className="text-lg font-semibold tabular-nums">{etaText}</div>
              </div>
              {snap?.created_at && (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Iniciada</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(snap.created_at).toLocaleTimeString("pt-BR")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
            Throughput por minuto (últimos 15 min)
          </div>
          {points.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
              Aguardando os primeiros envios…
            </div>
          ) : (
            <ThroughputChart data={points} />
          )}
        </div>

        {failures.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="failures">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Falhas recentes ({failures.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {failures.map((f) => (
                    <div key={f.id} className="text-xs border rounded p-2 bg-muted/30">
                      <div className="font-mono">{f.recipient_email}</div>
                      {f.error && <div className="text-destructive mt-0.5 truncate" title={f.error}>{f.error}</div>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {isLive ? "Atualizando ao vivo via Lovable Cloud" : `Status: ${snap?.status ?? "—"}`}
          </div>
          <div className="flex gap-2">
            {isLive && (
              <Button variant="outline" size="sm" onClick={pauseCampaign} disabled={pausing}>
                <Pause className="mr-1 h-3 w-3" />
                Pausar
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-3 w-3" /> Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "success" | "destructive" | "muted" | "info";
  icon?: React.ReactNode;
}) {
  const toneCls: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-foreground/80",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${toneCls[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
