import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Search, Shield, ShieldOff, KeyRound, Unlock, LogOut, Trash2 } from "lucide-react";

type Row = {
  id: string; email: string; full_name: string | null; created_at: string; last_sign_in_at: string | null;
  clinic_id: string | null; clinic_name: string | null; clinic_role: string | null;
  is_super_admin: boolean; locked: boolean; locked_until: string | null; failed_attempts: number;
};

export default function UsersPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users-list", {
        body: undefined,
        method: "GET" as any,
      });
      // supabase-js doesn't easily pass query params via invoke GET; fallback to fetch
      if (error) throw error;
      setRows((data as any)?.users ?? []);
    } catch {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users-list?page=${page}&per_page=100&search=${encodeURIComponent(search)}`;
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "erro");
        setRows(j.users ?? []);
      } catch (e: any) {
        toast.error(e.message);
      }
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

  const filtered = search ? rows.filter((r) =>
    (r.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.clinic_name ?? "").toLowerCase().includes(search.toLowerCase()),
  ) : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por email, nome ou clínica…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Atualizar
        </Button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
          Página {page}
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => p + 1)}>›</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Clínica</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                {loading ? "Carregando…" : "Sem usuários"}
              </TableCell></TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.full_name ?? u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>{u.clinic_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {u.is_super_admin && <Badge variant="default" className="mr-1">super admin</Badge>}
                  {u.clinic_role ? <Badge variant="secondary">{u.clinic_role}</Badge> : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
                </TableCell>
                <TableCell>
                  {u.locked
                    ? <Badge variant="destructive">bloqueado</Badge>
                    : <Badge variant="outline">ativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
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
                      <DropdownMenuItem className="text-destructive" onClick={() => {
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
      </div>
    </div>
  );
}
