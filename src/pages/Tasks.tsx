import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable,
  useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Plus, MoreHorizontal, Trash2, CheckCircle2, Circle, Clock, ListChecks, AlignLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAttendants } from "@/hooks/useAttendants";
import { cn } from "@/lib/utils";
import {
  TaskBoard, TaskCard as TCard, TaskColumn, TaskChecklistItem,
  createColumn, createTask, deleteColumn, ensureDefaultBoard, listAssignees,
  listChecklist, listColumns, listTasks, moveTask, renameColumn, updateTask,
} from "@/lib/tasks-board";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

function CardItem({ card, assignees, checklist, attendants, onOpen }: {
  card: TCard; assignees: string[]; checklist: TaskChecklistItem[];
  attendants: { id: string; name: string; color: string }[]; onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id, data: { type: "card", card },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const due = card.due_at ? new Date(card.due_at) : null;
  const done = !!card.done_at;
  const overdue = due && !done && due.getTime() < Date.now();
  const checkedCount = checklist.filter((c) => c.done).length;
  const attMap = new Map(attendants.map((a) => [a.id, a]));

  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onOpen}
      className="group cursor-pointer rounded-lg border bg-card p-2.5 shadow-sm hover:border-primary/50"
    >
      <div className="flex items-start gap-2">
        {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1 text-sm">{card.title}</div>
      </div>
      {card.description && (
        <div className="mt-1 line-clamp-2 whitespace-pre-wrap pl-6 text-xs text-muted-foreground">
          {card.description}
        </div>
      )}
      {(due || checklist.length > 0 || card.description) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6 text-[11px] text-muted-foreground">
          {due && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
              done ? "bg-primary/10 text-primary" : overdue ? "bg-destructive/10 text-destructive" : "bg-muted",
            )}>
              <Clock className="h-3 w-3" />
              {format(due, "dd 'de' MMM", { locale: ptBR })}
            </span>
          )}
          {card.description && <AlignLeft className="h-3 w-3" />}
          {checklist.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks className="h-3 w-3" />{checkedCount}/{checklist.length}
            </span>
          )}
        </div>
      )}
      {assignees.length > 0 && (
        <div className="mt-2 flex justify-end -space-x-1.5">
          {assignees.slice(0, 4).map((id) => {
            const a = attMap.get(id); if (!a) return null;
            return (
              <Avatar key={id} className="h-5 w-5 border-2 border-card" title={a.name}>
                <AvatarFallback style={{ background: a.color, color: "white", fontSize: 10 }}>
                  {a.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ColumnView({ column, cards, assigneesByTask, checklistByTask, attendants, onOpenCard, onRename, onDelete, onAddCard }: {
  column: TaskColumn; cards: TCard[];
  assigneesByTask: Record<string, string[]>;
  checklistByTask: Record<string, TaskChecklistItem[]>;
  attendants: { id: string; name: string; color: string }[];
  onOpenCard: (c: TCard) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddCard: (columnId: string, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", column } });
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState(column.name);
  const [renaming, setRenaming] = useState(false);
  useEffect(() => setName(column.name), [column.name]);

  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/40 p-2", isOver && "ring-2 ring-primary/40")}>
      <div className="mb-2 flex items-center gap-2 px-1">
        {renaming ? (
          <Input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => { setRenaming(false); if (name.trim() && name !== column.name) onRename(column.id, name.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(column.name); setRenaming(false); } }}
            className="h-7"
          />
        ) : (
          <button onClick={() => setRenaming(true)} className="flex-1 truncate text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {column.name} <span className="ml-1 opacity-60">{cards.length}</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>Renomear</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(column.id)}>Excluir coluna</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
          {cards.map((c) => (
            <CardItem
              key={c.id} card={c}
              assignees={assigneesByTask[c.id] ?? []}
              checklist={checklistByTask[c.id] ?? []}
              attendants={attendants}
              onOpen={() => onOpenCard(c)}
            />
          ))}
        </div>
      </SortableContext>

      {adding ? (
        <div className="mt-2 space-y-2">
          <Input
            autoFocus value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { if (text.trim()) { onAddCard(column.id, text.trim()); setText(""); } }
              if (e.key === "Escape") { setAdding(false); setText(""); }
            }}
            placeholder="Título do cartão"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { if (text.trim()) { onAddCard(column.id, text.trim()); setText(""); } }}>Adicionar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setText(""); }}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted">
          <Plus className="h-4 w-4" /> Adicionar um cartão
        </button>
      )}
    </div>
  );
}

export default function Tasks() {
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<TCard[]>([]);
  const [assigneesByTask, setAssigneesByTask] = useState<Record<string, string[]>>({});
  const [checklistByTask, setChecklistByTask] = useState<Record<string, TaskChecklistItem[]>>({});
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<TCard | null>(null);
  const [newCol, setNewCol] = useState("");
  const [addingCol, setAddingCol] = useState(false);

  const { attendants } = useAttendants();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function reloadBoard(b: TaskBoard) {
    const [cs, ts, asgns, chs] = await Promise.all([
      listColumns(b.id), listTasks(b.id), listAssignees(b.id), listChecklist(b.id),
    ]);
    setColumns(cs); setTasks(ts);
    const am: Record<string, string[]> = {};
    asgns.forEach((a) => { (am[a.task_id] ||= []).push(a.attendant_id); });
    setAssigneesByTask(am);
    const cm: Record<string, TaskChecklistItem[]> = {};
    chs.forEach((c) => { (cm[c.task_id] ||= []).push(c); });
    setChecklistByTask(cm);
  }

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const b = await ensureDefaultBoard();
      setBoard(b);
      await reloadBoard(b);
      const ch = supabase
        .channel(`board-${b.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => reloadBoard(b))
        .on("postgres_changes", { event: "*", schema: "public", table: "task_columns" }, () => reloadBoard(b))
        .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, () => reloadBoard(b))
        .on("postgres_changes", { event: "*", schema: "public", table: "task_checklist_items" }, () => reloadBoard(b))
        .subscribe();
      unsub = () => { supabase.removeChannel(ch); };
    })();
    return () => { unsub?.(); };
  }, []);

  const tasksByColumn = useMemo(() => {
    const m: Record<string, TCard[]> = {};
    columns.forEach((c) => (m[c.id] = []));
    tasks.forEach((t) => { (m[t.column_id] ||= []).push(t); });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return m;
  }, [columns, tasks]);

  function onDragStart(e: DragStartEvent) {
    const c = e.active.data.current?.card as TCard | undefined;
    if (c) setActiveCard(c);
  }
  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const card = e.active.data.current?.card as TCard | undefined;
    if (!card) return;
    const overData = e.over?.data.current as any;
    let targetColId = card.column_id;
    let targetIndex = (tasksByColumn[card.column_id]?.length ?? 0);
    if (overData?.type === "column") {
      targetColId = overData.column.id;
      targetIndex = (tasksByColumn[targetColId]?.length ?? 0);
    } else if (overData?.type === "card") {
      const overCard = overData.card as TCard;
      targetColId = overCard.column_id;
      const arr = tasksByColumn[targetColId] ?? [];
      targetIndex = arr.findIndex((c) => c.id === overCard.id);
      if (targetIndex < 0) targetIndex = arr.length;
    } else return;

    // Compute new ordering
    const sourceArr = (tasksByColumn[card.column_id] ?? []).filter((c) => c.id !== card.id);
    const targetArr = targetColId === card.column_id ? sourceArr : (tasksByColumn[targetColId] ?? []).slice();
    targetArr.splice(targetIndex, 0, { ...card, column_id: targetColId });

    // Optimistic update
    setTasks((prev) => prev.map((t) => {
      if (t.id === card.id) return { ...t, column_id: targetColId };
      return t;
    }));

    // Persist new positions for affected columns
    const updates: Promise<any>[] = [];
    targetArr.forEach((t, i) => updates.push(moveTask(t.id, targetColId, i)));
    if (targetColId !== card.column_id) {
      sourceArr.forEach((t, i) => updates.push(moveTask(t.id, card.column_id, i)));
    }
    await Promise.all(updates);
  }

  async function handleAddCard(colId: string, title: string) {
    if (!board) return;
    const pos = (tasksByColumn[colId]?.length ?? 0);
    await createTask(board.id, colId, title, pos);
  }
  async function handleAddColumn() {
    if (!board || !newCol.trim()) return;
    await createColumn(board.id, newCol.trim(), columns.length);
    setNewCol(""); setAddingCol(false);
  }

  const openCard = openCardId ? tasks.find((t) => t.id === openCardId) ?? null : null;

  return (
    <div className="flex h-full flex-col p-4">
      <header className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Tarefas</h1>
        {board && <span className="text-sm text-muted-foreground">· {board.name}</span>}
      </header>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
          {columns.map((c) => (
            <ColumnView
              key={c.id} column={c}
              cards={tasksByColumn[c.id] ?? []}
              assigneesByTask={assigneesByTask}
              checklistByTask={checklistByTask}
              attendants={attendants}
              onOpenCard={(card) => setOpenCardId(card.id)}
              onRename={renameColumn}
              onDelete={(id) => { if (confirm("Excluir coluna e seus cartões?")) deleteColumn(id); }}
              onAddCard={handleAddCard}
            />
          ))}

          <div className="w-72 shrink-0">
            {addingCol ? (
              <div className="rounded-lg bg-muted/40 p-2">
                <Input
                  autoFocus value={newCol} onChange={(e) => setNewCol(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") { setAddingCol(false); setNewCol(""); } }}
                  placeholder="Nome da coluna"
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={handleAddColumn}>Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingCol(false); setNewCol(""); }}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingCol(true)} className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/30">
                <Plus className="h-4 w-4" /> Adicionar coluna
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="rounded-lg border bg-card p-2.5 text-sm shadow-lg">{activeCard.title}</div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailDialog
        task={openCard}
        assignees={openCard ? assigneesByTask[openCard.id] ?? [] : []}
        checklist={openCard ? checklistByTask[openCard.id] ?? [] : []}
        attendants={attendants}
        onClose={() => setOpenCardId(null)}
      />
    </div>
  );
}
