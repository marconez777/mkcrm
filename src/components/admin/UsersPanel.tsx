import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Loader2, MoreHorizontal, Search, Shield, ShieldOff, KeyRound, Unlock, LogOut, Trash2, Download,
  Users, UserCheck, UserX, Crown,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { AdminCard } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";

type Row = {
  id: string; email: string; full_name: string | null; created_at: string;
  last_sign_in_at: string | null; last_seen_at: string | null;
  clinic_id: string | null; clinic_name: string | null; clinic_role: string | null;
  is_super_admin: boolean; locked: boolean; locked_until: string | null; failed_attempts: number;
};

function initials(name: string | null, email: string) {
  const src = (name ?? email).trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mês`;
  return `${Math.floor(mo / 12)}a`;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-admin-warning-soft text-admin-warning",
  admin: "bg-admin-primary-soft text-admin-primary",
  professional: "bg-admin-accent-soft text-admin-accent",
  viewer: "bg-admin-surface-2 text-admin-text-muted",
};

export default function UsersPanel({ clinics }: { clinics?: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fClinic, setFClinic] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users-list?page=${page}&per_page=100&search=${encodeURIComponent(search)}`;
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "erro");
      setRows(j.users ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function action(body: any, okMsg: string) {
    try {
      const { error } = await supabase.functions.invoke("admin-user-action", { body });
      if (error) throw error;
      toast.success(okMsg);
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fClinic !== "all" && r.clinic_id !== fClinic && !(fClinic === "none" && !r.clinic_id)) return false;
      if (fStatus === "active" && r.locked) return false;
      if (fStatus === "locked" && !r.locked) return false;
      if (fStatus === "super" && !r.is_super_admin) return false;
      if (fStatus === "never" && r.last_sign_in_at) return false;
      if (q && !`${r.email} ${r.full_name ?? ""} ${r.clinic_name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, fClinic, fStatus]);

  const summary = useMemo(() => {
    const active = rows.filter((r) => !r.locked).length;
    const locked = rows.filter((r) => r.locked).length;
    const supers = rows.filter((r) => r.is_super_admin).length;
    const never = rows.filter((r) => !r.last_sign_in_at).length;
    return { total: rows.length, active, locked, supers, never };
  }, [rows]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleAll(v: boolean) { setSelected(v ? new Set(filtered.map((r) => r.id)) : new Set()); }
  function toggleOne(id: string, v: boolean) {
    setSelected((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  }
  async function bulkSignOut() {
    if (selected.size === 0) return;
    if (!confirm(`Forçar logout em ${selected.size} usuário(s)?`)) return;
    for (const id of selected) {
      await supabase.functions.invoke("admin-user-action", { body: { action: "sign_out", user_id: id } });
    }
    toast.success("Sessões encerradas");
    setSelected(new Set());
    await load();
  }
  function exportCsv() {
    downloadCsv(`usuarios-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((r) => ({
      id: r.id, email: r.email, full_name: r.full_name, clinic: r.clinic_name, role: r.clinic_role,
      super_admin: r.is_super_admin, locked: r.locked, last_sign_in_at: r.last_sign_in_at, created_at: r.created_at,
    })));
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiStat icon={Users} tone="primary" label="Total" value={summary.total} />
        <KpiStat icon={UserCheck} tone="positive" label="Ativos" value={summary.active} />
        <KpiStat icon={UserX} tone="negative" label="Bloqueados" value={summary.locked} />
        <KpiStat icon={Crown} tone="warning" label="Super admins" value={summary.supers} />
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-10 -mx-6 px-6 py-2 bg-admin-bg/95 backdrop-blur border-b border-admin-border">
        <AdminCard className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-text-subtle" />
              <Input className="pl-9 h-9 bg-admin-surface-2 border-admin-border" placeholder="Buscar email, nome ou clínica…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={fClinic} onValueChange={setFClinic}>
              <SelectTrigger className="w-[180px] h-9 bg-admin-surface-2 border-admin-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas clínicas</SelectItem>
                <SelectItem value="none">Sem clínica</SelectItem>
                {clinics?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[150px] h-9 bg-admin-surface-2 border-admin-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="locked">Bloqueados</SelectItem>
                <SelectItem value="super">Super admins</SelectItem>
                <SelectItem value="never">Nunca logaram</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-admin-text-muted">{filtered.length} de {rows.length}</span>
              <Button variant="outline" size="sm" className="h-9 border-admin-border" onClick={load} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Atualizar
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-admin-border" onClick={exportCsv}>
                <Download className="mr-1 h-3.5 w-3.5" />CSV
              </Button>
              <div className="inline-flex items-center gap-0.5 border border-admin-border rounded-md bg-admin-surface">
                <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
                <span className="text-xs text-admin-text-muted px-1 tabular-nums">{page}</span>
                <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setPage((p) => p + 1)}>›</Button>
              </div>
            </div>
          </div>
        </AdminCard>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--admin-radius)] border border-admin-primary/30 bg-admin-primary-soft px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-8 border-admin-border" onClick={bulkSignOut}>
              <LogOut className="mr-1 h-3.5 w-3.5" />Forçar logout
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      <AdminCard>
        <Table>
          <TableHeader>
            <TableRow className="border-admin-border hover:bg-transparent">
              <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} /></TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Clínica</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-admin-text-muted py-10">
                  {loading ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : "Nenhum usuário encontrado."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id} className="border-admin-border group">
                <TableCell><Checkbox checked={selected.has(u.id)} onCheckedChange={(v) => toggleOne(u.id, !!v)} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-admin-primary-soft text-admin-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(u.full_name, u.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-admin-text truncate flex items-center gap-1.5">
                        {u.full_name ?? u.email.split("@")[0]}
                        {u.is_super_admin && <Crown className="h-3 w-3 text-admin-warning shrink-0" aria-label="super admin" />}
                      </div>
                      <div className="text-[11px] text-admin-text-subtle truncate">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-admin-text">
                  {u.clinic_name ?? <span className="text-admin-text-subtle">—</span>}
                </TableCell>
                <TableCell>
                  {u.clinic_role ? (
                    <span className={cn("inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded", ROLE_COLORS[u.clinic_role] ?? "bg-admin-surface-2 text-admin-text-muted")}>
                      {u.clinic_role}
                    </span>
                  ) : (
                    <span className="text-admin-text-subtle text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn("h-1.5 w-1.5 rounded-full", u.locked ? "bg-admin-negative" : "bg-admin-positive")} />
                    <span className={u.locked ? "text-admin-negative" : "text-admin-positive"}>
                      {u.locked ? "Bloqueado" : "Ativo"}
                    </span>
                    {u.failed_attempts > 0 && !u.locked && (
                      <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px] border-admin-border text-admin-warning">{u.failed_attempts} falhas</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-admin-text-muted whitespace-nowrap" title={u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : ""}>
                  {relativeTime(u.last_sign_in_at)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        const p = prompt("Nova senha (mín. 8 caracteres):");
                        if (p && p.length >= 8) action({ action: "set_password", user_id: u.id, password: p }, "Senha alterada");
                      }}>
                        <KeyRound className="mr-2 h-3.5 w-3.5" />Redefinir senha
                      </DropdownMenuItem>
                      {u.locked && (
                        <DropdownMenuItem onClick={() => action({ action: "unlock", user_id: u.id }, "Conta desbloqueada")}>
                          <Unlock className="mr-2 h-3.5 w-3.5" />Desbloquear
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => action({ action: "sign_out", user_id: u.id }, "Sessões encerradas")}>
                        <LogOut className="mr-2 h-3.5 w-3.5" />Forçar logout
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.is_super_admin ? (
                        <DropdownMenuItem onClick={() => action({ action: "set_super_admin", user_id: u.id, enable: false }, "Super admin revogado")}>
                          <ShieldOff className="mr-2 h-3.5 w-3.5" />Revogar super admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => action({ action: "set_super_admin", user_id: u.id, enable: true }, "Promovido a super admin")}>
                          <Shield className="mr-2 h-3.5 w-3.5" />Promover super admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-admin-negative focus:text-admin-negative" onClick={() => {
                        if (confirm(`Excluir ${u.email}? Isso é irreversível.`)) action({ action: "delete_user", user_id: u.id }, "Usuário excluído");
                      }}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir usuário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </div>
  );
}

function KpiStat({ icon: Icon, tone, label, value }: { icon: any; tone: "primary" | "positive" | "negative" | "warning"; label: string; value: number }) {
  const toneCls: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    negative: "text-admin-negative bg-admin-negative-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
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
