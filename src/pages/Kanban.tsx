import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { useStages, useLeads } from "@/hooks/useCrm";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Stage } from "@/types/crm";
import { Plus, MessageCircle, Phone, MoreVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import LeadDrawer from "./LeadDrawer";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "agora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function formatMoney(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { type: "lead", lead } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const initials = (lead.name || lead.phone).slice(0, 2).toUpperCase();
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium">{lead.name || lead.phone}</div>
            {lead.unread_count > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{lead.unread_count}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" /> {lead.phone}
          </div>
        </div>
      </div>
      {lead.last_message_preview && (
        <div className="mt-2 line-clamp-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          {lead.last_message_preview}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {timeAgo(lead.last_message_at)}</span>
        {lead.deal_value != null && <span className="font-medium text-foreground">{formatMoney(lead.deal_value)}</span>}
      </div>
    </div>
  );
}

function Column({ stage, leads, onOpenLead }: { stage: Stage; leads: Lead[]; onOpenLead: (l: Lead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage", stage } });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
          <span className="text-sm font-semibold">{stage.name}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`scrollbar-thin flex-1 space-y-2 overflow-y-auto rounded-lg border-2 border-dashed p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((l) => <LeadCard key={l.id} lead={l} onOpen={onOpenLead} />)}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">vazio</div>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { stages, setStages } = useStages();
  const { leads, setLeads } = useLeads();
  const [active, setActive] = useState<Lead | null>(null);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onStart(e: DragStartEvent) {
    const lead = leads.find((l) => l.id === e.active.id);
    if (lead) setActive(lead);
  }

  async function onEnd(e: DragEndEvent) {
    setActive(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;
    const overData: any = over.data.current;
    let targetStageId = lead.stage_id;
    if (overData?.type === "stage") targetStageId = overData.stage.id;
    else if (overData?.type === "lead") targetStageId = overData.lead.stage_id;
    if (!targetStageId || targetStageId === lead.stage_id) return;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: targetStageId } : l));
    await supabase.from("leads").update({ stage_id: targetStageId }).eq("id", lead.id);
  }

  async function addColumn() {
    if (!newColName.trim()) return;
    const pos = (stages[stages.length - 1]?.position ?? -1) + 1;
    await supabase.from("pipeline_stages").insert({ name: newColName.trim(), position: pos });
    setNewColName(""); setNewColOpen(false);
  }

  async function addLead() {
    if (!newLead.phone.trim()) { toast.error("Telefone obrigatório"); return; }
    setCreating(true);
    const stage = stages[0];
    const phone = newLead.phone.replace(/\D/g, "");
    const { error } = await supabase.from("leads").insert({
      phone, name: newLead.name.trim() || null, stage_id: stage?.id ?? null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setNewLead({ name: "", phone: "" });
    setNewLeadOpen(false);
    toast.success("Lead criado");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Pipeline de vendas</h1>
          <p className="text-xs text-muted-foreground">{leads.length} leads · {stages.length} etapas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewColOpen(true)}><Plus className="mr-1 h-4 w-4" />Nova coluna</Button>
          <Button size="sm" onClick={() => setNewLeadOpen(true)}><Plus className="mr-1 h-4 w-4" />Novo lead</Button>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd}>
          <div className="flex h-full gap-3">
            {stages.map((s) => (
              <Column key={s.id} stage={s} leads={leads.filter((l) => l.stage_id === s.id)} onOpenLead={setOpenLead} />
            ))}
            {stages.length === 0 && (
              <div className="m-auto text-sm text-muted-foreground">Nenhuma etapa. Crie sua primeira coluna.</div>
            )}
          </div>
          <DragOverlay>
            {active && <div className="rotate-2"><LeadCard lead={active} onOpen={() => {}} /></div>}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} />

      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader>
          <Input placeholder="Nome da etapa" value={newColName} onChange={(e) => setNewColName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && addColumn()} />
          <DialogFooter><Button onClick={addColumn}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone (com DDI)</Label><Input placeholder="5511999999999" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={addLead} disabled={creating}>{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
