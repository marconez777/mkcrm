import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Save } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";
import { useCustomFieldDefsFull } from "@/hooks/useCustomFieldDefs";

type Template = {
  id: string;
  name: string;
  shortcut: string | null;
  content: string;
  description: string | null;
};

const VARIABLES = ["{{nome}}", "{{primeiro_nome}}", "{{telefone}}", "{{email}}", "{{empresa}}"];

export default function Templates() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const customDefs = useCustomFieldDefsFull();
  const confirm = useConfirm();

  const load = async () => {
    const data = await fetchAllPaged<any>(() => supabase.from("message_templates").select("*").order("name"));
    setItems(data as any);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data, error } = await supabase
      .from("message_templates")
      .insert({ name: "Novo template", content: "Olá {{primeiro_nome}}, ", shortcut: null })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    await load();
    setSelected(data as any);
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("message_templates")
      .update({
        name: selected.name,
        shortcut: selected.shortcut || null,
        content: selected.content,
        description: selected.description,
      })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Template salvo");
    load();
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Excluir template?", confirmLabel: "Excluir", destructive: true }))) return;
    await supabase.from("message_templates").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const insertVar = (v: string) => {
    if (!selected) return;
    setSelected({ ...selected, content: (selected.content || "") + v });
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
      <aside className="w-72 shrink-0 border-r bg-muted/10">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("templates.sidebarTitle")} <span className="ml-1 text-foreground/60">· {items.length}</span>
          </h2>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={create} title={t("templates.newTemplate")}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="px-2 pb-3">
          {items.map((t) => {
            const isActive = selected?.id === t.id;
            const initials = (t.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")) || "T";
            let hash = 0;
            for (let i = 0; i < t.name.length; i++) hash = (hash * 31 + t.name.charCodeAt(i)) | 0;
            const hue = Math.abs(hash) % 360;
            const avatarStyle = { backgroundColor: `hsl(${hue} 55% 28%)`, color: `hsl(${hue} 70% 88%)` };
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`relative mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                  isActive ? "bg-muted" : "hover:bg-muted/40"
                }`}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={avatarStyle}>
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    {t.shortcut ? `//${t.shortcut}` : this.t?.("templates.noShortcut") ?? "sem atalho"}
                  </p>
                </div>
              </button>
            );
          })}
          <button
            onClick={create}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md border border-dashed border-border/60 px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span>{t("templates.newTemplate")}</span>
          </button>
          {items.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">{t("templates.empty")}</p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie um template.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Editar template</h1>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4" />Salvar</Button>
              </div>
            </div>

            <Card className="space-y-4 p-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Atalho (opcional, ex: ola)</Label>
                <Input
                  value={selected.shortcut ?? ""}
                  onChange={(e) => setSelected({ ...selected, shortcut: e.target.value })}
                  placeholder="ola"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={selected.description ?? ""}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  rows={8}
                  value={selected.content}
                  onChange={(e) => setSelected({ ...selected, content: e.target.value })}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {VARIABLES.map((v) => (
                    <Button key={v} size="sm" variant="outline" type="button" onClick={() => insertVar(v)}>
                      {v}
                    </Button>
                  ))}
                  {customDefs.map((f) => {
                    const isDate = f.field_type === "date" || f.field_type === "datetime";
                    const base = `{{campo.${f.field_key}}}`;
                    return (
                      <span key={f.field_key} className="contents">
                        <Button size="sm" variant="outline" type="button" onClick={() => insertVar(base)} title={f.label}>
                          {base}
                        </Button>
                        {isDate && (
                          <>
                            <Button size="sm" variant="outline" type="button" onClick={() => insertVar(`{{campo.${f.field_key}:data}}`)} title={`${f.label} — apenas data`}>
                              {`{{campo.${f.field_key}:data}}`}
                            </Button>
                            <Button size="sm" variant="outline" type="button" onClick={() => insertVar(`{{campo.${f.field_key}:hora}}`)} title={`${f.label} — apenas hora`}>
                              {`{{campo.${f.field_key}:hora}}`}
                            </Button>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
                {customDefs.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Para campos de data, use também <code className="rounded bg-muted px-1">:data</code>, <code className="rounded bg-muted px-1">:hora</code>, <code className="rounded bg-muted px-1">:dia_semana</code> ou <code className="rounded bg-muted px-1">:extenso</code>.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
