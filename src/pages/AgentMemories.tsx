import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllByIn } from "@/lib/fetch-all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Trash2, ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Memory {
  id: string;
  agent_id: string | null;
  lead_id: string | null;
  kind: string;
  content: string;
  created_at: string;
}
interface Agent { id: string; name: string }
interface Lead { id: string; name: string | null; phone: string }

export default function AgentMemories() {
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_memory")
      .select("id,agent_id,lead_id,kind,content,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const mems = (data || []) as Memory[];
    setMemories(mems);

    const agentIds = [...new Set(mems.map((m) => m.agent_id).filter(Boolean) as string[])];
    const leadIds = [...new Set(mems.map((m) => m.lead_id).filter(Boolean) as string[])];

    const [ag, ld] = await Promise.all([
      fetchAllByIn<Agent>(
        (slice) => supabase.from("ai_agents").select("id,name").in("id", slice),
        agentIds,
      ),
      fetchAllByIn<Lead>(
        (slice) => supabase.from("leads").select("id,name,phone").in("id", slice),
        leadIds,
      ),
    ]);
    setAgents(Object.fromEntries(ag.map((a: Agent) => [a.id, a])));
    setLeads(Object.fromEntries(ld.map((l: Lead) => [l.id, l])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    const { error } = await supabase.from("agent_memory").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.success("Memória apagada");
  }

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      if (agentFilter !== "all" && m.agent_id !== agentFilter) return false;
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [memories, agentFilter, kindFilter, search]);

  const kinds = useMemo(() => [...new Set(memories.map((m) => m.kind))], [memories]);
  const agentList = useMemo(() => Object.values(agents), [agents]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Memórias dos Agentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo que os agentes aprenderam e salvaram sobre os leads (fatos, preferências, contexto).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar no conteúdo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {agentList.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {kinds.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {filtered.length} de {memories.length} memórias
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {memories.length === 0
            ? "Nenhuma memória salva ainda. Os agentes vão registrar fatos importantes conforme conversam com os leads."
            : "Nenhuma memória corresponde aos filtros."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const agent = m.agent_id ? agents[m.agent_id] : null;
            const lead = m.lead_id ? leads[m.lead_id] : null;
            return (
              <Card key={m.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant={m.kind === "preference" ? "default" : "secondary"}>{m.kind}</Badge>
                    {agent && <Badge variant="outline">🤖 {agent.name}</Badge>}
                    {lead && (
                      <Link to={`/inbox/${lead.id}`}>
                        <Badge variant="outline" className="hover:bg-accent cursor-pointer">
                          👤 {lead.name || lead.phone} <ExternalLink className="h-3 w-3 ml-1" />
                        </Badge>
                      </Link>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  <div className="flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Apagar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar esta memória?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O agente vai esquecer permanentemente esta informação. Não pode ser desfeito.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(m.id)}>Apagar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
