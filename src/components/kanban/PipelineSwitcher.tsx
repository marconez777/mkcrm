import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline, Lead } from "@/types/crm";
import { ChevronDown, Plus, Star, Pencil, Trash2, MessageCircleMore, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  pipelines: Pipeline[];
  current: Pipeline | null;
  leads: Lead[];
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function PipelineSwitcher({ pipelines, current, leads, onSelect, onNew }: Props) {
  const [open, setOpen] = useState(false);

  const counts = new Map<string, number>();
  leads.forEach((l) => l.pipeline_id && counts.set(l.pipeline_id, (counts.get(l.pipeline_id) ?? 0) + 1));

  async function setDefault(id: string) {
    await supabase.from("pipelines").update({ is_default: false }).eq("is_default", true);
    await supabase.from("pipelines").update({ is_default: true }).eq("id", id);
    toast.success("Funil padrão atualizado");
  }
  async function rename(p: Pipeline) {
    const name = prompt("Novo nome", p.name);
    if (!name?.trim() || name === p.name) return;
    await supabase.from("pipelines").update({ name: name.trim() }).eq("id", p.id);
  }
  async function remove(p: Pipeline) {
    const used = counts.get(p.id) ?? 0;
    if (used > 0) { toast.error(`Não dá: ${used} leads neste funil. Mova-os antes.`); return; }
    if (!confirm(`Excluir o funil "${p.name}"?`)) return;
    const { error } = await supabase.from("pipelines").delete().eq("id", p.id);
    if (error) toast.error(error.message);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="-ml-1 flex items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-muted">
          {current && (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.color }} />
          )}
          <h1 className="text-lg font-semibold">{current?.name ?? "Pipeline"}</h1>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Funis
        </DropdownMenuLabel>
        {pipelines.map((p) => {
          const active = p.id === current?.id;
          return (
            <div key={p.id} className="group flex items-center gap-1 px-1">
              <button
                onClick={() => { onSelect(p.id); setOpen(false); }}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${active ? "bg-accent" : "hover:bg-muted"}`}
              >
                {active ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />}
                <span className="truncate">{p.name}</span>
                {p.is_default && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
                {p.kind === "sales" && p.whatsapp_instance_id && (
                  <MessageCircleMore className="h-3 w-3 shrink-0 text-success" />
                )}
                <span className="ml-auto rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {counts.get(p.id) ?? 0}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => rename(p)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />Renomear
                  </DropdownMenuItem>
                  {!p.is_default && (
                    <DropdownMenuItem onClick={() => setDefault(p.id)}>
                      <Star className="mr-2 h-3.5 w-3.5" />Definir como padrão
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => remove(p)} className="text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { onNew(); setOpen(false); }}>
          <Plus className="mr-2 h-4 w-4" />Adicionar funil
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
