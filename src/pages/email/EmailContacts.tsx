import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Download, Search, Loader2, Users, AlertTriangle } from "lucide-react";
import { TablePager, PAGE_SIZE } from "@/components/email/TablePager";
import { fetchAllPaged } from "@/lib/fetch-all";

type Segment = { id: string; name: string };

type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  form_source: string | null;
};
type SegContactRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  segment_id: string | null;
  lead_id: string | null;
};

// Uma linha por e-mail (agrupado)
type GroupedContact = {
  email: string;
  name: string | null;
  created_at: string;
  leadId: string | null;
  formSource: string | null;
  segmentEntries: Array<{
    id: string;
    segment_id: string | null;
    segment_name: string | null;
    fromLead: boolean; // true = auto-inscrito pelo formulário (lead_id != null)
  }>;
};

export default function EmailContacts() {
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [segContacts, setSegContacts] = useState<SegContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState<string>("__all");
  const [filterSource, setFilterSource] = useState<string>("__all");
  const [page, setPage] = useState(0);

  // add manual
  const [openAdd, setOpenAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addSegment, setAddSegment] = useState<string>("");

  // import
  const [openImport, setOpenImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [mapEmail, setMapEmail] = useState<string>("");
  const [mapName, setMapName] = useState<string>("");
  const [importSegment, setImportSegment] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // delete confirm
  const [toDelete, setToDelete] = useState<GroupedContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cm } = await supabase
      .from("clinic_members").select("clinic_id")
      .eq("user_id", user.id).limit(1).maybeSingle();
    const cid = cm?.clinic_id ?? null;
    setClinicId(cid);
    if (!cid) { setLoading(false); return; }

    const [{ data: segs }, leadsData, manual] = await Promise.all([
      supabase.from("email_segments").select("id, name").eq("clinic_id", cid).order("name"),
      fetchAllPaged<LeadRow>(() =>
        supabase.from("leads")
          .select("id, email, name, created_at, form_source")
          .eq("clinic_id", cid)
          .not("email", "is", null)
          .neq("email", "")
          .order("created_at", { ascending: false })
      ),
      fetchAllPaged<SegContactRow>(() =>
        supabase.from("email_segment_contacts")
          .select("id, email, name, created_at, segment_id, lead_id")
          .eq("clinic_id", cid)
          .order("created_at", { ascending: false })
      ),
    ]);

    setSegments((segs as Segment[]) ?? []);
    setLeads((leadsData ?? []).map((l) => ({ ...l, email: String(l.email).toLowerCase() })));
    setSegContacts((manual ?? []).map((c) => ({ ...c, email: String(c.email).toLowerCase() })));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Agrupa por e-mail
  const grouped = useMemo<GroupedContact[]>(() => {
    const segMap = new Map(segments.map((s) => [s.id, s.name]));
    const byEmail = new Map<string, GroupedContact>();

    for (const l of leads) {
      const g = byEmail.get(l.email) ?? {
        email: l.email,
        name: l.name,
        created_at: l.created_at,
        leadId: null,
        formSource: null,
        segmentEntries: [],
      };
      g.leadId = l.id;
      g.formSource = l.form_source;
      g.name = g.name ?? l.name;
      if (new Date(l.created_at) > new Date(g.created_at)) g.created_at = l.created_at;
      byEmail.set(l.email, g);
    }

    for (const c of segContacts) {
      const g = byEmail.get(c.email) ?? {
        email: c.email,
        name: c.name,
        created_at: c.created_at,
        leadId: null,
        formSource: null,
        segmentEntries: [],
      };
      g.name = g.name ?? c.name;
      g.segmentEntries.push({
        id: c.id,
        segment_id: c.segment_id,
        segment_name: c.segment_id ? (segMap.get(c.segment_id) ?? null) : null,
        fromLead: !!c.lead_id,
      });
      byEmail.set(c.email, g);
    }

    return Array.from(byEmail.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [leads, segContacts, segments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grouped.filter((g) => {
      if (q && !g.email.includes(q) && !(g.name ?? "").toLowerCase().includes(q)) return false;

      if (filterSource !== "__all") {
        const hasLead = !!g.leadId;
        const hasManual = g.segmentEntries.some((e) => !e.fromLead);
        const hasAuto = g.segmentEntries.some((e) => e.fromLead);
        if (filterSource === "lead" && !hasLead) return false;
        if (filterSource === "manual" && !hasManual) return false;
        if (filterSource === "auto" && !hasAuto) return false;
      }

      if (filterSegment !== "__all") {
        if (!g.segmentEntries.some((e) => e.segment_id === filterSegment)) return false;
      }
      return true;
    });
  }, [grouped, search, filterSource, filterSegment]);

  // Reset paginação quando filtros mudam
  useEffect(() => { setPage(0); }, [search, filterSource, filterSegment]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const totals = useMemo(() => {
    const leadCount = grouped.filter((g) => g.leadId).length;
    const manualCount = grouped.filter((g) => g.segmentEntries.some((e) => !e.fromLead)).length;
    return { total: grouped.length, leads: leadCount, manual: manualCount };
  }, [grouped]);

  async function addManual() {
    const email = addEmail.trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) return toast.error("E-mail inválido");
    if (!clinicId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("email_segment_contacts").insert({
      clinic_id: clinicId,
      segment_id: addSegment && addSegment !== "__none" ? addSegment : null,
      email,
      name: addName.trim() || null,
      added_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Contato adicionado");
    setAddEmail(""); setAddName(""); setOpenAdd(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const segIds = toDelete.segmentEntries.map((e) => e.id);
      if (segIds.length) {
        const { error } = await supabase.from("email_segment_contacts").delete().in("id", segIds);
        if (error) { toast.error(error.message); return; }
      }
      if (toDelete.leadId) {
        const { error } = await supabase.from("leads").delete().eq("id", toDelete.leadId);
        if (error) { toast.error(error.message); return; }
      }
      toast.success("Contato excluído");
      setToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        if (!json.length) return toast.error("Planilha vazia");
        const headers = Object.keys(json[0]).map(String);
        setImportHeaders(headers);
        setImportRows(json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")]))));
        const guessEmail = headers.find((h) => /e[\-_ ]?mail|email/i.test(h)) ?? headers[0];
        const guessName = headers.find((h) => /nome|name/i.test(h)) ?? "";
        setMapEmail(guessEmail);
        setMapName(guessName);
      } catch (err: any) {
        toast.error("Falha ao ler planilha: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function doImport() {
    if (!clinicId) return;
    if (!mapEmail) return toast.error("Mapeie a coluna de e-mail");
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const seen = new Set<string>();
      const rows = importRows
        .map((r) => ({
          email: String(r[mapEmail] ?? "").trim().toLowerCase(),
          name: mapName ? String(r[mapName] ?? "").trim() || null : null,
        }))
        .filter((r) => /.+@.+\..+/.test(r.email))
        .filter((r) => {
          if (seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });
      if (!rows.length) { toast.error("Nenhum e-mail válido"); setImporting(false); return; }

      const payload = rows.map((r) => ({
        clinic_id: clinicId,
        segment_id: importSegment && importSegment !== "__none" ? importSegment : null,
        email: r.email,
        name: r.name,
        added_by: user?.id,
      }));
      const chunkSize = 500;
      let ok = 0, fail = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("email_segment_contacts").insert(chunk);
        if (error) fail += chunk.length; else ok += chunk.length;
      }
      toast.success(`${ok} importado(s)${fail ? ` · ${fail} falharam (duplicados?)` : ""}`);
      setOpenImport(false);
      setImportRows([]); setImportHeaders([]); setMapEmail(""); setMapName(""); setImportSegment("");
      load();
    } finally {
      setImporting(false);
    }
  }

  function exportCsv() {
    const rows = [["email", "nome", "origens", "segmentos", "form_source"]];
    filtered.forEach((g) => {
      const origens: string[] = [];
      if (g.leadId) origens.push("lead");
      if (g.segmentEntries.some((e) => e.fromLead)) origens.push("auto");
      if (g.segmentEntries.some((e) => !e.fromLead)) origens.push("manual");
      const segs = [...new Set(g.segmentEntries.map((e) => e.segment_name).filter(Boolean) as string[])].join(" | ");
      rows.push([g.email, g.name ?? "", origens.join(" + "), segs, g.formSource ?? ""]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contatos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totals.total} únicos · {totals.leads} de leads · {totals.manual} inscrições manuais
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportCsv} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>

          <Dialog open={openImport} onOpenChange={setOpenImport}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-xl"><Upload className="h-4 w-4 mr-2" />Importar planilha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Importar contatos</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Arquivo (CSV ou XLSX)</Label>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
                {importHeaders.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Coluna de E-mail *</Label>
                        <Select value={mapEmail} onValueChange={setMapEmail}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {importHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Coluna de Nome (opcional)</Label>
                        <Select value={mapName || "__none"} onValueChange={(v) => setMapName(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">— nenhum —</SelectItem>
                            {importHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Segmento de destino</Label>
                      <Select value={importSegment || "__none"} onValueChange={setImportSegment}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Sem segmento (contatos gerais)</SelectItem>
                          {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        "Sem segmento" inclui esses contatos em campanhas "Todos os leads".
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pré-visualização: {importRows.length} linha(s).
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenImport(false)}>Cancelar</Button>
                <Button onClick={doImport} disabled={importing || !importRows.length}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Importar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl shadow-[var(--shadow-soft)]"><Plus className="h-4 w-4 mr-2" />Adicionar contato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>E-mail *</Label>
                  <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input value={addName} onChange={(e) => setAddName(e.target.value)} />
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Select value={addSegment || "__none"} onValueChange={setAddSegment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem segmento (contatos gerais)</SelectItem>
                      {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                <Button onClick={addManual}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] p-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8 rounded-xl" placeholder="Buscar por e-mail ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as origens</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="auto">Auto · formulário</SelectItem>
              <SelectItem value="manual">Manuais</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-[200px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os segmentos</SelectItem>
              {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] p-12 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum contato encontrado
        </div>
      ) : (
        <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="text-left px-4 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">E-mail</th>
                <th className="text-left px-4 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Origens</th>
                <th className="text-left px-4 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Segmentos</th>
                <th className="text-right px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paged.map((g) => {
                const hasManual = g.segmentEntries.some((e) => !e.fromLead);
                const hasAuto = g.segmentEntries.some((e) => e.fromLead);
                const segNames = [...new Set(
                  g.segmentEntries.map((e) => e.segment_name).filter(Boolean) as string[]
                )];
                return (
                  <tr key={g.email} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 truncate max-w-[260px]" title={g.email}>{g.email}</td>
                    <td className="px-4 py-4 truncate max-w-[180px]">{g.name ?? "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {g.leadId && (
                          <Badge variant="outline" className="text-[10px]">
                            Lead{g.formSource ? ` · ${g.formSource}` : ""}
                          </Badge>
                        )}
                        {hasAuto && (
                          <Badge variant="outline" className="text-[10px]">Auto · formulário</Badge>
                        )}
                        {hasManual && (
                          <Badge variant="secondary" className="text-[10px]">Manual</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {segNames.length ? segNames.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setToDelete(g)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePager page={page} total={filtered.length} onPageChange={setPage} />
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {toDelete?.email}
              <br />
              <span className="text-xs">
                {toDelete?.leadId && (toDelete?.segmentEntries.length ?? 0) > 0
                  ? "O lead será removido do CRM e todas as inscrições em segmentos serão apagadas."
                  : toDelete?.leadId
                  ? "Esta ação removerá o lead permanentemente do CRM."
                  : "Esta ação removerá todas as inscrições em segmentos para este e-mail."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
