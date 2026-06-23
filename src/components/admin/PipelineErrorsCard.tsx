import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, RotateCw } from "lucide-react";

type ErrorRow = {
  lead_id: string;
  clinic_id: string;
  step: string | null;
  error: string | null;
  run_id: string | null;
  created_at: string;
  stage_name: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  clinic_name: string | null;
};

const PAGE_SIZE = 25;

const STEP_OPTIONS = [
  { value: "__all__", label: "Todas as etapas" },
  { value: "summarizer", label: "Resumidor" },
  { value: "parallel", label: "Paralelos (agendador/tipif./movim.)" },
  { value: "agendador", label: "Agendador" },
  { value: "typifier", label: "Tipificador" },
  { value: "movimentador", label: "Movimentador" },
  { value: "maestro", label: "Maestro" },
  { value: "classify", label: "classify (legado)" },
];

const PERIOD_OPTIONS = [
  { value: "24", label: "24 horas" },
  { value: "168", label: "7 dias" },
  { value: "720", label: "30 dias" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function PipelineErrorsCard() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState<string>("__all__");
  const [sinceHours, setSinceHours] = useState<string>("168");
  const [loading, setLoading] = useState(false);
  const [retryingLead, setRetryingLead] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_pipeline_errors_paginated" as never, {
      p_since_hours: Number(sinceHours),
      p_step: step === "__all__" ? null : step,
      p_clinic_id: null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    } as never);
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      return;
    }
    const payload = (data ?? {}) as { rows?: ErrorRow[]; total?: number };
    setRows(payload.rows ?? []);
    setTotal(payload.total ?? 0);
  }, [page, step, sinceHours, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [step, sinceHours]);

  const retryLead = async (leadId: string) => {
    setRetryingLead(leadId);
    const { data, error } = await supabase.functions.invoke("pipeline-run-executor", {
      body: { action: "retry_lead", lead_id: leadId, since_hours: Number(sinceHours) },
    });
    setRetryingLead(null);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Falha ao reprocessar",
        description: error?.message || (data as { error?: string })?.error || "erro",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Lead enfileirado", description: "Reprocessando…" });
    setTimeout(() => void load(), 3000);
  };

  const retryAll = async () => {
    setRetryingAll(true);
    const { data, error } = await supabase.functions.invoke("pipeline-run-executor", {
      body: { action: "retry_all_errors", since_hours: Number(sinceHours) },
    });
    setRetryingAll(false);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Falha ao reprocessar em lote",
        description: error?.message || (data as { error?: string })?.error || "erro",
        variant: "destructive",
      });
      return;
    }
    const enq = (data as { leads_enqueued?: number })?.leads_enqueued ?? 0;
    toast({ title: "Lote enfileirado", description: `${enq} leads reprocessando…` });
    setTimeout(() => void load(), 3000);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Leads com erro no pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Cada lead aparece apenas uma vez (erro mais recente). Total: {total}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sinceHours} onValueChange={setSinceHours}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={step} onValueChange={setStep}>
            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STEP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={total === 0 || retryingAll}>
                {retryingAll ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCw className="mr-1 h-3 w-3" />}
                Retry em todos ({total})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reprocessar todos os leads com erro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vai enfileirar {total} leads distintos (último erro nos últimos {sinceHours}h).
                  Cada clínica recebe uma run separada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void retryAll()}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Clínica</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead>Quando</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhum lead com erro no período.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.lead_id}>
                  <TableCell className="text-xs">
                    <Link to={`/inbox/${r.lead_id}`} className="hover:underline">
                      {r.lead_name || r.lead_phone || r.lead_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{r.clinic_name || r.clinic_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="font-mono">{r.step || "—"}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md text-xs">
                    <span className="line-clamp-2 text-destructive" title={r.error ?? ""}>
                      {r.error || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryingLead === r.lead_id}
                      onClick={() => void retryLead(r.lead_id)}
                    >
                      {retryingLead === r.lead_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCw className="mr-1 h-3 w-3" />
                          Retry
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <span className="text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </Card>
  );
}
