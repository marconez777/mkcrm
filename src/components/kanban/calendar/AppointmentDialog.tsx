import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useLeadSearch } from "@/hooks/useLeadSearch";
import type { AppointmentKind, AppointmentStatus } from "@/hooks/useAppointments";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/lib/appointments-mutations";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  mode: Mode;
  appointmentId?: string;
  initialStart?: Date;
  initialEnd?: Date;
  initialLeadId?: string;
};

const KINDS: { value: AppointmentKind; label: string }[] = [
  { value: "consulta", label: "Consulta" },
  { value: "procedimento", label: "Procedimento" },
  { value: "retorno", label: "Retorno" },
];

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${mi}`;
}
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(d.getTime()) ? null : d;
}

export default function AppointmentDialog({
  open,
  onOpenChange,
  pipelineId,
  mode,
  appointmentId,
  initialStart,
  initialEnd,
  initialLeadId,
}: Props) {
  const { types } = useServiceTypes();

  const [leadId, setLeadId] = useState<string>(initialLeadId ?? "");
  const [leadName, setLeadName] = useState<string>("");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const { results: leadResults, loading: searchingLeads } = useLeadSearch(pipelineId, leadQuery);

  const [kind, setKind] = useState<AppointmentKind>("consulta");
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<AppointmentStatus>("agendado");

  const [loadingRow, setLoadingRow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset / load on open change
  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      const start = initialStart ?? new Date();
      const end = initialEnd ?? new Date(start.getTime() + 30 * 60_000);
      setLeadId(initialLeadId ?? "");
      setLeadName("");
      setLeadQuery("");
      setKind("consulta");
      setServiceTypeId("");
      setDateStr(toDateInput(start));
      setTimeStr(toTimeInput(start));
      setDuration(Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)));
      setNotes("");
      setStatus("agendado");
      return;
    }
    if (mode === "edit" && appointmentId) {
      setLoadingRow(true);
      void (async () => {
        const { data, error } = await supabase
          .from("appointments")
          .select(
            "id, lead_id, kind, service_type_id, scheduled_at, duration_min, notes, status, leads(name)",
          )
          .eq("id", appointmentId)
          .maybeSingle();
        if (error || !data) {
          toast.error(error?.message ?? "Agendamento não encontrado");
          setLoadingRow(false);
          onOpenChange(false);
          return;
        }
        const row = data as unknown as {
          lead_id: string;
          kind: AppointmentKind;
          service_type_id: string | null;
          scheduled_at: string;
          duration_min: number;
          notes: string | null;
          status: AppointmentStatus;
          leads: { name: string | null } | null;
        };
        const start = new Date(row.scheduled_at);
        setLeadId(row.lead_id);
        setLeadName(row.leads?.name ?? "");
        setKind(row.kind);
        setServiceTypeId(row.service_type_id ?? "");
        setDateStr(toDateInput(start));
        setTimeStr(toTimeInput(start));
        setDuration(row.duration_min);
        setNotes(row.notes ?? "");
        setStatus(row.status);
        setLoadingRow(false);
      })();
    }
  }, [open, mode, appointmentId, initialStart, initialEnd, initialLeadId, onOpenChange]);

  // When kind changes (create mode), default duration from service type or kind default
  useEffect(() => {
    if (mode !== "create") return;
    if (serviceTypeId) {
      const st = types.find((t) => t.id === serviceTypeId);
      if (st) setDuration(st.default_duration_min);
    }
  }, [serviceTypeId, mode, types]);

  const filteredTypes = useMemo(
    () => types.filter((t) => t.kind === kind),
    [types, kind],
  );

  const editable = mode === "create" || status === "agendado";

  const handleSave = async () => {
    const when = parseDateTime(dateStr, timeStr);
    if (!when) {
      toast.error("Data/hora inválida");
      return;
    }
    if (!leadId) {
      toast.error("Selecione um lead");
      return;
    }
    if (duration < 5 || duration > 480) {
      toast.error("Duração deve estar entre 5 e 480 min");
      return;
    }
    setSaving(true);
    if (mode === "create") {
      const { error } = await createAppointment({
        lead_id: leadId,
        kind,
        service_type_id: serviceTypeId || null,
        scheduled_at: when,
        duration_min: duration,
        notes: notes || null,
      });
      setSaving(false);
      if (error) {
        toast.error(`Não foi possível criar: ${error}`);
        return;
      }
      toast.success("Agendamento criado");
      onOpenChange(false);
    } else if (appointmentId) {
      const { error } = await updateAppointment(appointmentId, {
        kind,
        service_type_id: serviceTypeId || null,
        scheduled_at: when,
        duration_min: duration,
        notes: notes || null,
      });
      setSaving(false);
      if (error) {
        toast.error(`Não foi possível salvar: ${error}`);
        return;
      }
      toast.success("Agendamento atualizado");
      onOpenChange(false);
    }
  };

  const handleStatus = async (next: AppointmentStatus) => {
    if (!appointmentId) return;
    setSaving(true);
    const { error } = await updateAppointmentStatus(appointmentId, next);
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível atualizar status: ${error}`);
      return;
    }
    toast.success("Status atualizado");
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!appointmentId) return;
    if (!confirm("Excluir este agendamento?")) return;
    setSaving(true);
    const { error } = await deleteAppointment(appointmentId);
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível excluir: ${error}`);
      return;
    }
    toast.success("Agendamento excluído");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo agendamento" : "Editar agendamento"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Selecione lead, tipo e horário."
              : status !== "agendado"
                ? `Status atual: ${status}. Apenas leitura.`
                : "Ajuste os detalhes ou atualize o status."}
          </DialogDescription>
        </DialogHeader>

        {loadingRow ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lead</Label>
              {mode === "edit" ? (
                <Input value={leadName || "(sem nome)"} disabled />
              ) : (
                <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {leadId
                        ? leadName || "Lead selecionado"
                        : "Selecionar lead…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar lead…"
                        value={leadQuery}
                        onValueChange={setLeadQuery}
                      />
                      <CommandList>
                        {searchingLeads && (
                          <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Buscando…
                          </div>
                        )}
                        <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                        <CommandGroup>
                          {leadResults.map((l) => (
                            <CommandItem
                              key={l.id}
                              value={l.id}
                              onSelect={() => {
                                setLeadId(l.id);
                                setLeadName(l.name);
                                setLeadPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  leadId === l.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {l.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as AppointmentKind);
                    setServiceTypeId("");
                  }}
                  disabled={!editable}
                >
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
                <Label>Serviço</Label>
                <Select
                  value={serviceTypeId || "__none"}
                  onValueChange={(v) => setServiceTypeId(v === "__none" ? "" : v)}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem serviço</SelectItem>
                    {filteredTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!editable}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {mode === "edit" && status === "agendado" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "edit" && status === "agendado" && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleStatus("cancelado")} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStatus("faltou")} disabled={saving}>
                  Faltou
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStatus("realizado")} disabled={saving}>
                  Realizado
                </Button>
              </>
            )}
            {editable ? (
              <Button onClick={handleSave} disabled={saving || loadingRow}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Criar" : "Salvar"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
