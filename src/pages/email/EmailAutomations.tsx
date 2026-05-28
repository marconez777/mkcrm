import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { Plus, Trash2, Loader2, BarChart3 } from "lucide-react";
import { AutomationReportDialog } from "@/components/email/AutomationReportDialog";
import { useConfirm } from "@/hooks/useDialogs";

type Step = { template_slug: string; delay_minutes: number };
type Automation = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  steps: Step[];
  active: boolean;
  preset_key: string | null;
};
type Tpl = { id: string; slug: string; name: string };
type Segment = { id: string; name: string };

const toDays = (m: number) => Math.floor((m || 0) / 1440);
const toHours = (m: number) => Math.floor(((m || 0) % 1440) / 60);
const toMinutes = (d: number, h: number) => (Math.max(0, d) * 1440) + (Math.max(0, Math.min(23, h)) * 60);


const TRIGGERS = [
  { value: "lead_created", label: "Lead criado" },
  { value: "segment_contact_added", label: "Adicionado ao segmento" },
  { value: "lead_stage_changed", label: "Lead mudou de estágio" },
  { value: "lead_tag_added", label: "Tag adicionada ao lead" },
];

export default function EmailAutomations() {
  const { membership } = useAuth();
  const confirm = useConfirm();
  const clinicId = membership?.clinic_id;
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [reporting, setReporting] = useState<Automation | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!clinicId) return;
    const [{ data: a }, { data: t }, { data: s }] = await Promise.all([
      supabase.from("email_automations").select("*").order("created_at", { ascending: false }),
      supabase.from("email_templates").select("id,slug,name").eq("active", true).order("name"),
      supabase.from("email_segments").select("id,name").eq("clinic_id", clinicId).order("name"),
    ]);
    setItems((a ?? []) as any);
    setTemplates((t ?? []) as any);
    setSegments((s ?? []) as any);
  }

  useEffect(() => { if (clinicId) load(); }, [clinicId]);
  useEffect(() => { document.title = "Email — Automações"; }, []);


  function startCreate() {
    setEditing({
      id: "", name: "", description: "", trigger_type: "lead_created",
      trigger_config: {}, steps: [{ template_slug: "", delay_minutes: 0 }],
      active: false, preset_key: null,
    });
  }

  async function save() {
    if (!editing || !clinicId) return;
    setBusy(true);
    try {
      const payload = {
        clinic_id: clinicId,
        name: editing.name,
        description: editing.description,
        trigger_type: editing.trigger_type,
        trigger_config: editing.trigger_config,
        steps: editing.steps,
        active: editing.active,
        preset_key: editing.preset_key,
      };
      const q = editing.id
        ? supabase.from("email_automations").update(payload).eq("id", editing.id)
        : supabase.from("email_automations").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success("Automação salva");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: Automation) {
    const { error } = await supabase.from("email_automations").update({ active: !a.active }).eq("id", a.id);
    if (error) toast.error(error.message); else load();
  }

  async function remove(a: Automation) {
    if (!(await confirm({ title: `Excluir automação "${a.name}"?`, confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("email_automations").delete().eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  }

  const custom = items.filter((i) => !i.preset_key);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Automações de Email</h1>
        <p className="text-sm text-muted-foreground">Dispare emails automaticamente baseado em eventos.</p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-end">
          <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Nova automação</Button>
        </div>
        {custom.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma automação personalizada</Card>
        ) : (
          <div className="space-y-2">
            {custom.map((a) => (
              <Card key={a.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {TRIGGERS.find((t) => t.value === a.trigger_type)?.label ?? a.trigger_type}
                    </Badge>
                    <Badge variant={a.active ? "default" : "secondary"} className="text-[10px]">
                      {a.active ? "Ativa" : "Pausada"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.steps?.length ?? 0} passo(s)</p>
                </div>
                <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
                <Button size="sm" variant="outline" onClick={() => setReporting(a)}>
                  <BarChart3 className="mr-1 h-3 w-3" />Relatório
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...a })}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-3 w-3" /></Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar automação" : "Nova automação"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Disparo</Label>
                <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Segmento {editing.trigger_type === "segment_contact_added" ? "(obrigatório)" : "(opcional)"}</Label>
                <Select
                  value={editing.trigger_config?.segment_id ?? "__all__"}
                  onValueChange={(v) => setEditing({
                    ...editing,
                    trigger_config: { ...editing.trigger_config, segment_id: v === "__all__" ? null : v },
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editing.trigger_type !== "segment_contact_added" && (
                      <SelectItem value="__all__">Todos os leads (sem filtro)</SelectItem>
                    )}
                    {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {editing.trigger_type === "segment_contact_added"
                    ? "Dispara sempre que um contato é adicionado a este segmento (independente da idade do lead)."
                    : "Filtra os leads que entram nesta automação."}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Passos</Label>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { template_slug: "", delay_minutes: 60 * 24 }] })}>
                    <Plus className="mr-1 h-3 w-3" />Passo
                  </Button>
                </div>
                {editing.steps.map((s, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        Passo {i + 1}
                        <span className="ml-2 font-normal text-[10px] text-muted-foreground">
                          {i === 0 ? "após entrada do lead" : "após o passo anterior"}
                        </span>
                      </span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Template</Label>
                        <Select value={s.template_slug} onValueChange={(v) => {
                          const next = [...editing.steps]; next[i] = { ...s, template_slug: v };
                          setEditing({ ...editing, steps: next });
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Atraso</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={0}
                            value={toDays(s.delay_minutes)}
                            onChange={(e) => {
                              const next = [...editing.steps];
                              next[i] = { ...s, delay_minutes: toMinutes(Number(e.target.value), toHours(s.delay_minutes)) };
                              setEditing({ ...editing, steps: next });
                            }}
                            className="h-8"
                          />
                          <span className="text-xs text-muted-foreground">d</span>
                          <Input
                            type="number" min={0} max={23}
                            value={toHours(s.delay_minutes)}
                            onChange={(e) => {
                              const next = [...editing.steps];
                              next[i] = { ...s, delay_minutes: toMinutes(toDays(s.delay_minutes), Number(e.target.value)) };
                              setEditing({ ...editing, steps: next });
                            }}
                            className="h-8"
                          />
                          <span className="text-xs text-muted-foreground">h</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <span className="text-sm">Ativar automação</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AutomationReportDialog
        automation={reporting}
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
      />
    </div>
  );
}
