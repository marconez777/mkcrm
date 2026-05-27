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
import { Plus, Trash2, Eye, Loader2, X, Users, Filter, Mail, Check, Search } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Link } from "react-router-dom";

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
  is_system?: boolean;
  system_key?: string | null;
};

type Stage = { id: string; name: string; pipeline_id: string };
type Contact = { id: string; email: string; name: string | null; lead_id: string | null };

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
  const [editingLoadingId, setEditingLoadingId] = useState<string | null>(null);

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

  // Contatos da clínica (multi-select para segmentos estáticos)
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (cm?.clinic_id) setClinicId(cm.clinic_id);
    }
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
    setName(""); setDescription(""); setKind("dynamic"); setMatch("any"); setRules([]); setActive(true);
    setSelectedContactIds(new Set()); setContactSearch("");
    setPreviewCount(null); setPreviewSample([]); setEditing(null);
  }

  async function loadAvailableContacts(targetClinicId: string, currentSegmentId?: string) {
    const data = await fetchAllPaged<any>(() => {
      let q = supabase
        .from("email_segment_contacts")
        .select("id, email, name, lead_id, segment_id")
        .eq("clinic_id", targetClinicId)
        .order("created_at", { ascending: false });
      if (currentSegmentId) {
        q = q.or(`segment_id.is.null,segment_id.eq.${currentSegmentId}`);
      } else {
        q = q.is("segment_id", null);
      }
      return q;
    });
    // Dedup por e-mail, preferindo a linha do segmento atual
    const byEmail = new Map<string, any>();
    (data as any[] ?? []).forEach((c) => {
      const key = String(c.email).toLowerCase();
      const existing = byEmail.get(key);
      if (!existing || (currentSegmentId && c.segment_id === currentSegmentId)) {
        byEmail.set(key, c);
      }
    });
    const merged = [...byEmail.values()];
    setAvailableContacts(merged as Contact[]);
    return merged;
  }

  async function openEdit(s: Segment) {
    setEditingLoadingId(s.id);
    try {
      setEditing(s);
      setName(s.name);
      setDescription(s.description ?? "");
      const f = normalizeFilters(s.filters);
      setKind(f.kind); setMatch(f.match); setRules(f.rules);
      setActive(s.active);
      const segClinicId = (s as any).clinic_id as string;
      const pool = await loadAvailableContacts(segClinicId, s.id);
      const idsToSelect = new Set<string>(
        pool.filter((c: any) => c.segment_id === s.id).map((c: any) => c.id),
      );
      setSelectedContactIds(idsToSelect);
      setOpenNew(true);
    } finally {
      setEditingLoadingId(null);
    }
  }

  async function openCreate() {
    if (clinicId) await loadAvailableContacts(clinicId);
    setOpenNew(true);
  }

  function addRule(type: RuleType) {
    if (type === "has_email") setRules((r) => [...r, { type: "has_email" }]);
    else if (type === "stage") setRules((r) => [...r, { type: "stage", stage_id: "" }]);
    else if (type === "created_at_range") setRules((r) => [...r, { type: "created_at_range" }]);
    else setRules((r) => [...r, { type, values: [] } as Rule]);
  }
  function updateRule(idx: number, patch: Partial<Rule>) {
    setRules((r) => r.map((x, i) => (i === idx ? ({ ...x, ...patch } as Rule) : x)));
  }
  function removeRule(idx: number) {
    setRules((r) => r.filter((_, i) => i !== idx));
  }

  const filtersPayload: SegmentFilters = useMemo(
    () => ({ kind, match, rules: kind === "static" ? [] : rules }),
    [kind, match, rules],
  );

  // Live preview (dry-run) — debounced
  useEffect(() => {
    if (!openNew || kind !== "dynamic" || !clinicId || rules.length === 0) {
      setPreviewCount(null); setPreviewSample([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc("resolve_email_segment_preview" as any, {
        _clinic_id: clinicId,
        _filters: filtersPayload as any,
      });
      if (error) return;
      const set = new Set<string>();
      (data as any[] ?? []).forEach((r: any) => r?.email && set.add(String(r.email).toLowerCase()));
      setPreviewCount(set.size);
      setPreviewSample([...set].slice(0, 5));
    }, 350);
    return () => clearTimeout(handle);
  }, [openNew, kind, match, rules, clinicId, filtersPayload]);


  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (kind === "dynamic" && rules.length === 0) {
      toast.error("Adicione pelo menos uma regra"); return;
    }
    if (kind === "static" && selectedContactIds.size === 0) {
      toast.error("Selecione ao menos um contato"); return;
    }

    let segmentId = editing?.id;
    let segClinicId: string | null = null;
    if (editing) {
      const { error } = await supabase.from("email_segments").update({
        name, description: description || null, filters: filtersPayload, active,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      segClinicId = (editing as any).clinic_id ?? clinicId;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cm } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user!.id).limit(1).maybeSingle();
      const { data: ins, error } = await supabase.from("email_segments").insert({
        name, description: description || null, filters: filtersPayload, active,
        source_table: "leads", clinic_id: cm?.clinic_id, created_by: user!.id,
      }).select("id").single();
      if (error) return toast.error(error.message);
      segmentId = ins!.id;
      segClinicId = cm?.clinic_id ?? null;
    }

    // Sincroniza vínculos para segmentos estáticos
    if (kind === "static" && segmentId && segClinicId) {
      await supabase.from("email_segment_contacts").delete().eq("segment_id", segmentId);
      const { data: { user } } = await supabase.auth.getUser();
      const rows = availableContacts
        .filter((c) => selectedContactIds.has(c.id))
        .map((c) => ({
          segment_id: segmentId,
          clinic_id: segClinicId,
          email: c.email,
          name: c.name,
          lead_id: c.lead_id,
          added_by: user!.id,
        }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("email_segment_contacts").insert(rows);
        if (insErr) return toast.error(insErr.message);
      }
    } else if (kind === "dynamic" && segmentId) {
      // Limpa qualquer vínculo antigo se trocou de estático para dinâmico
      await supabase.from("email_segment_contacts").delete().eq("segment_id", segmentId);
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

  function toggleContact(id: string) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remove(seg: Segment) {
    if (seg.is_system) { toast.error("Lista do sistema não pode ser excluída."); return; }
    if (!(await confirm({ title: "Excluir segmento?", confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("email_segments").delete().eq("id", seg.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); load(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Segmentos</h2>
          <p className="text-sm text-muted-foreground mt-1">Listas dinâmicas (por filtros) ou estáticas (contatos manuais)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={async () => {
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
        <Dialog open={openNew} onOpenChange={(o) => { if (o) openCreate(); else { setOpenNew(false); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl shadow-[var(--shadow-soft)]"><Plus className="h-4 w-4 mr-2" />Novo segmento</Button>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Lead entra se atender</span>
                      <div className="inline-flex rounded-md border overflow-hidden">
                        <button
                          type="button"
                          className={`px-2 py-0.5 text-xs ${match === "any" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                          onClick={() => setMatch("any")}
                        >qualquer (OR)</button>
                        <button
                          type="button"
                          className={`px-2 py-0.5 text-xs ${match === "all" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                          onClick={() => setMatch("all")}
                        >todas (AND)</button>
                      </div>
                      <span className="text-xs text-muted-foreground">das regras abaixo.</span>
                    </div>
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
                    Selecione contatos já cadastrados na aba Contatos para incluir neste segmento.
                  </p>
                )}
              </div>

              {/* Seletor de contatos (apenas para segmento estático) */}
              {kind === "static" && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Selecionar contatos</Label>
                    <span className="text-xs text-muted-foreground">{selectedContactIds.size} selecionado(s)</span>
                  </div>
                  {availableContacts.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      Nenhum contato cadastrado.{" "}
                      <Link to="/email/contacts" className="text-primary underline">
                        Cadastre na aba Contatos
                      </Link>
                      .
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Buscar por nome ou e-mail"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            const visible = availableContacts.filter((c) => {
                              const q = contactSearch.trim().toLowerCase();
                              if (!q) return true;
                              return c.email.toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q);
                            });
                            const allSelected = visible.every((c) => selectedContactIds.has(c.id));
                            setSelectedContactIds((prev) => {
                              const next = new Set(prev);
                              if (allSelected) visible.forEach((c) => next.delete(c.id));
                              else visible.forEach((c) => next.add(c.id));
                              return next;
                            });
                          }}
                        >
                          Selecionar/desmarcar todos (visíveis)
                        </button>
                        <Link to="/email/contacts" className="text-muted-foreground hover:underline">
                          Gerenciar contatos →
                        </Link>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {availableContacts
                          .filter((c) => {
                            const q = contactSearch.trim().toLowerCase();
                            if (!q) return true;
                            return c.email.toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q);
                          })
                          .map((c) => {
                            const checked = selectedContactIds.has(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleContact(c.id)}
                                className={`w-full flex items-center gap-2 text-left text-sm border rounded px-2 py-1.5 transition-colors ${
                                  checked ? "bg-primary/10 border-primary/40" : "hover:bg-accent"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                  checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                                }`}>
                                  {checked && <Check className="h-3 w-3" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{c.email}</div>
                                  {c.name && <div className="text-xs text-muted-foreground truncate">{c.name}</div>}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}

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
        <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] p-12 text-center text-muted-foreground">
          Nenhum segmento criado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {segments.map((s) => {
            const f = normalizeFilters(s.filters);
            return (
              <div key={s.id} className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] p-5 hover:border-border transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{s.name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {f.kind === "static" ? "Estático" : "Dinâmico"}
                      </Badge>
                    </div>
                    {s.description && <div className="text-xs text-muted-foreground truncate mt-1">{s.description}</div>}
                    <div className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-2 gap-y-1">
                      {s.active
                        ? <span className="text-[hsl(var(--status-sending-fg))]">● Ativo</span>
                        : <span>○ Inativo</span>}
                      <span>·</span>
                      <span>{counts[s.id] ?? "…"} destinatário(s)</span>
                      {f.rules.length > 0 && <span>· {f.rules.length} regra(s)</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)} className="text-muted-foreground hover:text-foreground">Editar</Button>
                    {!s.is_system && (
                      <Button size="icon" variant="ghost" onClick={() => remove(s)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {s.is_system && <Badge variant="secondary" className="self-center text-[10px]">sistema</Badge>}
                  </div>
                </div>
              </div>
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
  const negate = !!(rule as any).negate;
  return (
    <div className="flex items-start gap-2 border rounded-md p-2 bg-muted/30">
      <div className="flex flex-col items-start gap-1 shrink-0 mt-0.5">
        <Badge variant="secondary">{RULE_LABELS[rule.type]}</Badge>
        <button
          type="button"
          onClick={() => onChange({ negate: !negate } as any)}
          className={`text-[10px] px-1.5 py-0.5 rounded border ${negate ? "bg-destructive/10 text-destructive border-destructive/40" : "text-muted-foreground hover:bg-accent"}`}
          title={negate ? "Excluindo quem bate nesta regra" : "Clique para inverter (NÃO)"}
        >
          {negate ? "NÃO bate" : "bate"}
        </button>
      </div>
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
        {rule.type === "created_at_range" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">De</Label>
              <Input
                type="date"
                value={(rule as any).from?.slice(0, 10) ?? ""}
                onChange={(e) => onChange({ from: e.target.value ? `${e.target.value}T00:00:00Z` : undefined } as any)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={(rule as any).to?.slice(0, 10) ?? ""}
                onChange={(e) => onChange({ to: e.target.value ? `${e.target.value}T23:59:59Z` : undefined } as any)}
              />
            </div>
          </div>
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
