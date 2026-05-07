import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, CheckCircle2, Circle, Trash2, Plus, X, Users, ListChecks, AlignLeft,
  Paperclip, Upload, FileText, Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Attendant } from "@/types/crm";
import {
  TaskCard, TaskChecklistItem, TaskAttachment, addChecklistItem, deleteChecklistItem, deleteTask,
  setAssignees, toggleChecklistItem, updateChecklistItem, updateTask,
  listAttachments, uploadAttachment, deleteAttachment, attachmentPublicUrl,
} from "@/lib/tasks-board";

type Props = {
  task: TaskCard | null;
  assignees: string[];
  checklist: TaskChecklistItem[];
  attendants: Attendant[];
  onClose: () => void;
};

export default function TaskDetailDialog({ task, assignees, checklist, attendants, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("12:00");
  const [done, setDone] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDue(task.due_at ? new Date(task.due_at) : undefined);
    setTime(task.due_at ? format(new Date(task.due_at), "HH:mm") : "12:00");
    setDone(!!task.done_at);
    listAttachments(task.id).then(setAttachments).catch(() => setAttachments([]));
  }, [task?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        attachments.map(async (a) => [a.id, await attachmentPublicUrl(a.storage_path)] as const),
      );
      if (!cancelled) setAttachmentUrls(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [attachments]);

  const attMap = useMemo(() => new Map(attendants.map((a) => [a.id, a])), [attendants]);
  if (!task) return null;

  async function handleUpload(files: FileList | null) {
    if (!files || !task) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name} excede 25MB`); continue; }
        const att = await uploadAttachment(task.id, f);
        setAttachments((prev) => [att, ...prev]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  async function handleRemoveAttachment(att: TaskAttachment) {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    try { await deleteAttachment(att); } catch (e: any) { toast.error(e?.message ?? "Erro ao remover"); }
  }
  function formatBytes(n: number | null) {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function saveField(patch: Partial<TaskCard>) {
    await updateTask(task!.id, patch);
  }
  async function commitDue(d: Date | undefined, t: string) {
    if (!d) { await saveField({ due_at: null }); return; }
    const [h, m] = t.split(":").map(Number);
    const merged = new Date(d); merged.setHours(h || 0, m || 0, 0, 0);
    await saveField({ due_at: merged.toISOString() });
  }
  async function toggleDone(v: boolean) {
    setDone(v);
    await saveField({ done_at: v ? new Date().toISOString() : null });
  }
  async function toggleAssignee(id: string) {
    const next = assignees.includes(id) ? assignees.filter((x) => x !== id) : [...assignees, id];
    await setAssignees(task!.id, next);
  }
  async function addItem() {
    const t = newItem.trim(); if (!t) return;
    await addChecklistItem(task!.id, t, checklist.length);
    setNewItem("");
  }

  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const overdue = dueDate && !done && dueDate.getTime() < Date.now();
  const checkedCount = checklist.filter((c) => c.done).length;

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <button onClick={() => toggleDone(!done)} className="mt-1 shrink-0">
              {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            </button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && saveField({ title: title.trim() })}
              className="border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Due date + status */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Data de entrega</div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd 'de' MMM", { locale: ptBR }) : "Sem data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={due}
                      onSelect={(d) => { setDue(d ?? undefined); commitDue(d ?? undefined, time); }}
                      initialFocus
                      className="pointer-events-auto p-3"
                    />
                  </PopoverContent>
                </Popover>
                {due && (
                  <>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      onBlur={() => commitDue(due, time)}
                      className="w-28"
                    />
                    <Button variant="ghost" size="icon" onClick={() => { setDue(undefined); commitDue(undefined, time); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {dueDate && (
                  <Badge variant={done ? "secondary" : overdue ? "destructive" : "default"}>
                    {done ? "Concluído" : overdue ? "Atrasada" : format(dueDate, "HH:mm")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Responsáveis
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {assignees.map((id) => {
                const a = attMap.get(id); if (!a) return null;
                return (
                  <button key={id} onClick={() => toggleAssignee(id)} className="group flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs hover:bg-muted">
                    <Avatar className="h-5 w-5"><AvatarFallback style={{ background: a.color, color: "white" }}>{a.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                    {a.name}
                    <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  </button>
                );
              })}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7"><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  {attendants.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum atendente</div>}
                  {attendants.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleAssignee(a.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Avatar className="h-5 w-5"><AvatarFallback style={{ background: a.color, color: "white" }}>{a.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="flex-1 text-left">{a.name}</span>
                      {assignees.includes(a.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlignLeft className="h-3.5 w-3.5" /> Descrição
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? "") && saveField({ description: description || null })}
              placeholder="Adicione uma descrição mais detalhada…"
              rows={4}
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Checklist {checklist.length > 0 && <span>({checkedCount}/{checklist.length})</span>}
            </div>
            <ul className="space-y-1.5">
              {checklist.map((it) => (
                <li key={it.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60">
                  <Checkbox checked={it.done} onCheckedChange={(v) => toggleChecklistItem(it.id, !!v)} />
                  <Input
                    defaultValue={it.text}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== it.text && updateChecklistItem(it.id, e.target.value.trim())}
                    className={cn("h-7 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1", it.done && "text-muted-foreground line-through")}
                  />
                  <Button variant="ghost" size="icon" className="invisible h-6 w-6 group-hover:visible" onClick={() => deleteChecklistItem(it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                placeholder="Adicionar item…"
                className="h-8"
              />
              <Button size="sm" onClick={addItem} disabled={!newItem.trim()}>Adicionar</Button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" /> Anexos {attachments.length > 0 && <span>({attachments.length})</span>}
              </div>
              <Button size="sm" variant="outline" className="h-7" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" />
                {uploading ? "Enviando…" : "Adicionar"}
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            </div>
            <div
              className="rounded-md border border-dashed p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
            >
              {attachments.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Arraste arquivos aqui ou clique em Adicionar
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {attachments.map((a) => {
                    const url = attachmentUrls[a.id] ?? "";
                    const isImage = (a.mime_type ?? "").startsWith("image/");
                    return (
                      <li key={a.id} className="group flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/60">
                        {isImage ? (
                          <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={url} alt={a.file_name} className="h-10 w-10 rounded object-cover" />
                          </a>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <a href={url} target="_blank" rel="noreferrer" className="block truncate text-sm hover:underline">{a.file_name}</a>
                          <div className="text-[11px] text-muted-foreground">
                            {format(new Date(a.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                            {a.size_bytes ? ` · ${formatBytes(a.size_bytes)}` : ""}
                          </div>
                        </div>
                        <a href={url} target="_blank" rel="noreferrer" download={a.file_name}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveAttachment(a)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => { await deleteTask(task.id); onClose(); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
