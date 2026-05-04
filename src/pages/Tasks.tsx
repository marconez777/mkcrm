import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toggleTaskDone, deleteTask, type LeadTask } from "@/lib/lead-tasks";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskWithLead = LeadTask & { lead?: { id: string; name: string | null; phone: string } };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function bucket(iso: string): "overdue" | "today" | "tomorrow" | "later" {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startAfter = new Date(startTomorrow); startAfter.setDate(startAfter.getDate() + 1);
  if (d.getTime() < now.getTime()) return "overdue";
  if (d < startTomorrow) return "today";
  if (d < startAfter) return "tomorrow";
  return "later";
}

const LABELS: Record<string, string> = {
  overdue: "Atrasadas",
  today: "Hoje",
  tomorrow: "Amanhã",
  later: "Próximas",
};

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskWithLead[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const { data: ts } = await supabase
      .from("lead_tasks")
      .select("*")
      .is("done_at", null)
      .order("due_at", { ascending: true });
    const list = (ts ?? []) as LeadTask[];
    const ids = Array.from(new Set(list.map((t) => t.lead_id)));
    let leads: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from("leads").select("id, name, phone").in("id", ids);
      leads = data ?? [];
    }
    const byId = new Map(leads.map((l) => [l.id, l]));
    setTasks(list.map((t) => ({ ...t, lead: byId.get(t.lead_id) })));
    setLoading(false);
  }

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`tasks-page-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_tasks" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const groups = tasks.reduce<Record<string, TaskWithLead[]>>((acc, t) => {
    const k = bucket(t.due_at);
    (acc[k] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <header className="mb-6 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Tarefas</h1>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente. Bom trabalho!</p>
      ) : (
        <div className="space-y-6">
          {(["overdue", "today", "tomorrow", "later"] as const).map((k) =>
            groups[k]?.length ? (
              <section key={k}>
                <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", k === "overdue" ? "text-destructive" : "text-muted-foreground")}>
                  {LABELS[k]} · {groups[k].length}
                </h2>
                <ul className="space-y-1.5">
                  {groups[k].map((t) => (
                    <li key={t.id} className="group flex items-start gap-3 rounded-md border bg-card p-3">
                      <Checkbox
                        className="mt-0.5"
                        checked={!!t.done_at}
                        onCheckedChange={(v) => toggleTaskDone(t.id, !!v)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{t.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className={k === "overdue" ? "text-destructive" : ""}>{fmt(t.due_at)}</span>
                          {t.lead && (
                            <Link to={`/inbox/${t.lead.id}`} className="text-primary hover:underline">
                              {t.lead.name || t.lead.phone}
                            </Link>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="invisible h-7 w-7 group-hover:visible"
                        onClick={() => deleteTask(t.id)} title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
