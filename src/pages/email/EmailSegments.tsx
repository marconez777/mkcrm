import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Loader2, X, Users, Filter, Mail } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

type RuleType = "form_source" | "tag" | "stage" | "has_email" | "utm_campaign" | "created_at_range";
type BaseRule = { negate?: boolean };
type Rule =
  | (BaseRule & { type: "form_source"; values: string[] })
  | (BaseRule & { type: "tag"; values: string[] })
  | (BaseRule & { type: "utm_campaign"; values: string[] })
  | (BaseRule & { type: "stage"; stage_id: string })
  | (BaseRule & { type: "has_email" })
  | (BaseRule & { type: "created_at_range"; from?: string; to?: string });

type SegmentFilters = {
  kind: "dynamic" | "static";
  match: "any" | "all";
  rules: Rule[];
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  source_table: string;
  filters: any;
  active: boolean;
  created_at: string;
};

type Stage = { id: string; name: string; pipeline_id: string };
type Contact = { id: string; email: string; name: string | null; created_at: string };

const RULE_LABELS: Record<RuleType, string> = {
  form_source: "Origem do formulário",
  tag: "Tag",
  stage: "Etapa do pipeline",
  has_email: "Tem e-mail",
  utm_campaign: "Campanha UTM",
  created_at_range: "Criado entre datas",
};

function normalizeFilters(raw: any): SegmentFilters {
  const out: SegmentFilters = { kind: "dynamic", match: "any", rules: [] };
  if (!raw || typeof raw !== "object") return out;
  out.kind = raw.kind === "static" ? "static" : "dynamic";
  out.match = raw.match === "all" ? "all" : "any";
  if (Array.isArray(raw.rules)) {
    out.rules = raw.rules.filter((r: any) => r && typeof r === "object" && r.type);
    return out;
  }
  // backward compat
  if (Array.isArray(raw.tags) && raw.tags.length) out.rules.push({ type: "tag", values: raw.tags });
  if (raw.has_email === true) out.rules.push({ type: "has_email" });
  if (Array.isArray(raw.stage_ids)) raw.stage_ids.forEach((id: string) => out.rules.push({ type: "stage", stage_id: id }));
  if (raw.stage_id) out.rules.push({ type: "stage", stage_id: raw.stage_id });
  return out;
}

export default function EmailSegments() {
  const confirm = useConfirm();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  const [stages, setStages] = useState<Stage[]>([]);
  const [knownFormSources, setKnownFormSources] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [knownUtm, setKnownUtm] = useState<string[]>([]);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"dynamic" | "static">("dynamic");
  const [match, setMatch] = useState<"any" | "all">("any");
  const [rules, setRules] = useState<Rule[]>([]);
  const [active, setActive] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);

  // Contatos manuais (estático ou inclusões extras)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    const [{ data: segs, error }, { data: st }, { data: leads }] = await Promise.all([
      supabase.from("email_segments").select("*").order("created_at", { ascending: false }),
      supabase.from("pipeline_stages").select("id, name, pipeline_id"),
      supabase.from("leads").select("form_source, tags, utm_campaign").limit(2000),
    ]);
    if (error) toast.error(error.message);
    setSegments((segs as Segment[]) ?? []);
    setStages((st as Stage[]) ?? []);
    const fs = new Set<string>(); const tg = new Set<string>(); const utm = new Set<string>();
    (leads ?? []).forEach((l: any) => {
      if (l.form_source) fs.add(l.form_source);
      if (l.utm_campaign) utm.add(l.utm_campaign);
      if (Array.isArray(l.tags)) l.tags.forEach((t: string) => t && tg.add(t));
    });
    setKnownFormSources([...fs].sort());
    setKnownTags([...tg].sort());
    setKnownUtm([...utm].sort());
    setLoading(false);

    // contagem assíncrona por segmento via RPC
    const next: Record<string, number> = {};
    await Promise.all(((segs as Segment[]) ?? []).map(async (s) => {
      const { data } = await supabase.rpc("resolve_email_segment", { _segment_id: s.id });
      const set = new Set<string>();
      (data as any[] ?? []).forEach((r) => r?.email && set.add(String(r.email).toLowerCase()));
      next[s.id] = set.size;
    }));
    setCounts(next);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setName(""); setDescription(""); setKind("dynamic"); setRules([]); setActive(true);
    setContacts([]); setNewContactEmail(""); setNewContactName("");
    setPreviewCount(null); setPreviewSample([]); setEditing(null);
  }

  async function openEdit(s: Segment) {
    setEditing(s);
    setName(s.name);
    setDescription(s.description ?? "");
    const f = normalizeFilters(s.filters);
    setKind(f.kind); setRules(f.rules);
    setActive(s.active);
    const { data: cs } = await supabase
      .from("email_segment_contacts")
      .select("id, email, name, created_at")
      .eq("segment_id", s.id)
      .order("created_at", { ascending: false });
    setContacts((cs as Contact[]) ?? []);
    setOpenNew(true);
  }

  function addRule(type: RuleType) {
    if (type === "has_email") setRules((r) => [...r, { type: "has_email" }]);
    else if (type === "stage") setRules((r) => [...r, { type: "stage", stage_id: "" }]);
    else setRules((r) => [...r, { type, values: [] }]);
  }
  function updateRule(idx: number, patch: Partial<Rule>) {
    setRules((r) => r.map((x, i) => (i === idx ? ({ ...x, ...patch } as Rule) : x)));
  }
  function removeRule(idx: number) {
    setRules((r) => r.filter((_, i) => i !== idx));
  }

  const filtersPayload: SegmentFilters = useMemo(
    () => ({ kind, match: "any", rules: kind === "static" ? [] : rules }),
    [kind, rules],
  );

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (kind === "dynamic" && rules.length === 0 && contacts.length === 0) {
      toast.error("Adicione pelo menos um gatilho ou contato manual"); return;
    }

    let segmentId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("email_segments").update({
        name, description: description || null, filters: filtersPayload, active,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user!.id).limit(1).maybeSingle();
      const { data: ins, error } = await supabase.from("email_segments").insert({
        name, description: description || null, filters: filtersPayload, active,
        source_table: "leads", clinic_id: cm?.clinic_id, created_by: user!.id,
      }).select("id").single();
      if (error) return toast.error(error.message);
      segmentId = ins!.id;
    }
    toast.success(editing ? "Segmento atualizado" : "Segmento criado");
    setOpenNew(false); resetForm(); load();
  }

  async function preview() {
    setPreviewing(true);
    try {
      if (editing) {
        const [{ data, error }, { data: unsubs }] = await Promise.all([
          supabase.rpc("resolve_email_segment", { _segment_id: editing.id }),
          supabase.from("email_unsubscribes").select("email").eq("clinic_id", (editing as any).clinic_id ?? ""),
        ]);
        if (error) throw error;
        const blocked = new Set((unsubs ?? []).map((u: any) => String(u.email).toLowerCase()));
        const all = new Set<string>();
        const eligible = new Set<string>();
        (data as any[] ?? []).forEach((r) => {
          if (!r?.email) return;
          const e = String(r.email).toLowerCase();
          all.add(e);
          if (!blocked.has(e)) eligible.add(e);
        });
        setPreviewCount(eligible.size);
        setPreviewSample([...eligible].slice(0, 5));
        const suppressed = all.size - eligible.size;
        if (suppressed > 0) toast.info(`${suppressed} contato(s) suprimido(s) foram descontados`);
      } else {
        toast.info("Salve o segmento para pré-visualizar o público completo");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function addContact() {
    const email = newContactEmail.trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) { toast.error("E-mail inválido"); return; }
    if (!editing) { toast.error("Salve o segmento antes de adicionar contatos"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user!.id).limit(1).maybeSingle();
    const { data, error } = await supabase.from("email_segment_contacts").insert({
      segment_id: editing.id,
      clinic_id: cm?.clinic_id,
      email,
      name: newContactName.trim() || null,
      added_by: user!.id,
    }).select("id, email, name, created_at").single();
    if (error) return toast.error(error.message);
    setContacts((c) => [data as Contact, ...c]);
    setNewContactEmail(""); setNewContactName("");
  }

  async function removeContact(id: string) {
    const { error } = await supabase.from("email_segment_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setContacts((c) => c.filter((x) => x.id !== id));
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir segmento?", confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("email_segments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Segmentos</h2>
          <p className="text-sm text-muted-foreground">Listas dinâmicas (por filtros) ou estáticas (contatos manuais)</p>
        </div>
        <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user!.id).limit(1).maybeSingle();
          if (!cm?.clinic_id) return toast.error("Clínica não encontrada");
          const { data: leads } = await supabase.from("leads").select("form_source").eq("clinic_id", cm.clinic_id).not("form_source", "is", null).limit(5000);
          const sources = [...new Set((leads ?? []).map((l: any) => l.form_source).filter(Boolean))];
          if (!sources.length) return toast.info("Nenhum lead com origem de formulário encontrado ainda");
          const existing = new Set(segments.map((s) => s.name));
          let created = 0;
          for (const src of sources) {
            const name = `Leads — ${src}`;
            if (existing.has(name)) continue;
            const { error } = await supabase.from("email_segments").insert({
              clinic_id: cm.clinic_id,
              created_by: user!.id,
              source_table: "leads",
              name,
              description: `Auto-gerado para o formulário "${src}"`,
              active: true,
              filters: { kind: "dynamic", match: "any", rules: [{ type: "form_source", values: [src] }] },
            });
            if (!error) created++;
          }
          toast.success(created ? `${created} segmento(s) criado(s)` : "Todos os segmentos já existiam");
          load();
        }}>
          <Filter className="h-4 w-4 mr-2" /> Criar segmentos dos formulários
        </Button>
        <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo segmento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar segmento" : "Novo segmento"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leads dos testes de saúde mental" />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "dynamic" ? "default" : "outline"}
                    onClick={() => setKind("dynamic")}
                  >
                    <Filter className="h-4 w-4 mr-2" /> Dinâmico (por regras)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "static" ? "default" : "outline"}
                    onClick={() => setKind("static")}
                  >
                    <Users className="h-4 w-4 mr-2" /> Estático (lista manual)
                  </Button>
                </div>

                {kind === "dynamic" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Lead entra se atender <strong>qualquer</strong> uma das regras abaixo (OR).
                    </p>
                    <div className="space-y-2">
                      {rules.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">Nenhuma regra. Adicione um gatilho.</div>
                      )}
                      {rules.map((rule, idx) => (
                        <RuleRow
                          key={idx}
                          rule={rule}
                          stages={stages}
                          knownFormSources={knownFormSources}
                          knownTags={knownTags}
                          knownUtm={knownUtm}
                          onChange={(p) => updateRule(idx, p)}
                          onRemove={() => removeRule(idx)}
                        />
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-2" /> Adicionar gatilho
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {(Object.keys(RULE_LABELS) as RuleType[]).map((t) => (
                          <DropdownMenuItem key={t} onClick={() => addRule(t)}>{RULE_LABELS[t]}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Os destinatários serão somente os contatos adicionados manualmente abaixo.
                  </p>
                )}
              </div>

              {/* Contatos manuais */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Contatos manuais</Label>
                  <span className="text-xs text-muted-foreground">{contacts.length} contato(s)</span>
                </div>
                {!editing && (
                  <p className="text-xs text-muted-foreground">Salve o segmento primeiro para adicionar contatos.</p>
                )}
                {editing && (
                  <>
                    <div className="flex gap-2">
                      <Input placeholder="Nome (opcional)" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                      <Input placeholder="email@exemplo.com" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} />
                      <Button type="button" size="sm" onClick={addContact}>Adicionar</Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {contacts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                          <div className="min-w-0">
                            <div className="truncate">{c.email}</div>
                            {c.name && <div className="text-xs text-muted-foreground truncate">{c.name}</div>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeContact(c.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
                  <div className="text-sm text-muted-foreground">
                    {previewCount} destinatário(s){previewSample.length > 0 && ` · ex.: ${previewSample.join(", ")}`}
                  </div>
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
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : segments.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum segmento criado</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {segments.map((s) => {
            const f = normalizeFilters(s.filters);
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{s.name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {f.kind === "static" ? "Estático" : "Dinâmico"}
                      </Badge>
                    </div>
                    {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-2 gap-y-1">
                      {s.active ? <span className="text-green-600">● Ativo</span> : <span>○ Inativo</span>}
                      <span>·</span>
                      <span>{counts[s.id] ?? "…"} destinatário(s)</span>
                      {f.rules.length > 0 && <span>· {f.rules.length} regra(s)</span>}
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule, stages, knownFormSources, knownTags, knownUtm, onChange, onRemove,
}: {
  rule: Rule;
  stages: Stage[];
  knownFormSources: string[];
  knownTags: string[];
  knownUtm: string[];
  onChange: (patch: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 border rounded-md p-2 bg-muted/30">
      <Badge variant="secondary" className="shrink-0 mt-1">{RULE_LABELS[rule.type]}</Badge>
      <div className="flex-1 min-w-0">
        {rule.type === "form_source" && (
          <MultiValueInput
            values={rule.values}
            suggestions={knownFormSources}
            placeholder="Ex.: teste-depressao, teste-ansiedade"
            onChange={(values) => onChange({ values } as any)}
          />
        )}
        {rule.type === "tag" && (
          <MultiValueInput
            values={rule.values}
            suggestions={knownTags}
            placeholder="tag1, tag2"
            onChange={(values) => onChange({ values } as any)}
          />
        )}
        {rule.type === "utm_campaign" && (
          <MultiValueInput
            values={rule.values}
            suggestions={knownUtm}
            placeholder="black-friday, primavera"
            onChange={(values) => onChange({ values } as any)}
          />
        )}
        {rule.type === "stage" && (
          <Select value={rule.stage_id} onValueChange={(v) => onChange({ stage_id: v } as any)}>
            <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {rule.type === "has_email" && (
          <div className="text-xs text-muted-foreground py-1">Lead precisa ter e-mail cadastrado</div>
        )}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onRemove}><X className="h-4 w-4" /></Button>
    </div>
  );
}

function MultiValueInput({
  values, suggestions, placeholder, onChange,
}: {
  values: string[];
  suggestions: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const remaining = suggestions.filter((s) => !values.includes(s)).slice(0, 8);

  function commit(v: string) {
    const x = v.trim();
    if (!x) return;
    if (!values.includes(x)) onChange([...values, x]);
    setText("");
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="outline" className="gap-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(text); }
          }}
          placeholder={placeholder}
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] text-muted-foreground self-center">sugestões:</span>
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
