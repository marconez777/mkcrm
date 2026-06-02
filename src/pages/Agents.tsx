import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Bot, Plus, Trash2, FileText, Send, Loader2, Settings as SettingsIcon, KeyRound, Wrench, FlaskConical, PlayCircle, Sparkles, History, Lightbulb, ShieldCheck, DollarSign, ClipboardList, Rocket, Pencil } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";
import { useAuth } from "@/hooks/useAuth";
import { BuilderSetupCard } from "@/components/agents/BuilderSetupCard";
import { KbAssistant } from "@/components/agents/KbAssistant";
import { TestLab } from "@/components/agents/TestLab";
import { PromptHistory } from "@/components/agents/PromptHistory";
import { AgentInsights } from "@/components/agents/AgentInsights";
import { AgentHealth } from "@/components/agents/AgentHealth";
import { CostsPanel } from "@/components/agents/CostsPanel";
import { AuditLogPanel } from "@/components/agents/AuditLogPanel";
import { Slider } from "@/components/ui/slider";
import { QUALITY_LADDER, QUALITY_LABELS, modelForQuality, qualityForModel } from "@/lib/quality-ladder";

type Provider = "openai" | "anthropic" | "google" | "xai" | "manus";
type Agent = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  provider: Provider;
  api_key: string | null;
  base_url: string | null;
  model: string;
  temperature: number;
  enabled: boolean;
  tools: string[];
  embedding_model: string | null;
  embedding_api_key: string | null;
  reranker_provider?: string | null;
  reranker_api_key?: string | null;
  max_iterations?: number;
  use_hyde?: boolean;
  use_hybrid_search?: boolean;
  use_memory?: boolean;
  planning_mode?: boolean;
  rag_top_k?: number;
  debounce_seconds?: number;
  is_system?: boolean;
  system_key?: string | null;
  builder_verified_at?: string | null;
  draft_mode?: boolean;
  niche?: string | null;
  niche_other?: string | null;
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-20250514", "claude-opus-4-20250514"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  xai: ["grok-2-latest", "grok-2-mini", "grok-beta", "grok-vision-beta"],
  manus: [],
};
const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI", anthropic: "Anthropic (Claude)", google: "Google (Gemini)", xai: "xAI (Grok)", manus: "Manus",
};
const PROVIDER_KEY_PLACEHOLDER: Record<Provider, string> = {
  openai: "sk-...", anthropic: "sk-ant-...", google: "AIza...", xai: "xai-...", manus: "API key Manus",
};
const PROVIDER_BASE_PLACEHOLDER: Record<Provider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  xai: "https://api.x.ai/v1",
  manus: "https://api.manus.example/v1 (obrigatório)",
};
/** Providers that don't have native embeddings — user must supply an OpenAI/Google embedding key. */
const PROVIDERS_NEEDING_EMBEDDING_KEY: Provider[] = ["anthropic", "xai", "manus"];

const TOOL_GROUPS: { group: string; tools: { id: string; label: string; hint?: string }[] }[] = [
  {
    group: "Pipeline & Lead",
    tools: [
      { id: "move_lead_stage", label: "Mover lead de estágio" },
      { id: "set_lead_field", label: "Atualizar campo do lead" },
      { id: "update_custom_field", label: "Atualizar campo custom" },
      { id: "assign_attendant", label: "Atribuir atendente" },
    ],
  },
  {
    group: "Conversa & Histórico",
    tools: [
      { id: "add_lead_note", label: "Anotar no lead" },
      { id: "get_lead_history", label: "Ler histórico do lead" },
      { id: "transfer_to_human", label: "Transferir para humano" },
    ],
  },
  {
    group: "Conhecimento & Memória",
    tools: [
      { id: "search_knowledge_base", label: "Buscar na base (RAG)" },
      { id: "remember_fact", label: "Memorizar fato/preferência", hint: "Silenciosa — recomendada em agentes observadores" },
    ],
  },
  {
    group: "Agendamentos & Tarefas",
    tools: [
      { id: "create_task", label: "Criar tarefa" },
      { id: "schedule_message", label: "Agendar mensagem" },
    ],
  },
];
const TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);

function McpServersPanel({ agentId }: { agentId: string }) {
  const [servers, setServers] = useState<any[]>([]);
  const [name, setName] = useState(""); const [url, setUrl] = useState("");
  const load = async () => {
    const { data } = await supabase.rpc("admin_list_agent_mcp_servers", { _agent_id: agentId });
    setServers((data as any[]) ?? []);
  };
  useEffect(() => { load(); }, [agentId]);
  const add = async () => {
    if (!name || !url) return;
    await supabase.from("agent_mcp_servers").insert({ agent_id: agentId, name, url, headers: {}, enabled: true });
    setName(""); setUrl(""); load();
  };
  const remove = async (id: string) => { await supabase.from("agent_mcp_servers").delete().eq("id", id); load(); };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="https://mcp.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" onClick={add}>Adicionar</Button>
      </div>
      {servers.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
          <span className="truncate"><b>{s.name}</b> · {s.url}</span>
          <Button variant="ghost" size="sm" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
      {servers.length === 0 && <p className="text-xs text-muted-foreground">Nenhum servidor MCP.</p>}
    </div>
  );
}

function EvalsPanel({ agentId }: { agentId: string }) {
  const [evals, setEvals] = useState<any[]>([]);
  const [prompt, setPrompt] = useState(""); const [expected, setExpected] = useState("");
  const [running, setRunning] = useState(false);
  const load = async () => {
    const { data } = await supabase.from("agent_evals").select("*").eq("agent_id", agentId).order("created_at", { ascending: false });
    setEvals(data ?? []);
  };
  useEffect(() => { load(); }, [agentId]);
  const add = async () => {
    if (!prompt) return;
    await supabase.from("agent_evals").insert({
      agent_id: agentId, prompt,
      expected_contains: expected.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setPrompt(""); setExpected(""); load();
  };
  const runAll = async () => {
    setRunning(true);
    await supabase.functions.invoke("ai-eval-run", { body: { agent_id: agentId } });
    setRunning(false); load();
  };
  return (
    <div className="space-y-2">
      <Textarea rows={2} placeholder="Pergunta de teste" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <Input placeholder="Termos esperados (separados por vírgula)" value={expected} onChange={(e) => setExpected(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" onClick={add}>Adicionar caso</Button>
        <Button size="sm" variant="secondary" onClick={runAll} disabled={running}>
          {running ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Rodar todos
        </Button>
      </div>
      {evals.map((e) => (
        <div key={e.id} className="rounded border bg-background px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium">{e.prompt}</span>
            {e.last_passed === true && <Badge className="bg-green-600">passou</Badge>}
            {e.last_passed === false && <Badge variant="destructive">falhou</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { membership, isSuperAdmin } = useAuth();
  const canManage = isSuperAdmin || membership?.role === "owner" || membership?.role === "admin";
  const [docs, setDocs] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [ingestingUrl, setIngestingUrl] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [pdfRunning, setPdfRunning] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [uiMode, setUiMode] = useState<"simple" | "advanced">(
    () => (localStorage.getItem("agents.uiMode") as "simple" | "advanced") || "simple"
  );
  const toggleMode = () => {
    const next = uiMode === "simple" ? "advanced" : "simple";
    setUiMode(next);
    localStorage.setItem("agents.uiMode", next);
  };

  const runBulk = async () => {
    if (!selected) return;
    if (!(await confirm({
      title: `Rodar "${selected.name}" em todos os leads?`,
      description: "O agente será enfileirado para todas as conversas ativas (não arquivadas) que já receberam alguma mensagem. Pode levar alguns minutos para processar.",
      confirmLabel: "Rodar agora",
    }))) return;
    setBulkRunning(true);
    const { data, error } = await supabase.functions.invoke("agent-run-bulk", {
      body: { agent_id: selected.id, only_with_inbound: true },
    });
    setBulkRunning(false);
    if (error || (data as any)?.error) {
      toast.error("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(`Enfileirado em ${(data as any)?.enqueued} leads. Rodando em background.`);
  };

  const ingestPdf = async (file: File) => {
    if (!selected) return;
    setPdfRunning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(",")[1];
      const { data, error } = await supabase.functions.invoke("ai-ingest-pdf", {
        body: { agent_id: selected.id, title: file.name, file_base64: b64 },
      });
      setPdfRunning(false);
      if (error || (data as any)?.error) {
        toast.error("Erro PDF: " + (error?.message ?? (data as any)?.error));
        return;
      }
      toast.success(`PDF ingerido (${(data as any)?.chunks} chunks, ${(data as any)?.pages} páginas)`);
      const docs = await fetchAllPaged<any>(() => supabase
        .from("ai_documents").select("id, title, source, source_type, created_at, metadata")
        .eq("agent_id", selected.id).order("created_at", { ascending: false }));
      setDocs(docs);
    };
    reader.readAsDataURL(file);
  };

  const ingestBatch = async () => {
    if (!selected) return;
    const urls = batchUrls.split(/\s+/).filter((u) => u.startsWith("http"));
    if (urls.length === 0) return toast.error("Cole uma URL por linha");
    setBatchRunning(true);
    const { data, error } = await supabase.functions.invoke("ai-ingest-urls", {
      body: { agent_id: selected.id, urls },
    });
    setBatchRunning(false);
    if (error) return toast.error(error.message);
    const d = data as any;
    toast.success(`Lote: ${d.succeeded}/${d.processed} ingeridas`);
    setBatchUrls("");
    const docs = await fetchAllPaged<any>(() => supabase
      .from("ai_documents").select("id, title, source, source_type, created_at, metadata")
      .eq("agent_id", selected.id).order("created_at", { ascending: false }));
    setDocs(docs);
  };

  const ingestUrl = async () => {
    if (!selected || !urlInput.trim()) return;
    setIngestingUrl(true);
    const { data, error } = await supabase.functions.invoke("ai-ingest-url", {
      body: { agent_id: selected.id, url: urlInput.trim() },
    });
    setIngestingUrl(false);
    if (error || (data as any)?.error) {
      toast.error("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(`URL ingerida (${(data as any)?.chunks} chunks)`);
    setUrlInput("");
    const docs = await fetchAllPaged<any>(() => supabase
      .from("ai_documents").select("id, title, source, source_type, created_at, metadata")
      .eq("agent_id", selected.id).order("created_at", { ascending: false }));
    setDocs(docs);
  };

  const AGENT_COLS = "id, name, description, system_prompt, provider, base_url, model, temperature, enabled, tools, api_key, embedding_model, embedding_api_key, reranker_provider, reranker_api_key, max_iterations, use_hyde, use_hybrid_search, use_memory, planning_mode, rag_top_k, debounce_seconds, is_system, system_key, draft_mode";

  const load = async () => {
    // RPC admin-only: retorna inclusive as colunas sensíveis (api_key, embedding_api_key, reranker_api_key).
    const { data, error } = await supabase.rpc("admin_list_ai_agents");
    if (error) { toast.error(error.message); return; }
    setAgents((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setDocs([]); return; }
    fetchAllPaged<any>(() => supabase
      .from("ai_documents")
      .select("id, title, source, source_type, created_at, metadata")
      .eq("agent_id", selected.id)
      .order("created_at", { ascending: false }))
      .then((data) => setDocs(data));
  }, [selected?.id]);

  const create = async () => {
    const { data, error } = await supabase
      .from("ai_agents")
      .insert({
        name: "Novo agente",
        system_prompt: "Você é um atendente prestativo. Responda em português.",
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await load();
    // Recarrega via RPC admin (inclui colunas sensíveis)
    const { data: full } = await supabase.rpc("admin_get_ai_agent", { _id: (data as any).id });
    setSelected(((full as any) ?? [])[0] ?? null);
  };

  const save = async (opts?: { versionSource?: string; versionSummary?: string }) => {
    if (!selected) return;
    // Snapshot do prompt atual antes do update, para versionar se mudou
    const { data: existing } = await supabase
      .from("ai_agents")
      .select("system_prompt")
      .eq("id", selected.id)
      .maybeSingle();
    const previousPrompt = (existing as any)?.system_prompt ?? "";

    const payload: any = {
      name: selected.name,
      description: selected.description,
      system_prompt: selected.system_prompt,
      provider: selected.provider,
      base_url: selected.base_url,
      model: selected.model,
      temperature: selected.temperature,
      enabled: selected.enabled,
      tools: selected.tools,
      embedding_model: selected.embedding_model,
      reranker_provider: selected.reranker_provider ?? null,
      max_iterations: selected.max_iterations ?? 6,
      use_hyde: selected.use_hyde ?? false,
      use_hybrid_search: selected.use_hybrid_search ?? true,
      use_memory: selected.use_memory ?? true,
      planning_mode: selected.planning_mode ?? false,
      rag_top_k: selected.rag_top_k ?? 5,
      debounce_seconds: selected.debounce_seconds ?? 8,
      draft_mode: selected.draft_mode ?? false,
    };
    // Only update credentials if user typed something (avoids wiping existing keys)
    if (typeof selected.api_key === "string" && selected.api_key.length > 0) payload.api_key = selected.api_key;
    if (typeof selected.embedding_api_key === "string" && selected.embedding_api_key.length > 0) payload.embedding_api_key = selected.embedding_api_key;
    if (typeof selected.reranker_api_key === "string" && selected.reranker_api_key.length > 0) payload.reranker_api_key = selected.reranker_api_key;
    const { error } = await supabase
      .from("ai_agents")
      .update(payload)
      .eq("id", selected.id);
    if (error) return toast.error(error.message);

    // Versiona prompt se mudou
    if (previousPrompt !== selected.system_prompt) {
      await supabase.from("agent_prompt_versions").insert({
        agent_id: selected.id,
        prompt: selected.system_prompt,
        source: opts?.versionSource ?? "manual",
        summary: opts?.versionSummary ?? null,
      });
    }

    toast.success("Agente salvo");
    load();
  };

  const remove = async (id: string) => {
    const target = agents.find((a) => a.id === id);
    if (target?.is_system) {
      toast.error("Agente padrão do sistema não pode ser excluído — apenas desativado.");
      return;
    }
    if (!(await confirm({ title: "Excluir agente?", description: "Documentos e memórias associadas serão removidos.", confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("ai_agents").delete().eq("id", id);
    if (error) {
      toast.error(error.message.includes("system_agent_cannot_be_deleted")
        ? "Agente padrão do sistema não pode ser excluído."
        : error.message);
      return;
    }
    if (selected?.id === id) setSelected(null);
    load();
  };

  const ingest = async () => {
    if (!selected || !docTitle.trim() || !docContent.trim()) return;
    setIngesting(true);
    const { data, error } = await supabase.functions.invoke("ai-ingest-document", {
      body: { agent_id: selected.id, title: docTitle, content: docContent },
    });
    setIngesting(false);
    if (error || (data as any)?.error) {
      toast.error("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(`Documento ingerido (${(data as any)?.chunks} chunks)`);
    setDocTitle(""); setDocContent("");
    const docs = await fetchAllPaged<any>(() => supabase
      .from("ai_documents").select("id, title, source, source_type, created_at, metadata")
      .eq("agent_id", selected.id).order("created_at", { ascending: false }));
    setDocs(docs);
  };

  const removeDoc = async (id: string) => {
    await supabase.from("ai_documents").delete().eq("id", id);
    setDocs((d) => d.filter((x) => x.id !== id));
  };

  const test = async () => {
    if (!selected || !testInput.trim()) return;
    setTesting(true);
    setTestOutput("");
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: {
        agent_id: selected.id,
        messages: [{ role: "user", content: testInput }],
      },
    });
    setTesting(false);
    if (error || (data as any)?.error) {
      setTestOutput("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    setTestOutput((data as any)?.content ?? "(vazio)");
  };

  const toggleTool = (tool: string) => {
    if (!selected) return;
    const next = selected.tools.includes(tool)
      ? selected.tools.filter((t) => t !== tool)
      : [...selected.tools, tool];
    setSelected({ ...selected, tools: next });
  };

  const builder = agents.find((a) => a.system_key === "builder") ?? null;
  const regularAgents = agents.filter((a) => a.system_key !== "builder");
  const clinicId = membership?.clinic_id ?? null;

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        {canManage && (
          <BuilderSetupCard
            builder={builder}
            clinicId={clinicId}
            selected={selected?.id === builder?.id}
            onSelect={() => builder && setSelected(builder)}
            onVerified={() => load()}
          />
        )}
        <div className="flex items-center justify-between p-4 pt-2">
          <h2 className="text-sm font-semibold">Agentes</h2>
          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate("/ai/agents/new")}
                title="Criar com assistente"
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Assistente
              </Button>
              <Button size="sm" variant="ghost" onClick={create} title="Criar em branco">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="px-2">
          {regularAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selected?.id === a.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{a.name}</span>
              {a.is_system && <Badge variant="secondary" className="text-[10px]" title="Agente padrão do sistema">padrão</Badge>}
              {!a.enabled && <Badge variant="outline" className="text-[10px]">off</Badge>}
            </button>
          ))}
          {regularAgents.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum agente. Crie o primeiro.</p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie um agente.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <Input
                  className="h-9 w-64 font-semibold"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                />
                <AgentHealth agentId={selected.id} />
                <Badge
                  variant={selected.draft_mode ? "secondary" : "default"}
                  className="gap-1 cursor-pointer"
                  title={selected.draft_mode
                    ? "Rascunho: o agente só responde no Test Lab. Clique para publicar."
                    : "Produção: o agente atende leads reais. Clique para voltar para rascunho."}
                  onClick={() => setSelected({ ...selected, draft_mode: !selected.draft_mode })}
                >
                  {selected.draft_mode ? <><Pencil className="h-3 w-3" /> Rascunho</> : <><Rocket className="h-3 w-3" /> Produção</>}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleMode}
                  title="Alternar entre modo Simples (essencial) e Avançado (tudo)"
                >
                  {uiMode === "simple" ? "Modo: Simples" : "Modo: Avançado"}
                </Button>
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={runBulk} disabled={bulkRunning} title="Rodar este agente em todos os leads ativos">
                      {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      Rodar em todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(selected.id)} disabled={!!selected.is_system} title={selected.is_system ? "Agente padrão do sistema não pode ser excluído" : "Excluir agente"}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => save()}>Salvar</Button>
                  </>
                )}
              </div>
            </div>


            <Accordion type="multiple" defaultValue={["general"]} className="space-y-3">
              <AccordionItem value="general" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <SettingsIcon className="h-4 w-4" /> Geral
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <Label>Ativo</Label>
                    <Switch
                      checked={selected.enabled}
                      onCheckedChange={(v) => setSelected({ ...selected, enabled: v })}
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={selected.description ?? ""}
                      onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                      placeholder="Para que serve este agente?"
                    />
                  </div>
                  <div>
                    <Label>Prompt do sistema</Label>
                    <Textarea
                      rows={8}
                      value={selected.system_prompt}
                      onChange={(e) => setSelected({ ...selected, system_prompt: e.target.value })}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="provider" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <KeyRound className="h-4 w-4" /> Provedor & API key
                    <Badge variant="outline" className="ml-2 text-[10px]">{PROVIDER_LABEL[selected.provider]}</Badge>
                    
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Provedor</Label>
                      <select
                        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={selected.provider}
                        onChange={(e) => {
                          const p = e.target.value as Provider;
                          setSelected({ ...selected, provider: p, model: PROVIDER_MODELS[p][0] ?? "" });
                        }}
                      >
                        {(Object.keys(PROVIDER_MODELS) as Provider[]).map((p) => (
                          <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      {uiMode === "simple" && QUALITY_LADDER[selected.provider]?.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          <Slider
                            min={0}
                            max={2}
                            step={1}
                            value={[qualityForModel(selected.provider, selected.model)]}
                            onValueChange={([v]) => setSelected({ ...selected, model: modelForQuality(selected.provider, v) })}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            {QUALITY_LABELS.map((l) => <span key={l}>{l}</span>)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Modelo: <code>{selected.model}</code>
                          </p>
                        </div>
                      ) : PROVIDER_MODELS[selected.provider].length > 0 ? (
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={PROVIDER_MODELS[selected.provider].includes(selected.model) ? selected.model : ""}
                          onChange={(e) => setSelected({ ...selected, model: e.target.value })}
                        >
                          <option value="" disabled>Selecione um modelo</option>
                          {PROVIDER_MODELS[selected.provider].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          placeholder="Nome do modelo (ex: manus-pro)"
                          value={selected.model ?? ""}
                          onChange={(e) => setSelected({ ...selected, model: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder={PROVIDER_KEY_PLACEHOLDER[selected.provider]}
                      value={selected.api_key ?? ""}
                      onChange={(e) => setSelected({ ...selected, api_key: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Armazenada no banco. Cada agente usa a key configurada aqui — nenhum provedor padrão é assumido.
                    </p>
                  </div>
                  {uiMode === "advanced" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Base URL {selected.provider === "manus" ? "(obrigatório)" : "(opcional)"}</Label>
                        <Input
                          placeholder={PROVIDER_BASE_PLACEHOLDER[selected.provider]}
                          value={selected.base_url ?? ""}
                          onChange={(e) => setSelected({ ...selected, base_url: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Temperatura</Label>
                        <Input
                          type="number" step="0.1" min="0" max="2"
                          value={selected.temperature}
                          onChange={(e) => setSelected({ ...selected, temperature: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                  {PROVIDERS_NEEDING_EMBEDDING_KEY.includes(selected.provider) && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <Label className="text-xs">
                        Embeddings ({PROVIDER_LABEL[selected.provider]} não fornece — use OpenAI ou Google)
                      </Label>
                      <Input
                        type="password"
                        placeholder="API key para embeddings (sk-... ou AIza...)"
                        value={selected.embedding_api_key ?? ""}
                        onChange={(e) => setSelected({ ...selected, embedding_api_key: e.target.value })}
                      />
                      <Input
                        placeholder="text-embedding-3-small"
                        value={selected.embedding_model ?? ""}
                        onChange={(e) => setSelected({ ...selected, embedding_model: e.target.value })}
                      />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {uiMode === "advanced" && (<>
              <AccordionItem value="advanced" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <SettingsIcon className="h-4 w-4" /> RAG avançado & Agêntico
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-between gap-2 text-sm"><span>Hybrid search</span>
                      <Switch checked={selected.use_hybrid_search ?? true} onCheckedChange={(v) => setSelected({ ...selected, use_hybrid_search: v })} /></label>
                    <label className="flex items-center justify-between gap-2 text-sm"><span>HyDE</span>
                      <Switch checked={selected.use_hyde ?? false} onCheckedChange={(v) => setSelected({ ...selected, use_hyde: v })} /></label>
                    <label className="flex items-center justify-between gap-2 text-sm"><span>Memória persistente</span>
                      <Switch checked={selected.use_memory ?? true} onCheckedChange={(v) => setSelected({ ...selected, use_memory: v })} /></label>
                    <label className="flex items-center justify-between gap-2 text-sm"><span>Modo planejamento</span>
                      <Switch checked={selected.planning_mode ?? false} onCheckedChange={(v) => setSelected({ ...selected, planning_mode: v })} /></label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Top-K RAG</Label>
                      <Input type="number" min={1} max={20} value={selected.rag_top_k ?? 5}
                        onChange={(e) => setSelected({ ...selected, rag_top_k: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Iterações máx.</Label>
                      <Input type="number" min={1} max={12} value={selected.max_iterations ?? 6}
                        onChange={(e) => setSelected({ ...selected, max_iterations: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Debounce (s)</Label>
                      <Input type="number" min={1} max={120} value={selected.debounce_seconds ?? 8}
                        onChange={(e) => setSelected({ ...selected, debounce_seconds: Number(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Reranker</Label>
                      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={selected.reranker_provider ?? ""}
                        onChange={(e) => setSelected({ ...selected, reranker_provider: e.target.value || null })}>
                        <option value="">Nenhum</option>
                        <option value="cohere">Cohere</option>
                        <option value="jina">Jina</option>
                        <option value="voyage">Voyage</option>
                      </select></div>
                    <div><Label className="text-xs">API key reranker</Label>
                      <Input type="password" value={selected.reranker_api_key ?? ""}
                        onChange={(e) => setSelected({ ...selected, reranker_api_key: e.target.value })} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hybrid = vetor + texto via RRF. HyDE gera resposta hipotética antes de buscar.
                    Reranker re-ordena trechos. Memória guarda fatos entre conversas. Debounce agrupa rajadas de mensagens.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mcp" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Wrench className="h-4 w-4" /> Servidores MCP
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4"><McpServersPanel agentId={selected.id} /></AccordionContent>
              </AccordionItem>

              <AccordionItem value="evals" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <FlaskConical className="h-4 w-4" /> Evals
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4"><EvalsPanel agentId={selected.id} /></AccordionContent>
              </AccordionItem>

              <AccordionItem value="tools" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Wrench className="h-4 w-4" /> Ferramentas
                    <Badge variant="outline" className="ml-2 text-[10px]">{selected.tools.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {TOOL_GROUPS.map((g) => (
                    <div key={g.group} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</p>
                      {g.tools.map((t) => (
                        <label key={t.id} className="flex items-start gap-2 text-sm">
                          <Switch
                            checked={selected.tools.includes(t.id)}
                            onCheckedChange={() => toggleTool(t.id)}
                          />
                          <span className="flex-1">
                            {t.label}
                            {t.hint && <span className="block text-xs text-muted-foreground">{t.hint}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>

              </>)}
              <AccordionItem value="kb" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" /> Base de conhecimento
                    <Badge variant="outline" className="ml-2 text-[10px]">{docs.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-4">
                  <KbAssistant
                    agentId={selected.id}
                    clinicId={clinicId}
                    onDocsChanged={async () => {
                      const fresh = await fetchAllPaged<any>(() => supabase
                        .from("ai_documents").select("id, title, source, source_type, created_at, metadata")
                        .eq("agent_id", selected.id).order("created_at", { ascending: false }));
                      setDocs(fresh);
                    }}
                  />
                  <Accordion type="multiple" className="space-y-2">
                    <AccordionItem value="text" className="rounded border bg-muted/20 px-3">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Texto manual</AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <Input placeholder="Título" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                        <Textarea
                          rows={5}
                          placeholder="Cole aqui o texto (FAQ, política, procedimento...)"
                          value={docContent}
                          onChange={(e) => setDocContent(e.target.value)}
                        />
                        <Button onClick={ingest} disabled={ingesting} size="sm">
                          {ingesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Adicionar à base
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="url" className="rounded border bg-muted/20 px-3">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Importar URL</AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://exemplo.com/faq"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                          />
                          <Button onClick={ingestUrl} disabled={ingestingUrl} size="sm" variant="secondary">
                            {ingestingUrl ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Importar
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="batch" className="rounded border bg-muted/20 px-3">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Importar lote de URLs</AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <Textarea
                          rows={3}
                          placeholder="https://exemplo.com/a&#10;https://exemplo.com/b"
                          value={batchUrls}
                          onChange={(e) => setBatchUrls(e.target.value)}
                        />
                        <Button onClick={ingestBatch} disabled={batchRunning} size="sm" variant="secondary">
                          {batchRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Importar lote
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="pdf" className="rounded border bg-muted/20 px-3">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Importar PDF</AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <Input
                          type="file"
                          accept="application/pdf"
                          disabled={pdfRunning}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) ingestPdf(f);
                            e.target.value = "";
                          }}
                        />
                        {pdfRunning && <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Processando PDF...</p>}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="docs" className="rounded border bg-muted/20 px-3">
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">Documentos ({docs.length})</AccordionTrigger>
                      <AccordionContent className="space-y-1 pb-3">
                        {docs.map((d) => (
                          <div key={d.id} className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
                            <span className="flex flex-1 items-center gap-2 truncate">
                              <span className="truncate">{d.title}</span>
                              {d.source_type === "system_default" && (
                                <Badge variant="secondary" className="text-[10px]" title="Documento padrão do sistema. Você pode editar ou excluir.">padrão</Badge>
                              )}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => removeDoc(d.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {docs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum documento ainda.</p>}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="test" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <FlaskConical className="h-4 w-4" /> Testar agente
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <TestLab
                    agentId={selected.id}
                    clinicId={clinicId}
                    onPatchToPrompt={(patch) => {
                      setSelected({
                        ...selected,
                        system_prompt: `${selected.system_prompt}\n\n## Patch do Test Lab\n${patch}`,
                      });
                      toast.success("Patch anexado ao prompt. Lembre de salvar.");
                    }}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="costs" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <DollarSign className="h-4 w-4" /> Custos & limites
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <CostsPanel agentId={selected.id} clinicId={clinicId} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="audit" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardList className="h-4 w-4" /> Auditoria de mudanças
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <AuditLogPanel agentId={selected.id} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="insights" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="h-4 w-4" /> Insights & recomendações
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <AgentInsights
                    agentId={selected.id}
                    clinicId={clinicId}
                    onApplyToPrompt={(text) => {
                      setSelected({
                        ...selected,
                        system_prompt: `${selected.system_prompt}\n\n${text}`,
                      });
                      toast.success("Texto anexado ao prompt. Lembre de salvar.");
                    }}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="history" className="rounded-md border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4" /> Histórico de versões
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <PromptHistory
                    agentId={selected.id}
                    currentPrompt={selected.system_prompt}
                    onRevert={(prompt) => {
                      setSelected({ ...selected, system_prompt: prompt });
                    }}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </main>
    </div>
  );
}
