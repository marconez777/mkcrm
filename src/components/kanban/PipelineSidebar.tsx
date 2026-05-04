import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pipeline, Lead } from "@/types/crm";
import { Plus, MoreVertical, Star, Pencil, Trash2, MessageCircleMore, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  pipelines: Pipeline[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  leads: Lead[];
}

export default function PipelineSidebar({ pipelines, currentId, onSelect, onNew, leads }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => l.pipeline_id && m.set(l.pipeline_id, (m.get(l.pipeline_id) ?? 0) + 1));
    return m;
  }, [leads]);

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

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-r bg-card py-3">
        <button onClick={() => setCollapsed(false)} className="rounded p-2 hover:bg-accent" title="Expandir lista de funis">
          <FolderKanban className="h-4 w-4" />
        </button>
        {pipelines.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`h-7 w-7 rounded-md border-2 ${currentId === p.id ? "border-foreground" : "border-transparent"}`}
            style={{ background: p.color }}
            title={p.name}
          />
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funis</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-xs text-muted-foreground hover:text-foreground" title="Recolher">
          ‹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {pipelines.map((p) => {
          const active = p.id === currentId;
          return (
            <div
              key={p.id}
              className={`group mb-1 flex items-center gap-2 rounded-md px-2 py-2 transition ${active ? "bg-accent" : "hover:bg-muted"}`}
            >
              <button onClick={() => onSelect(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className={`truncate text-sm ${active ? "font-semibold text-foreground" : "text-foreground/80"}`}>{p.name}</span>
                {p.is_default && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
                {p.kind === "sales" && p.whatsapp_instance_id && (
                  <MessageCircleMore className="h-3 w-3 shrink-0 text-success" />
                )}
              </button>
              <span className="rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                {counts.get(p.id) ?? 0}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 transition group-hover:opacity-100" aria-label="Opções">
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
      </div>

      <div className="border-t p-2">
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />Adicionar funil
        </Button>
      </div>
    </aside>
  );
}

export function usePipelineLeadCounts() {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
}
