import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Pencil, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useDialogs";

export type Persona = {
  id: string;
  clinic_id: string;
  agent_id: string | null;
  name: string;
  phone: string | null;
  channel: string;
  persona_text: string | null;
  custom_fields: Record<string, string>;
  opening_message: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

interface Props {
  agentId: string;
  clinicId: string | null;
}

const CHANNELS = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "instagram", l: "Instagram" },
  { v: "widget", l: "Widget" },
  { v: "sms", l: "SMS" },
];

type FormState = {
  id: string | null;
  name: string;
  phone: string;
  channel: string;
  persona_text: string;
  opening_message: string;
  custom_fields: Record<string, string>;
  tags: string[];
  scope_all: boolean; // null agent_id (global na clínica) ou específico do agente
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  phone: "",
  channel: "whatsapp",
  persona_text: "",
  opening_message: "",
  custom_fields: {},
  tags: [],
  scope_all: false,
};

export function PersonasPanel({ agentId, clinicId }: Props) {
  const confirm = useConfirm();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [ckey, setCkey] = useState("");
  const [cval, setCval] = useState("");

  async function load() {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_personas")
      .select("*")
      .or(`agent_id.eq.${agentId},agent_id.is.null`)
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPersonas((data ?? []) as unknown as Persona[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, clinicId]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setTagInput("");
    setCkey("");
    setCval("");
    setDialogOpen(true);
  }

  function openEdit(p: Persona) {
    setForm({
      id: p.id,
      name: p.name,
      phone: p.phone ?? "",
      channel: p.channel,
      persona_text: p.persona_text ?? "",
      opening_message: p.opening_message ?? "",
      custom_fields: p.custom_fields ?? {},
      tags: p.tags ?? [],
      scope_all: p.agent_id === null,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Dê um nome para a persona.");
      return;
    }
    setSaving(true);
    const payload = {
      agent_id: form.scope_all ? null : agentId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      channel: form.channel,
      persona_text: form.persona_text.trim() || null,
      opening_message: form.opening_message.trim() || null,
      custom_fields: form.custom_fields,
      tags: form.tags,
    };
    const res = form.id
      ? await supabase.from("agent_personas").update(payload).eq("id", form.id)
      : await supabase.from("agent_personas").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(form.id ? "Persona atualizada." : "Persona criada.");
    setDialogOpen(false);
    load();
  }

  async function remove(p: Persona) {
    const ok = await confirm({
      title: "Excluir persona?",
      description: `"${p.name}" será removida.`,
      confirmText: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("agent_personas").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Persona excluída.");
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Personas reutilizáveis para testar este agente. Cada persona pode ser carregada no Test Lab em 1 clique.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Nova persona
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : personas.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          Nenhuma persona ainda. Crie uma para reusar nos testes.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {personas.map((p) => (
            <div key={p.id} className="rounded-md border bg-card p-3 text-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate font-semibold">{p.name}</span>
                    {p.agent_id === null && (
                      <Badge variant="outline" className="text-[9px]">global</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.channel}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => remove(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {p.persona_text && (
                <p className="mb-1 line-clamp-2 text-xs text-muted-foreground italic">{p.persona_text}</p>
              )}
              {p.opening_message && (
                <div className="mt-1 flex items-start gap-1 rounded bg-muted/50 p-1.5 text-[11px]">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{p.opening_message}</span>
                </div>
              )}
              {p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar persona" : "Nova persona"}</DialogTitle>
            <DialogDescription className="text-xs">
              Descreva um lead típico. O texto da persona vira o contexto que o agente recebe quando você carrega ela no Test Lab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição da persona</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: mulher 35a, mãe, busca tratamento estético, sensível a preço, já comparou concorrentes"
                value={form.persona_text}
                onChange={(e) => setForm({ ...form, persona_text: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem de abertura (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="A primeira mensagem que o lead enviaria. Será pré-preenchida no Test Lab."
                value={form.opening_message}
                onChange={(e) => setForm({ ...form, opening_message: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Campos customizados</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(form.custom_fields).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="gap-1 text-[10px]">
                    <span className="font-semibold">{k}:</span> {v}
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...form.custom_fields };
                        delete next[k];
                        setForm({ ...form, custom_fields: next });
                      }}
                      className="ml-1 hover:text-destructive"
                    >×</button>
                  </Badge>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                <Input className="h-8 text-xs" placeholder="campo" value={ckey} onChange={(e) => setCkey(e.target.value)} />
                <Input className="h-8 text-xs" placeholder="valor" value={cval} onChange={(e) => setCval(e.target.value)} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const k = ckey.trim(); const v = cval.trim();
                    if (!k || !v) return;
                    setForm({ ...form, custom_fields: { ...form.custom_fields, [k]: v } });
                    setCkey(""); setCval("");
                  }}
                >+ campo</Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Tags</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {form.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-[10px]">
                    {t}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}
                      className="ml-1 hover:text-destructive"
                    >×</button>
                  </Badge>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="adicionar tag (Enter)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = tagInput.trim();
                      if (t && !form.tags.includes(t)) {
                        setForm({ ...form, tags: [...form.tags, t] });
                      }
                      setTagInput("");
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded border bg-muted/30 p-2">
              <Switch
                checked={form.scope_all}
                onCheckedChange={(v) => setForm({ ...form, scope_all: v })}
              />
              <div className="text-xs">
                <div className="font-medium">Disponível para todos os agentes da clínica</div>
                <div className="text-muted-foreground">
                  Quando desligado, esta persona aparece só neste agente.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
