import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { ServiceKind, ServiceType } from "@/hooks/useServiceTypes";
import {
  createServiceType,
  slugify,
  updateServiceType,
} from "@/lib/service-types-mutations";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  mode: "create" | "edit";
  existing?: ServiceType;
};

const KINDS: { value: ServiceKind; label: string }[] = [
  { value: "consulta", label: "Consulta" },
  { value: "procedimento", label: "Procedimento" },
  { value: "retorno", label: "Retorno" },
];

export default function ServiceTypeDialog({
  open,
  onOpenChange,
  clinicId,
  mode,
  existing,
}: Props) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ServiceKind>("consulta");
  const [color, setColor] = useState("#3b82f6");
  const [duration, setDuration] = useState(30);
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && existing) {
      setLabel(existing.label);
      setKind(existing.kind);
      setColor(existing.color_hex);
      setDuration(existing.default_duration_min);
      setSlug(existing.slug);
      setActive(existing.active);
      setSlugTouched(true);
    } else {
      setLabel("");
      setKind("consulta");
      setColor("#3b82f6");
      setDuration(30);
      setSlug("");
      setActive(true);
      setSlugTouched(false);
    }
  }, [open, mode, existing]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(label));
  }, [label, slugTouched]);

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Informe um nome");
      return;
    }
    if (duration < 5 || duration > 480) {
      toast.error("Duração deve estar entre 5 e 480 min");
      return;
    }
    setSaving(true);
    if (mode === "create") {
      const { error } = await createServiceType({
        clinic_id: clinicId,
        label: label.trim(),
        kind,
        color_hex: color,
        default_duration_min: duration,
        slug: slug.trim() || undefined,
      });
      setSaving(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Tipo criado");
      onOpenChange(false);
    } else if (existing) {
      const { error } = await updateServiceType(existing.id, {
        label: label.trim(),
        kind,
        color_hex: color,
        default_duration_min: duration,
        slug: slug.trim() || slugify(label),
        active,
      });
      setSaving(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Tipo atualizado");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo tipo" : "Editar tipo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ServiceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duração padrão (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hex</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="font-mono text-xs"
            />
          </div>
          {mode === "edit" && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">
                  Inativos não aparecem ao criar agendamentos.
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Criar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
