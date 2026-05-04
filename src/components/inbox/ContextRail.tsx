import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Attendant, CustomFieldDef, Lead, LeadEvent, Stage } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Copy, Trash2, Archive, ArchiveRestore, X, Phone, Mail, Building2, Bot, History, Sparkles, Pin, PinOff, Loader2, GitBranch, UserCheck, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CustomFieldsPanel from "./CustomFieldsPanel";
import LeadTasksPanel from "./LeadTasksPanel";
import ScheduledMessagesPanel from "./ScheduledMessagesPanel";
import { useConfirm } from "@/hooks/useDialogs";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ContextRail({ lead, stages, attendants, onClose }: { lead: Lead; stages: Stage[]; attendants: Attendant[]; onClose?: () => void }) {
  const nav = useNavigate();
  const [form, setForm] = useState<Partial<Lead>>(lead);
  const [tagInput, setTagInput] = useState("");
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [aiCfg, setAiCfg] = useState<{ agent_id: string | null; auto_reply: boolean }>({ agent_id: null, auto_reply: false });
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [customDefs, setCustomDefs] = useState<CustomFieldDef[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(lead.ai_summary ?? null);

  useEffect(() => { setSummary(lead.ai_summary ?? null); }, [lead.id, lead.ai_summary]);

  async function generateSummary() {
    setSummarizing(true);
    const { data, error } = await supabase.functions.invoke("ai-assist", { body: { lead_id: lead.id, mode: "summary" } });
    setSummarizing(false);
    if (error || (data as any)?.error) {
      toast.error("Falha IA: " + (error?.message || (data as any)?.error));
      return;
    }
    setSummary((data as any)?.summary ?? "");
  }

  async function togglePin() {
    await patch({ pinned_at: lead.pinned_at ? null : (new Date().toISOString() as any) });
  }
  async function toggleUnread() {
    if (lead.marked_unread || (lead.unread_count ?? 0) > 0) {
      await patch({ marked_unread: false, unread_count: 0 } as any);
    } else {
      await patch({ marked_unread: true } as any);
    }
  }

  useEffect(() => {
    setForm(lead);
    setTagInput("");
  }, [lead.id]);

  const [eventsExpanded, setEventsExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: ev }, { data: ag }, { data: cfg }, { data: defs }] = await Promise.all([
        supabase.from("lead_events").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("ai_agents").select("id, name").eq("enabled", true).order("name"),
        supabase.from("lead_ai_settings").select("agent_id, auto_reply").eq("lead_id", lead.id).maybeSingle(),
        supabase.from("lead_custom_fields").select("*").order("position", { ascending: true }),
      ]);
      if (!active) return;
      if (ev) setEvents(ev as LeadEvent[]);
      setAgents(ag ?? []);
      setAiCfg({ agent_id: cfg?.agent_id ?? null, auto_reply: cfg?.auto_reply ?? false });
      setCustomDefs((defs ?? []) as any);
    })();
    // Realtime: append new events
    const ch = supabase
      .channel(`lead-events-${lead.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_events", filter: `lead_id=eq.${lead.id}` }, (p) => {
        setEvents((cur) => [p.new as LeadEvent, ...cur]);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [lead.id]);

  async function saveAiCfg(next: { agent_id: string | null; auto_reply: boolean }) {
    setAiCfg(next);
    await supabase.from("lead_ai_settings").upsert({
      lead_id: lead.id,
      agent_id: next.agent_id,
      auto_reply: next.auto_reply,
    }, { onConflict: "lead_id" });
  }

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
    if (!(await confirm({ title: "Excluir este lead?", description: "Todo o histórico de conversa será removido. Esta ação é irreversível.", confirmLabel: "Excluir definitivamente", destructive: true, requireTyping: "EXCLUIR" }))) return;
    await supabase.from("leads").delete().eq("id", lead.id);
    nav("/inbox");
  }

  const stage = stages.find((s) => s.id === lead.stage_id);

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-3 py-2">
        <div className="text-xs font-semibold text-muted-foreground">Perfil</div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={togglePin} title={lead.pinned_at ? "Desafixar" : "Fixar no topo"} className="h-7 w-7">
            {lead.pinned_at ? <PinOff className="h-4 w-4 text-amber-500" /> : <Pin className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} title="Fechar perfil" className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
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

        <div className="rounded-md border bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Resumo IA
            </Label>
            <Button variant="ghost" size="sm" onClick={generateSummary} disabled={summarizing} className="h-6 px-2 text-[11px]">
              {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : (summary ? "Atualizar" : "Gerar")}
            </Button>
          </div>
          {summary ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{summary}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Gere um resumo automático da conversa.</p>
          )}
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

        <CustomFieldsPanel
          lead={lead}
          fields={customDefs}
          onChange={(next) => setForm((f) => ({ ...f, custom_fields: next }))}
        />

        <LeadTasksPanel leadId={lead.id} />
        <ScheduledMessagesPanel leadId={lead.id} />

        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Bot className="h-3 w-3" /> Auto-resposta IA
            </Label>
            <Switch
              checked={aiCfg.auto_reply}
              disabled={agents.length === 0}
              onCheckedChange={(v) => saveAiCfg({ ...aiCfg, auto_reply: v })}
            />
          </div>
          {agents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Crie um agente em Agentes IA para ativar.</p>
          ) : (
            <Select
              value={aiCfg.agent_id ?? "__none"}
              onValueChange={(v) => saveAiCfg({ ...aiCfg, agent_id: v === "__none" ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem agente</SelectItem>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <button
            onClick={async () => {
              const next = !showHistory;
              setShowHistory(next);
              if (next && aiHistory.length === 0) {
                const { data: thr } = await supabase
                  .from("ai_threads").select("id").eq("lead_id", lead.id)
                  .order("updated_at", { ascending: false }).limit(1).maybeSingle();
                if (thr?.id) {
                  const { data: msgs } = await supabase
                    .from("ai_messages").select("role, content, tool_calls, created_at")
                    .eq("thread_id", thr.id).order("created_at", { ascending: true }).limit(50);
                  setAiHistory(msgs ?? []);
                }
              }
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" />
            {showHistory ? "Ocultar histórico IA" : "Ver histórico IA"}
          </button>
          {showHistory && (
            <div className="space-y-1.5 rounded border bg-background p-2 max-h-64 overflow-y-auto">
              {aiHistory.length === 0 && <p className="text-[11px] text-muted-foreground">Sem histórico ainda.</p>}
              {aiHistory.map((m, i) => (
                <div key={i} className="text-[11px]">
                  <span className="font-semibold">
                    {m.role === "assistant" ? "🤖" : m.role === "tool" ? "🔧" : m.role === "user" ? "👤" : m.role}
                  </span>{" "}
                  {m.tool_calls
                    ? <span className="text-muted-foreground italic">tool: {(m.tool_calls as any)?.[0]?.function?.name}</span>
                    : <span className="whitespace-pre-wrap">{m.content?.slice(0, 280)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Linha do tempo</span>
              {events.length > 5 && (
                <button onClick={() => setEventsExpanded((v) => !v)} className="flex items-center gap-0.5 normal-case hover:text-foreground">
                  {eventsExpanded ? <>Menos <ChevronUp className="h-3 w-3" /></> : <>Tudo ({events.length}) <ChevronDown className="h-3 w-3" /></>}
                </button>
              )}
            </div>
            <ol className="relative space-y-2 border-l border-border pl-4 text-xs">
              {(eventsExpanded ? events : events.slice(0, 5)).map((e) => {
                let label = e.type;
                let Icon: any = Activity;
                let color = "bg-muted-foreground";
                if (e.type === "stage_changed") {
                  const to = stages.find((s) => s.id === e.payload?.to);
                  label = `Etapa → ${to?.name ?? "—"}`;
                  Icon = GitBranch;
                  color = "bg-primary";
                } else if (e.type === "attendant_changed") {
                  const to = attendants.find((a) => a.id === e.payload?.to);
                  label = `Atendente → ${to?.name ?? "—"}`;
                  Icon = UserCheck;
                  color = "bg-emerald-500";
                }
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ${color} text-[8px] text-white`}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-foreground/90">{label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={toggleUnread}>
            <Mail className="mr-2 h-4 w-4" />
            {(lead.marked_unread || (lead.unread_count ?? 0) > 0) ? "Marcar como lida" : "Marcar como não lida"}
          </Button>
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
