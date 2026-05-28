import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllByIn } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

type Member = {
  user_id: string;
  role: string;
  created_at: string;
  profile: { email: string | null; full_name: string | null } | null;
};

export default function Team() {
  const { membership, loading } = useAuth();
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "professional" | "viewer">("professional");

  useEffect(() => { document.title = "Equipe — MK CRM"; }, []);

  async function load() {
    if (!membership?.clinic_id) return;
    const { data, error } = await supabase
      .from("clinic_members")
      .select("user_id, role, created_at")
      .eq("clinic_id", membership.clinic_id)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    const ids = (data ?? []).map((m: any) => m.user_id);
    let profilesMap: Record<string, { email: string | null; full_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", ids);
      profilesMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, { email: p.email, full_name: p.full_name }]));
    }
    setMembers((data ?? []).map((m: any) => ({ ...m, profile: profilesMap[m.user_id] ?? null })));
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, membership?.clinic_id]);

  if (loading) return null;
  if (!membership) return <Navigate to="/onboarding" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinic-create-user", {
        body: { email, password, full_name: fullName || null, role },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Usuário criado");
      setOpen(false);
      setEmail(""); setPassword(""); setFullName(""); setRole("professional");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar usuário");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Membros da clínica <strong>{membership.clinic?.name}</strong>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar usuário</DialogTitle></DialogHeader>
            <form onSubmit={createUser} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="pessoa@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" />
                <p className="text-xs text-muted-foreground">Repasse a senha de forma segura. O usuário pode alterá-la depois.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum membro</TableCell></TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell className="font-medium">{m.profile?.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.profile?.email ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{m.role}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
