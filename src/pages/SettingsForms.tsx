import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff, Download, ArrowLeft, ExternalLink } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

type Integration = {
  id: string;
  clinic_id: string;
  name: string;
  slug: string;
  token: string;
  allowed_domains: string[];
  status: string;
  default_tags: string[];
  total_submissions: number;
  last_submission_at: string | null;
  created_at: string;
};
type Definition = {
  id: string;
  integration_id: string;
  form_key: string;
  name: string;
  source_page: string | null;
  field_map: Record<string, string>;
  active: boolean;
  total_submissions: number;
  last_submission_at: string | null;
};
type Submission = {
  id: string;
  form_key: string | null;
  source_page: string | null;
  payload: Record<string, unknown>;
  lead_id: string | null;
  is_new_lead: boolean;
  status: string;
  error: string | null;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const INGEST_URL = `${SUPABASE_URL}/functions/v1/forms-ingest`;
const SNIPPET_URL = `${SUPABASE_URL}/functions/v1/forms-snippet`;
const PLUGIN_URL = `${SUPABASE_URL}/functions/v1/forms-plugin-zip`;

export default function SettingsForms() {
  const { isSuperAdmin, membership } = useAuth();
  const canManage = isSuperAdmin || ["owner", "admin"].includes(membership?.role || "");
  const [list, setList] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomains, setNewDomains] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Integração do Site — MK CRM"; load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("form_integrations").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setList((data ?? []) as any);
    setLoading(false);
  }

  async function createIntegration(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const allowed_domains = newDomains.split(",").map((s) => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("forms-admin", {
        body: { action: "create_integration", name: newName, allowed_domains, default_tags: [] },
      });
      if (error) throw error;
      toast.success("Integração criada");
      setCreateOpen(false); setNewName(""); setNewDomains("");
      await load();
      setSelected((data as any).integration);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (selected) return <DetailView integration={selected} onBack={() => { setSelected(null); load(); }} canManage={canManage} />;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Integração do Site</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pixel de rastreamento + captura de formulários num único SDK. Cada integração gera um prompt pronto para colar no chat do Lovable do site da clínica.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova integração</Button>
          )}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : list.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma integração criada ainda. Clique em "Nova integração" para começar.
          </Card>
        ) : (
          <div className="grid gap-3">
            {list.map((i) => (
              <Card key={i.id} className="p-4 hover:bg-accent/30 cursor-pointer" onClick={() => setSelected(i)}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{i.name}</h3>
                      <Badge variant={i.status === "active" ? "default" : "secondary"}>{i.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {(i.allowed_domains || []).length ? i.allowed_domains.join(", ") : "Qualquer domínio"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{i.total_submissions} envios</div>
                    <div>{i.last_submission_at ? new Date(i.last_submission_at).toLocaleString("pt-BR") : "Sem envios"}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova integração de formulários</DialogTitle></DialogHeader>
            <form onSubmit={createIntegration} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Site MKart" />
              </div>
              <div className="space-y-1.5">
                <Label>Domínios permitidos (opcional)</Label>
                <Input value={newDomains} onChange={(e) => setNewDomains(e.target.value)} placeholder="mkart.com.br, www.mkart.com.br" />
                <p className="text-xs text-muted-foreground">Separe por vírgula. Deixe em branco para aceitar qualquer origem.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DetailView({ integration, onBack, canManage }: { integration: Integration; onBack: () => void; canManage: boolean }) {
  const confirm = useConfirm();
  const [data, setData] = useState<Integration>(integration);
  const [defs, setDefs] = useState<Definition[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editDef, setEditDef] = useState<Definition | null>(null);

  useEffect(() => { loadAll(); }, [integration.id]);

  async function loadAll() {
    const [d, s, fresh] = await Promise.all([
      supabase.from("form_definitions").select("*").eq("integration_id", integration.id).order("created_at", { ascending: false }),
      supabase.from("form_submissions").select("*").eq("integration_id", integration.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("form_integrations").select("*").eq("id", integration.id).single(),
    ]);
    if (d.data) setDefs(d.data as any);
    if (s.data) setSubs(s.data as any);
    if (fresh.data) setData(fresh.data as any);
  }

  function copy(s: string, label = "Copiado") {
    navigator.clipboard.writeText(s).then(() => toast.success(label));
  }

  async function rotate() {
    if (!(await confirm({ title: "Rotacionar token?", description: "O token atual continua válido por 24h.", confirmLabel: "Rotacionar" }))) return;
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("forms-admin", { body: { action: "rotate_token", id: integration.id } });
      if (error) throw error;
      setData((res as any).integration);
      toast.success("Token rotacionado");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("forms-admin", {
        body: { action: "update_integration", id: integration.id, status: data.status === "active" ? "paused" : "active" },
      });
      if (error) throw error;
      setData((res as any).integration);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function removeIntegration() {
    if (!(await confirm({ title: "Excluir integração?", description: "Envios futuros com este token serão rejeitados.", confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.functions.invoke("forms-admin", { body: { action: "delete_integration", id: integration.id } });
    if (error) toast.error(error.message); else { toast.success("Excluída"); onBack(); }
  }

  const tokenMasked = showToken ? data.token : data.token.slice(0, 8) + "•••••••••••••••";
  const snippetCode = `<script async src="${SNIPPET_URL}?token=${data.token}"></script>`;
  const pixelCode = `<script async src="${SUPABASE_URL}/functions/v1/tracking-pixel?project_id=${data.clinic_id}"></script>`;
  const primaryDomain = (data.allowed_domains || [])[0] || "seu-site.com";
  const curlCode = `curl -X POST "${INGEST_URL}" \\\n  -H "Content-Type: application/json" \\\n  -H "x-form-token: ${data.token}" \\\n  -d '{"form_key":"contato-home","fields":{"name":"João","email":"joao@x.com","phone":"11999999999"}}'`;

  const aiPrompt = buildAiPrompt({
    pixelCode,
    snippetCode,
    clinicId: data.clinic_id,
    token: data.token,
    domain: primaryDomain,
    supabaseUrl: SUPABASE_URL,
  });

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl p-8 space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-semibold">{data.name}</h1>
              <p className="text-xs text-muted-foreground">{data.total_submissions} envios totais · {(data.allowed_domains || []).join(", ") || "qualquer domínio"}</p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleStatus} disabled={busy}>{data.status === "active" ? "Pausar" : "Reativar"}</Button>
                <Button variant="outline" size="sm" onClick={removeIntegration}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="install">
          <TabsList>
            <TabsTrigger value="install">Como instalar</TabsTrigger>
            <TabsTrigger value="forms">Formulários ({defs.length})</TabsTrigger>
            <TabsTrigger value="submissions">Envios ({subs.length})</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="install" className="space-y-4">
            <Card className="p-4 space-y-3">
              <div>
                <Label>Token da integração</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input readOnly value={tokenMasked} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button variant="outline" size="icon" onClick={() => copy(data.token, "Token copiado")}><Copy className="h-4 w-4" /></Button>
                  {canManage && <Button variant="outline" size="icon" onClick={rotate} disabled={busy}><RotateCcw className="h-4 w-4" /></Button>}
                </div>
              </div>
            </Card>

            <Tabs defaultValue="ai">
              <TabsList>
                <TabsTrigger value="ai">🤖 Prompt para IA (Lovable)</TabsTrigger>
                <TabsTrigger value="wp">WordPress</TabsTrigger>
                <TabsTrigger value="lovable">Lovable / HTML</TabsTrigger>
                <TabsTrigger value="api">API direta</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-3">
                <Card className="p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Prompt completo pra colar no chat do Lovable do site</p>
                    <p className="text-muted-foreground text-xs">
                      Copie o texto abaixo e cole no chat do projeto Lovable do site da clínica. Ele já vem com o token, o project_id e todas as instruções de instalação, peculiaridades dos formulários e checklist de validação.
                    </p>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto font-mono max-h-[480px] whitespace-pre-wrap">{aiPrompt}</pre>
                      <Button size="sm" className="absolute top-2 right-2" onClick={() => copy(aiPrompt, "Prompt copiado — cole no chat do Lovable do site")}>
                        <Copy className="h-3 w-3 mr-1" />Copiar tudo
                      </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="wp" className="space-y-3">
                <Card className="p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">1. Baixe o plugin</p>
                    <a href={PLUGIN_URL} download>
                      <Button variant="outline"><Download className="mr-2 h-4 w-4" />Baixar mk-crm-forms.zip</Button>
                    </a>
                    <p className="font-medium pt-2">2. No WordPress</p>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                      <li>Plugins → Adicionar novo → Enviar plugin → faça upload do .zip e ative.</li>
                      <li>Configurações → MK CRM Forms → cole o token acima e salve.</li>
                    </ul>
                    <p className="text-muted-foreground pt-2">
                      Suporta: Contact Form 7, Elementor Pro Forms, WPForms, Gravity Forms, Fluent Forms.
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="lovable" className="space-y-3">
                <Card className="p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Cole este script antes do <code>{"</body>"}</code>:</p>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto font-mono">{snippetCode}</pre>
                      <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-7 w-7" onClick={() => copy(snippetCode)}><Copy className="h-3 w-3" /></Button>
                    </div>
                    <p className="text-muted-foreground pt-2">
                      O script captura automaticamente qualquer <code>&lt;form&gt;</code> da página. Use <code>data-mk-form="contato"</code> no form para nomeá-lo, ou <code>data-mk-ignore</code> para ignorar.
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="api" className="space-y-3">
                <Card className="p-4 space-y-3">
                  <p className="text-sm font-medium">Envio direto via HTTP POST:</p>
                  <div className="relative">
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto font-mono whitespace-pre">{curlCode}</pre>
                    <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-7 w-7" onClick={() => copy(curlCode)}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Endpoint: <code>{INGEST_URL}</code>
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="forms">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Form key</TableHead>
                    <TableHead>Envios</TableHead>
                    <TableHead>Último</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum formulário detectado ainda. Submeta um envio para auto-descoberta.</TableCell></TableRow>}
                  {defs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name} {!d.active && <Badge variant="secondary" className="ml-2">pausado</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{d.form_key}</TableCell>
                      <TableCell>{d.total_submissions}</TableCell>
                      <TableCell className="text-xs">{d.last_submission_at ? new Date(d.last_submission_at).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        {canManage && <Button size="sm" variant="outline" onClick={() => setEditDef(d)}>Editar</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Formulário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum envio ainda</TableCell></TableRow>}
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs font-mono">{s.form_key}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "ok" ? "default" : s.status === "error" ? "destructive" : "secondary"}>
                          {s.status}{s.is_new_lead ? " · novo" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.lead_id ? <a className="text-xs underline" href={`/leads/${s.lead_id}`} target="_blank" rel="noopener"><ExternalLink className="inline h-3 w-3 mr-1" />abrir</a> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <code className="text-[10px] text-muted-foreground line-clamp-2 break-all">{JSON.stringify(s.payload)}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <IntegrationSettings integration={data} onSaved={(updated) => setData(updated)} canManage={canManage} />
          </TabsContent>
        </Tabs>

        {editDef && (
          <DefinitionEditor def={editDef} onClose={() => { setEditDef(null); loadAll(); }} canManage={canManage} />
        )}
      </div>
    </div>
  );
}

function IntegrationSettings({ integration, onSaved, canManage }: { integration: Integration; onSaved: (i: Integration) => void; canManage: boolean }) {
  const [name, setName] = useState(integration.name);
  const [domains, setDomains] = useState((integration.allowed_domains || []).join(", "));
  const [tags, setTags] = useState((integration.default_tags || []).join(", "));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("forms-admin", {
        body: {
          action: "update_integration",
          id: integration.id,
          name,
          allowed_domains: domains.split(",").map((s) => s.trim()).filter(Boolean),
          default_tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      if (error) throw error;
      toast.success("Salvo");
      onSaved((data as any).integration);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></div>
      <div className="space-y-1.5"><Label>Domínios permitidos</Label><Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="mkart.com.br, www.mkart.com.br" disabled={!canManage} /></div>
      <div className="space-y-1.5"><Label>Tags padrão para novos leads</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="site, formulario" disabled={!canManage} /></div>
      {canManage && <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>}
    </Card>
  );
}

function DefinitionEditor({ def, onClose, canManage }: { def: Definition; onClose: () => void; canManage: boolean }) {
  const [name, setName] = useState(def.name);
  const [map, setMap] = useState(JSON.stringify(def.field_map || {}, null, 2));
  const [active, setActive] = useState(def.active);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      let parsed: Record<string, string> = {};
      try { parsed = JSON.parse(map); } catch { throw new Error("field_map inválido (JSON)"); }
      const { error } = await supabase.functions.invoke("forms-admin", {
        body: { action: "update_definition", id: def.id, name, field_map: parsed, active },
      });
      if (error) throw error;
      toast.success("Salvo");
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar formulário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome amigável</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></div>
          <div className="space-y-1.5">
            <Label>Mapeamento de campos (JSON)</Label>
            <textarea
              className="w-full h-40 rounded border bg-background p-2 font-mono text-xs"
              value={map}
              onChange={(e) => setMap(e.target.value)}
              disabled={!canManage}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: <code>{`{"name":"your-name","email":"your-email","phone":"tel-123"}`}</code>. Deixe vazio para auto-detecção.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canManage} /> Ativo</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildAiPrompt(args: {
  pixelCode: string;
  snippetCode: string;
  clinicId: string;
  token: string;
  domain: string;
  supabaseUrl: string;
}) {
  const { pixelCode, snippetCode, clinicId, token, domain, supabaseUrl } = args;
  return `# Integração com MK CRM — leia tudo e adapte o site

Este site precisa enviar **visitas, eventos de tracking e submissões de formulário** para o MK CRM. Abaixo está TUDO que você precisa: scripts prontos, regras dos formulários, peculiaridades conhecidas e checklist de validação. Não improvise — siga ao pé da letra.

---

## 1. Instalar os 2 scripts no <head> do index.html

Cole **exatamente nesta ordem** (o pixel TEM que vir antes do snippet de formulários, porque ele cria os cookies _mk_vid/_mk_sid que o snippet lê):

\`\`\`html
<!-- MK CRM — Tracking Pixel (DEVE vir ANTES do forms-snippet) -->
${pixelCode}
<!-- MK CRM — Forms Snippet -->
${snippetCode}
\`\`\`

- **NÃO** mude a ordem.
- **NÃO** adicione \`defer\` — use \`async\` exatamente como está.
- **NÃO** tente "otimizar" envolvendo em React/useEffect. Os scripts são vanilla JS e precisam rodar o mais cedo possível no HTML.
- Se o projeto usa pré-renderização (Encited, Prerender.io, etc.), force re-render depois de adicionar.

---

## 2. Regras OBRIGATÓRIAS dos formulários

O \`forms-snippet\` adiciona um listener global em \`document.addEventListener("submit", ..., true)\`. Para ele capturar um formulário, **TODAS** as regras abaixo precisam ser respeitadas:

### 2.1 Use submit nativo (NÃO fetch custom)
\`\`\`tsx
// ✅ CORRETO
<form onSubmit={handleSubmit}>
  <button type="submit">Enviar</button>
</form>

// ❌ ERRADO — snippet NÃO captura
<form>
  <button type="button" onClick={() => fetch(...)}>Enviar</button>
</form>
\`\`\`

Se você TEM que usar fetch custom (ex: precisa fazer algo antes de redirecionar), chame manualmente DEPOIS do seu fetch:
\`\`\`tsx
const formRef = useRef<HTMLFormElement>(null);
await fetch(...);
(window as any).MKForms?.send(formRef.current);
\`\`\`

### 2.2 Todos os inputs precisam ter \`name=\`
\`\`\`tsx
// ✅
<input name="name" />
<input name="email" type="email" />
<input name="phone" type="tel" />

// ❌ Sem name não vai ser capturado
<input />
\`\`\`

Nomes reconhecidos automaticamente (case-insensitive):
- **name**: name, nome, fullname, full_name, first_name, firstname
- **email**: email, e-mail, mail
- **phone**: phone, telefone, tel, celular, whatsapp, wpp, mobile
- **message**: message, mensagem, msg, comments, comentario

Se o input tem nome esquisito, force com \`data-mk-field\`:
\`\`\`tsx
<input name="cf_7_abc" data-mk-field="email" type="email" />
\`\`\`

### 2.3 Identifique o formulário com \`data-mk-form\`
\`\`\`tsx
<form data-mk-form="phq9" data-mk-name="Teste PHQ-9" onSubmit={...}>
\`\`\`
- \`data-mk-form\` vira o \`form_key\` no CRM (use kebab-case, sem espaços)
- \`data-mk-name\` é o nome humano que aparece no painel
- Para ignorar um form (ex.: busca), use \`data-mk-ignore\`

### 2.4 Pelo menos email OU phone precisa estar presente
Sem nenhum dos dois, a submission é registrada como \`status=no_contact\` e **nenhum lead é criado**.

---

## 3. Botão de WhatsApp — deixar o pixel cuidar

NÃO chame o WhatsApp direto sem rastreio. O pixel reescreve qualquer link \`wa.me/\` / \`api.whatsapp.com\` automaticamente para passar pelo redirecionador do CRM (assim a gente rastreia o clique e linka com o visitante).

\`\`\`tsx
// ✅ Mantenha assim — o pixel intercepta no clique
<a href="https://wa.me/5511999999999?text=Olá">WhatsApp</a>
\`\`\`

Não precisa fazer nada — só ter o pixel instalado.

---

## 4. Peculiaridades conhecidas

| Sintoma | Causa | Solução |
|---|---|---|
| Submit não chega no CRM | Form usa \`<button type="button">\` + fetch custom | Trocar para \`type="submit"\` OU chamar \`window.MKForms.send(formRef)\` |
| Submit não chega no CRM | Inputs sem \`name=\` | Adicionar \`name\` em todos os campos |
| Submit chega mas sem email/phone | Nome do input não está nos aliases | Adicionar \`data-mk-field="email"\` (ou phone/name) |
| Tracking não conta visitas | Pixel instalado depois do snippet, ou cache de pré-renderização | Verificar ordem e forçar re-render |
| WhatsApp abre tela "unknown_project" | Project ID errado no script | Confirmar que o pixel tem exatamente: \`?project_id=${clinicId}\` |
| CORS error no console | Domínio não está na allowlist do CRM | Pedir ao admin do CRM pra adicionar \`${domain}\` em domínios permitidos |

---

## 5. Dados pré-configurados para ESTE site

| Campo | Valor |
|---|---|
| Endpoint base | \`${supabaseUrl}\` |
| Project ID (clinic) | \`${clinicId}\` |
| Form token | \`${token}\` |
| Domínio principal | \`${domain}\` |

Esses valores **já estão dentro dos scripts** do passo 1. Você não precisa repetir em lugar nenhum — só copie e cole os \`<script>\` exatamente como estão.

---

## 6. Checklist de validação (faça depois de instalar)

1. Abra o site em aba anônima e abra o DevTools → Network
2. Recarregue. Você deve ver 2 requests com status 200:
   - \`tracking-pixel?project_id=${clinicId}\`
   - \`forms-snippet?token=${token.slice(0, 8)}...\`
3. No DevTools → Application → Cookies → seu domínio, confirme que existem:
   - \`_mk_vid\` (1 ano de validade)
   - \`_mk_sid\` (sessão)
4. Navegue por 2 páginas. Em Network, filtre por \`tracking-event\` — deve aparecer 2 POSTs com status 200
5. Preencha e envie um formulário. Em Network, filtre por \`forms-ingest\` — deve aparecer 1 POST com response \`{"ok":true,"status":"ok","lead_id":"..."}\`
6. Clique no botão de WhatsApp — deve abrir o WhatsApp normalmente (passando pelo redirecionador do CRM, com um código de rastreio na mensagem)

Se qualquer passo falhar, **NÃO mexa nos scripts**. Reporte ao admin do CRM com: o passo que falhou, o response da request (Network → clique → Response) e os erros do Console.
`;
}

