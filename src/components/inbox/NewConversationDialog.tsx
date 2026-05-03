import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewConversationDialog({
  open, onClose, onCreated, defaultStageId,
}: {
  open: boolean; onClose: () => void;
  onCreated: (leadId: string) => void;
  defaultStageId: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const p = phone.replace(/\D/g, "");
    if (!p) { toast.error("Telefone obrigatório"); return; }
    setBusy(true);
    try {
      // Reuse existing lead if same phone
      const { data: existing } = await supabase.from("leads").select("id").eq("phone", p).maybeSingle();
      let leadId = existing?.id as string | undefined;
      if (!leadId) {
        const { data: created, error } = await supabase
          .from("leads")
          .insert({ phone: p, name: name.trim() || null, stage_id: defaultStageId })
          .select("id")
          .single();
        if (error) throw error;
        leadId = created.id;
      }
      if (text.trim()) {
        const { error } = await supabase.functions.invoke("evolution-send", {
          body: { lead_id: leadId, text: text.trim(), client_message_id: crypto.randomUUID() },
        });
        if (error) toast.error("Lead criado, mas falhou enviar: " + error.message);
      }
      setPhone(""); setName(""); setText("");
      onCreated(leadId!);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Telefone (com DDI)</Label>
            <Input placeholder="5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5"><Label>Nome (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5"><Label>Primeira mensagem (opcional)</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {text.trim() ? "Criar e enviar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
