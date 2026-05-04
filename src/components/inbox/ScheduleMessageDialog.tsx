import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { scheduleMessage } from "@/lib/scheduled-messages";
import { toast } from "sonner";
import { Clock } from "lucide-react";

function defaultDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleMessageDialog({
  open, onClose, leadId, initialText = "",
}: { open: boolean; onClose: () => void; leadId: string; initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState(defaultDateTime());
  const [saving, setSaving] = useState(false);

  async function save() {
    const t = text.trim();
    if (!t) return toast.error("Mensagem vazia");
    const date = new Date(when);
    if (isNaN(date.getTime())) return toast.error("Data inválida");
    if (date.getTime() < Date.now() + 30_000) return toast.error("Escolha um horário no futuro");
    setSaving(true);
    try {
      await scheduleMessage(leadId, t, date);
      toast.success("Mensagem agendada");
      onClose();
      setText("");
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
          <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Agendar mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Conteúdo</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Digite a mensagem..." />
          </div>
          <div className="space-y-1">
            <Label>Enviar em</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
