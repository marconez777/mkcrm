import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Unlock } from "lucide-react";

type Row = {
  clinic_id: string;
  provider: string;
  blocked_until: string;
  last_error: string | null;
  updated_at: string;
  clinic_name?: string | null;
};

function minsLeft(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

export function ProviderHealthCard() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_provider_health" as never)
      .select("clinic_id, provider, blocked_until, last_error, updated_at")
      .gt("blocked_until", new Date().toISOString())
      .order("blocked_until", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      return;
    }
    const list = (data ?? []) as Row[];
    if (list.length > 0) {
      const ids = Array.from(new Set(list.map((r) => r.clinic_id)));
      const { data: cs } = await supabase.from("clinics").select("id,name").in("id", ids);
      const byId = new Map((cs ?? []).map((c) => [c.id as string, c.name as string]));
      for (const r of list) r.clinic_name = byId.get(r.clinic_id) ?? null;
    }
    setRows(list);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const unblock = async (clinicId: string, provider: string) => {
    const { error } = await supabase
      .from("pipeline_provider_health" as never)
      .delete()
      .eq("clinic_id", clinicId)
      .eq("provider", provider);
    if (error) {
      toast({ title: "Falha ao desbloquear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Desbloqueado", description: `${provider} liberado para a clínica` });
    void load();
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Provedores de IA bloqueados por quota
          </h2>
          <p className="text-xs text-muted-foreground">
            Clínicas com Lovable AI ou OpenAI temporariamente bloqueados (30min após cota esgotada).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      {rows === null ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum provider bloqueado. ✓</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Restam</TableHead>
              <TableHead>Último erro</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.clinic_id}-${r.provider}`}>
                <TableCell className="text-xs">{r.clinic_name || r.clinic_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="font-mono">{r.provider}</Badge>
                </TableCell>
                <TableCell className="text-xs">{minsLeft(r.blocked_until)} min</TableCell>
                <TableCell className="max-w-md text-xs">
                  <span className="line-clamp-2 text-muted-foreground" title={r.last_error ?? ""}>
                    {r.last_error || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => void unblock(r.clinic_id, r.provider)}>
                    <Unlock className="mr-1 h-3 w-3" />
                    Desbloquear
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
