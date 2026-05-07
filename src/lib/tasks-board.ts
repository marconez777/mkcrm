import { supabase } from "@/integrations/supabase/client";

export type TaskBoard = { id: string; name: string; position: number; created_at: string };
export type TaskColumn = { id: string; board_id: string; name: string; position: number; created_at: string };
export type TaskCard = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  done_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};
export type TaskAssignee = { task_id: string; attendant_id: string };
export type TaskLabel = { id: string; board_id: string; name: string; color: string };
export type TaskLabelLink = { task_id: string; label_id: string };
export type TaskChecklistItem = { id: string; task_id: string; text: string; done: boolean; position: number };

export async function listBoards(): Promise<TaskBoard[]> {
  const { data } = await supabase.from("task_boards").select("*").order("position");
  return (data ?? []) as TaskBoard[];
}

export async function ensureDefaultBoard(): Promise<TaskBoard> {
  const boards = await listBoards();
  if (boards.length) return boards[0];
  const { data } = await supabase.from("task_boards").insert({ name: "Geral", position: 0 }).select("*").single();
  const b = data as TaskBoard;
  await supabase.from("task_columns").insert([
    { board_id: b.id, name: "A fazer", position: 0 },
    { board_id: b.id, name: "Fazendo", position: 1 },
    { board_id: b.id, name: "Concluído", position: 2 },
  ]);
  return b;
}

export async function listColumns(boardId: string): Promise<TaskColumn[]> {
  const { data } = await supabase.from("task_columns").select("*").eq("board_id", boardId).order("position");
  return (data ?? []) as TaskColumn[];
}

export async function listTasks(boardId: string): Promise<TaskCard[]> {
  const { data } = await supabase.from("tasks").select("*").eq("board_id", boardId).order("position");
  return (data ?? []) as TaskCard[];
}

export async function listAssignees(boardId: string): Promise<TaskAssignee[]> {
  const { data } = await supabase
    .from("task_assignees")
    .select("task_id, attendant_id, tasks!inner(board_id)")
    .eq("tasks.board_id", boardId);
  return ((data ?? []) as any[]).map((r) => ({ task_id: r.task_id, attendant_id: r.attendant_id }));
}

export async function listChecklist(boardId: string): Promise<TaskChecklistItem[]> {
  const { data } = await supabase
    .from("task_checklist_items")
    .select("*, tasks!inner(board_id)")
    .eq("tasks.board_id", boardId)
    .order("position");
  return ((data ?? []) as any[]).map(({ tasks, ...rest }) => rest as TaskChecklistItem);
}

export async function createColumn(boardId: string, name: string, position: number) {
  const { data, error } = await supabase.from("task_columns").insert({ board_id: boardId, name, position }).select("*").single();
  if (error) throw error;
  return data as TaskColumn;
}
export async function renameColumn(id: string, name: string) {
  await supabase.from("task_columns").update({ name }).eq("id", id);
}
export async function deleteColumn(id: string) {
  await supabase.from("task_columns").delete().eq("id", id);
}

export async function createTask(boardId: string, columnId: string, title: string, position: number) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ board_id: boardId, column_id: columnId, title, position })
    .select("*")
    .single();
  if (error) throw error;
  return data as TaskCard;
}
export async function updateTask(id: string, patch: Partial<TaskCard>) {
  await supabase.from("tasks").update(patch).eq("id", id);
}
export async function deleteTask(id: string) {
  await supabase.from("tasks").delete().eq("id", id);
}
export async function moveTask(id: string, columnId: string, position: number) {
  await supabase.from("tasks").update({ column_id: columnId, position }).eq("id", id);
}

export async function setAssignees(taskId: string, attendantIds: string[]) {
  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (attendantIds.length) {
    await supabase.from("task_assignees").insert(attendantIds.map((a) => ({ task_id: taskId, attendant_id: a })));
  }
}

export async function addChecklistItem(taskId: string, text: string, position: number) {
  const { data } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, text, position })
    .select("*")
    .single();
  return data as TaskChecklistItem;
}
export async function toggleChecklistItem(id: string, done: boolean) {
  await supabase.from("task_checklist_items").update({ done }).eq("id", id);
}
export async function deleteChecklistItem(id: string) {
  await supabase.from("task_checklist_items").delete().eq("id", id);
}
export async function updateChecklistItem(id: string, text: string) {
  await supabase.from("task_checklist_items").update({ text }).eq("id", id);
}

export type TaskAttachment = {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export const ATTACHMENTS_BUCKET = "task-attachments";

export async function attachmentPublicUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data) return "";
  return data.signedUrl;
}

export async function listAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TaskAttachment[];
}

export async function uploadAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${taskId}/${Date.now()}_${safeName}`;
  const up = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (up.error) throw up.error;
  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TaskAttachment;
}

export async function deleteAttachment(att: TaskAttachment) {
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([att.storage_path]);
  await supabase.from("task_attachments").delete().eq("id", att.id);
}
