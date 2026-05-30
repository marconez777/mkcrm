import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Loader2, Send, Calendar, Trash2, Beaker, BarChart3, Pencil, Pause, Play, Copy, Activity } from "lucide-react";
import { CampaignReportDialog } from "@/components/email/CampaignReportDialog";
import { CampaignRecipientsPreview } from "@/components/email/CampaignRecipientsPreview";
import { CampaignLiveDialog } from "@/components/email/live/CampaignLiveDialog";
import { LivePulseDot } from "@/components/email/live/LivePulseDot";
import { StatusBadge } from "@/components/email/StatusBadge";
import { TablePager, PAGE_SIZE } from "@/components/email/TablePager";
import { useConfirm } from "@/hooks/useDialogs";

type Campaign = {
  id: string;
  name: string;
  template_slug: string;
  segment_id: string | null;
  segment_ids: string[];
  status: string;
  scheduled_for: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  test_email: string | null;
  test_sent_at: string | null;
  created_at: string;
  from_name_override: string | null;
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
  const [liveId, setLiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    if (!clinicId) return;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const [{ data: cs, count }, ts, ss] = await Promise.all([
      supabase
        .from("email_campaigns")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to),
      fetchAllPaged<any>(() => supabase.from("email_templates").select("id,slug,name").eq("active", true).order("name")),
      fetchAllPaged<any>(() => supabase.from("email_segments").select("id,name").order("name")),
    ]);
    const campaigns = (cs ?? []) as Campaign[];
    setTotal(count ?? 0);
    // Conta sent/failed reais a partir de email_logs e email_queue por campanha (somente página atual)
    const ids = campaigns.map((c) => `campaign_${c.id}`);
    if (ids.length > 0) {
      const [logs, queue] = await Promise.all([
        fetchAllPaged<any>(() => supabase.from("email_logs").select("related_lead_table,status").in("related_lead_table", ids)),
        fetchAllPaged<any>(() => supabase.from("email_queue").select("related_lead_table,status").in("related_lead_table", ids)),
      ]);
      const sentBy = new Map<string, number>();
      const failedBy = new Map<string, number>();
      for (const r of (logs ?? []) as any[]) {
        sentBy.set(r.related_lead_table, (sentBy.get(r.related_lead_table) ?? 0) + 1);
        if (["bounced", "complained", "failed"].includes(r.status)) {
          failedBy.set(r.related_lead_table, (failedBy.get(r.related_lead_table) ?? 0) + 1);
        }
      }
      for (const r of (queue ?? []) as any[]) {
        if (r.status === "failed") {
          failedBy.set(r.related_lead_table, (failedBy.get(r.related_lead_table) ?? 0) + 1);
        }
      }
      for (const c of campaigns) {
        const key = `campaign_${c.id}`;
        c.sent_count = sentBy.get(key) ?? c.sent_count ?? 0;
        c.failed_count = failedBy.get(key) ?? c.failed_count ?? 0;
      }
    }
    setItems(campaigns);
    setTemplates((ts ?? []) as any);
    setSegments((ss ?? []) as any);
  }


  useEffect(() => { if (clinicId) load(); }, [clinicId, page]);
  useEffect(() => { document.title = "Email — Campanhas"; }, []);

  function startCreate() {
    setEditing({
      id: "", name: "", template_slug: "", segment_id: null, segment_ids: [], status: "draft",
      scheduled_for: null, total_recipients: 0, sent_count: 0, failed_count: 0,
      test_email: user?.email ?? null, test_sent_at: null, created_at: "",
      from_name_override: null,
    });
    setScheduleDate("");
  }


  async function save() {
    if (!editing || !clinicId) return;
    if (!editing.name || !editing.template_slug) { toast.error("Preencha nome e template"); return; }
    setBusy(true);
    try {
      const segIds = (editing.segment_ids ?? []).filter(Boolean);
      const payload = {
        clinic_id: clinicId,
        name: editing.name,
        template_slug: editing.template_slug,
        segment_ids: segIds,
        // mantém segment_id sincronizado p/ retro-compat (1 segmento) ou null (0 ou >1)
        segment_id: segIds.length === 1 ? segIds[0] : null,
        test_email: editing.test_email,
        from_name_override: editing.from_name_override?.trim() || null,
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
      setLiveId(c.id);
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

  async function pause(c: Campaign) {
    if (!(await confirm({
      title: `Pausar campanha "${c.name}"?`,
      description: "Emails ainda não enviados ficarão em espera até você retomar.",
      confirmLabel: "Pausar",
    }))) return;
    setBusy(true);
    try {
      const { error: qErr } = await supabase
        .from("email_queue")
        .update({ status: "paused" })
        .eq("status", "pending")
        .eq("related_lead_table", `campaign_${c.id}`);
      if (qErr) throw qErr;
      const { error } = await supabase
        .from("email_campaigns")
        .update({ status: "paused" })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Campanha pausada");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function resume(c: Campaign) {
    setBusy(true);
    try {
      const { error: qErr } = await supabase
        .from("email_queue")
        .update({ status: "pending", scheduled_at: new Date().toISOString() })
        .eq("status", "paused")
        .eq("related_lead_table", `campaign_${c.id}`);
      if (qErr) throw qErr;
      const futureSchedule = c.scheduled_for && new Date(c.scheduled_for) > new Date();
      const nextStatus = futureSchedule ? "scheduled" : (c.sent_count > 0 || c.total_recipients > 0 ? "sending" : "draft");
      const { error } = await supabase
        .from("email_campaigns")
        .update({ status: nextStatus })
        .eq("id", c.id);
      if (error) throw error;
      // dispara processamento imediato
      supabase.functions.invoke("process-email-queue", { body: {} }).catch(() => {});
      toast.success("Campanha retomada");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function duplicate(c: Campaign) {
    if (!clinicId) return;
    setBusy(true);
    try {
      const segIds = (c.segment_ids ?? []).filter(Boolean);
      const { error } = await supabase.from("email_campaigns").insert({
        clinic_id: clinicId,
        name: `${c.name} (cópia)`,
        template_slug: c.template_slug,
        segment_ids: segIds,
        segment_id: segIds.length === 1 ? segIds[0] : null,
        test_email: c.test_email,
        status: "draft",
      });
      if (error) throw error;
      toast.success("Campanha duplicada");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }


  function progressBar(c: Campaign) {
    const total = c.total_recipients || 0;
    if (!total) return null;
    const pct = Math.min(100, Math.round((c.sent_count / total) * 100));
    const color =
      c.status === "failed"
        ? "bg-[hsl(var(--status-failed-fg))]"
        : c.status === "sent"
          ? "bg-[hsl(var(--status-sent-fg))]"
          : "bg-primary";
    return (
      <div className="mt-1.5 h-1 w-24 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campanhas de Email</h1>
            <p className="text-sm text-muted-foreground mt-1">Envios únicos para listas segmentadas.</p>
          </div>
          <Button
            onClick={startCreate}
            className="rounded-xl px-5 py-2.5 shadow-[var(--shadow-soft)]"
          >
            <Plus className="mr-2 h-4 w-4" />Nova campanha
          </Button>
        </div>

        <div className="bg-card rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-border/40">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-4">Nome</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Template</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Segmento</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Enviados</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Agendada</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nenhuma campanha ainda.
                  </TableCell>
                </TableRow>
              )}
              {items.map((c) => (
                <TableRow key={c.id} className="border-0 hover:bg-muted/40 transition-colors">
                  <TableCell className="font-semibold py-5">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.template_slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(() => {
                    const ids = (c.segment_ids && c.segment_ids.length > 0) ? c.segment_ids : (c.segment_id ? [c.segment_id] : []);
                    if (ids.length === 0) return "Todos";
                    const names = ids.map((id) => segments.find((s) => s.id === id)?.name).filter(Boolean) as string[];
                    if (names.length === 0) return "—";
                    if (names.length === 1) return names[0];
                    return `${names[0]} +${names.length - 1}`;
                  })()}</TableCell>

                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="tabular-nums">
                    <div className="text-sm font-medium">{c.sent_count} / {c.total_recipients}</div>
                    {progressBar(c)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.scheduled_for ? new Date(c.scheduled_for).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "sending" ? (
                        <Button size="sm" variant="outline" onClick={() => setLiveId(c.id)} className="rounded-lg">
                          <span className="mr-1.5"><LivePulseDot /></span>
                          Ao vivo
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReporting(c)} className="rounded-lg">
                          <BarChart3 className="mr-1 h-3 w-3" />Relatório
                        </Button>
                      )}
                      {["draft", "scheduled"].includes(c.status) && (
                        <Button size="icon" variant="ghost" onClick={() => setEditing(c)} title="Editar" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {["draft", "scheduled"].includes(c.status) && (
                        <Button size="icon" variant="ghost" onClick={() => dispatch(c)} disabled={busy} title="Enviar agora" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {["sending", "scheduled"].includes(c.status) && (
                        <Button size="icon" variant="ghost" onClick={() => pause(c)} disabled={busy} title="Pausar" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {c.status === "paused" && (
                        <Button size="icon" variant="ghost" onClick={() => resume(c)} disabled={busy} title="Retomar" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => duplicate(c)} disabled={busy} title="Duplicar" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c)} title="Excluir" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager page={page} total={total} onPageChange={setPage} />
        </div>


      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 overflow-y-auto px-1 -mx-1 py-1 flex-1">
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
                <Label>Nome de exibição (De)</Label>
                <Input
                  placeholder="Ex.: Clínica Ór"
                  value={editing.from_name_override ?? ""}
                  onChange={(e) => setEditing({ ...editing, from_name_override: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Sobrescreve o nome do remetente do template só nesta campanha. Deixe vazio para usar o do template.
                </p>
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
              {clinicId && (
                <CampaignRecipientsPreview clinicId={clinicId} segmentId={editing.segment_id} />
              )}
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

      <CampaignLiveDialog
        campaignId={liveId}
        open={!!liveId}
        onOpenChange={(o) => !o && setLiveId(null)}
      />
    </div>
  );
}
