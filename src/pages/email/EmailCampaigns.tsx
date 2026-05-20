import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Loader2, Send, Calendar, Trash2, Beaker, BarChart3, Pencil } from "lucide-react";
import { CampaignReportDialog } from "@/components/email/CampaignReportDialog";
import { useConfirm } from "@/hooks/useDialogs";

type Campaign = {
  id: string;
  name: string;
  template_slug: string;
  segment_id: string | null;
  status: string;
  scheduled_for: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  test_email: string | null;
  test_sent_at: string | null;
  created_at: string;
};
type Tpl = { id: string; slug: string; name: string };
type Segment = { id: string; name: string };

export default function EmailCampaigns() {
  const { membership, user } = useAuth();
  const clinicId = membership?.clinic_id;
  const confirm = useConfirm();
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [reporting, setReporting] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!clinicId) return;
    const [{ data: cs }, { data: ts }, { data: ss }] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("email_templates").select("id,slug,name").eq("active", true).order("name"),
      supabase.from("email_segments").select("id,name").order("name"),
    ]);
    setItems((cs ?? []) as any);
    setTemplates((ts ?? []) as any);
    setSegments((ss ?? []) as any);
  }

  useEffect(() => { if (clinicId) load(); }, [clinicId]);
  useEffect(() => { document.title = "Email — Campanhas"; }, []);

  function startCreate() {
    setEditing({
      id: "", name: "", template_slug: "", segment_id: null, status: "draft",
      scheduled_for: null, total_recipients: 0, sent_count: 0, failed_count: 0,
      test_email: user?.email ?? null, test_sent_at: null, created_at: "",
    });
    setScheduleDate("");
  }

  async function save() {
    if (!editing || !clinicId) return;
    if (!editing.name || !editing.template_slug) { toast.error("Preencha nome e template"); return; }
    setBusy(true);
    try {
      const payload = {
        clinic_id: clinicId,
        name: editing.name,
        template_slug: editing.template_slug,
        segment_id: editing.segment_id,
        test_email: editing.test_email,
        scheduled_for: scheduleDate ? new Date(scheduleDate).toISOString() : null,
        status: scheduleDate ? "scheduled" : "draft",
      };
      const q = editing.id
        ? supabase.from("email_campaigns").update(payload).eq("id", editing.id)
        : supabase.from("email_campaigns").insert(payload).select("id").single();
      const { data, error } = await q;
      if (error) throw error;
      toast.success("Campanha salva");
      if (!editing.id && data) setEditing({ ...editing, id: (data as any).id });
      else setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!editing?.id) { toast.error("Salve a campanha antes de enviar teste"); return; }
    const dest = editing.test_email?.trim();
    if (!dest) { toast.error("Informe o email de teste"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-campaign", {
        body: { campaign_id: editing.id, test_only: true, test_email_override: dest },
      });
      if (error) throw error;
      toast.success(`Teste enviado para ${dest}`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(c: Campaign) {
    if (!(await confirm({ title: `Enviar campanha "${c.name}" agora?`, description: "Os e-mails serão enfileirados imediatamente.", confirmLabel: "Enviar" }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-campaign", {
        body: { campaign_id: c.id },
      });
      if (error) throw error;
      toast.success("Campanha em envio");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Campaign) {
    if (!(await confirm({ title: `Excluir campanha "${c.name}"?`, confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("email_campaigns").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  }

  function statusBadge(s: string) {
    const map: Record<string, "default" | "secondary" | "destructive"> = {
      sent: "default", sending: "default", scheduled: "secondary", draft: "secondary", failed: "destructive",
    };
    return <Badge variant={map[s] ?? "secondary"}>{s}</Badge>;
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campanhas de Email</h1>
          <p className="text-sm text-muted-foreground">Envios únicos para listas segmentadas.</p>
        </div>
        <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Nova campanha</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead>Agendada</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma campanha</TableCell></TableRow>
            )}
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.template_slug}</TableCell>
                <TableCell className="text-xs">{segments.find((s) => s.id === c.segment_id)?.name ?? "—"}</TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{c.sent_count} / {c.total_recipients}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.scheduled_for ? new Date(c.scheduled_for).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setReporting(c)}>
                    <BarChart3 className="mr-1 h-3 w-3" />Relatório
                  </Button>
                  {["draft", "scheduled"].includes(c.status) && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      <Pencil className="mr-1 h-3 w-3" />Editar
                    </Button>
                  )}
                  {["draft", "scheduled"].includes(c.status) && (
                    <Button size="sm" variant="outline" onClick={() => dispatch(c)} disabled={busy}>
                      <Send className="mr-1 h-3 w-3" />Enviar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={editing.template_slug} onValueChange={(v) => setEditing({ ...editing, template_slug: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Segmento (opcional — vazio = todos os leads)</Label>
                <Select value={editing.segment_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, segment_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os leads</SelectItem>
                    {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Calendar className="h-3 w-3" />Agendar para (opcional)</Label>
                <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Beaker className="h-3 w-3" />Email de teste</Label>
                <Input type="email" placeholder="voce@exemplo.com" value={editing.test_email ?? ""} onChange={(e) => setEditing({ ...editing, test_email: e.target.value })} />
                {editing.test_sent_at && <p className="text-xs text-muted-foreground">Último teste: {new Date(editing.test_sent_at).toLocaleString("pt-BR")}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="outline" onClick={sendTest} disabled={busy || !editing?.id}>
              <Beaker className="mr-1 h-3 w-3" />Enviar teste
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignReportDialog
        campaign={reporting}
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
      />
    </div>
  );
}
