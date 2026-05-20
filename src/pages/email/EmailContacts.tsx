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

type Segment = { id: string; name: string };
type Contact = {
  source: "lead" | "manual";
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  segment_id?: string | null;
  segment_name?: string | null;
  form_source?: string | null;
};

export default function EmailContacts() {
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState<string>("__all");
  const [filterSource, setFilterSource] = useState<string>("__all");

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
  const [toDelete, setToDelete] = useState<Contact | null>(null);
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

    const [{ data: segs }, { data: leads }, { data: manual }] = await Promise.all([
      supabase.from("email_segments").select("id, name").eq("clinic_id", cid).order("name"),
      supabase.from("leads")
        .select("id, email, name, created_at, form_source")
        .eq("clinic_id", cid)
        .not("email", "is", null)
        .neq("email", "")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("email_segment_contacts")
        .select("id, email, name, created_at, segment_id, lead_id")
        .eq("clinic_id", cid)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const segList = (segs as Segment[]) ?? [];
    setSegments(segList);
    const segMap = new Map(segList.map((s) => [s.id, s.name]));

    const merged: Contact[] = [
      ...((leads as any[]) ?? []).map((l) => ({
        source: "lead" as const,
        id: l.id,
        email: String(l.email).toLowerCase(),
        name: l.name,
        created_at: l.created_at,
        form_source: l.form_source,
      })),
      ...((manual as any[]) ?? []).map((c) => ({
        source: "manual" as const,
        id: c.id,
        email: String(c.email).toLowerCase(),
        name: c.name,
        created_at: c.created_at,
        segment_id: c.segment_id,
        segment_name: segMap.get(c.segment_id) ?? null,
      })),
    ];
    setContacts(merged);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (q && !c.email.includes(q) && !(c.name ?? "").toLowerCase().includes(q)) return false;
      if (filterSource !== "__all" && c.source !== filterSource) return false;
      if (filterSegment !== "__all") {
        if (c.source !== "manual" || c.segment_id !== filterSegment) return false;
      }
      return true;
    });
  }, [contacts, search, filterSource, filterSegment]);

  const totals = useMemo(() => {
    const uniq = new Set(contacts.map((c) => c.email));
    return {
      total: uniq.size,
      leads: contacts.filter((c) => c.source === "lead").length,
      manual: contacts.filter((c) => c.source === "manual").length,
    };
  }, [contacts]);

  async function addManual() {
    const email = addEmail.trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) return toast.error("E-mail inválido");
    if (!addSegment) return toast.error("Escolha um segmento");
    if (!clinicId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("email_segment_contacts").insert({
      clinic_id: clinicId,
      segment_id: addSegment,
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
      if (toDelete.source === "manual") {
        const { error } = await supabase.from("email_segment_contacts").delete().eq("id", toDelete.id);
        if (error) return toast.error(error.message);
      } else {
        const { error } = await supabase.from("leads").delete().eq("id", toDelete.id);
        if (error) return toast.error(error.message);
      }
      setContacts((c) => c.filter((x) => !(x.source === toDelete.source && x.id === toDelete.id)));
      toast.success("Contato excluído");
      setToDelete(null);
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
        // auto-detect
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
    if (!importSegment) return toast.error("Escolha um segmento");
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
        segment_id: importSegment,
        email: r.email,
        name: r.name,
        added_by: user?.id,
      }));
      // chunked insert (upsert by ignoring conflict)
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
    const rows = [["email", "nome", "origem", "segmento", "form_source"]];
    filtered.forEach((c) => rows.push([
      c.email, c.name ?? "", c.source, c.segment_name ?? "", c.form_source ?? "",
    ]));
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Contatos</h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} únicos · {totals.leads} leads · {totals.manual} manuais
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>

          <Dialog open={openImport} onOpenChange={setOpenImport}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-2" />Importar planilha</Button>
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
                      <Label>Segmento de destino *</Label>
                      <Select value={importSegment} onValueChange={setImportSegment}>
                        <SelectTrigger><SelectValue placeholder="Escolha um segmento" /></SelectTrigger>
                        <SelectContent>
                          {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Contatos serão adicionados como manuais no segmento escolhido.
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
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Adicionar contato</Button>
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
                  <Label>Segmento *</Label>
                  <Select value={addSegment} onValueChange={setAddSegment}>
                    <SelectTrigger><SelectValue placeholder="Escolha um segmento" /></SelectTrigger>
                    <SelectContent>
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

      <Card className="p-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por e-mail ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as origens</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="manual">Manuais</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os segmentos</SelectItem>
              {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum contato encontrado
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">E-mail</th>
                  <th className="text-left px-3 py-2">Nome</th>
                  <th className="text-left px-3 py-2">Origem</th>
                  <th className="text-left px-3 py-2">Segmento</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((c) => (
                  <tr key={`${c.source}-${c.id}`} className="border-t">
                    <td className="px-3 py-2 truncate max-w-[260px]">{c.email}</td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{c.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.source === "lead" ? (
                        <Badge variant="outline" className="text-[10px]">
                          Lead{c.form_source ? ` · ${c.form_source}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Manual</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.segment_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && (
            <div className="text-xs text-muted-foreground p-2 border-t text-center">
              Exibindo 500 de {filtered.length}. Use os filtros para refinar.
            </div>
          )}
        </Card>
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
                {toDelete?.source === "lead"
                  ? "Esta ação removerá o lead permanentemente do CRM."
                  : "Esta ação removerá o contato do segmento permanentemente."}
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
