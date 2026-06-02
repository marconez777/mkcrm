import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, RefreshCw, Lightbulb } from "lucide-react";
import { toast } from "sonner";

type Recommendation = {
  title: string;
  detail: string;
  area: "prompt" | "kb" | "config" | "process";
  priority: "high" | "medium" | "low";
};

type Insight = {
  id: string;
  created_at: string;
  period_start: string | null;
  period_end: string;
  summary: string;
  sentiment: string | null;
  top_objections: string[];
  top_doubts: string[];
  top_interests: string[];
  drop_off_reasons: string[];
  recommendations: Recommendation[];
  raw: any;
};

const AREA_LABEL: Record<string, string> = {
  prompt: "Prompt",
  kb: "Base de conhecimento",
  config: "Configuração",
  process: "Processo",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "positivo",
  neutral: "neutro",
  negative: "negativo",
  mixed: "misto",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function AgentInsights({
  agentId,
  clinicId,
  onApplyToPrompt,
}: {
  agentId: string;
  clinicId: string;
  onApplyToPrompt: (text: string) => void;
}) {
  const [latest, setLatest] = useState<Insight | null>(null);
  const [history, setHistory] = useState<Insight[]>([]);
  const [days, setDays] = useState("14");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(6);
    const list = (data as Insight[]) ?? [];
    setHistory(list);
    setLatest(list[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const generate = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-builder", {
        body: {
          action: "generate_insights",
          clinic_id: clinicId,
          payload: { agent_id: agentId, days: Number(days) },
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? "Falha ao gerar insights.");
      toast.success(`Insights gerados (${data.threads_analyzed} conversas, ${data.messages_analyzed} mensagens).`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar insights.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">Analisar últimos</span>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="60">60 dias</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={generate} disabled={running}>
          {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Gerar insights
        </Button>
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {!latest && !loading && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum insight ainda. Clique em "Gerar insights" para analisar conversas reais deste agente.
        </p>
      )}

      {latest && (
        <div className="rounded border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">Mais recente</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(latest.created_at).toLocaleString("pt-BR")}
              </span>
              {latest.sentiment && (
                <Badge variant="outline" className="text-[10px]">
                  Clima: {SENTIMENT_LABEL[latest.sentiment] ?? latest.sentiment}
                </Badge>
              )}
              {latest.raw?.threads_analyzed && (
                <span className="text-[11px] text-muted-foreground">
                  {latest.raw.threads_analyzed} threads · {latest.raw.messages_analyzed} mensagens
                </span>
              )}
            </div>
          </div>

          <p className="text-sm">{latest.summary}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ListBlock title="Objeções" items={latest.top_objections} />
            <ListBlock title="Dúvidas" items={latest.top_doubts} />
            <ListBlock title="Interesses" items={latest.top_interests} />
            <ListBlock title="Motivos de drop-off" items={latest.drop_off_reasons} />
          </div>

          {latest.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Recomendações
              </p>
              {latest.recommendations.map((r, i) => (
                <div key={i} className="rounded border bg-muted/20 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={PRIORITY_VARIANT[r.priority] ?? "outline"} className="text-[10px]">
                      {r.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {AREA_LABEL[r.area] ?? r.area}
                    </Badge>
                    <span className="font-medium">{r.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                  {r.area === "prompt" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onApplyToPrompt(`## Insight: ${r.title}\n${r.detail}`)}
                    >
                      Anexar ao prompt
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Histórico ({history.length - 1} anteriores)
          </summary>
          <div className="mt-2 space-y-2">
            {history.slice(1).map((h) => (
              <div key={h.id} className="rounded border bg-muted/10 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  {h.sentiment && <Badge variant="outline" className="text-[10px]">{SENTIMENT_LABEL[h.sentiment] ?? h.sentiment}</Badge>}
                </div>
                <p className="mt-1">{h.summary}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded border bg-muted/10 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <ul className="space-y-0.5 text-xs">
        {items.map((it, i) => <li key={i}>• {it}</li>)}
      </ul>
    </div>
  );
}
