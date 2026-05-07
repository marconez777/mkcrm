import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KommoImportDialog from "./KommoImportDialog";

type Source = "kommo" | "rdstation" | "pipedrive" | "hubspot";

const SOURCES: { value: Source; label: string; available: boolean }[] = [
  { value: "kommo", label: "Kommo", available: true },
  { value: "rdstation", label: "RD Station (em breve)", available: false },
  { value: "pipedrive", label: "Pipedrive (em breve)", available: false },
  { value: "hubspot", label: "HubSpot (em breve)", available: false },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  whatsappInstances: { id: string; name: string }[];
  nextPosition: number;
  onCreated: (pipelineId: string) => void;
}

export default function ImportPipelineDialog({ open, onOpenChange, whatsappInstances, nextPosition, onCreated }: Props) {
  const [source, setSource] = useState<Source>("kommo");
  const [kommoOpen, setKommoOpen] = useState(false);

  function handleContinue() {
    const s = SOURCES.find((x) => x.value === source);
    if (!s?.available) return;
    onOpenChange(false);
    if (source === "kommo") setKommoOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>De qual CRM você quer importar?</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value} disabled={!s.available}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Mais integrações em breve. Quer alguma específica? Nos avise.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleContinue} disabled={!SOURCES.find((s) => s.value === source)?.available}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KommoImportDialog
        open={kommoOpen}
        onOpenChange={setKommoOpen}
        whatsappInstances={whatsappInstances}
        nextPosition={nextPosition}
        onCreated={onCreated}
      />
    </>
  );
}
