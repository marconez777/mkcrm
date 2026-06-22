import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useDialogs";
import type { ServiceKind, ServiceType } from "@/hooks/useServiceTypes";
import {
  deleteServiceType,
  swapServiceTypePositions,
} from "@/lib/service-types-mutations";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ServiceTypeDialog from "@/components/settings/ServiceTypeDialog";

const GROUPS: { kind: ServiceKind; label: string }[] = [
  { kind: "consulta", label: "Consultas" },
  { kind: "procedimento", label: "Procedimentos" },
  { kind: "retorno", label: "Retornos" },
];

export default function SettingsAppointmentTypes() {
  const { membership, isSuperAdmin } = useAuth();
  const confirm = useConfirm();
  const clinicId = membership?.clinic_id ?? null;
  const canManage = isSuperAdmin || !!membership;

  const [items, setItems] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; item: ServiceType } | null
  >(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("appointment_service_types")
        .select("*")
        .order("kind", { ascending: true })
        .order("position", { ascending: true });
      if (!active) return;
      setItems((data as ServiceType[] | null) ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`ast-admin-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_service_types" },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<ServiceKind, ServiceType[]>();
    for (const g of GROUPS) map.set(g.kind, []);
    for (const it of items) {
      const list = map.get(it.kind);
      if (list) list.push(it);
    }
    return map;
  }, [items]);

  const handleDelete = async (item: ServiceType) => {
    if (
      !(await confirm({
        title: `Excluir “${item.label}”?`,
        description: "Se houver agendamentos usando este tipo, prefira desativar.",
        confirmLabel: "Excluir",
        destructive: true,
      }))
    )
      return;
    const { error } = await deleteServiceType(item.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Tipo excluído");
  };

  const handleMove = async (item: ServiceType, dir: -1 | 1) => {
    const siblings = grouped.get(item.kind) ?? [];
    const idx = siblings.findIndex((s) => s.id === item.id);
    const neighbor = siblings[idx + dir];
    if (!neighbor) return;
    const { error } = await swapServiceTypePositions(
      { id: item.id, position: item.position },
      { id: neighbor.id, position: neighbor.position },
    );
    if (error) toast.error(error);
  };

  if (!canManage) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Sem permissão para gerenciar tipos de agendamento.
      </div>
    );
  }

  if (!clinicId && !isSuperAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Clínica não encontrada.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon">
                <Link to="/settings" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold">Tipos de agendamento</h1>
            </div>
            <p className="ml-10 mt-1 text-sm text-muted-foreground">
              Catálogo de consultas, procedimentos e retornos usado no calendário.
            </p>
          </div>
          <Button onClick={() => setDialog({ mode: "create" })} disabled={!clinicId}>
            <Plus className="mr-2 h-4 w-4" /> Novo tipo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-6">
            {GROUPS.map((g) => {
              const list = grouped.get(g.kind) ?? [];
              return (
                <Card key={g.kind} className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{g.label}</h2>
                    <span className="text-xs text-muted-foreground">
                      {list.length} {list.length === 1 ? "tipo" : "tipos"}
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhum tipo cadastrado.
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((item, idx) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border p-2.5"
                        >
                          <span
                            className="h-6 w-6 shrink-0 rounded-full border"
                            style={{ backgroundColor: item.color_hex }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{item.label}</span>
                              {!item.active && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                                  inativo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{item.slug}</span> ·{" "}
                              {item.default_duration_min} min
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMove(item, -1)}
                              disabled={idx === 0}
                              aria-label="Mover para cima"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMove(item, 1)}
                              disabled={idx === list.length - 1}
                              aria-label="Mover para baixo"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDialog({ mode: "edit", item })}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="text-destructive hover:text-destructive"
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {dialog && clinicId && (
        <ServiceTypeDialog
          open
          onOpenChange={(v) => {
            if (!v) setDialog(null);
          }}
          clinicId={clinicId}
          mode={dialog.mode}
          existing={dialog.mode === "edit" ? dialog.item : undefined}
        />
      )}
    </div>
  );
}
