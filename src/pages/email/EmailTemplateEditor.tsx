import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent, closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Eye, Code as CodeIcon, Loader2 } from "lucide-react";
import Palette from "@/components/email/editor/Palette";
import Canvas from "@/components/email/editor/Canvas";
import Inspector from "@/components/email/editor/Inspector";
import { EMAIL_VARIABLES } from "@/lib/email/variables";
import { newBlock, type EmailBlock, type BlockType } from "@/lib/email/types";
import { blocksToHtml, htmlContainsUnsubscribeVar } from "@/lib/email/blocksToHtml";
import { sanitizeHtml } from "@/lib/email/sanitize";

const SLUG_RE = /^[a-z][a-z0-9-]*$/;
function toSlug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

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
  blocks_json: EmailBlock[] | null;
  folder_id: string | null;
  active: boolean;
  version: number;
};

type Folder = { id: string; name: string };
type Domain = { id: string; domain: string; status: string };

export default function EmailTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const isNew = id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { document.title = "Editor de Email"; }, []);

  // Load
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [{ data: fs }, { data: ds }] = await Promise.all([
        supabase.from("email_template_folders").select("id,name").order("sort_order"),
        supabase.from("email_domains").select("id,domain,status").eq("clinic_id", clinicId),
      ]);
      setFolders((fs ?? []) as Folder[]);
      setDomains((ds ?? []) as Domain[]);

      if (isNew) {
        const def = (ds ?? []).find((d: any) => d.status === "verified") ?? (ds ?? [])[0];
        const fromEmail = def ? `contato@${def.domain}` : "";
        setTpl({
          id: "", name: "Novo template", slug: "", subject: "", preheader: "",
          from_name: "", from_email: fromEmail, reply_to: null, category: "marketing",
          html_body: "", blocks_json: [], folder_id: null, active: true, version: 1,
        });
        setBlocks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from("email_templates").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Template não encontrado");
        navigate("/email/templates");
        return;
      }
      setTpl(data as unknown as Tpl);
      const initial = Array.isArray(data.blocks_json) && data.blocks_json.length > 0
        ? (data.blocks_json as EmailBlock[])
        : [];
      // localStorage draft
      const draft = typeof window !== "undefined" ? localStorage.getItem(`email-template-draft:${id}`) : null;
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.blocks) setBlocks(parsed.blocks);
          if (parsed.tpl) setTpl((t) => ({ ...(t as Tpl), ...parsed.tpl }));
        } catch { setBlocks(initial); }
      } else {
        setBlocks(initial);
      }
      setLoading(false);
    })();
  }, [clinicId, id, isNew, navigate]);

  // Autosave to localStorage (debounce 2s)
  useEffect(() => {
    if (!tpl || isNew || !id) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`email-template-draft:${id}`, JSON.stringify({ blocks, tpl: { name: tpl.name, subject: tpl.subject, preheader: tpl.preheader } }));
      } catch {}
    }, 2000);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [blocks, tpl, id, isNew]);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);
  const renderedHtml = useMemo(() => {
    return blocksToHtml(blocks, {
      preheader: tpl?.preheader ?? undefined,
      includeUnsubscribeFooter: !htmlContainsUnsubscribeVar(blocks.map((b) => "html" in b ? (b as any).html : "").join("")),
    });
  }, [blocks, tpl?.preheader]);

  // Sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current as { source?: string; blockType?: BlockType } | undefined;
    if (data?.source === "palette" && data.blockType) {
      const b = newBlock(data.blockType);
      let insertAt = blocks.length;
      if (over.id !== "canvas-drop") {
        const idx = blocks.findIndex((x) => x.id === over.id);
        if (idx >= 0) insertAt = idx + 1;
      }
      const next = [...blocks];
      next.splice(insertAt, 0, b);
      setBlocks(next);
      setSelectedId(b.id);
      return;
    }
    if (active.id !== over.id && over.id !== "canvas-drop") {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) setBlocks(arrayMove(blocks, oldIndex, newIndex));
    }
  }

  function updateBlock(b: EmailBlock) {
    setBlocks((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }

  function moveBlock(blockId: string, dir: -1 | 1) {
    const i = blocks.findIndex((x) => x.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    setBlocks(arrayMove(blocks, i, j));
  }

  function duplicateBlock(blockId: string) {
    const b = blocks.find((x) => x.id === blockId);
    if (!b) return;
    const copy = { ...b, id: crypto.randomUUID() } as EmailBlock;
    const i = blocks.findIndex((x) => x.id === blockId);
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    setBlocks(next);
    setSelectedId(copy.id);
  }

  function removeBlock(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedId === blockId) setSelectedId(null);
  }

  async function save() {
    if (!tpl || !clinicId) return;
    if (!tpl.name.trim()) { toast.error("Informe o nome"); return; }
    if (!tpl.subject.trim()) { toast.error("Informe o assunto"); return; }
    if (!tpl.slug || !SLUG_RE.test(tpl.slug)) { toast.error("Slug inválido (use letras, números e hífen, começando por letra)"); return; }
    if (blocks.length === 0) { toast.error("Adicione pelo menos um bloco"); return; }
    if (!tpl.from_email.includes("@")) { toast.error("Configure um remetente"); return; }

    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        name: tpl.name,
        slug: tpl.slug,
        subject: tpl.subject,
        preheader: tpl.preheader,
        from_name: tpl.from_name,
        from_email: tpl.from_email,
        reply_to: tpl.reply_to,
        category: tpl.category,
        html_body: renderedHtml,
        blocks_json: blocks,
        folder_id: tpl.folder_id,
        active: tpl.active,
        version: (tpl.version ?? 1) + (tpl.id ? 1 : 0),
      };
      let res;
      if (tpl.id) {
        res = await supabase.from("email_templates").update(payload).eq("id", tpl.id).select("id").maybeSingle();
      } else {
        res = await supabase.from("email_templates").insert(payload).select("id").maybeSingle();
      }
      if (res.error) throw res.error;
      toast.success("Template salvo");
      if (!tpl.id && res.data) {
        navigate(`/email/templates/${res.data.id}`, { replace: true });
      } else if (tpl.id) {
        try { localStorage.removeItem(`email-template-draft:${tpl.id}`); } catch {}
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!tpl?.id) { toast.error("Salve o template primeiro"); return; }
    if (!testEmail.includes("@")) { toast.error("Informe um email válido"); return; }
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          clinic_id: clinicId,
          template_slug: tpl.slug,
          recipient_email: testEmail,
          recipient_name: "Teste",
          variables: { name: "Teste", first_name: "Teste" },
          force: true,
        },
      });
      if (error) throw error;
      toast.success("Email de teste enviado");
      setTestOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading || !tpl) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-background">
        <Button variant="ghost" size="sm" onClick={() => navigate("/email/templates")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Input
          value={tpl.name}
          onChange={(e) => setTpl({ ...tpl, name: e.target.value, slug: tpl.slug || toSlug(e.target.value) })}
          placeholder="Nome do template"
          className="max-w-[260px] h-8 font-medium"
        />
        <Input
          value={tpl.slug}
          onChange={(e) => setTpl({ ...tpl, slug: toSlug(e.target.value) })}
          placeholder="slug-do-template"
          className="max-w-[200px] h-8 font-mono text-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHtmlOpen(true)}><CodeIcon className="h-3.5 w-3.5 mr-1" />HTML</Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="h-3.5 w-3.5 mr-1" />Preview</Button>
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)} disabled={!tpl.id}><Send className="h-3.5 w-3.5 mr-1" />Enviar teste</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}Salvar
          </Button>
        </div>
      </div>

      {/* Metadata strip */}
      <div className="border-b px-4 py-2 grid grid-cols-4 gap-3 bg-muted/30 text-xs">
        <div>
          <Label className="text-[10px] uppercase">Assunto</Label>
          <Input className="h-7 mt-1" value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Preheader</Label>
          <Input className="h-7 mt-1" value={tpl.preheader ?? ""} onChange={(e) => setTpl({ ...tpl, preheader: e.target.value })} />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Remetente</Label>
          <div className="flex gap-1 mt-1">
            <Input
              className="h-7 flex-1"
              value={tpl.from_email.split("@")[0] ?? ""}
              onChange={(e) => {
                const dom = tpl.from_email.split("@")[1] ?? domains[0]?.domain ?? "";
                setTpl({ ...tpl, from_email: `${e.target.value}@${dom}` });
              }}
              placeholder="contato"
            />
            <Select
              value={tpl.from_email.split("@")[1] ?? domains[0]?.domain}
              onValueChange={(v) => setTpl({ ...tpl, from_email: `${tpl.from_email.split("@")[0] || "contato"}@${v}` })}
            >
              <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="@domínio" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => <SelectItem key={d.id} value={d.domain}>@{d.domain}{d.status !== "verified" && " ⚠"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase">Pasta</Label>
          <Select value={tpl.folder_id ?? "none"} onValueChange={(v) => setTpl({ ...tpl, folder_id: v === "none" ? null : v })}>
            <SelectTrigger className="h-7 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem pasta</SelectItem>
              {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main 3 columns */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 grid grid-cols-[260px_1fr_340px] overflow-hidden">
          <div className="border-r overflow-auto"><Palette /></div>
          <Canvas
            blocks={blocks}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id || null)}
            onMove={moveBlock}
            onDuplicate={duplicateBlock}
            onRemove={removeBlock}
          />
          <div className="border-l overflow-auto bg-background">
            <Inspector block={selected} onChange={updateBlock} />
          </div>
        </div>
      </DndContext>

      {/* Variables footer */}
      <div className="border-t px-4 py-2 flex items-center gap-2 flex-wrap text-[11px] bg-muted/30">
        <span className="text-muted-foreground">Variáveis (clique para copiar):</span>
        {EMAIL_VARIABLES.map((v) => (
          <button
            key={v.key}
            className="px-2 py-0.5 rounded bg-background border hover:bg-accent font-mono"
            onClick={() => { navigator.clipboard.writeText(`{{ ${v.key} }}`); toast.success(`Copiado: {{ ${v.key} }}`); }}
            title={v.label}
          >
            {`{{ ${v.key} }}`}
          </button>
        ))}
      </div>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b"><DialogTitle>Preview — {tpl.subject || "(sem assunto)"}</DialogTitle></DialogHeader>
          <iframe title="preview" srcDoc={sanitizeHtml(renderedHtml)} className="flex-1 w-full bg-white" />
        </DialogContent>
      </Dialog>

      {/* HTML */}
      <Dialog open={htmlOpen} onOpenChange={setHtmlOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>HTML renderizado</DialogTitle></DialogHeader>
          <textarea readOnly className="flex-1 font-mono text-[11px] p-2 border rounded bg-muted/30 resize-none" value={renderedHtml} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(renderedHtml); toast.success("Copiado"); }}>Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar teste</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Email destino</Label>
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="seu@email.com" />
            <p className="text-xs text-muted-foreground">Ignora cota e supressões. Use a versão salva.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>Cancelar</Button>
            <Button onClick={sendTest}><Send className="h-3.5 w-3.5 mr-1" />Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
