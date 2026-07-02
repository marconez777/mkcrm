import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import type { CustomFieldDef, FieldType } from "@/types/crm";
import { useConfirm } from "@/hooks/useDialogs";

const TYPE_KEYS: FieldType[] = [
  "text", "number", "currency", "date", "datetime", "boolean",
  "select", "multiselect", "url", "textarea",
];

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    .slice(0, 40) || `campo_${Date.now()}`;
}

export default function SettingsCustomFields() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CustomFieldDef[]>([]);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const typeLabel = (v: FieldType) => t(`settings.customFieldsPage.types.${v}`);

  async function load() {
    const { data } = await supabase
      .from("lead_custom_fields")
      .select("*")
      .order("position", { ascending: true });
    setItems((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  function newField() {
    setEditing({
      id: "",
      label: "",
      field_key: "",
      field_type: "select",
      options: [],
      position: items.length,
    } as any);
    setOpen(true);
  }

  async function save() {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) return toast.error(t("settings.customFieldsPage.labelRequired"));
    const key = (editing.field_key || slugify(label)).trim();
    const opts = ["select", "multiselect"].includes(editing.field_type) ? editing.options ?? [] : null;
    const payload = {
      label,
      field_key: key,
      field_type: editing.field_type,
      options: opts as any,
      position: editing.position ?? items.length,
    };
    if (editing.id) {
      const { error } = await supabase.from("lead_custom_fields").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("lead_custom_fields").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t("settings.customFieldsPage.saved"));
    setOpen(false);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!(await confirm({
      title: t("settings.customFieldsPage.confirmDeleteTitle"),
      description: t("settings.customFieldsPage.confirmDeleteDesc"),
      confirmLabel: t("settings.customFieldsPage.remove"),
      destructive: true,
    }))) return;
    await supabase.from("lead_custom_fields").delete().eq("id", id);
    load();
  }

  async function move(idx: number, dir: -1 | 1) {
    const a = items[idx], b = items[idx + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("lead_custom_fields").update({ position: b.position }).eq("id", a.id),
      supabase.from("lead_custom_fields").update({ position: a.position }).eq("id", b.id),
    ]);
    load();
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/settings" className="text-xs text-muted-foreground hover:underline">
            {t("settings.customFieldsPage.backToSettings")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{t("settings.customFieldsPage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.customFieldsPage.subtitle")}</p>
        </div>
        <Button onClick={newField}><Plus className="mr-2 h-4 w-4" />{t("settings.customFieldsPage.newField")}</Button>
      </div>

      <Card className="flex-1 divide-y overflow-y-auto">
        {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{t("settings.customFieldsPage.empty")}</div>}
        {items.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">
                <code>{f.field_key}</code> · {typeLabel(f.field_type)}
                {f.options?.length ? ` · ${t("settings.customFieldsPage.optionsCount", { count: f.options.length })}` : ""}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? t("settings.customFieldsPage.editField") : t("settings.customFieldsPage.newFieldTitle")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>{t("settings.customFieldsPage.label")}</Label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({
                    ...editing, label: e.target.value,
                    field_key: editing.id ? editing.field_key : slugify(e.target.value),
                  })}
                  placeholder={t("settings.customFieldsPage.labelPlaceholder")}
                />
              </div>
              <div>
                <Label>{t("settings.customFieldsPage.key")}</Label>
                <Input
                  value={editing.field_key}
                  onChange={(e) => setEditing({ ...editing, field_key: slugify(e.target.value) })}
                  disabled={!!editing.id}
                />
              </div>
              <div>
                <Label>{t("settings.customFieldsPage.type")}</Label>
                <Select value={editing.field_type} onValueChange={(v: FieldType) => setEditing({ ...editing, field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_KEYS.map(v => <SelectItem key={v} value={v}>{typeLabel(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(["select", "multiselect"].includes(editing.field_type)) && (
                <div>
                  <Label>{t("settings.customFieldsPage.options")}</Label>
                  <textarea
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    rows={5}
                    value={(editing.options ?? []).join("\n")}
                    onChange={(e) => setEditing({ ...editing, options: e.target.value.split("\n") })}
                    onBlur={(e) => setEditing({ ...editing, options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                    placeholder={t("settings.customFieldsPage.optionsPlaceholder")}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("settings.customFieldsPage.cancel")}</Button>
            <Button onClick={save}>{t("settings.customFieldsPage.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
