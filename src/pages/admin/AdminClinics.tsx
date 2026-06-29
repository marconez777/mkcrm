import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Mail, Copy, UserPlus, Sliders, Search, Download, Eye, LayoutGrid, List, Building2, CheckCircle2, PauseCircle, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FEATURES, isFeatureEnabled } from "@/lib/features";
import ClinicDetailsDialog from "@/components/admin/ClinicDetailsDialog";
import { downloadCsv } from "@/lib/csv";
import { AdminCard, AdminPageHeader } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";

type Clinic = { id: string; name: string; slug: string; status: string; plan: string; created_at: string; settings: { features?: Record<string, boolean> } & Record<string, any>; grant_reason?: string | null; wa_instances?: { name: string; connection_state: string | null; session_stale_since: string | null; last_inbound_webhook_at: string | null }[] };
type PlanRow = { code: string; name: string; limits: Record<string, number | null> };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export default function AdminClinics() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState<Clinic | null>(null);
  const [openCreateUser, setOpenCreateUser] = useState<Clinic | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "professional" | "viewer">("owner");
  const [generatedLink, setGeneratedLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"owner" | "admin" | "professional" | "viewer">("professional");
  const [openFeatures, setOpenFeatures] = useState<Clinic | null>(null);
  const [featuresDraft, setFeaturesDraft] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Clinic | null>(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fPlan, setFPlan] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<string>("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [openDelete, setOpenDelete] = useState<Clinic | null>(null);
  const [deleteSlugInput, setDeleteSlugInput] = useState("");

  async function load() {
    try {
      const [cs, { data: ps }, subs, waInstances] = await Promise.all([
        fetchAllPaged<any>(() => supabase.from("clinics").select("*").order("created_at", { ascending: false })),
        supabase.from("plans").select("code,name,limits").order("sort_order"),
        fetchAllPaged<any>(() => supabase.from("clinic_subscriptions").select("clinic_id,grant_reason").eq("is_current", true)),
        fetchAllPaged<any>(() => supabase.from("whatsapp_instances").select("clinic_id,name,connection_state,session_stale_since,last_inbound_webhook_at")),
      ]);
      const reasonMap = new Map<string, string | null>((subs as any[]).map((s) => [s.clinic_id, s.grant_reason]));
      const waMap = new Map<string, { name: string; connection_state: string | null; session_stale_since: string | null; last_inbound_webhook_at: string | null }[]>();
      for (const w of waInstances as any[]) {
        if (!w.clinic_id) continue;
        const arr = waMap.get(w.clinic_id) ?? [];
        arr.push({ name: w.name, connection_state: w.connection_state, session_stale_since: w.session_stale_since, last_inbound_webhook_at: w.last_inbound_webhook_at });
        waMap.set(w.clinic_id, arr);
      }
      setClinics((cs as any[]).map((c) => ({
        ...c,
        grant_reason: reasonMap.get(c.id) ?? null,
        wa_instances: waMap.get(c.id) ?? [],
      })) as any);
      setPlans((ps as any) ?? []);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clinics.filter((c) => {
      if (fStatus !== "all" && c.status !== fStatus) return false;
      if (fPlan !== "all" && c.plan !== fPlan) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clinics, search, fStatus, fPlan]);

  async function createClinic(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const finalSlug = slug || slugify(name);
      const { error } = await supabase.from("clinics").insert({ name, slug: finalSlug });
      if (error) throw error;
      toast.success("Clínica criada");
      setOpenCreate(false); setName(""); setSlug("");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function generateInvite(e: React.FormEvent) {
    e.preventDefault(); if (!openInvite) return; setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinic-invite", {
        body: { clinic_id: openInvite.id, email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      setGeneratedLink({ url: data.invite_url, expires_at: data.expires_at });
      toast.success("Convite criado");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function copyLink() {
    if (!generatedLink) return;
    try { await navigator.clipboard.writeText(generatedLink.url); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  }
  function closeInvite() { setOpenInvite(null); setInviteEmail(""); setInviteRole("owner"); setGeneratedLink(null); }

  async function toggleStatus(c: Clinic) {
    const next = c.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("clinics").update({ status: next }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success(`Clínica ${next}`); load(); }
  }
  function featuresEnabledCount(c: Clinic) {
    const f = c.settings?.features ?? {};
    return FEATURES.filter((x) => isFeatureEnabled(f, x.key)).length;
  }
  function openFeaturesDialog(c: Clinic) {
    const f = c.settings?.features ?? {};
    const draft: Record<string, boolean> = {};
    for (const x of FEATURES) draft[x.key] = isFeatureEnabled(f, x.key);
    setFeaturesDraft(draft); setOpenFeatures(c);
  }
  async function saveFeatures() {
    if (!openFeatures) return; setBusy(true);
    try {
      const nextSettings = { ...(openFeatures.settings ?? {}), features: featuresDraft };
      const { error } = await supabase.from("clinics").update({ settings: nextSettings }).eq("id", openFeatures.id);
      if (error) throw error;
      toast.success("Recursos atualizados");
      setOpenFeatures(null); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  function closeDelete() { setOpenDelete(null); setDeleteSlugInput(""); }
  async function deleteClinic() {
    if (!openDelete) return;
    if (deleteSlugInput.trim() !== openDelete.slug) {
      toast.error(`Digite o slug exato: ${openDelete.slug}`);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-clinic", {
        body: { clinic_id: openDelete.id, confirm_slug: deleteSlugInput.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(
        `Clínica excluída · ${d.users_deleted} usuário(s) apagado(s), ${d.users_detached} desvinculado(s)`,
      );
      closeDelete();
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  function closeCreateUser() { setOpenCreateUser(null); setNewUserEmail(""); setNewUserPassword(""); setNewUserName(""); setNewUserRole("professional"); }
  async function createUser(e: React.FormEvent) {
    e.preventDefault(); if (!openCreateUser) return; setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("clinic-create-user", {
        body: { clinic_id: openCreateUser.id, email: newUserEmail, password: newUserPassword, full_name: newUserName || null, role: newUserRole },
      });
      if (error) throw error;
      toast.success("Usuário criado"); closeCreateUser();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  function toggleAll(checked: boolean) { setSelected(checked ? new Set(filtered.map((c) => c.id)) : new Set()); }
  function toggleOne(id: string, checked: boolean) {
    setSelected((s) => { const n = new Set(s); if (checked) n.add(id); else n.delete(id); return n; });
  }
  async function bulkApplyPlan() {
    if (!bulkPlan || selected.size === 0) return;
    if (!confirm(`Aplicar plano "${bulkPlan}" em ${selected.size} clínica(s)? Isso sobrescreve features e limites.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("admin-apply-plan", {
        body: { plan_code: bulkPlan, clinic_ids: Array.from(selected), overwrite_features: true, overwrite_limits: true },
      });
      if (error) throw error;
      toast.success(`Plano aplicado em ${selected.size} clínica(s)`);
      setSelected(new Set()); setBulkPlan(""); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function bulkSetStatus(next: "active" | "suspended") {
    if (selected.size === 0) return;
    if (!confirm(`Mudar status para "${next}" em ${selected.size} clínica(s)?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("clinics").update({ status: next }).in("id", Array.from(selected));
      if (error) throw error;
      toast.success("Status atualizado");
      setSelected(new Set()); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  function exportCsv() {
    const rows = filtered.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, status: c.status, plan: c.plan,
      created_at: c.created_at, features_enabled: featuresEnabledCount(c),
    }));
    downloadCsv(`clinicas-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const summary = useMemo(() => {
    const active = clinics.filter((c) => c.status === "active").length;
    const suspended = clinics.filter((c) => c.status === "suspended").length;
    const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newCount = clinics.filter((c) => new Date(c.created_at).getTime() >= last30).length;
    return { total: clinics.length, active, suspended, newCount };
  }, [clinics]);

  return (
    <>
      <AdminPageHeader
        title="Clínicas"
        description="Gerencie todas as clínicas da plataforma — planos, status, recursos e convites."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="bg-admin-primary hover:bg-admin-primary/90 text-admin-primary-foreground">
                <Plus className="mr-1.5 h-4 w-4" />Nova clínica
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar clínica</DialogTitle></DialogHeader>
              <form onSubmit={createClinic} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <KpiStat icon={Building2} tone="primary" label="Total" value={summary.total} />
        <KpiStat icon={CheckCircle2} tone="positive" label="Ativas" value={summary.active} />
        <KpiStat icon={PauseCircle} tone="warning" label="Suspensas" value={summary.suspended} />
        <KpiStat icon={Sparkles} tone="accent" label="Novas (30d)" value={summary.newCount} />
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-10 -mx-6 px-6 py-2 bg-admin-bg/95 backdrop-blur mb-4 border-b border-admin-border">
        <AdminCard className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-text-subtle" />
              <Input className="pl-9 bg-admin-surface-2 border-admin-border h-9" placeholder="Buscar nome ou slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[140px] h-9 bg-admin-surface-2 border-admin-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="suspended">Suspensas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fPlan} onValueChange={setFPlan}>
              <SelectTrigger className="w-[160px] h-9 bg-admin-surface-2 border-admin-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos planos</SelectItem>
                {plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-admin-text-muted">{filtered.length} de {clinics.length}</span>
              <div className="inline-flex rounded-md border border-admin-border bg-admin-surface p-0.5">
                <button onClick={() => setView("table")} className={cn("h-7 w-7 inline-flex items-center justify-center rounded-sm", view === "table" ? "bg-admin-primary text-admin-primary-foreground" : "text-admin-text-muted hover:text-admin-text")} title="Tabela"><List className="h-3.5 w-3.5" /></button>
                <button onClick={() => setView("grid")} className={cn("h-7 w-7 inline-flex items-center justify-center rounded-sm", view === "grid" ? "bg-admin-primary text-admin-primary-foreground" : "text-admin-text-muted hover:text-admin-text")} title="Cartões"><LayoutGrid className="h-3.5 w-3.5" /></button>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} className="border-admin-border h-9"><Download className="mr-1 h-3.5 w-3.5" />CSV</Button>
            </div>
          </div>
        </AdminCard>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-admin-primary/30 bg-admin-primary-soft px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={bulkPlan} onValueChange={setBulkPlan}>
              <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Aplicar plano…" /></SelectTrigger>
              <SelectContent>{plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!bulkPlan || busy} onClick={bulkApplyPlan}>Aplicar</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkSetStatus("suspended")}>Suspender</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkSetStatus("active")}>Reativar</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      {view === "table" ? (
        <AdminCard>
          <Table>
            <TableHeader>
              <TableRow className="border-admin-border hover:bg-transparent">
                <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} /></TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Recursos</TableHead>
                <TableHead title="Instâncias de WhatsApp da clínica. Verde = conectada (open), amarelo = conectando, cinza = desconectada.">WhatsApp</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-admin-text-muted py-10">Nenhuma clínica encontrada.</TableCell></TableRow>}
              {filtered.map((c) => (
                <TableRow key={c.id} className="border-admin-border group">
                  <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggleOne(c.id, !!v)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-md bg-admin-primary-soft text-admin-primary flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                        {c.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-admin-text truncate">{c.name}</div>
                        <div className="text-[11px] text-admin-text-subtle truncate">/{c.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full", c.status === "active" ? "bg-admin-positive" : "bg-admin-warning")} />
                      <span className={c.status === "active" ? "text-admin-positive" : "text-admin-warning"}>{c.status === "active" ? "Ativa" : "Suspensa"}</span>
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="border-admin-border text-admin-text-muted font-normal">{c.plan}</Badge></TableCell>
                  <TableCell className="text-xs text-admin-text-muted max-w-[180px] truncate" title={c.grant_reason ?? ""}>{c.grant_reason || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs text-admin-text-muted">
                      <div className="h-1 w-12 rounded-full bg-admin-surface-2 overflow-hidden">
                        <div className="h-full bg-admin-primary" style={{ width: `${(featuresEnabledCount(c) / FEATURES.length) * 100}%` }} />
                      </div>
                      <span className="tabular-nums">{featuresEnabledCount(c)}/{FEATURES.length}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const list = c.wa_instances ?? [];
                      if (list.length === 0) return <span className="text-xs text-admin-text-subtle">—</span>;
                      const connected = list.filter((i) => i.connection_state === "open");
                      const connecting = list.filter((i) => i.connection_state === "connecting");
                      // ghost = "open" mas sem eventos há ≥4h (sessão fantasma do WhatsApp Web)
                      const ghost = list.filter((i) => {
                        if (i.connection_state !== "open") return false;
                        const t = i.last_inbound_webhook_at ? Date.parse(i.last_inbound_webhook_at) : 0;
                        return t > 0 && (Date.now() - t) / 60000 >= 240;
                      });
                      const tone = ghost.length > 0
                        ? "bg-admin-negative"
                        : connected.length > 0
                          ? "bg-admin-positive"
                          : connecting.length > 0 ? "bg-admin-warning" : "bg-admin-text-subtle";
                      const label = ghost.length > 0
                        ? (ghost.length === 1 ? `${ghost[0].name} (expirada)` : `${ghost.length} expirada(s)`)
                        : connected.length > 0
                          ? (connected.length === 1 ? connected[0].name : `${connected.length} conectadas`)
                          : connecting.length > 0 ? "conectando" : "desconectada";
                      const tooltip = list.map((i) => {
                        const mins = i.last_inbound_webhook_at ? Math.floor((Date.now() - Date.parse(i.last_inbound_webhook_at)) / 60000) : null;
                        const ageStr = mins === null ? "sem inbound" : mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
                        return `${i.name}: ${i.connection_state ?? "?"} · último evento ${ageStr}`;
                      }).join("\n");
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs max-w-[180px]"
                          title={tooltip}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone)} />
                          <span className="truncate text-admin-text-muted">{label}</span>
                          {list.length > 1 && (
                            <span className="text-[10px] text-admin-text-subtle tabular-nums">({connected.length}/{list.length})</span>
                          )}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-admin-text-muted">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-0.5 opacity-70 group-hover:opacity-100 transition">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Detalhes" onClick={() => setDetails(c)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Recursos" onClick={() => openFeaturesDialog(c)}><Sliders className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Criar usuário" onClick={() => setOpenCreateUser(c)}><UserPlus className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Convite" onClick={() => setOpenInvite(c)}><Mail className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleStatus(c)}>{c.status === "active" ? "Suspender" : "Reativar"}</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-admin-negative hover:text-admin-negative hover:bg-admin-negative/10" title="Excluir clínica e todos os usuários" onClick={() => setOpenDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 && <AdminCard className="col-span-full p-10 text-center text-admin-text-muted text-sm">Nenhuma clínica encontrada.</AdminCard>}
          {filtered.map((c) => (
            <AdminCard key={c.id} className="p-4 group hover:border-admin-border-strong transition">
              <div className="flex items-start gap-3">
                <Checkbox className="mt-1" checked={selected.has(c.id)} onCheckedChange={(v) => toggleOne(c.id, !!v)} />
                <div className="h-9 w-9 rounded-md bg-admin-primary-soft text-admin-primary flex items-center justify-center text-sm font-semibold uppercase shrink-0">
                  {c.name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-admin-text truncate">{c.name}</div>
                  <div className="text-[11px] text-admin-text-subtle truncate">/{c.slug}</div>
                </div>
                <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", c.status === "active" ? "bg-admin-positive" : "bg-admin-warning")} title={c.status} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="border-admin-border text-admin-text-muted font-normal">{c.plan}</Badge>
                <span className="text-[11px] text-admin-text-subtle">desde {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-admin-text-muted mb-1">
                  <span>Recursos</span>
                  <span className="tabular-nums">{featuresEnabledCount(c)}/{FEATURES.length}</span>
                </div>
                <div className="h-1 rounded-full bg-admin-surface-2 overflow-hidden">
                  <div className="h-full bg-admin-primary" style={{ width: `${(featuresEnabledCount(c) / FEATURES.length) * 100}%` }} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 pt-3 border-t border-admin-border">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDetails(c)}><Eye className="mr-1 h-3 w-3" />Detalhes</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openFeaturesDialog(c)}><Sliders className="mr-1 h-3 w-3" />Recursos</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpenInvite(c)}><Mail className="mr-1 h-3 w-3" />Convite</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs ml-auto" onClick={() => toggleStatus(c)}>{c.status === "active" ? "Suspender" : "Reativar"}</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-admin-negative hover:text-admin-negative hover:bg-admin-negative/10" onClick={() => setOpenDelete(c)}><Trash2 className="mr-1 h-3 w-3" />Excluir</Button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      <ClinicDetailsDialog clinic={details} plans={plans} onClose={() => setDetails(null)} onChanged={load} />

      <Dialog open={!!openInvite} onOpenChange={(o) => !o && closeInvite()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar convite — {openInvite?.name}</DialogTitle></DialogHeader>
          {!generatedLink ? (
            <form onSubmit={generateInvite} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email do convidado</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="pessoa@clinica.com" />
                <p className="text-xs text-muted-foreground">O convite só pode ser aceito por quem fizer login com este email.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                  <option value="owner">Owner (dono da clínica)</option>
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeInvite}>Cancelar</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Gerar link</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Link de convite</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generatedLink.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie manualmente para <strong>{inviteEmail}</strong>. Expira em {new Date(generatedLink.expires_at).toLocaleDateString("pt-BR")}.
                </p>
              </div>
              <DialogFooter><Button type="button" onClick={closeInvite}>Concluir</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openCreateUser} onOpenChange={(o) => !o && closeCreateUser()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar usuário — {openCreateUser?.name}</DialogTitle></DialogHeader>
          <form onSubmit={createUser} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome (opcional)</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Nome completo" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required placeholder="pessoa@clinica.com" /></div>
            <div className="space-y-1.5"><Label>Senha</Label><Input type="text" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" /></div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
                <option value="owner">Owner (dono da clínica)</option>
                <option value="admin">Admin</option>
                <option value="professional">Profissional</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeCreateUser}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar usuário</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openFeatures} onOpenChange={(o) => !o && setOpenFeatures(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Recursos — {openFeatures?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            <p className="text-xs text-muted-foreground mb-2">Desligue os recursos que esta clínica não deve ver/usar.</p>
            {FEATURES.map((f) => (
              <div key={f.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground">{f.key}</div>
                </div>
                <Switch checked={featuresDraft[f.key] ?? true} onCheckedChange={(v) => setFeaturesDraft((d) => ({ ...d, [f.key]: v }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpenFeatures(null)}>Cancelar</Button>
            <Button type="button" onClick={saveFeatures} disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiStat({ icon: Icon, tone, label, value }: { icon: any; tone: "primary" | "positive" | "warning" | "accent"; label: string; value: number }) {
  const toneCls: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
    accent: "text-admin-accent bg-admin-accent-soft",
  };
  return (
    <AdminCard className="p-4 flex items-center gap-3">
      <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneCls[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-admin-text-subtle font-medium">{label}</div>
        <div className="text-xl font-semibold text-admin-text tabular-nums leading-tight">{value.toLocaleString("pt-BR")}</div>
      </div>
    </AdminCard>
  );
}
