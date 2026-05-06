import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Mail, Copy } from "lucide-react";

type Clinic = { id: string; name: string; slug: string; status: string; plan: string; created_at: string };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export default function Admin() {
  const { isSuperAdmin, loading } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [busy, setBusy] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState<Clinic | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "professional" | "viewer">("owner");
  const [generatedLink, setGeneratedLink] = useState<{ url: string; expires_at: string } | null>(null);

  useEffect(() => { document.title = "Admin — MKart CRM"; }, []);

  async function load() {
    const { data, error } = await supabase.from("clinics").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setClinics(data ?? []);
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  async function createClinic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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
    e.preventDefault();
    if (!openInvite) return;
    setBusy(true);
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
    try {
      await navigator.clipboard.writeText(generatedLink.url);
      toast.success("Link copiado");
    } catch { toast.error("Não foi possível copiar"); }
  }

  function closeInvite() {
    setOpenInvite(null); setInviteEmail(""); setInviteRole("owner"); setGeneratedLink(null);
  }

  async function toggleStatus(c: Clinic) {
    const next = c.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("clinics").update({ status: next }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success(`Clínica ${next}`); load(); }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Painel Super Admin</h1>
          <p className="text-sm text-muted-foreground">Gerenciar clínicas e convites</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova clínica</Button></DialogTrigger>
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma clínica</TableCell></TableRow>}
            {clinics.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                <TableCell>{c.plan}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setOpenInvite(c)}><Mail className="mr-1 h-3 w-3" />Convidar owner</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(c)}>{c.status === "active" ? "Suspender" : "Reativar"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!openInvite} onOpenChange={(o) => !o && setOpenInvite(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar owner — {openInvite?.name}</DialogTitle></DialogHeader>
          <form onSubmit={sendInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Enviar convite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
