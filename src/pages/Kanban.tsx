import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, closestCorners,
} from "@dnd-kit/core";

// Custom sensor: only activate drag-and-drop when the pointer originates on a lead card.
// This frees the rest of the board (background, headers, empty space) for the
// horizontal pan gesture handled by useHorizontalScroll.
class CardOnlyPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        if (event.button !== 0) return false;
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        if (!target.closest("[data-kanban-card]")) return false;
        // ignore clicks on interactive children inside a card
        if (target.closest("button, a, input, textarea, select, [role='menuitem']")) return false;
        return true;
      },
    },
  ];
}
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { useStages, useLeads } from "@/hooks/useCrm";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Stage } from "@/types/crm";
import { Plus, MessageCircle, Phone, Loader2, ChevronLeft, ChevronRight, Minimize2, Maximize2, Rows3, Rows2, MoreVertical, Pencil, Trash2, ArrowRightLeft, Search, X, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import LeadDrawer from "./LeadDrawer";
import MoveLeadDialog from "@/components/kanban/MoveLeadDialog";
import MoveColumnLeadsDialog from "@/components/kanban/MoveColumnLeadsDialog";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";

import PipelineSwitcher from "@/components/kanban/PipelineSwitcher";
import NewPipelineDialog from "@/components/kanban/NewPipelineDialog";

import EditPipelineDialog from "@/components/kanban/EditPipelineDialog";
import EditStageDialog from "@/components/kanban/EditStageDialog";
import { usePipelines } from "@/hooks/usePipelines";
import PipelineDateFilter, { EMPTY_DATE_FILTER, presetToValue, type DateFilterValue } from "@/components/kanban/PipelineDateFilter";

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

const EMPTY_LEADS: Lead[] = [];

const UI_KEY = "pipeline:ui:v1";
type SavedUi = { collapsed: string[]; compact: boolean; dateFilterPreset?: string | null; dateFilterCustom?: { from: string; to: string } | null };
function loadUi(): SavedUi {
  try { return { collapsed: [], compact: false, ...JSON.parse(localStorage.getItem(UI_KEY) || "{}") }; }
  catch { return { collapsed: [], compact: false }; }
}
function saveUi(ui: SavedUi) {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {}
}

function loadInitialDateFilter(ui: SavedUi): DateFilterValue {
  if (ui.dateFilterPreset && ui.dateFilterPreset !== "custom" && !ui.dateFilterPreset.startsWith("m:")) {
    return presetToValue(ui.dateFilterPreset);
  }
  if (ui.dateFilterPreset?.startsWith("m:") && ui.dateFilterCustom) {
    const from = new Date(ui.dateFilterCustom.from);
    const to = new Date(ui.dateFilterCustom.to);
    return { from, to, label: from.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }), preset: ui.dateFilterPreset };
  }
  if (ui.dateFilterPreset === "custom" && ui.dateFilterCustom) {
    const from = new Date(ui.dateFilterCustom.from);
    const to = new Date(ui.dateFilterCustom.to);
    const label = from.getTime() === to.getTime()
      ? from.toLocaleDateString("pt-BR")
      : `${from.toLocaleDateString("pt-BR")}–${to.toLocaleDateString("pt-BR")}`;
    return { from, to, label, preset: "custom" };
  }
  return EMPTY_DATE_FILTER;
}

type LeadCardProps = {
  lead: Lead;
  onOpen: (l: Lead) => void;
  onMove: (l: Lead) => void;
  onMoveToStage?: (l: Lead, stageId: string) => void;
  stages?: Stage[];
  compact?: boolean;
};

const LeadCard = memo(forwardRef<HTMLDivElement, LeadCardProps>(function LeadCard(
  { lead, onOpen, onMove, onMoveToStage, stages, compact },
  _ref,
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { type: "lead", lead } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const initials = (lead.name || lead.phone).slice(0, 2).toUpperCase();
  const otherStages = useMemo(() => (stages ?? []).filter((s) => s.id !== lead.stage_id), [stages, lead.stage_id]);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      data-kanban-card
      className={`kanban-card group relative cursor-pointer rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md ${compact ? "p-2" : "p-3"}`}
    >
      <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              title="Mais ações"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onMoveToStage && otherStages.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Columns3 className="mr-2 h-3.5 w-3.5" />Mover para coluna
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    {otherStages.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onSelect={(e) => { e.preventDefault(); setTimeout(() => onMoveToStage(lead, s.id), 0); }}
                      >
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color || "hsl(var(--muted-foreground))" }} />
                        <span className="truncate">{s.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onMove(lead), 0); }}>
              <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />Mover para outro funil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-start gap-2">
        <div className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium">{lead.name || lead.phone}</div>
            {lead.unread_count > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{lead.unread_count}</span>
            )}
          </div>
          {!compact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {lead.phone}
            </div>
          )}
        </div>
      </div>
      {!compact && lead.last_message_preview && (
        <div className="mt-2 line-clamp-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          {lead.last_message_preview}
        </div>
      )}
      <div className={`flex items-center justify-between text-[11px] text-muted-foreground ${compact ? "mt-1" : "mt-2"}`}>
        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {timeAgo(lead.last_message_at)}</span>
        {lead.created_at && (
          <span title="Data de entrada do lead">
            {new Date(lead.created_at).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}), (prev, next) => {
  if (prev.compact !== next.compact) return false;
  if (prev.onOpen !== next.onOpen) return false;
  if (prev.onMove !== next.onMove) return false;
  if (prev.onMoveToStage !== next.onMoveToStage) return false;
  if (prev.stages !== next.stages) return false;
  const a = prev.lead, b = next.lead;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.phone === b.phone &&
    a.last_message_at === b.last_message_at &&
    a.last_message_preview === b.last_message_preview &&
    a.unread_count === b.unread_count &&
    a.pinned_at === b.pinned_at &&
    a.stage_id === b.stage_id &&
    a.position === b.position &&
    a.created_at === b.created_at &&
    a.deal_value === b.deal_value
  );
});

function Column({
  stage, leads, onOpenLead, onMoveLead, onMoveLeadToStage, allStages, collapsed, onToggleCollapse, compact, onEdit, onDelete,
}: {
  stage: Stage; leads: Lead[]; onOpenLead: (l: Lead) => void; onMoveLead: (l: Lead) => void;
  onMoveLeadToStage: (l: Lead, stageId: string) => void; allStages: Stage[];
  collapsed: boolean; onToggleCollapse: () => void; compact: boolean;
  onEdit: (s: Stage) => void; onDelete: (s: Stage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage", stage } });
  const totalValue = leads.reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(stage.name);
  useEffect(() => { setNameDraft(stage.name); }, [stage.name]);
  async function commitRename() {
    setRenaming(false);
    const v = nameDraft.trim();
    if (!v || v === stage.name) { setNameDraft(stage.name); return; }
    const { error } = await supabase.from("pipeline_stages").update({ name: v }).eq("id", stage.id);
    if (error) { toast.error(error.message); setNameDraft(stage.name); }
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1 text-muted-foreground hover:bg-accent" title="Mais ações" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onEdit(stage), 0); }}>
          <Pencil className="mr-2 h-3.5 w-3.5" />Editar etapa
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onDelete(stage), 0); }} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir etapa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (collapsed) {
    return (
      <div data-column-id={stage.id} className="kanban-snap flex w-10 shrink-0 flex-col items-center rounded-lg border bg-muted/30 py-2">
        <button onClick={onToggleCollapse} className="mb-1 rounded p-1 hover:bg-accent" title="Expandir">
          <Maximize2 className="h-4 w-4" />
        </button>
        {menu}
        <span className="mt-1 h-3 w-3 rounded-full ring-2 ring-background" style={{ background: stage.color || "hsl(var(--muted-foreground))" }} />
        <div className="mt-1 h-1 w-6 rounded-full" style={{ background: stage.color || "hsl(var(--muted-foreground))" }} />
        <div ref={setNodeRef} className={`mt-2 flex flex-1 flex-col items-center justify-start gap-1 ${isOver ? "bg-primary/10" : ""}`}>
          <div className="rotate-180 whitespace-nowrap text-sm font-bold [writing-mode:vertical-rl]">{stage.name}</div>
          <span className="mt-2 rounded bg-muted px-1.5 text-[11px] font-bold text-muted-foreground">{leads.length}</span>
        </div>
      </div>
    );
  }

  const stageColor = stage.color || "hsl(var(--muted-foreground))";
  return (
    <div data-column-id={stage.id} className="kanban-snap flex w-80 shrink-0 flex-col">
      <div className="mb-1.5 flex items-center justify-between px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background shadow-sm" style={{ background: stageColor }} />
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setNameDraft(stage.name); setRenaming(false); } }}
              className="min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-base font-bold outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <span
              className="truncate text-base font-bold"
              onDoubleClick={() => setRenaming(true)}
              title="Duplo-clique para renomear"
            >
              {stage.name}
            </span>
          )}
          <span className="text-sm font-medium text-muted-foreground">{leads.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {totalValue > 0 && (
            <span className="text-xs font-medium text-muted-foreground">{formatMoney(totalValue)}</span>
          )}
          <button onClick={onToggleCollapse} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Colapsar coluna">
            <Minimize2 className="h-4 w-4" />
          </button>
          {menu}
        </div>
      </div>
      <div className="mb-2 h-[3px] w-full rounded-full" style={{ background: stageColor }} />
      <VirtualizedColumnBody
        leads={leads}
        compact={compact}
        isOver={isOver}
        setDroppableRef={setNodeRef}
        onOpen={onOpenLead}
        onMove={onMoveLead}
        onMoveToStage={onMoveLeadToStage}
        allStages={allStages}
      />
    </div>
  );
}

function VirtualizedColumnBody({
  leads, compact, isOver, setDroppableRef, onOpen, onMove, onMoveToStage, allStages,
}: {
  leads: Lead[]; compact: boolean; isOver: boolean;
  setDroppableRef: (el: HTMLElement | null) => void;
  onOpen: (l: Lead) => void; onMove: (l: Lead) => void;
  onMoveToStage: (l: Lead, stageId: string) => void; allStages: Stage[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setDroppableRef(el);
  }, [setDroppableRef]);
  // Card aproximado: compacto ~58px, normal ~108px (com preview ainda mais). Gap de 8px.
  const estimate = compact ? 62 : 112;
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimate,
    overscan: 8,
    getItemKey: (i) => leads[i]?.id ?? i,
  });
  const items = virtualizer.getVirtualItems();
  const ids = useMemo(() => leads.map((l) => l.id), [leads]);

  return (
    <div
      ref={setRefs}
      data-kanban-column-body
      className={`scrollbar-thin flex-1 overflow-y-auto rounded-lg border-2 border-dashed p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {leads.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">vazio</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {items.map((v) => {
              const lead = leads[v.index];
              if (!lead) return null;
              return (
                <div
                  key={lead.id}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                    paddingBottom: 8,
                  }}
                >
                  <LeadCard
                    lead={lead}
                    onOpen={onOpen}
                    onMove={onMove}
                    onMoveToStage={onMoveToStage}
                    stages={allStages}
                    compact={compact}
                  />
                </div>
              );
            })}
          </div>
        )}
      </SortableContext>
    </div>
  );
}

export default function KanbanPage() {
  const { stages: allStages } = useStages();
  const { leads: allLeads, setLeads } = useLeads();
  const { pipelines, current, currentId, setCurrentId } = usePipelines();
  const [active, setActive] = useState<Lead | null>(null);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [movingLead, setMovingLead] = useState<Lead | null>(null);
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "" });
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  
  const [creating, setCreating] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [deletingStage, setDeletingStage] = useState<Stage | null>(null);
  const [ui, setUi] = useState(loadUi);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => loadInitialDateFilter(loadUi()));
  const [editPipelineOpen, setEditPipelineOpen] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState<{ id: string; name: string }[]>([]);
  const sensors = useSensors(useSensor(CardOnlyPointerSensor, { activationConstraint: { distance: 6 } }));
  const { ref: scrollRef, overflow, scrollByPage } = useHorizontalScroll();
  const [query, setQuery] = useState("");

  const stages = useMemo(() => allStages.filter((s) => s.pipeline_id === currentId), [allStages, currentId]);
  const allPipelineLeads = useMemo(() => allLeads.filter((l) => l.pipeline_id === currentId), [allLeads, currentId]);
  const dateFromMs = dateFilter.from?.getTime() ?? null;
  const dateToMs = dateFilter.to?.getTime() ?? null;
  const dateFiltered = useMemo(() => {
    if (dateFromMs == null) return allPipelineLeads;
    return allPipelineLeads.filter((l) => {
      if (!l.created_at) return false;
      const t = new Date(l.created_at).getTime();
      if (dateFromMs != null && t < dateFromMs) return false;
      if (dateToMs != null && t > dateToMs) return false;
      return true;
    });
  }, [allPipelineLeads, dateFromMs, dateToMs]);
  const normalizedQ = query.trim().toLowerCase();
  const phoneQ = normalizedQ.replace(/\D/g, "");
  const leads = useMemo(() => {
    if (!normalizedQ) return dateFiltered;
    return dateFiltered.filter((l) => {
      const name = (l.name ?? "").toLowerCase();
      const phone = (l.phone ?? "").replace(/\D/g, "");
      if (name.includes(normalizedQ)) return true;
      if (phoneQ && phone.includes(phoneQ)) return true;
      return false;
    });
  }, [dateFiltered, normalizedQ, phoneQ]);

  // Pré-agrupa leads por stage_id (já ordenado por pinned + última mensagem) uma única vez por render do pipeline.
  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const s of stages) map.set(s.id, []);
    for (const l of leads) {
      if (!l.stage_id) continue;
      const arr = map.get(l.stage_id);
      if (arr) arr.push(l);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ap = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
        const bp = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
        if (ap !== bp) return bp - ap;
        const al = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime();
        const bl = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime();
        return bl - al;
      });
    }
    return map;
  }, [stages, leads]);

  useEffect(() => {
    saveUi({
      ...ui,
      dateFilterPreset: dateFilter.preset ?? null,
      dateFilterCustom: dateFilter.from && dateFilter.to
        ? { from: dateFilter.from.toISOString(), to: dateFilter.to.toISOString() }
        : null,
    });
  }, [ui, dateFilter]);

  useEffect(() => {
    supabase.from("whatsapp_instances").select("id, name").then(({ data }) => {
      setWhatsappInstances((data ?? []) as any);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") {
        e.preventDefault();
        (document.getElementById("kanban-search") as HTMLInputElement | null)?.focus();
        return;
      }
      if (e.key === "ArrowRight") { scrollByPage(1); }
      else if (e.key === "ArrowLeft") { scrollByPage(-1); }
      else if (e.key === "Home") { scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" }); }
      else if (e.key === "End") { scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollByPage, scrollRef]);

  function toggleCollapsed(id: string) {
    setUi((u) => ({ ...u, collapsed: u.collapsed.includes(id) ? u.collapsed.filter((x) => x !== id) : [...u.collapsed, id] }));
  }

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
    const previousStageId = lead.stage_id;
    const previousPosition = lead.position ?? 0;
    const targetLeads = leads.filter((l) => l.stage_id === targetStageId);
    const newPosition = targetLeads.reduce((m, l) => Math.max(m, l.position ?? 0), -1) + 1;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: targetStageId, position: newPosition } : l));
    await supabase.from("leads").update({ stage_id: targetStageId, position: newPosition }).eq("id", lead.id);
    const target = stages.find((s) => s.id === targetStageId);
    toast.success(`Movido para "${target?.name ?? "etapa"}"`, {
      action: previousStageId ? {
        label: "Desfazer",
        onClick: async () => {
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: previousStageId, position: previousPosition } : l));
          await supabase.from("leads").update({ stage_id: previousStageId, position: previousPosition }).eq("id", lead.id);
        },
      } : undefined,
      duration: 6000,
    });
  }

  const moveLeadToStage = useCallback(async (lead: Lead, targetStageId: string) => {
    if (!targetStageId || targetStageId === lead.stage_id) return;
    const previousStageId = lead.stage_id;
    const previousPosition = lead.position ?? 0;
    const targetLeads = leads.filter((l) => l.stage_id === targetStageId);
    const newPosition = targetLeads.reduce((m, l) => Math.max(m, l.position ?? 0), -1) + 1;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: targetStageId, position: newPosition } : l));
    const { error } = await supabase.from("leads").update({ stage_id: targetStageId, position: newPosition }).eq("id", lead.id);
    if (error) {
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: previousStageId, position: previousPosition } : l));
      toast.error(error.message);
      return;
    }
    const target = allStages.find((s) => s.id === targetStageId);
    toast.success(`Movido para "${target?.name ?? "etapa"}"`, {
      action: previousStageId ? {
        label: "Desfazer",
        onClick: async () => {
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage_id: previousStageId, position: previousPosition } : l));
          await supabase.from("leads").update({ stage_id: previousStageId, position: previousPosition }).eq("id", lead.id);
        },
      } : undefined,
      duration: 6000,
    });
  }, [leads, allStages, setLeads]);

  const openLeadCb = useCallback((l: Lead) => setOpenLead(l), []);
  const openMoveCb = useCallback((l: Lead) => setMovingLead(l), []);
  const editStageCb = useCallback((s: Stage) => setEditingStage(s), []);
  const requestDeleteStage = useCallback((s: Stage) => setDeletingStage(s), []);

  async function addColumn() {
    if (!newColName.trim() || !currentId) return;
    const pos = (stages[stages.length - 1]?.position ?? -1) + 1;
    await supabase.from("pipeline_stages").insert({
      name: newColName.trim(), position: pos, pipeline_id: currentId,
    });
    setNewColName(""); setNewColOpen(false);
  }

  async function confirmDeleteStage() {
    const stage = deletingStage;
    if (!stage) return;
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", stage.id);
    if (error) toast.error(error.message); else toast.success("Coluna excluída");
    setDeletingStage(null);
  }

  async function addLead() {
    if (!newLead.phone.trim()) { toast.error("Telefone obrigatório"); return; }
    if (!stages.length) { toast.error("Crie uma coluna primeiro"); return; }
    setCreating(true);
    const stage = stages[0];
    const phone = newLead.phone.replace(/\D/g, "");
    const stageLeads = leads.filter((l) => l.stage_id === stage.id);
    const nextPos = stageLeads.reduce((m, l) => Math.max(m, l.position ?? 0), -1) + 1;
    const { error } = await supabase.from("leads").insert({
      phone, name: newLead.name.trim() || null, stage_id: stage?.id ?? null,
      position: nextPos,
      whatsapp_instance_id: current?.whatsapp_instance_id ?? null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setNewLead({ name: "", phone: "" });
    setNewLeadOpen(false);
    toast.success("Lead criado");
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3">
          <div className="min-w-0">
            <PipelineSwitcher
              pipelines={pipelines}
              current={current}
              leads={allLeads}
              onSelect={setCurrentId}
              onNew={() => setNewPipelineOpen(true)}
              whatsappInstances={whatsappInstances}
            />
            <p className="px-2 text-xs text-muted-foreground">
              {(normalizedQ || dateFilter.from) ? `${leads.length} de ${allPipelineLeads.length}` : leads.length} leads · {stages.length} etapas
              {current?.kind === "internal" && <> · gestão interna</>}
              {current?.kind === "sales" && current?.whatsapp_instance_id && <> · WhatsApp vinculado</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="kanban-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                className="h-8 w-64 pl-7 pr-7 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <PipelineDateFilter value={dateFilter} onChange={setDateFilter} />
            <Toggle pressed={ui.compact} onPressedChange={(v) => setUi((u) => ({ ...u, compact: v }))} size="sm" aria-label="Modo compacto" title="Modo compacto">
              {ui.compact ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
            </Toggle>
            {ui.collapsed.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setUi((u) => ({ ...u, collapsed: [] }))}>
                Expandir todas ({ui.collapsed.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditPipelineOpen(true)} disabled={!current}>
              <Pencil className="mr-1 h-4 w-4" />Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewColOpen(true)} disabled={!currentId}>
              <Plus className="mr-1 h-4 w-4" />Coluna
            </Button>
            <Button size="sm" onClick={() => setNewLeadOpen(true)} disabled={!currentId}>
              <Plus className="mr-1 h-4 w-4" />{current?.kind === "internal" ? "Card" : "Lead"}
            </Button>
          </div>
        </header>

        {currentId ? (
          <>
            <div className="relative flex-1 overflow-hidden">
              {overflow.left && (
                <button onClick={() => scrollByPage(-1)} className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-card p-2.5 shadow-lg transition hover:bg-accent" aria-label="Rolar à esquerda">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {overflow.right && (
                <button onClick={() => scrollByPage(1)} className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-card p-2.5 shadow-lg transition hover:bg-accent" aria-label="Rolar à direita">
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div ref={scrollRef} className="kanban-scroll h-full overflow-x-auto overflow-y-hidden p-4" style={{ cursor: "grab" }}>
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd} autoScroll={{ threshold: { x: 0.1, y: 0.15 }, acceleration: 15 }}>
                  <div className="flex h-full gap-3">
                    {stages.map((s) => (
                      <Column
                        key={s.id}
                        stage={s}
                        leads={leadsByStage.get(s.id) ?? EMPTY_LEADS}
                        onOpenLead={openLeadCb}
                        onMoveLead={openMoveCb}
                        onMoveLeadToStage={moveLeadToStage}
                        allStages={stages}
                        collapsed={ui.collapsed.includes(s.id)}
                        onToggleCollapse={() => toggleCollapsed(s.id)}
                        compact={ui.compact}
                        onEdit={editStageCb}
                        onDelete={requestDeleteStage}
                      />
                    ))}
                    {stages.length === 0 && (
                      <div className="m-auto text-sm text-muted-foreground">Nenhuma etapa. Crie sua primeira coluna.</div>
                    )}
                  </div>
                  <DragOverlay>
                    {active && <div className="rotate-2"><LeadCard lead={active} onOpen={() => {}} onMove={() => {}} compact={ui.compact} /></div>}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Crie seu primeiro funil para começar.
          </div>
        )}
      </div>

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} />
      <MoveLeadDialog
        open={!!movingLead}
        onOpenChange={(v) => !v && setMovingLead(null)}
        lead={movingLead}
        pipelines={pipelines}
        stages={allStages}
      />

      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader>
          <Input placeholder="Nome da etapa" value={newColName} onChange={(e) => setNewColName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && addColumn()} />
          <DialogFooter><Button onClick={addColumn}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo {current?.kind === "internal" ? "card" : "lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{current?.kind === "internal" ? "Identificador" : "Telefone (com DDI)"}</Label><Input placeholder="5511999999999" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={addLead} disabled={creating}>{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <EditStageDialog stage={editingStage} open={!!editingStage} onOpenChange={(v) => !v && setEditingStage(null)} />

      <EditPipelineDialog
        pipeline={current ?? null}
        open={editPipelineOpen}
        onOpenChange={setEditPipelineOpen}
        pipelines={pipelines}
        whatsappInstances={whatsappInstances}
      />

      <NewPipelineDialog
        open={newPipelineOpen}
        onOpenChange={setNewPipelineOpen}
        whatsappInstances={whatsappInstances}
        nextPosition={pipelines.length}
        onCreated={(id) => setCurrentId(id)}
      />


      <AlertDialog open={!!deletingStage} onOpenChange={(v) => !v && setDeletingStage(null)}>
        <AlertDialogContent>
          {(() => {
            const used = deletingStage ? leads.filter((l) => l.stage_id === deletingStage.id).length : 0;
            const blocked = used > 0;
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {blocked ? "Não é possível excluir" : "Excluir coluna"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {blocked ? (
                      <>
                        A coluna <span className="font-medium text-foreground">"{deletingStage?.name}"</span> contém{" "}
                        <span className="font-medium text-foreground">{used}</span>{" "}
                        {used === 1 ? "lead" : "leads"}. Mova-{used === 1 ? "o" : "os"} para outra coluna antes de excluir.
                      </>
                    ) : (
                      <>
                        Tem certeza que deseja excluir a coluna{" "}
                        <span className="font-medium text-foreground">"{deletingStage?.name}"</span>? Esta ação não pode ser desfeita.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  {!blocked && (
                    <AlertDialogAction
                      onClick={confirmDeleteStage}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
