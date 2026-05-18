import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  source: string | null;
  medium: string | null;
  channel_group: string | null;
  campaign: string | null;
  confidence_score: number | null;
  lead_id: string;
};

type Grouped = {
  channel_group: string;
  source: string;
  medium: string;
  leads: number;
  confidence_total: number;
  confidence_count: number;
};

export function AttributionTab({
  clinicId,
  from,
  to,
}: {
  clinicId: string;
  from: string;
  to: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tracking_lead_sources")
      .select("source, medium, channel_group, campaign, confidence_score, lead_id")
      .eq("clinic_id", clinicId)
      .eq("source_type", "conversion_touch")
      .gte("created_at", from)
      .lte("created_at", to)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data as Row[]) || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId, from, to]);

  const grouped = useMemo(() => {
    const map = new Map<string, Grouped>();
    for (const r of rows) {
      const channel = r.channel_group ?? "unknown";
      const source = r.source ?? "—";
      const medium = r.medium ?? "—";
      const key = `${channel}|${source}|${medium}`;
      const cur =
        map.get(key) ??
        ({
          channel_group: channel,
          source,
          medium,
          leads: 0,
          confidence_total: 0,
          confidence_count: 0,
        } as Grouped);
      cur.leads += 1;
      if (r.confidence_score != null) {
        cur.confidence_total += r.confidence_score;
        cur.confidence_count += 1;
      }
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leads por origem da conversão</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem leads com atribuição no período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Mídia</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Confiança média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g, i) => (
                <TableRow key={i}>
                  <TableCell>{g.channel_group}</TableCell>
                  <TableCell>{g.source}</TableCell>
                  <TableCell>{g.medium}</TableCell>
                  <TableCell className="text-right">{g.leads}</TableCell>
                  <TableCell className="text-right">
                    {g.confidence_count > 0
                      ? Math.round(g.confidence_total / g.confidence_count) + "%"
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default AttributionTab;
