import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/layouts/AdminShell";
import { Loader2, Check, X, RefreshCw } from "lucide-react";

interface Proposal {
  id: string;
  lead_id: string;
  batch_tag: string;
  current_stage_id: string;
  proposed_stage_id: string;
  proposed_custom_fields: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  status: string;
  cost_usd: number | null;
  created_at: string;
}

interface Stage { id: string; name: string; pipeline_id: string }
interface Pipeline { id: string; name: string; clinic_id: string }
interface Clinic { id: string; name: string }
interface Lead { id: string; name: string | null; phone: string }

export default function AdminReclassify() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [batchTag, setBatchTag] = useState("F1-smoke");
  const [clinicId, setClinicId] = useState("");
  const [stageId, setStageId] = useState("");
  const [limit, setLimit] = useState(5);
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [singleLeadId, setSingleLeadId] = useState("");

  async function loadMeta() {
    const [{ data: cs }, { data: ps }, { data: st }] = await Promise.all([
      supabase.from("clinics").select("id, name").order("name"),
      supabase.from("pipelines").select("id, name, clinic_id"),
      supabase.from("pipeline_stages").select("id, name, pipeline_id").limit(500),
    ]);
    setClinics((cs ?? []) as Clinic[]);
    setPipelines((ps ?? []) as Pipeline[]);
    setStages((st ?? []) as Stage[]);
  }

  async function load() {
    setLoading(true);
    const { data: props } = await supabase
      .from("lead_reclassify_proposals")
      .select("*").eq("status", statusFilter)
      .order("created_at", { ascending: false }).limit(200);
    setProposals((props ?? []) as Proposal[]);
    const ids = Array.from(new Set((props ?? []).map((p: any) => p.lead_id)));
    if (ids.length) {
      const { data: ls } = await supabase.from("leads")
        .select("id, name, phone").in("id", ids);
      const map: Record<string, Lead> = {};
      for (const l of (ls ?? []) as Lead[]) map[l.id] = l;
      setLeads(map);
    } else {
      setLeads({});
    }
    setLoading(false);
  }

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [statusFilter]);

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  // Stages filtrados pela clínica selecionada
  const filteredStages = useMemo(() => {
    if (!clinicId) return [];
    const pipelineIds = new Set(pipelines.filter((p) => p.clinic_id === clinicId).map((p) => p.id));
    return stages
      .filter((s) => pipelineIds.has(s.pipeline_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clinicId, pipelines, stages]);

  // Reset stage quando trocar clínica
  useEffect(() => { setStageId(""); }, [clinicId]);

  async function runBatch() {
    setRunning(true);
    try {
      const body: any = { batch_tag: batchTag, dry_run: dryRun };
      if (singleLeadId.trim()) body.lead_id = singleLeadId.trim();
      else if (stageId) { body.stage_id = stageId; body.limit = limit; }
      else { toast({ title: "Informe lead_id ou clínica + stage" }); return; }
      const { data, error } = await supabase.functions.invoke("lead-reclassify-deep", { body });
      if (error) throw error;
      toast({ title: "OK", description: `${(data as any)?.count ?? 1} processado(s)` });
      await load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setRunning(false); }
  }

  async function approve(id: string) {
    const { error } = await supabase.rpc("apply_reclassify_proposal", { _proposal_id: id });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Aplicado" }); await load(); }
  }
  async function reject(id: string) {
    const { error } = await supabase.rpc("reject_reclassify_proposal", { _proposal_id: id });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Rejeitado" }); await load(); }
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="Reclassificação profunda"
        description="IA relê a conversa inteira de cada lead e propõe a coluna correta. Aprovação manual."
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4" /></Button>}
      />

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Disparar reclassificação</div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          <Input placeholder="batch_tag" value={batchTag} onChange={(e) => setBatchTag(e.target.value)} />
          <Input placeholder="lead_id (opcional)" value={singleLeadId} onChange={(e) => setSingleLeadId(e.target.value)} className="md:col-span-2" />
          <Select value={clinicId} onValueChange={setClinicId}>
            <SelectTrigger><SelectValue placeholder="Clínica" /></SelectTrigger>
            <SelectContent>
              {clinics.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stageId} onValueChange={setStageId} disabled={!clinicId}>
            <SelectTrigger><SelectValue placeholder={clinicId ? "Stage (lote)" : "Escolha clínica"} /></SelectTrigger>
            <SelectContent>
              {filteredStages.map((s) => {
                const pipe = pipelines.find((p) => p.id === s.pipeline_id);
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} <span className="text-xs text-muted-foreground">· {pipe?.name}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> dry-run
            </label>
            <Button onClick={runBatch} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : "Rodar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["pending", "applied", "rejected", "skipped", "error"].map((s) =>
              <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {proposals.length} propostas · custo total: ${proposals.reduce((a, p) => a + Number(p.cost_usd ?? 0), 0).toFixed(4)}
        </span>
      </div>

      {loading ? <Loader2 className="size-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {proposals.map((p) => {
            const lead = leads[p.lead_id];
            const moved = p.current_stage_id !== p.proposed_stage_id;
            return (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{lead?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{lead?.phone}</span>
                  <Badge variant="outline">{stageName(p.current_stage_id)}</Badge>
                  <span>→</span>
                  <Badge variant={moved ? "default" : "secondary"}>{stageName(p.proposed_stage_id)}</Badge>
                  <Badge variant="outline">conf {(p.confidence * 100).toFixed(0)}%</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    ${Number(p.cost_usd ?? 0).toFixed(4)} · {p.batch_tag}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{p.reasoning}</p>
                {Object.keys(p.proposed_custom_fields ?? {}).length > 0 && (
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(p.proposed_custom_fields, null, 2)}
                  </pre>
                )}
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(p.id)}>
                      <Check className="size-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(p.id)}>
                      <X className="size-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
