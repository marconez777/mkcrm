import { Search, Plus, Filter, ArrowDownUp, Image, Mic, FileText, Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Attendant, Lead, Stage } from "@/types/crm";
import type { FilterKey, SortKey } from "@/pages/Inbox";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "agora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function MsgTypeIcon({ type }: { type?: string | null }) {
  if (type === "image" || type === "video") return <Image className="h-3 w-3 opacity-60" />;
  if (type === "audio") return <Mic className="h-3 w-3 opacity-60" />;
  if (type === "document") return <FileText className="h-3 w-3 opacity-60" />;
  return null;
}

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "unassigned", label: "Sem atribuição" },
  { key: "archived", label: "Arquivadas" },
];

export default function ConversationList(props: {
  leads: Lead[];
  stages: Stage[];
  attendants: Attendant[];
  allTags: string[];
  selectedId: string | null;
  onSelect: (l: Lead) => void;
  q: string; setQ: (v: string) => void;
  filter: FilterKey; setFilter: (v: FilterKey) => void;
  sort: SortKey; setSort: (v: SortKey) => void;
  stageFilter: string | null; setStageFilter: (v: string | null) => void;
  tagFilter: string | null; setTagFilter: (v: string | null) => void;
  onNew: () => void;
}) {
  const { leads, stages, attendants, allTags, selectedId, onSelect } = props;

  return (
    <>
      <header className="space-y-2 border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Conversas</h1>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
          <div className="flex-1" />
          <Button size="icon" variant="ghost" onClick={props.onNew} title="Nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title="Ordenar"><ArrowDownUp className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => props.setSort("recent")}>Mais recentes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.setSort("unread")}>Não lidas primeiro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.setSort("oldest")}>Mais antigas</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="inbox-search" placeholder="Buscar (nome, telefone, mensagem)" value={props.q} onChange={(e) => props.setQ(e.target.value)} className="h-9 pl-8" />
        </div>
        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 scrollbar-thin">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => props.setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors",
                props.filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(stages.length > 0 || allTags.length > 0) && (
          <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 pb-1 scrollbar-thin">
            <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />
            <button
              onClick={() => props.setStageFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                !props.stageFilter ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >Todas etapas</button>
            {stages.map((s) => (
              <button
                key={s.id}
                onClick={() => props.setStageFilter(props.stageFilter === s.id ? null : s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                  props.stageFilter === s.id ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => props.setTagFilter(props.tagFilter === t ? null : t)}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                  props.tagFilter === t ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >#{t}</button>
            ))}
          </div>
        )}
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma conversa.</div>
        )}
        {leads.map((l) => {
          const initials = (l.name || l.phone).slice(0, 2).toUpperCase();
          const stage = stages.find((s) => s.id === l.stage_id);
          const att = attendants.find((a) => a.id === l.attendant_id);
          const isSel = selectedId === l.id;
          return (
            <button
              key={l.id}
              onClick={() => onSelect(l)}
              className={cn(
                "flex w-full items-start gap-3 border-b px-3 py-2.5 text-left transition-colors",
                isSel ? "bg-accent" : "hover:bg-muted/50",
              )}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
                {att && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                    style={{ background: att.color }}
                    title={att.name}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{l.name || l.phone}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(l.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MsgTypeIcon />
                    {l.last_message_preview || "—"}
                  </span>
                  {l.unread_count > 0 ? (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{l.unread_count}</span>
                  ) : null}
                </div>
                {stage && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color }} />
                      {stage.name}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
