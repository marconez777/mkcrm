import { supabase } from "@/integrations/supabase/client";

export type LeadTask = {
  id: string;
  lead_id: string;
  title: string;
  due_at: string;
  done_at: string | null;
  created_at: string;
};

export async function listTasks(leadId: string, includeDone = false): Promise<LeadTask[]> {
  let q = supabase.from("lead_tasks").select("*").eq("lead_id", leadId).order("due_at", { ascending: true });
  if (!includeDone) q = q.is("done_at", null);
  const { data } = await q;
  return (data ?? []) as LeadTask[];
}

export async function createTask(leadId: string, title: string, dueAt: Date) {
  const { error } = await supabase.from("lead_tasks").insert({
    lead_id: leadId,
    title,
    due_at: dueAt.toISOString(),
  });
  if (error) throw error;
}

export async function toggleTaskDone(id: string, done: boolean) {
  await supabase
    .from("lead_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
}

export async function deleteTask(id: string) {
  await supabase.from("lead_tasks").delete().eq("id", id);
}
