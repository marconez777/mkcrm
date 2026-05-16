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
import { Loader2, Pencil } from "lucide-react";

type Clinic = {
  id: string;
  name: string;
  settings: Record<string, any>;
};
type SendState = { clinic_id: string; sent_today: number };

const DEFAULT_QUOTA = 1000;

function readQuota(c: Clinic): number {
  return Number(c.settings?.email?.quota_daily ?? DEFAULT_QUOTA);
}
function emailEnabled(c: Clinic): boolean {
  const f = c.settings?.features ?? {};
  return f.email_marketing !== false;
}

export default function IntegrationsQuotaTable() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [state, setState] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [quota, setQuota] = useState<number>(DEFAULT_QUOTA);

  async function load() {
    const [{ data: cs, error: e1 }, { data: ss, error: e2 }] = await Promise.all([
      supabase.from("clinics").select("id,name,settings").order("name"),
      supabase.from("email_send_state").select("clinic_id,sent_today"),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) console.warn(e2.message);
    setClinics((cs ?? []) as any);
    const map: Record<string, number> = {};
    (ss ?? []).forEach((r: SendState) => (map[r.clinic_id] = r.sent_today));
    setState(map);
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(c: Clinic) {
    setQuota(readQuota(c));
    setEditing(c);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const nextSettings = {
        ...(editing.settings ?? {}),
        email: { ...(editing.settings?.email ?? {}), quota_daily: Number(quota) || 0 },
      };
      const { error } = await supabase
        .from("clinics")
        .update({ settings: nextSettings })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Cota atualizada");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Cota diária de email</h2>
        <p className="text-xs text-muted-foreground">
          Limite de envios por dia para cada clínica. Contador zera diariamente.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clínica</TableHead>
            <TableHead>Email marketing</TableHead>
            <TableHead className="text-right">Cota diária</TableHead>
            <TableHead className="text-right">Enviados hoje</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clinics.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Nenhuma clínica
              </TableCell>
            </TableRow>
          )}
          {clinics.map((c) => {
            const q = readQuota(c);
            const sent = state[c.id] ?? 0;
            const pct = q > 0 ? Math.round((sent / q) * 100) : 0;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant={emailEnabled(c) ? "default" : "secondary"}>
                    {emailEnabled(c) ? "Ativo" : "Desligado"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{q.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {sent.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs text-muted-foreground">({pct}%)</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                    <Pencil className="mr-1 h-3 w-3" />Editar cota
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cota diária — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Limite de emails por dia</Label>
              <Input
                type="number"
                min={0}
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Use 0 para bloquear todos os envios. Padrão sugerido: {DEFAULT_QUOTA}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
