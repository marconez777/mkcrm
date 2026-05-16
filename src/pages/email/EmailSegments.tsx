import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Loader2 } from "lucide-react";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  source_table: string;
  filters: any;
  active: boolean;
  created_at: string;
};

export default function EmailSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filtersText, setFiltersText] = useState('{\n  "tags": ["lead"]\n}');
  const [active, setActive] = useState(true);

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("email_segments").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setSegments((data as Segment[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setName(""); setDescription(""); setFiltersText('{\n  "tags": ["lead"]\n}'); setActive(true);
    setPreviewCount(null); setEditing(null);
  }

  function openEdit(s: Segment) {
    setEditing(s);
    setName(s.name);
    setDescription(s.description ?? "");
    setFiltersText(JSON.stringify(s.filters ?? {}, null, 2));
    setActive(s.active);
    setOpenNew(true);
  }

  async function save() {
    let filters: any;
    try { filters = JSON.parse(filtersText); } catch { toast.error("JSON de filtros inválido"); return; }
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }

    if (editing) {
      const { error } = await supabase.from("email_segments").update({
        name, description: description || null, filters, active,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Segmento atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user!.id).limit(1).maybeSingle();
      const { error } = await supabase.from("email_segments").insert({
        name, description: description || null, filters, active,
        source_table: "leads", clinic_id: cm?.clinic_id, created_by: user!.id,
      });
      if (error) return toast.error(error.message);
      toast.success("Segmento criado");
    }
    setOpenNew(false); resetForm(); load();
  }

  async function preview() {
    let filters: any;
    try { filters = JSON.parse(filtersText); } catch { toast.error("JSON inválido"); return; }
    setPreviewing(true);
    try {
      let q = supabase.from("leads").select("id", { count: "exact", head: true });
      if (Array.isArray(filters?.tags) && filters.tags.length > 0) {
        q = q.overlaps("tags", filters.tags);
      }
      if (filters?.stage_id) q = q.eq("stage_id", filters.stage_id);
      if (filters?.has_email === true) q = q.not("email", "is", null);
      const { count, error } = await q;
      if (error) throw error;
      setPreviewCount(count ?? 0);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir segmento?")) return;
    const { error } = await supabase.from("email_segments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Segmentos</h2>
          <p className="text-sm text-muted-foreground">Listas dinâmicas baseadas em filtros sobre leads</p>
        </div>
        <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo segmento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar segmento" : "Novo segmento"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leads quentes" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Filtros (JSON)</Label>
                <Textarea
                  value={filtersText}
                  onChange={(e) => setFiltersText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Campos suportados: <code>tags</code> (array), <code>stage_id</code> (uuid), <code>has_email</code> (boolean)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} id="active" />
                <Label htmlFor="active">Ativo</Label>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={preview} disabled={previewing}>
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  Pré-visualizar
                </Button>
                {previewCount !== null && (
                  <span className="text-sm text-muted-foreground">{previewCount} destinatários</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : segments.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum segmento criado</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {segments.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                  <div className="text-xs text-muted-foreground mt-2">
                    {s.active ? <span className="text-green-600">● Ativo</span> : <span>○ Inativo</span>} · {s.source_table}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
