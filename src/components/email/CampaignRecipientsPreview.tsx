import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MailX, AlertCircle } from "lucide-react";

type Props = {
  clinicId: string;
  segmentIds: string[];
};

type Recipient = { email: string; name: string | null };

type State = {
  loading: boolean;
  error: string | null;
  total: number;
  unsubscribed: number;
  sample: Recipient[];
};

const INITIAL: State = { loading: false, error: null, total: 0, unsubscribed: 0, sample: [] };

const SAMPLE_LIMIT = 10;

export function CampaignRecipientsPreview({ clinicId, segmentIds }: Props) {
  const [state, setState] = useState<State>(INITIAL);
  const segKey = segmentIds.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState({ ...INITIAL, loading: true });
      try {
        // Contagem, supressões e amostra vêm prontas do servidor. Paginar
        // `resolve_email_segment` daqui recalculava o público a cada página —
        // numa lista de 146k a prévia nunca terminava (G-04 do EMAIL_ESCALA).
        const { data, error } = await supabase.rpc("email_segment_preview" as any, {
          _clinic_id: clinicId,
          _segment_ids: segmentIds,
          _sample_limit: SAMPLE_LIMIT,
        });
        if (error) throw error;

        const row = (data ?? {}) as {
          total?: number;
          unsubscribed?: number;
          sample?: Array<{ email?: string; name?: string | null }>;
        };

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          total: Number(row.total ?? 0),
          unsubscribed: Number(row.unsubscribed ?? 0),
          sample: (row.sample ?? []).map((r) => ({
            email: String(r.email ?? ""),
            name: r.name ?? null,
          })),
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({ ...INITIAL, error: e.message ?? "Erro ao carregar prévia" });
      }
    }
    if (clinicId) run();
    return () => {
      cancelled = true;
    };
  }, [clinicId, segKey]);

  const sendable = Math.max(0, state.total - state.unsubscribed);
  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <Card className="p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Destinatários
        </span>
        {state.loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : state.error ? (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertCircle className="h-2.5 w-2.5" /> erro
          </Badge>
        ) : (
          <div className="flex gap-1.5">
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {fmt(sendable)} enviáveis
            </Badge>
            {state.unsubscribed > 0 && (
              <Badge variant="outline" className="text-[10px] tabular-nums gap-1">
                <MailX className="h-2.5 w-2.5" />
                {fmt(state.unsubscribed)} descad.
              </Badge>
            )}
          </div>
        )}
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {!state.loading && !state.error && state.total === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum contato corresponde a este segmento.
        </p>
      )}

      {state.sample.length > 0 && (
        <div className="space-y-0.5 max-h-40 overflow-auto rounded border border-border bg-background p-2">
          {state.sample.map((r) => (
            <div key={r.email} className="text-xs flex justify-between gap-2">
              <span className="font-mono truncate">{r.email}</span>
              <span className="text-muted-foreground truncate">{r.name ?? "—"}</span>
            </div>
          ))}
          {sendable > state.sample.length && (
            <p className="text-[10px] text-muted-foreground pt-1">
              … e mais {fmt(sendable - state.sample.length)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
