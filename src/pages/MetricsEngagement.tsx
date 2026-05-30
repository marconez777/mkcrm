import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Loader2, MessageCircle, Megaphone, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Period = "7" | "30" | "90";

type BroadcastRow = {
  broadcast_id: string;
  broadcast_name: string;
  created_at: string;
  sent_count: number;
  replied_count: number;
  qualified_count: number;
};
type SequenceRow = {
  sequence_id: string;
  sequence_name: string;
  enabled: boolean;
  sent_count: number;
  replied_count: number;
  qualified_count: number;
};
type StepRow = {
  step_id: string;
  step_position: number;
  sent_count: number;
  replied_count: number;
  qualified_count: number;
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function KpiCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: any }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const w = total > 0 ? Math.max(2, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} <span className="text-muted-foreground">({pct(value, total)}%)</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export default function MetricsEngagement() {
  const [period, setPeriod] = useState<Period>("30");
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [sequences, setSequences] = useState<SequenceRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stepsBySeq, setStepsBySeq] = useState<Record<string, StepRow[]>>({});

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - Number(period) * 24 * 3600 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  const load = async () => {
    setLoading(true);
    const [{ data: b, error: be }, { data: s, error: se }] = await Promise.all([
      supabase.rpc("engagement_broadcasts_summary", { _from: range.from, _to: range.to }),
      supabase.rpc("engagement_sequences_summary", { _from: range.from, _to: range.to }),
    ]);
    if (be) toast.error(be.message);
    if (se) toast.error(se.message);
    setBroadcasts((b as BroadcastRow[]) ?? []);
    setSequences((s as SequenceRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const loadSteps = async (sequenceId: string) => {
    if (stepsBySeq[sequenceId]) return;
    const { data, error } = await supabase.rpc("engagement_sequence_steps", {
      _sequence_id: sequenceId, _from: range.from, _to: range.to,
    });
    if (error) return toast.error(error.message);
    setStepsBySeq((m) => ({ ...m, [sequenceId]: (data as StepRow[]) ?? [] }));
  };

  const toggle = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadSteps(id);
  };

  const totals = useMemo(() => {
    const all = [...broadcasts, ...sequences];
    const sent = all.reduce((a, r) => a + r.sent_count, 0);
    const replied = all.reduce((a, r) => a + r.replied_count, 0);
    const qualified = all.reduce((a, r) => a + r.qualified_count, 0);
    return { sent, replied, qualified };
  }, [broadcasts, sequences]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Engajamento</h1>
          <p className="text-sm text-muted-foreground">Respostas e qualificação dos leads em disparos e sequências do WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-card">
            {(["7", "30", "90"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs ${period === p ? "bg-accent font-semibold" : "text-muted-foreground"}`}>
                {p}d
              </button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="Mensagens enviadas" value={totals.sent} icon={MessageCircle} />
        <KpiCard label="Respostas" value={totals.replied} hint={`Taxa de resposta ${pct(totals.replied, totals.sent)}%`} icon={Megaphone} />
        <KpiCard label="Qualificados" value={totals.qualified} hint={`Taxa de qualificação ${pct(totals.qualified, totals.sent)}%`} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="sequences">
        <TabsList>
          <TabsTrigger value="sequences">Sequências ({sequences.length})</TabsTrigger>
          <TabsTrigger value="broadcasts">Disparos ({broadcasts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sequences" className="space-y-2">
          {sequences.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sequência com envios no período.</p>
          )}
          {sequences.map((s) => {
            const open = expanded === s.sequence_id;
            const steps = stepsBySeq[s.sequence_id] ?? [];
            return (
              <Card key={s.sequence_id} className="overflow-hidden">
                <button onClick={() => toggle(s.sequence_id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.sequence_name}</span>
                      <Badge variant={s.enabled ? "default" : "secondary"} className="text-[10px]">
                        {s.enabled ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden grid-cols-3 gap-6 text-xs text-muted-foreground sm:grid">
                    <div><span className="text-foreground font-semibold">{s.sent_count}</span> enviadas</div>
                    <div><span className="text-foreground font-semibold">{s.replied_count}</span> resp ({pct(s.replied_count, s.sent_count)}%)</div>
                    <div><span className="text-foreground font-semibold">{s.qualified_count}</span> qualif ({pct(s.qualified_count, s.sent_count)}%)</div>
                  </div>
                </button>
                {open && (
                  <div className="space-y-4 border-t bg-muted/20 p-4">
                    {steps.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sem envios desta sequência no período.</p>
                    )}
                    {steps.map((st) => (
                      <div key={st.step_id} className="space-y-2 rounded-md border bg-card p-3">
                        <div className="text-xs font-semibold">Passo {st.step_position + 1}</div>
                        <FunnelBar label="Enviadas" value={st.sent_count} total={st.sent_count} color="bg-primary" />
                        <FunnelBar label="Respostas" value={st.replied_count} total={st.sent_count} color="bg-emerald-500" />
                        <FunnelBar label="Qualificados" value={st.qualified_count} total={st.sent_count} color="bg-amber-500" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="broadcasts" className="space-y-2">
          {broadcasts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum disparo no período.</p>
          )}
          {broadcasts.map((b) => (
            <Card key={b.broadcast_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{b.broadcast_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-xs text-muted-foreground">
                <div><span className="text-foreground font-semibold">{b.sent_count}</span> enviadas</div>
                <div><span className="text-foreground font-semibold">{b.replied_count}</span> resp ({pct(b.replied_count, b.sent_count)}%)</div>
                <div><span className="text-foreground font-semibold">{b.qualified_count}</span> qualif ({pct(b.qualified_count, b.sent_count)}%)</div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        <strong>Resposta:</strong> primeira mensagem do lead após o envio. <strong>Qualificação:</strong> lead avançou para uma coluna posterior no pipeline depois do envio (snapshot da coluna é registrado no momento do envio; registros antigos não contam).
      </p>
    </div>
  );
}
