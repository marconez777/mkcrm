import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { listTasks, toggleTaskDone, deleteTask, type LeadTask } from "@/lib/lead-tasks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import TaskDialog from "./TaskDialog";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function isOverdue(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export default function LeadTasksPanel({ leadId }: { leadId: string }) {
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    listTasks(leadId, false).then(setTasks);
  }, [leadId]);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`tasks-${leadId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lead_tasks", filter: `lead_id=eq.${leadId}` },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId, reload]);

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="h-3 w-3" /> Tarefas {tasks.length > 0 && <span className="lowercase">· {tasks.length}</span>}
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Nova
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhuma tarefa pendente.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-background">
              <Checkbox
                className="mt-0.5"
                checked={!!t.done_at}
                onCheckedChange={(v) => toggleTaskDone(t.id, !!v)}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs">{t.title}</div>
                <div className={cn("text-[10px]", isOverdue(t.due_at) ? "text-destructive" : "text-muted-foreground")}>
                  {fmt(t.due_at)}{isOverdue(t.due_at) && " · atrasada"}
                </div>
              </div>
              <button
                onClick={() => deleteTask(t.id)}
                className="invisible rounded p-1 text-muted-foreground hover:text-destructive group-hover:visible"
                title="Excluir"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <TaskDialog open={open} onClose={() => setOpen(false)} leadId={leadId} onSaved={reload} />
    </div>
  );
}
