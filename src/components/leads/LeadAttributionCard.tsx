import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type SourceType = "first_touch" | "conversion_touch" | "last_non_direct";

type LeadSource = {
  source_type: SourceType;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  channel_group: string | null;
  landing_page: string | null;
  conversion_page: string | null;
  confidence_score: number | null;
  gclid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  msclkid: string | null;
  li_fat_id: string | null;
  created_at: string;
};

export function LeadAttributionCard({ leadId }: { leadId: string }) {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tracking_lead_sources")
      .select(
        "source_type, source, medium, campaign, channel_group, landing_page, conversion_page, confidence_score, gclid, fbclid, fbp, fbc, ttclid, msclkid, li_fat_id, created_at",
      )
      .eq("lead_id", leadId)
      .then(({ data }) => {
        if (cancelled) return;
        setSources(((data as LeadSource[]) || []));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Atribuição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Atribuição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem dados de origem. Esse lead não foi vinculado a um visitante rastreado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const byType = Object.fromEntries(sources.map((s) => [s.source_type, s])) as Partial<
    Record<SourceType, LeadSource>
  >;
  const conv = byType["conversion_touch"];
  const first = byType["first_touch"];
  const nonDirect = byType["last_non_direct"];
  const idsSource = conv ?? first;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Atribuição</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conv && <SourceBlock title="Origem da conversão" data={conv} highlight />}
        {first && <SourceBlock title="Primeira origem" data={first} />}
        {nonDirect && <SourceBlock title="Última origem não direta" data={nonDirect} />}
        <ClickIdsRow source={idsSource} />
      </CardContent>
    </Card>
  );
}

function SourceBlock({
  title,
  data,
  highlight,
}: {
  title: string;
  data: LeadSource;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (highlight ? "border-primary/40 bg-primary/5" : "border-border")
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {data.confidence_score != null && (
          <Badge variant="secondary" className="text-[10px]">
            {data.confidence_score}% confiança
          </Badge>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <div className="font-medium">
          {data.source ?? "—"}
          {data.medium ? ` / ${data.medium}` : ""}
        </div>
        {data.campaign && (
          <div className="text-xs text-muted-foreground">Campanha: {data.campaign}</div>
        )}
        {data.channel_group && (
          <div className="text-xs text-muted-foreground">Grupo: {data.channel_group}</div>
        )}
        {(data.conversion_page || data.landing_page) && (
          <div className="truncate text-xs text-muted-foreground">
            Página: {data.conversion_page ?? data.landing_page}
          </div>
        )}
      </div>
    </div>
  );
}

function ClickIdsRow({ source }: { source?: LeadSource }) {
  if (!source) return null;
  const ids = [
    { name: "gclid", value: source.gclid },
    { name: "fbclid", value: source.fbclid },
    { name: "_fbp", value: source.fbp },
    { name: "_fbc", value: source.fbc },
    { name: "ttclid", value: source.ttclid },
    { name: "msclkid", value: source.msclkid },
    { name: "li_fat_id", value: source.li_fat_id },
  ];
  const present = ids.filter((i) => i.value);
  if (present.length === 0) return null;
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Identificadores capturados
      </div>
      <div className="flex flex-wrap gap-1">
        {present.map((i) => (
          <Badge key={i.name} variant="outline" className="text-[10px]">
            {i.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default LeadAttributionCard;
