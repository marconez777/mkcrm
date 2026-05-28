import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Mail,
  CheckCircle2,
  Eye,
  MousePointerClick,
  AlertTriangle,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";

type Stats = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  best_hour: number | null;
  hourly: Array<{ hour: number; sent: number; opened: number }>;
};

const RANGES = [
  { id: "7", label: "7 dias", days: 7 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "90 dias", days: 90 },
];

const chartConfig = {
  sent: { label: "Enviados", color: "hsl(var(--primary))" },
  opened: { label: "Abertos", color: "hsl(var(--chart-2, 142 71% 45%))" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
      ? "text-emerald-500"
      : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Funnel({ s }: { s: Stats }) {
  const steps = [
    { label: "Enviados", value: s.sent, pct: 100 },
    {
      label: "Entregues",
      value: s.delivered,
      pct: s.sent ? (s.delivered / s.sent) * 100 : 0,
    },
    {
      label: "Abertos",
      value: s.opened,
      pct: s.sent ? (s.opened / s.sent) * 100 : 0,
    },
    {
      label: "Cliques",
      value: s.clicked,
      pct: s.sent ? (s.clicked / s.sent) * 100 : 0,
    },
  ];
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">Funil</div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{step.label}</span>
              <span>
                {step.value.toLocaleString()} ({step.pct.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.max(2, step.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HourlyChart({ data }: { data: Stats["hourly"] }) {
  const series = useMemo(() => {
    const map = new Map(data.map((d) => [d.hour, d]));
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      sent: map.get(h)?.sent ?? 0,
      opened: map.get(h)?.opened ?? 0,
    }));
  }, [data]);
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">Distribuição por hora (BRT)</div>
      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sent" fill="var(--color-sent)" radius={[2, 2, 0, 0]} />
            <Bar
              dataKey="opened"
              fill="var(--color-opened)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  );
}

function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Sem dados para esta seleção.
      </Card>
    );
  }
  const bestHour =
    stats.best_hour != null ? `${String(stats.best_hour).padStart(2, "0")}h` : "—";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Mail} label="Enviados" value={stats.sent.toLocaleString()} />
        <StatCard
          icon={CheckCircle2}
          label="Entregues"
          value={`${
            stats.sent
              ? ((stats.delivered / stats.sent) * 100).toFixed(1)
              : "0"
          }%`}
          hint={`${stats.delivered.toLocaleString()} de ${stats.sent.toLocaleString()}`}
          tone="success"
        />
        <StatCard
          icon={Eye}
          label="Open rate"
          value={`${stats.open_rate}%`}
          hint={`${stats.opened.toLocaleString()} abertos`}
        />
        <StatCard
          icon={MousePointerClick}
          label="Click rate"
          value={`${stats.click_rate}%`}
          hint={`${stats.clicked.toLocaleString()} cliques`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Bounces"
          value={stats.bounced.toLocaleString()}
          hint={`${stats.bounce_rate}%`}
          tone={stats.bounced > 0 ? "destructive" : "default"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Reclamações"
          value={stats.complained.toLocaleString()}
          tone={stats.complained > 0 ? "destructive" : "default"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Falhas"
          value={stats.failed.toLocaleString()}
          tone={stats.failed > 0 ? "destructive" : "default"}
        />
        <StatCard icon={Clock} label="Melhor hora" value={bestHour} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Funnel s={stats} />
        <HourlyChart data={stats.hourly ?? []} />
      </div>
    </div>
  );
}

function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmailReports() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [tab, setTab] = useState("templates");
  const [range, setRange] = useState(RANGES[1]);

  const [templates, setTemplates] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  const [templateSlug, setTemplateSlug] = useState<string>("");
  const [templateStats, setTemplateStats] = useState<Stats | null>(null);

  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; name: string; status: string }>
  >([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaignStats, setCampaignStats] = useState<Stats | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [{ data: tpls }, camps] = await Promise.all([
        supabase
          .from("email_templates")
          .select("slug,name")
          .eq("clinic_id", clinicId)
          .eq("active", true)
          .order("name"),
        fetchAllPaged<any>(() =>
          supabase
            .from("email_campaigns")
            .select("id,name,status")
            .eq("clinic_id", clinicId)
            .order("created_at", { ascending: false })
        ),
      ]);
      setTemplates(tpls ?? []);
      setCampaigns(camps ?? []);
      if (tpls?.length && !templateSlug) setTemplateSlug(tpls[0].slug);
      if (camps?.length && !campaignId) setCampaignId(camps[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  async function loadTemplateStats() {
    if (!clinicId || !templateSlug) return;
    setLoading(true);
    const from = new Date(Date.now() - range.days * 86400000).toISOString();
    const { data, error } = await supabase.rpc("report_template_stats", {
      _clinic_id: clinicId,
      _template_slug: templateSlug,
      _from: from,
      _to: new Date().toISOString(),
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar", { description: error.message });
      setTemplateStats(null);
      return;
    }
    setTemplateStats((data?.[0] as any) ?? null);
  }

  async function loadCampaignStats() {
    if (!clinicId || !campaignId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("report_campaign_stats", {
      _clinic_id: clinicId,
      _campaign_id: campaignId,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar", { description: error.message });
      setCampaignStats(null);
      return;
    }
    setCampaignStats((data?.[0] as any) ?? null);
  }

  useEffect(() => {
    if (tab === "templates") loadTemplateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, templateSlug, range, clinicId]);

  useEffect(() => {
    if (tab === "campaigns") loadCampaignStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, campaignId, clinicId]);

  function exportCsv() {
    const s = tab === "templates" ? templateStats : campaignStats;
    if (!s) return;
    const label =
      tab === "templates"
        ? templates.find((t) => t.slug === templateSlug)?.name ?? templateSlug
        : campaigns.find((c) => c.id === campaignId)?.name ?? campaignId;
    downloadCsv(
      [
        {
          item: label,
          sent: s.sent,
          delivered: s.delivered,
          opened: s.opened,
          clicked: s.clicked,
          bounced: s.bounced,
          complained: s.complained,
          failed: s.failed,
          open_rate: s.open_rate,
          click_rate: s.click_rate,
          bounce_rate: s.bounce_rate,
          best_hour: s.best_hour,
        },
      ],
      `report-${tab}-${Date.now()}.csv`
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Relatórios de e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Performance por template e por campanha.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={range.id}
            onValueChange={(v) => setRange(RANGES.find((r) => r.id === v) ?? RANGES[1])}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Por template</TabsTrigger>
          <TabsTrigger value="campaigns">Por campanha</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={templateSlug} onValueChange={setTemplateSlug}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && (
              <span className="text-xs text-muted-foreground">carregando…</span>
            )}
          </div>
          <StatsView stats={templateStats} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && (
              <span className="text-xs text-muted-foreground">carregando…</span>
            )}
          </div>
          <StatsView stats={campaignStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
