import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTask } from "@/lib/lead-tasks";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

function defaultDateTime() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskDialog({
  open, onClose, leadId, onSaved,
}: { open: boolean; onClose: () => void; leadId: string; onSaved?: () => void }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultDateTime());
  const [saving, setSaving] = useState(false);

  async function save() {
    const t = title.trim();
    if (!t) return toast.error("Informe o título");
    const d = new Date(when);
    if (isNaN(d.getTime())) return toast.error("Data inválida");
    setSaving(true);
    try {
      await createTask(leadId, t, d);
      toast.success("Tarefa criada");
      setTitle("");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Nova tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Ex.: Ligar para o cliente" />
          </div>
          <div className="space-y-1">
            <Label>Vencimento</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
