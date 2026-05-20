import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Send, Loader2, FolderPlus, Folder } from "lucide-react";

type Folder = { id: string; name: string; sort_order: number };
type Tpl = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  preheader: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  category: string;
  html_body: string;
  text_body: string | null;
  active: boolean;
  folder_id: string | null;
};
type Domain = { id: string; domain: string; status: string };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

const EMPTY: Tpl = {
  id: "", name: "", slug: "", subject: "", preheader: "",
  from_name: "", from_email: "", reply_to: null, category: "marketing",
  html_body: "<p>Olá {{ nome }},</p>\n<p>Sua mensagem aqui.</p>", text_body: "",
  active: true, folder_id: null,
};

export default function EmailTemplates() {
  const { membership } = useAuth();
  const navigate = useNavigate();
  const clinicId = membership?.clinic_id;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);

  async function load() {
    if (!clinicId) return;
    const [{ data: fs }, { data: ts }, { data: ds }] = await Promise.all([
      supabase.from("email_template_folders").select("id,name,sort_order").order("sort_order"),
      supabase.from("email_templates").select("*").order("updated_at", { ascending: false }),
      supabase.from("email_domains").select("id,domain,status").eq("clinic_id", clinicId),
    ]);
    setFolders((fs ?? []) as any);
    setTemplates((ts ?? []) as any);
    setDomains((ds ?? []) as any);
  }

  useEffect(() => { if (clinicId) load(); }, [clinicId]);
  useEffect(() => { document.title = "Email — Templates"; }, []);

  async function createFolder() {
    if (!newFolderName.trim() || !clinicId) return;
    const { error } = await supabase.from("email_template_folders").insert({
      clinic_id: clinicId, name: newFolderName.trim(), sort_order: folders.length,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pasta criada"); setNewFolderName(""); setFolderOpen(false); load(); }
  }

  async function deleteFolder(id: string) {
    if (!confirm("Excluir pasta? Os templates dentro dela ficam sem pasta.")) return;
    await supabase.from("email_templates").update({ folder_id: null }).eq("folder_id", id);
    const { error } = await supabase.from("email_template_folders").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Pasta excluída"); load(); }
  }

  function startCreate() {
    const def = domains.find((d) => d.status === "verified") ?? domains[0];
    setEditing({
      ...EMPTY,
      from_email: def ? `contato@${def.domain}` : "",
      folder_id: activeFolder !== "all" ? activeFolder : null,
    });
  }

  function startEdit(t: Tpl) { setEditing({ ...t }); }

  function duplicate(t: Tpl) {
    setEditing({ ...t, id: "", name: `${t.name} (cópia)`, slug: `${t.slug}-copia` });
  }

  async function save() {
    if (!editing || !clinicId) return;
    setBusy(true);
    try {
      const payload = {
        clinic_id: clinicId,
        name: editing.name,
        slug: editing.slug || slugify(editing.name),
        subject: editing.subject,
        preheader: editing.preheader,
        from_name: editing.from_name,
        from_email: editing.from_email,
        reply_to: editing.reply_to,
        category: editing.category,
        html_body: editing.html_body,
        text_body: editing.text_body,
        active: editing.active,
        folder_id: editing.folder_id,
      };
      const q = editing.id
        ? supabase.from("email_templates").update(payload).eq("id", editing.id)
        : supabase.from("email_templates").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success("Template salvo");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Tpl) {
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  }

  async function sendTest(t: Tpl) {
    if (!clinicId) { toast.error("Clínica não identificada"); return; }
    if (!testEmail) { toast.error("Informe um email para teste"); return; }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          clinic_id: clinicId,
          template_slug: t.slug,
          recipient_email: testEmail,
          recipient_name: "Teste",
          variables: { nome: "Teste", name: "Teste", first_name: "Teste" },
          force: true,
        },
      });
      if (error) throw error;
      toast.success("Email de teste enviado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingTest(false);
    }
  }

  const filtered = templates.filter((t) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "none") return !t.folder_id;
    return t.folder_id === activeFolder;
  });

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates de Email</h1>
          <p className="text-sm text-muted-foreground">Crie modelos reutilizáveis para campanhas e automações.</p>
        </div>
        <Button onClick={() => navigate("/email/templates/new")}><Plus className="mr-2 h-4 w-4" />Novo template</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Card className="p-3 space-y-1 h-fit">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground">Pastas</div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setFolderOpen(true)}>
              <FolderPlus className="h-3 w-3" />
            </Button>
          </div>
          {[{ id: "all", name: "Todos" }, { id: "none", name: "Sem pasta" }, ...folders].map((f) => (
            <div
              key={f.id}
              className={`group flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent ${activeFolder === f.id ? "bg-accent font-medium" : ""}`}
            >
              <button
                type="button"
                onClick={() => setActiveFolder(f.id)}
                className="flex flex-1 items-center gap-1.5 text-left"
              >
                <Folder className="h-3 w-3" />
                {f.name}
              </button>
              {!["all", "none"].includes(f.id) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }}
                  className="opacity-0 group-hover:opacity-100 transition hover:text-destructive"
                  title="Excluir pasta"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </Card>

        <Card className="p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum template</div>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => (
                <div key={t.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t.slug}</Badge>
                      {!t.active && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/email/templates/${t.id}`)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(t)}><Copy className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderOpen(false)}>Cancelar</Button>
            <Button onClick={createFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="sender">Remetente</TabsTrigger>
                <TabsTrigger value="test">Testar</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug (identificador único)</Label>
                    <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value, name: editing.name || e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preheader (texto curto que aparece após o assunto)</Label>
                  <Input value={editing.preheader ?? ""} onChange={(e) => setEditing({ ...editing, preheader: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>HTML</Label>
                  <Textarea
                    rows={14}
                    className="font-mono text-xs"
                    value={editing.html_body}
                    onChange={(e) => setEditing({ ...editing, html_body: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use <code>{"{{ nome }}"}</code>, <code>{"{{ email }}"}</code> etc. para variáveis.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Versão texto (opcional)</Label>
                  <Textarea rows={5} value={editing.text_body ?? ""} onChange={(e) => setEditing({ ...editing, text_body: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pasta</Label>
                  <Select value={editing.folder_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, folder_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem pasta</SelectItem>
                      {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sender" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome do remetente</Label>
                    <Input value={editing.from_name} onChange={(e) => setEditing({ ...editing, from_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    {domains.length > 0 ? (
                      <div className="flex gap-2">
                        <Input
                          value={editing.from_email.split("@")[0] ?? ""}
                          onChange={(e) => {
                            const dom = editing.from_email.split("@")[1] ?? domains[0]?.domain;
                            setEditing({ ...editing, from_email: `${e.target.value}@${dom}` });
                          }}
                          className="flex-1"
                        />
                        <Select
                          value={editing.from_email.split("@")[1] ?? domains[0]?.domain}
                          onValueChange={(v) => {
                            const local = editing.from_email.split("@")[0] ?? "contato";
                            setEditing({ ...editing, from_email: `${local}@${v}` });
                          }}
                        >
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {domains.map((d) => (
                              <SelectItem key={d.id} value={d.domain}>
                                @{d.domain} {d.status !== "verified" && "(não verificado)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Input placeholder="Configure um domínio em Configurações → Email" disabled />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Reply-to</Label>
                  <Input value={editing.reply_to ?? ""} onChange={(e) => setEditing({ ...editing, reply_to: e.target.value })} />
                </div>
              </TabsContent>

              <TabsContent value="test" className="space-y-3">
                <p className="text-xs text-muted-foreground">Envia o template para um email de teste, ignorando cota e supressões.</p>
                <div className="flex gap-2">
                  <Input placeholder="seu@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  <Button onClick={() => editing && sendTest(editing)} disabled={sendingTest || !editing?.id}>
                    {sendingTest ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}Enviar teste
                  </Button>
                </div>
                {!editing.id && <p className="text-xs text-muted-foreground">Salve o template primeiro para poder enviar teste.</p>}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
