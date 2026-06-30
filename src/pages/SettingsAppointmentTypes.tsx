import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const GROUP_KINDS: ServiceKind[] = ["consulta", "procedimento", "retorno"];

export default function SettingsAppointmentTypes() {
  const { t } = useTranslation();
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
    for (const k of GROUP_KINDS) map.set(k, []);
    for (const it of items) {
      const list = map.get(it.kind);
      if (list) list.push(it);
    }
    return map;
  }, [items]);

  const handleDelete = async (item: ServiceType) => {
    if (
      !(await confirm({
        title: t("settings.appointmentTypesPage.confirmDeleteTitle", { label: item.label }),
        description: t("settings.appointmentTypesPage.confirmDeleteDesc"),
        confirmLabel: t("settings.appointmentTypesPage.deleteConfirm"),
        destructive: true,
      }))
    )
      return;
    const { error } = await deleteServiceType(item.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(t("settings.appointmentTypesPage.deleted"));
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
        {t("settings.appointmentTypesPage.noPermission")}
      </div>
    );
  }

  if (!clinicId && !isSuperAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        {t("settings.appointmentTypesPage.noCompany")}
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
                <Link to="/settings" aria-label={t("settings.appointmentTypesPage.back")}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold">{t("settings.appointmentTypesPage.title")}</h1>
            </div>
            <p className="ml-10 mt-1 text-sm text-muted-foreground">
              {t("settings.appointmentTypesPage.subtitle")}
            </p>
          </div>
          <Button onClick={() => setDialog({ mode: "create" })} disabled={!clinicId}>
            <Plus className="mr-2 h-4 w-4" /> {t("settings.appointmentTypesPage.newType")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("settings.appointmentTypesPage.loading")}
          </div>
        ) : (
          <div className="space-y-6">
            {GROUP_KINDS.map((kind) => {
              const list = grouped.get(kind) ?? [];
              return (
                <Card key={kind} className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{t(`settings.appointmentTypesPage.groups.${kind}`)}</h2>
                    <span className="text-xs text-muted-foreground">
                      {t("settings.appointmentTypesPage.typesCount", { count: list.length })}
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                      {t("settings.appointmentTypesPage.emptyGroup")}
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
                                  {t("settings.appointmentTypesPage.inactive")}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{item.slug}</span> ·{" "}
                              {item.default_duration_min} {t("settings.appointmentTypesPage.minutesShort")}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMove(item, -1)}
                              disabled={idx === 0}
                              aria-label={t("settings.appointmentTypesPage.moveUp")}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMove(item, 1)}
                              disabled={idx === list.length - 1}
                              aria-label={t("settings.appointmentTypesPage.moveDown")}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDialog({ mode: "edit", item })}
                              aria-label={t("settings.appointmentTypesPage.edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="text-destructive hover:text-destructive"
                              aria-label={t("settings.appointmentTypesPage.delete")}
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
