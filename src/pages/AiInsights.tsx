import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2, Search, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Insight {
  id: string;
  agent_id: string | null;
  lead_id: string | null;
  thread_id: string | null;
  summary: string;
  sentiment: string | null;
  top_objections: string[];
  top_doubts: string[];
  top_interests: string[];
  drop_off_reasons: string[];
  recommendations: string[];
  period_start: string | null;
  period_end: string;
  created_at: string;
}
interface Agent { id: string; name: string }
interface Lead { id: string; name: string | null; phone: string }

const SENTIMENT_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  positivo: "default",
  neutro: "secondary",
  negativo: "destructive",
  ambivalente: "outline",
};

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export default function AiInsights() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const ins: Insight[] = (data || []).map((r: any) => ({
      ...r,
      top_objections: asArray(r.top_objections),
      top_doubts: asArray(r.top_doubts),
      top_interests: asArray(r.top_interests),
      drop_off_reasons: asArray(r.drop_off_reasons),
      recommendations: asArray(r.recommendations),
    }));
    setInsights(ins);

    const agentIds = [...new Set(ins.map((m) => m.agent_id).filter(Boolean) as string[])];
    const leadIds = [...new Set(ins.map((m) => m.lead_id).filter(Boolean) as string[])];

    const [{ data: ag }, { data: ld }] = await Promise.all([
      agentIds.length
        ? supabase.from("ai_agents").select("id,name").in("id", agentIds)
        : Promise.resolve({ data: [] as Agent[] }),
      leadIds.length
        ? supabase.from("leads").select("id,name,phone").in("id", leadIds)
        : Promise.resolve({ data: [] as Lead[] }),
    ]);
    setAgents(Object.fromEntries((ag || []).map((a: any) => [a.id, a])));
    setLeads(Object.fromEntries((ld || []).map((l: any) => [l.id, l])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return insights.filter((m) => {
      if (agentFilter !== "all" && m.agent_id !== agentFilter) return false;
      if (sentimentFilter !== "all" && m.sentiment !== sentimentFilter) return false;
      if (q) {
        const hay = [
          m.summary,
          ...m.top_objections, ...m.top_doubts, ...m.top_interests,
          ...m.drop_off_reasons, ...m.recommendations,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [insights, agentFilter, sentimentFilter, search]);

  const agentList = useMemo(() => Object.values(agents), [agents]);

  async function runAnalyst() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analyst-run", {
        body: { hours: 24 },
      });
      if (error) throw error;
      toast.success(`Análise iniciada: ${(data as any)?.processed ?? 0} leads`);
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao executar analista");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Insights de conversas</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runAnalyst} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-1" />}
            Rodar analista agora
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em resumo, objeções, dúvidas, recomendações..."
            className="pl-8"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agentList.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sentimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos sentimentos</SelectItem>
            <SelectItem value="positivo">Positivo</SelectItem>
            <SelectItem value="neutro">Neutro</SelectItem>
            <SelectItem value="negativo">Negativo</SelectItem>
            <SelectItem value="ambivalente">Ambivalente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando insights...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum insight ainda. O agente "Analista de Conversas" roda diariamente — ou clique em "Rodar analista agora".
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const lead = m.lead_id ? leads[m.lead_id] : null;
            const agent = m.agent_id ? agents[m.agent_id] : null;
            return (
              <Card key={m.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.sentiment && (
                        <Badge variant={SENTIMENT_BADGE[m.sentiment] ?? "secondary"}>{m.sentiment}</Badge>
                      )}
                      {agent && <Badge variant="outline">{agent.name}</Badge>}
                      {lead && (
                        <Link to={`/inbox/${lead.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                          {lead.name || lead.phone} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <CardTitle className="text-base font-medium leading-snug pt-2">{m.summary}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InsightList label="Objeções" items={m.top_objections} tone="destructive" />
                  <InsightList label="Dúvidas" items={m.top_doubts} tone="secondary" />
                  <InsightList label="Interesses" items={m.top_interests} tone="default" />
                  <InsightList label="Motivos de sumiço" items={m.drop_off_reasons} tone="outline" />
                  <InsightList label="Recomendações" items={m.recommendations} tone="default" highlight />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightList({
  label, items, tone, highlight,
}: { label: string; items: string[]; tone: "default" | "secondary" | "destructive" | "outline"; highlight?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <ul className={`space-y-1 ${highlight ? "pl-0" : "pl-0"}`}>
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <Badge variant={tone} className="mt-0.5 shrink-0">{i + 1}</Badge>
            <span className={highlight ? "font-medium" : ""}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
