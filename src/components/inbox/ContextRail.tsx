import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Attendant, Lead, LeadEvent, Stage } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Trash2, Archive, ArchiveRestore, X, Phone, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ContextRail({ lead, stages, attendants }: { lead: Lead; stages: Stage[]; attendants: Attendant[] }) {
  const nav = useNavigate();
  const [form, setForm] = useState<Partial<Lead>>(lead);
  const [tagInput, setTagInput] = useState("");
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setForm(lead);
    setTagInput("");
  }, [lead.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (active && data) setEvents(data as LeadEvent[]);
    })();
    return () => { active = false; };
  }, [lead.id]);

  async function patch(p: Partial<Lead>) {
    setForm((f) => ({ ...f, ...p }));
    await supabase.from("leads").update(p).eq("id", lead.id);
  }

  // Auto-save notes (debounced)
  useEffect(() => {
    if (form.notes === lead.notes) return;
    setSavingNotes(true);
    const t = setTimeout(async () => {
      await supabase.from("leads").update({ notes: form.notes ?? null }).eq("id", lead.id);
      setSavingNotes(false);
    }, 800);
    return () => { clearTimeout(t); setSavingNotes(false); };
  }, [form.notes, lead.id, lead.notes]);

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    const next = Array.from(new Set([...(form.tags ?? []), v]));
    patch({ tags: next });
    setTagInput("");
  }

  function removeTag(t: string) {
    patch({ tags: (form.tags ?? []).filter((x) => x !== t) });
  }

  async function toggleArchive() {
    await patch({ archived_at: lead.archived_at ? null : (new Date().toISOString() as any) });
  }

  async function remove() {
    if (!confirm("Excluir este lead e todo o histórico?")) return;
    await supabase.from("leads").delete().eq("id", lead.id);
    nav("/inbox");
  }

  const stage = stages.find((s) => s.id === lead.stage_id);

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {(lead.name || lead.phone).slice(0, 2).toUpperCase()}
          </div>
          <Input
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => patch({ name: form.name ?? null })}
            placeholder="Nome do lead"
            className="mt-2 border-0 text-center text-sm font-semibold focus-visible:ring-0"
          />
          <button
            onClick={() => { navigator.clipboard.writeText(lead.phone); toast.success("Telefone copiado"); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3 w-3" /> {lead.phone} <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Etapa</Label>
            <Select value={form.stage_id ?? undefined} onValueChange={(v) => patch({ stage_id: v })}>
              <SelectTrigger className="h-9">
                <SelectValue>
                  {stage ? (
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                      {stage.name}
                    </span>
                  ) : "Selecionar"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Atendente</Label>
            <Select
              value={form.attendant_id ?? "__none"}
              onValueChange={(v) => patch({ attendant_id: v === "__none" ? null : v })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Não atribuído" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Não atribuído</SelectItem>
                {attendants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor (R$)</Label>
            <Input
              type="number"
              value={form.deal_value ?? ""}
              onChange={(e) => setForm({ ...form, deal_value: e.target.value ? Number(e.target.value) : null })}
              onBlur={() => patch({ deal_value: form.deal_value ?? null })}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />E-mail</Label>
            <Input
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => patch({ email: form.email ?? null })}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground"><Building2 className="mr-1 inline h-3 w-3" />Empresa</Label>
            <Input
              value={form.company ?? ""}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              onBlur={() => patch({ company: form.company ?? null })}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {(form.tags ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  #{t}
                  <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Adicionar tag e Enter"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              Notas {savingNotes && <span className="lowercase">salvando…</span>}
            </Label>
            <Textarea
              rows={4}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>

        {events.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Atividade recente</div>
            <ul className="space-y-1.5 text-xs">
              {events.map((e) => {
                let label = e.type;
                if (e.type === "stage_changed") {
                  const to = stages.find((s) => s.id === e.payload?.to)?.name;
                  label = `Etapa → ${to ?? "—"}`;
                } else if (e.type === "attendant_changed") {
                  const to = attendants.find((a) => a.id === e.payload?.to)?.name;
                  label = `Atendente → ${to ?? "—"}`;
                }
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 text-[10px]">{timeAgo(e.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={toggleArchive}>
            {lead.archived_at ? <><ArchiveRestore className="mr-2 h-4 w-4" />Desarquivar</> : <><Archive className="mr-2 h-4 w-4" />Arquivar</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />Excluir lead
          </Button>
        </div>
      </div>
    </div>
  );
}
