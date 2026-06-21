import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Report = {
  id: string;
  report_month: string;
  payload: {
    month_label?: string;
    count_consulta?: number;
    count_tratamento?: number;
    total?: number;
  } | null;
  email_sent_at: string | null;
  created_at: string;
};

export function MonthlyFinalizadosReportCard({ clinicId }: { clinicId: string | null }) {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clinic_monthly_reports")
        .select("id, report_month, payload, email_sent_at, created_at")
        .eq("clinic_id", clinicId)
        .eq("report_kind", "finalizados_mensal_or")
        .order("report_month", { ascending: false })
        .limit(12);
      if (alive) {
        setRows((data ?? []) as Report[]);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clinicId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Relatório mensal — Consultas & Tratamentos Finalizados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Ainda não há relatórios. O primeiro é gerado automaticamente no dia 1º do próximo mês.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Consultas finalizadas</TableHead>
                <TableHead className="text-right">1ª sessão finalizada</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.payload?.month_label ?? r.report_month.slice(0, 7)}
                  </TableCell>
                  <TableCell className="text-right">{r.payload?.count_consulta ?? 0}</TableCell>
                  <TableCell className="text-right">{r.payload?.count_tratamento ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold">{r.payload?.total ?? 0}</TableCell>
                  <TableCell>
                    {r.email_sent_at ? (
                      <Badge variant="secondary">Enviado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
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
