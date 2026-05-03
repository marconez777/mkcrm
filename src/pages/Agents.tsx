import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Bot, Plus, Trash2, FileText, Send, Loader2, Settings as SettingsIcon, KeyRound, Wrench, FlaskConical } from "lucide-react";

type Provider = "openai" | "anthropic" | "google";
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
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-20250514", "claude-opus-4-20250514"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
};
const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI", anthropic: "Anthropic", google: "Google AI",
};

const TOOLS = [
  { id: "move_lead_stage", label: "Mover lead de estágio" },
  { id: "add_lead_note", label: "Anotar no lead" },
  { id: "set_lead_field", label: "Atualizar campo do lead" },
  { id: "assign_attendant", label: "Atribuir atendente" },
];

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
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
      const { data: docs } = await supabase
        .from("ai_documents").select("id, title, source, created_at")
        .eq("agent_id", selected.id).order("created_at", { ascending: false });
      setDocs(docs ?? []);
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
    const { data: docs } = await supabase
      .from("ai_documents").select("id, title, source, created_at")
      .eq("agent_id", selected.id).order("created_at", { ascending: false });
    setDocs(docs ?? []);
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
    const { data: docs } = await supabase
      .from("ai_documents").select("id, title, source, created_at")
      .eq("agent_id", selected.id).order("created_at", { ascending: false });
    setDocs(docs ?? []);
  };

  const load = async () => {
    const { data } = await supabase.from("ai_agents").select("*").order("created_at");
    setAgents((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setDocs([]); return; }
    supabase
      .from("ai_documents")
      .select("id, title, source, created_at")
      .eq("agent_id", selected.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs(data ?? []));
  }, [selected?.id]);

  const create = async () => {
    const { data, error } = await supabase
      .from("ai_agents")
      .insert({
        name: "Novo agente",
        system_prompt: "Você é um atendente prestativo. Responda em português.",
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    await load();
    setSelected(data as any);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("ai_agents")
      .update({
        name: selected.name,
        description: selected.description,
        system_prompt: selected.system_prompt,
        provider: selected.provider,
        api_key: selected.api_key,
        base_url: selected.base_url,
        model: selected.model,
        temperature: selected.temperature,
        enabled: selected.enabled,
        tools: selected.tools,
        embedding_model: selected.embedding_model,
        embedding_api_key: selected.embedding_api_key,
      })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Agente salvo");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir agente?")) return;
    await supabase.from("ai_agents").delete().eq("id", id);
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
    const { data: docs } = await supabase
      .from("ai_documents").select("id, title, source, created_at")
      .eq("agent_id", selected.id).order("created_at", { ascending: false });
    setDocs(docs ?? []);
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

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Agentes</h2>
          <Button size="sm" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="px-2">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selected?.id === a.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{a.name}</span>
              {!a.enabled && <Badge variant="outline" className="text-[10px]">off</Badge>}
            </button>
          ))}
          {agents.length === 0 && (
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <Input
                  className="h-9 w-64 font-semibold"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={save}>Salvar</Button>
              </div>
            </div>

            <Card className="space-y-4 p-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Provedor</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={selected.provider}
                    onChange={(e) => {
                      const p = e.target.value as Provider;
                      setSelected({ ...selected, provider: p, model: PROVIDER_MODELS[p][0] });
                    }}
                  >
                    {(Object.keys(PROVIDER_MODELS) as Provider[]).map((p) => (
                      <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input
                    list={`models-${selected.provider}`}
                    value={selected.model}
                    onChange={(e) => setSelected({ ...selected, model: e.target.value })}
                  />
                  <datalist id={`models-${selected.provider}`}>
                    {PROVIDER_MODELS[selected.provider].map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder={selected.provider === "openai" ? "sk-..." : selected.provider === "anthropic" ? "sk-ant-..." : "AIza..."}
                  value={selected.api_key ?? ""}
                  onChange={(e) => setSelected({ ...selected, api_key: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Armazenada no banco. Usada para chat e (quando suportado) embeddings.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base URL (opcional)</Label>
                  <Input
                    placeholder={selected.provider === "openai" ? "https://api.openai.com/v1" : ""}
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
              {selected.provider === "anthropic" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs">Embeddings (Anthropic não fornece — use OpenAI)</Label>
                  <Input
                    type="password"
                    placeholder="OpenAI key para embeddings (sk-...)"
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
              <div>
                <Label>Ferramentas habilitadas</Label>
                <div className="mt-2 space-y-2">
                  {TOOLS.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={selected.tools.includes(t.id)}
                        onCheckedChange={() => toggleTool(t.id)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Base de conhecimento</h3>
              <Input
                placeholder="Título"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
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

              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="https://exemplo.com/faq"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <Button onClick={ingestUrl} disabled={ingestingUrl} size="sm" variant="secondary">
                  {ingestingUrl ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Importar URL
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">Importar várias URLs (uma por linha)</Label>
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
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">Importar PDF</Label>
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
              </div>

              <div className="space-y-1">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded border bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate">{d.title}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeDoc(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {docs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum documento ainda.</p>}
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Testar agente</h3>
              <Textarea
                rows={2}
                placeholder="Pergunte algo..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />
              <Button onClick={test} disabled={testing} size="sm">
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
              {testOutput && (
                <div className="rounded border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{testOutput}</div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
