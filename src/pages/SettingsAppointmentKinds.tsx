import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useDialogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  clinic_id: string;
  kind_name: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function slugifyKind(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const PROTECTED_KINDS = new Set(["consulta", "procedimento", "retorno"]);

export default function SettingsAppointmentKinds() {
  const { membership, isSuperAdmin } = useAuth();
  const confirm = useConfirm();
  const clinicId = membership?.clinic_id ?? null;
  const canManage =
    isSuperAdmin ||
    (!!membership && ["owner", "admin"].includes(membership.role ?? ""));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; row: Row } | null
  >(null);
  const [form, setForm] = useState({ kind_name: "", label: "", is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("clinic_appointment_types")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("kind_name", { ascending: true });
      if (!active) return;
      if (error) toast.error(error.message);
      setRows((data as Row[] | null) ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`cat-admin-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clinic_appointment_types",
          filter: `clinic_id=eq.${clinicId}`,
        },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [clinicId]);

  const openCreate = () => {
    setForm({ kind_name: "", label: "", is_active: true });
    setDialog({ mode: "create" });
  };
  const openEdit = (row: Row) => {
    setForm({ kind_name: row.kind_name, label: row.label, is_active: row.is_active });
    setDialog({ mode: "edit", row });
  };

  const handleSave = async () => {
    if (!clinicId) return;
    const kind = slugifyKind(form.kind_name);
    const label = form.label.trim();
    if (!/^[a-z0-9_]{2,40}$/.test(kind)) {
      toast.error("Nome interno inválido (use 2–40 chars: a-z, 0-9, _).");
      return;
    }
    if (!label) {
      toast.error("Informe o rótulo.");
      return;
    }
    setSaving(true);
    if (dialog?.mode === "create") {
      const { error } = await supabase.from("clinic_appointment_types").insert({
        clinic_id: clinicId,
        kind_name: kind,
        label,
        is_active: form.is_active,
      });
      if (error) {
        toast.error(
          error.code === "23505" ? "Já existe um tipo com esse nome interno." : error.message,
        );
      } else {
        toast.success("Tipo criado.");
        setDialog(null);
      }
    } else if (dialog?.mode === "edit") {
      const payload: Partial<Row> = { label, is_active: form.is_active };
      if (!PROTECTED_KINDS.has(dialog.row.kind_name)) payload.kind_name = kind;
      const { error } = await supabase
        .from("clinic_appointment_types")
        .update(payload)
        .eq("id", dialog.row.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Tipo atualizado.");
        setDialog(null);
      }
    }
    setSaving(false);
  };

  const handleToggleActive = async (row: Row) => {
    const { error } = await supabase
      .from("clinic_appointment_types")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) toast.error(error.message);
  };

  const handleDelete = async (row: Row) => {
    if (PROTECTED_KINDS.has(row.kind_name)) {
      toast.error("Tipos padrão não podem ser excluídos. Desative se necessário.");
      return;
    }
    const ok = await confirm({
      title: `Excluir "${row.label}"?`,
      description:
        "Se houver agendamentos usando este tipo, a exclusão pode falhar. Considere desativar.",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("clinic_appointment_types")
      .delete()
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else toast.success("Tipo excluído.");
  };

  if (!canManage) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Sem permissão para gerenciar tipos de agendamento.
      </div>
    );
  }
  if (!clinicId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Selecione uma clínica.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon">
                <Link to="/settings" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold">Tipos de Agendamento</h1>
            </div>
            <p className="ml-10 mt-1 text-sm text-muted-foreground">
              Defina quais tipos de agendamento sua clínica utiliza (ex.: Consulta,
              Procedimento, Exame). Cada tipo ativo gera automaticamente a chave
              <code className="mx-1 rounded bg-muted px-1 text-xs">{"{tipo}_agendado_em"}</code>
              nos leads.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo tipo
          </Button>
        </div>

        <Card className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              Nenhum tipo cadastrado.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((row) => {
                const isProtected = PROTECTED_KINDS.has(row.kind_name);
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-md border p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{row.label}</span>
                        {isProtected && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            padrão
                          </span>
                        )}
                        {!row.is_active && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            inativo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{row.kind_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={() => handleToggleActive(row)}
                        aria-label="Ativo"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(row)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row)}
                        disabled={isProtected}
                        className="text-destructive hover:text-destructive disabled:opacity-30"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Editar tipo" : "Novo tipo de agendamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="label">Rótulo</Label>
              <Input
                id="label"
                placeholder="Ex.: Consulta de Avaliação"
                value={form.label}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label: v,
                    kind_name:
                      dialog?.mode === "edit" && PROTECTED_KINDS.has(dialog.row.kind_name)
                        ? f.kind_name
                        : f.kind_name && dialog?.mode === "edit"
                          ? f.kind_name
                          : slugifyKind(v),
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind">Nome interno</Label>
              <Input
                id="kind"
                placeholder="ex: exame"
                value={form.kind_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind_name: slugifyKind(e.target.value) }))
                }
                disabled={
                  dialog?.mode === "edit" && PROTECTED_KINDS.has(dialog.row.kind_name)
                }
              />
              <p className="text-xs text-muted-foreground">
                Usado para chaves e integrações. Só letras minúsculas, números e "_".
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <p className="text-xs text-muted-foreground">
                  Tipos inativos não podem ser usados em novos agendamentos.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
