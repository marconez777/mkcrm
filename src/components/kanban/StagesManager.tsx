import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, GripVertical, Flag } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/hooks/useDialogs";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#64748b", "#ec4899",
  "#14b8a6", "#a855f7", "#f97316", "#22c55e",
];

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_terminal: boolean;
  lead_count: number;
}

interface Props {
  pipelineId: string;
}

export default function StagesManager({ pipelineId }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const confirm = useConfirm();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function load() {
    setLoading(true);
    const { data: stageData } = await supabase
      .from("pipeline_stages")
      .select("id,name,color,position,is_terminal")
      .eq("pipeline_id", pipelineId)
      .order("position");
    const ids = (stageData ?? []).map((s) => s.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: leadData } = await supabase
        .from("leads")
        .select("stage_id")
        .in("stage_id", ids);
      (leadData ?? []).forEach((l: any) => {
        if (l.stage_id) counts.set(l.stage_id, (counts.get(l.stage_id) ?? 0) + 1);
      });
    }
    setStages((stageData ?? []).map((s: any) => ({ ...s, lead_count: counts.get(s.id) ?? 0 })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [pipelineId]);

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex((s) => s.id === active.id);
    const newIdx = stages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(stages, oldIdx, newIdx).map((s, i) => ({ ...s, position: i }));
    setStages(reordered);
    await Promise.all(
      reordered.map((s) =>
        supabase.from("pipeline_stages").update({ position: s.position }).eq("id", s.id)
      )
    );
  }

  async function addStage() {
    if (!newName.trim()) return;
    setAdding(true);
    const nextPos = stages.length;
    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({ pipeline_id: pipelineId, name: newName.trim(), position: nextPos, color: PALETTE[nextPos % PALETTE.length] })
      .select("id,name,color,position,is_terminal")
      .single();
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setStages((s) => [...s, { ...(data as any), lead_count: 0 }]);
    setNewName("");
  }

  async function removeStage(stage: Stage) {
    if (stage.lead_count > 0) {
      toast.error(`Não é possível: a etapa tem ${stage.lead_count} ${stage.lead_count === 1 ? "lead" : "leads"}. Mova-os antes.`);
      return;
    }
    if (!(await confirm({ title: `Excluir etapa "${stage.name}"?`, confirmLabel: "Excluir", destructive: true }))) return;
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", stage.id);
    if (error) { toast.error(error.message); return; }
    setStages((s) => s.filter((x) => x.id !== stage.id));
  }

  async function updateStage(id: string, patch: Partial<Pick<Stage, "name" | "color">>) {
    setStages((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("pipeline_stages").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Arraste para reordenar. Clique no círculo de cor para alterar. Etapas com leads não podem ser excluídas.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {stages.map((s) => (
              <SortableRow key={s.id} stage={s} onUpdate={updateStage} onRemove={removeStage} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2 pt-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova etapa"
          onKeyDown={(e) => e.key === "Enter" && addStage()}
        />
        <Button size="sm" onClick={addStage} disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function SortableRow({
  stage,
  onUpdate,
  onRemove,
}: {
  stage: Stage;
  onUpdate: (id: string, patch: Partial<Pick<Stage, "name" | "color">>) => void;
  onRemove: (s: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const [name, setName] = useState(stage.name);

  useEffect(() => setName(stage.name), [stage.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-card p-2">
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-5 w-5 shrink-0 rounded-full ring-1 ring-border"
            style={{ background: stage.color }}
            aria-label="Cor"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate(stage.id, { color: c })}
                className={`h-6 w-6 rounded-full border-2 transition ${stage.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== stage.name && onUpdate(stage.id, { name: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setName(stage.name);
        }}
        className="h-8 flex-1"
      />

      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
        {stage.lead_count}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(stage)}
        disabled={stage.lead_count > 0}
        title={stage.lead_count > 0 ? "Mova os leads antes de excluir" : "Excluir etapa"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
