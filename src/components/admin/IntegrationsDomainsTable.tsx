import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, Eye } from "lucide-react";
import DnsWizard from "@/components/email/DnsWizard";

type Clinic = { id: string; name: string };
type DnsRecord = {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  ttl?: string | number;
  priority?: number | string;
  status?: string;
};
type Domain = {
  id: string;
  clinic_id: string;
  domain: string;
  status: string;
  region: string;
  dns_records: DnsRecord[];
  last_checked_at: string | null;
  clinic?: Clinic | null;
};

const REGIONS = [
  { value: "us-east-1", label: "us-east-1 (N. Virginia)" },
  { value: "eu-west-1", label: "eu-west-1 (Ireland)" },
  { value: "sa-east-1", label: "sa-east-1 (São Paulo)" },
];

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "verified") return "default";
  if (s === "failed" || s === "temporary_failure") return "destructive";
  return "secondary";
}

export default function IntegrationsDomainsTable({ clinics }: { clinics: Clinic[] }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [busy, setBusy] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openDns, setOpenDns] = useState<Domain | null>(null);
  const [newClinicId, setNewClinicId] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newRegion, setNewRegion] = useState("us-east-1");

  async function load() {
    const { data, error } = await supabase
      .from("email_domains")
      .select("*, clinic:clinics(id,name)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDomains((data ?? []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function createDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!newClinicId || !newDomain) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("email-domain-manage", {
        body: { action: "create", clinic_id: newClinicId, domain: newDomain, region: newRegion },
      });
      if (error) throw error;
      toast.success("Domínio criado. Configure o DNS na clínica.");
      setOpenAdd(false);
      setNewClinicId("");
      setNewDomain("");
      setNewRegion("us-east-1");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar");
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain(d: Domain) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-manage", {
        body: { action: "verify", domain_id: d.id },
      });
      if (error) throw error;
      toast.success(`Status: ${data?.domain?.status ?? "atualizado"}`);
      await load();
      if (openDns?.id === d.id) {
        const updated = (data?.domain as Domain) ?? null;
        if (updated) setOpenDns({ ...updated, clinic: d.clinic });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha na verificação");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDomain(d: Domain) {
    if (!confirm(`Excluir domínio ${d.domain}?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("email-domain-manage", {
        body: { action: "delete", domain_id: d.id },
      });
      if (error) throw error;
      toast.success("Domínio excluído");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Domínios de email</h2>
          <p className="text-xs text-muted-foreground">
            Um domínio por clínica. Os clientes apenas informam o domínio deles — você gerencia tudo aqui.
          </p>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-3 w-3" />
              Adicionar domínio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar domínio</DialogTitle>
            </DialogHeader>
            <form onSubmit={createDomain} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Clínica</Label>
                <select
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newClinicId}
                  onChange={(e) => setNewClinicId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Domínio</Label>
                <Input
                  placeholder="mail.clinica.com.br"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Região</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpenAdd(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clínica</TableHead>
            <TableHead>Domínio</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Região</TableHead>
            <TableHead>Última verificação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                Nenhum domínio cadastrado
              </TableCell>
            </TableRow>
          )}
          {domains.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.clinic?.name ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{d.domain}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{d.region}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {d.last_checked_at ? new Date(d.last_checked_at).toLocaleString("pt-BR") : "—"}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => setOpenDns(d)}>
                  <Eye className="mr-1 h-3 w-3" />DNS
                </Button>
                <Button size="sm" variant="outline" onClick={() => verifyDomain(d)} disabled={busy}>
                  <RefreshCw className="mr-1 h-3 w-3" />Verificar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteDomain(d)} disabled={busy}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!openDns} onOpenChange={(o) => !o && setOpenDns(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DNS — {openDns?.domain}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Peça à clínica para cadastrar estes registros no provedor de DNS dela. A verificação
            roda automaticamente a cada 20 segundos enquanto este diálogo estiver aberto.
          </p>
          {openDns && (
            <DnsWizard
              domain={openDns}
              onUpdated={(next) => {
                setOpenDns(next);
                setDomains((arr) => arr.map((d) => (d.id === next.id ? { ...d, ...next } : d)));
              }}
            />
          )}
          <DialogFooter>
            <Button onClick={() => setOpenDns(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
