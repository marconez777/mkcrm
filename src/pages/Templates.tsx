import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [items, setItems] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const customDefs = useCustomFieldDefsFull();
  const confirm = useConfirm();

  const load = async () => {
    const { data } = await supabase.from("message_templates").select("*").order("name");
    setItems((data ?? []) as any);
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
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Templates</h2>
          <Button size="sm" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="px-2">
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selected?.id === t.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{t.name}</span>
              {t.shortcut && <Badge variant="outline" className="text-[10px]">/{t.shortcut}</Badge>}
            </button>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum template.</p>
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
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
