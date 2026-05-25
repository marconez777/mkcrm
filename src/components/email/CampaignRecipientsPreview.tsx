import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MailX, AlertCircle } from "lucide-react";

type Props = {
  clinicId: string;
  segmentId: string | null;
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

export function CampaignRecipientsPreview({ clinicId, segmentId }: Props) {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState({ ...INITIAL, loading: true });
      try {
        let recipients: Recipient[] = [];

        if (segmentId) {
          // Carrega filtros do segmento e chama o preview RPC (dry-run)
          const { data: seg, error: segErr } = await supabase
            .from("email_segments")
            .select("filters")
            .eq("id", segmentId)
            .maybeSingle();
          if (segErr) throw segErr;
          const filters = (seg?.filters ?? {}) as any;

          const { data, error } = await supabase.rpc("resolve_email_segment_preview", {
            _clinic_id: clinicId,
            _filters: filters,
          });
          if (error) throw error;
          recipients = (data ?? []).map((r: any) => ({ email: r.email, name: r.name }));
        } else {
          // Sem segmento = todos os leads da clínica com email
          const { data, error } = await supabase
            .from("leads")
            .select("email,name")
            .eq("clinic_id", clinicId)
            .not("email", "is", null)
            .neq("email", "")
            .limit(5000);
          if (error) throw error;
          recipients = (data ?? []).map((r: any) => ({
            email: String(r.email).toLowerCase(),
            name: r.name,
          }));
        }

        // Dedupe por email
        const seen = new Set<string>();
        const deduped: Recipient[] = [];
        for (const r of recipients) {
          const key = (r.email || "").toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push({ ...r, email: key });
        }

        // Conta unsubscribes
        let unsubscribed = 0;
        if (deduped.length > 0) {
          const emails = deduped.map((r) => r.email);
          const { data: unsubs } = await supabase
            .from("email_unsubscribes")
            .select("email")
            .eq("clinic_id", clinicId)
            .in("email", emails);
          unsubscribed = (unsubs ?? []).length;
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          total: deduped.length,
          unsubscribed,
          sample: deduped.slice(0, 10),
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
  }, [clinicId, segmentId]);

  const sendable = Math.max(0, state.total - state.unsubscribed);

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
              {sendable} enviáveis
            </Badge>
            {state.unsubscribed > 0 && (
              <Badge variant="outline" className="text-[10px] tabular-nums gap-1">
                <MailX className="h-2.5 w-2.5" />
                {state.unsubscribed} descad.
              </Badge>
            )}
          </div>
        )}
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {!state.loading && !state.error && state.total === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum lead corresponde a este segmento.
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
          {state.total > state.sample.length && (
            <p className="text-[10px] text-muted-foreground pt-1">
              … e mais {state.total - state.sample.length}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
