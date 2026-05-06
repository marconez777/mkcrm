import { forwardRef, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Search, Plus, Filter, ArrowDownUp, Image, Mic, FileText, PanelLeftClose, Pin, PinOff, MailOpen, Mail, MoreVertical, X, Archive, UserPlus, GitBranch, Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { Attendant, Lead, Stage } from "@/types/crm";
import type { FilterKey, SortKey } from "@/pages/Inbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listViews, addView, removeView, type SavedView } from "@/lib/saved-views";
import { usePrompt, useConfirm } from "@/hooks/useDialogs";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "agora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

// Cor por idade da última mensagem (SLA visual) — só destaca quando não-lido.
function ageColor(iso: string | null, isUnread: boolean): string {
  if (!iso || !isUnread) return "text-muted-foreground";
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 60) return "text-emerald-500";
  if (min < 24 * 60) return "text-amber-500";
  return "text-destructive";
}

const MsgTypeIcon = forwardRef<SVGSVGElement, { type?: string | null }>(function MsgTypeIcon({ type }, ref) {
  if (type === "image" || type === "video") return <Image ref={ref} className="h-3 w-3 opacity-60" />;
  if (type === "audio") return <Mic ref={ref} className="h-3 w-3 opacity-60" />;
  if (type === "document") return <FileText ref={ref} className="h-3 w-3 opacity-60" />;
  return null;
});

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
  loaded?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onCollapse?: () => void;
}) {
  const { leads, stages, attendants, allTags, selectedId, onSelect, loaded = true, hasMore, loadingMore, onLoadMore } = props;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const prompt = usePrompt();
  const [views, setViews] = useState<SavedView[]>(() => listViews());
  useEffect(() => {
    const refresh = () => setViews(listViews());
    window.addEventListener("saved-views-changed", refresh);
    return () => window.removeEventListener("saved-views-changed", refresh);
  }, []);
  function applyView(v: SavedView) {
    props.setFilter(v.filter);
    props.setSort(v.sort);
    props.setStageFilter(v.stageFilter);
    props.setTagFilter(v.tagFilter);
  }
  async function saveCurrentView() {
    const name = await prompt({ title: "Salvar view atual", label: "Nome da view", placeholder: "Ex: Sem resposta hoje" });
    if (!name) return;
    addView({ name, filter: props.filter, sort: props.sort, stageFilter: props.stageFilter, tagFilter: props.tagFilter });
    toast.success("View salva");
  }
  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSel() { setSelected(new Set()); }
  async function bulkPatch(p: any, msg: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("leads").update(p as any).in("id", ids);
    if (error) toast.error("Falha: " + error.message);
    else { toast.success(msg); clearSel(); }
  }
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    }, { root: scrollRef.current, rootMargin: "300px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, hasMore, leads.length]);

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
              <Button size="icon" variant="ghost" title="Views salvas"><Bookmark className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Views salvas</DropdownMenuLabel>
              {views.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma view ainda</div>
              )}
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={(e) => e.preventDefault()} className="flex items-center justify-between gap-2">
                  <button onClick={() => applyView(v)} className="flex-1 truncate text-left">{v.name}</button>
                  <button onClick={() => { removeView(v.id); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveCurrentView}>
                <BookmarkPlus className="mr-2 h-4 w-4" /> Salvar filtros atuais
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {props.onCollapse && (
            <Button size="icon" variant="ghost" onClick={props.onCollapse} title="Ocultar lista" className="hidden lg:inline-flex">
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
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
          <div className="flex flex-wrap items-center gap-1 pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    (props.stageFilter || props.tagFilter)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  <Filter className="h-3 w-3" />
                  {props.stageFilter ? (
                    <>
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: stages.find((s) => s.id === props.stageFilter)?.color }}
                      />
                      {stages.find((s) => s.id === props.stageFilter)?.name ?? "Etapa"}
                    </>
                  ) : props.tagFilter ? (
                    <>#{props.tagFilter}</>
                  ) : (
                    "Filtrar"
                  )}
                  {(props.stageFilter || props.tagFilter) && (
                    <X
                      className="h-3 w-3 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        props.setStageFilter(null);
                        props.setTagFilter(null);
                      }}
                    />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
                {stages.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Etapas
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => props.setStageFilter(null)}>
                      <span className={cn("flex-1 text-xs", !props.stageFilter && "font-semibold text-primary")}>
                        Todas etapas
                      </span>
                    </DropdownMenuItem>
                    {stages.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => props.setStageFilter(props.stageFilter === s.id ? null : s.id)}
                      >
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className={cn("flex-1 text-xs", props.stageFilter === s.id && "font-semibold text-primary")}>
                          {s.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {allTags.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Tags
                    </DropdownMenuLabel>
                    {allTags.map((t) => (
                      <DropdownMenuItem
                        key={t}
                        onClick={() => props.setTagFilter(props.tagFilter === t ? null : t)}
                      >
                        <span className={cn("flex-1 text-xs", props.tagFilter === t && "font-semibold text-primary")}>
                          #{t}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
        {!loaded && (
          <div className="p-8 text-center text-xs text-muted-foreground">Carregando…</div>
        )}
        {loaded && leads.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma conversa.</div>
        )}
        {leads.map((l) => {
          const initials = (l.name || l.phone).slice(0, 2).toUpperCase();
          const stage = stages.find((s) => s.id === l.stage_id);
          const att = attendants.find((a) => a.id === l.attendant_id);
          const isSel = selectedId === l.id;
          const isPinned = !!l.pinned_at;
          const isUnread = (l.unread_count ?? 0) > 0 || !!l.marked_unread;
          // SLA: last incoming msg older than 30min and unread → warn
          const ageMin = l.last_message_at ? (Date.now() - new Date(l.last_message_at).getTime()) / 60000 : 0;
          const slaWarn = isUnread && ageMin > 30;
          const isChecked = selected.has(l.id);
          const bulkMode = selected.size > 0;
          return (
            <div
              key={l.id}
              className={cn(
                "group relative flex w-full items-start gap-3 border-b px-3 py-2.5 transition-colors",
                isSel ? "bg-accent" : "hover:bg-muted/50",
                isPinned && "bg-amber-500/5",
                isChecked && "bg-primary/5",
              )}
            >
              <button
                onClick={(e) => {
                  if (bulkMode) { e.preventDefault(); toggleSel(l.id); } else onSelect(l);
                }}
                className="flex flex-1 items-start gap-3 text-left min-w-0"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary overflow-hidden",
                      (bulkMode || isChecked) && "opacity-0",
                    )}
                  >
                    {l.avatar_url
                      ? <img src={l.avatar_url} alt="" className="h-full w-full object-cover" />
                      : initials}
                  </div>
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-full bg-card transition-opacity",
                      bulkMode || isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSel(l.id); }}
                  >
                    <Checkbox checked={isChecked} className="h-5 w-5" />
                  </span>
                  {att && !bulkMode && !isChecked && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                      style={{ background: att.color }}
                      title={att.name}
                    />
                  )}
                  {slaWarn && !bulkMode && !isChecked && (
                    <span className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" title={`Sem resposta há ${Math.floor(ageMin)}m`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("flex items-center gap-1 truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>
                      {isPinned && <Pin className="h-3 w-3 fill-amber-500 text-amber-500" />}
                      {l.name || l.phone}
                    </span>
                    <span className={cn("shrink-0 text-[10px] font-medium tabular-nums", ageColor(l.last_message_at, isUnread))}>{timeAgo(l.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("line-clamp-1 flex items-center gap-1 text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>
                      <MsgTypeIcon />
                      {l.last_message_preview || "—"}
                    </span>
                    {(l.unread_count ?? 0) > 0 ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{l.unread_count}</span>
                    ) : l.marked_unread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={async () => {
                    await supabase.from("leads").update({ pinned_at: isPinned ? null : new Date().toISOString() }).eq("id", l.id);
                  }}>
                    {isPinned ? <><PinOff className="mr-2 h-4 w-4" />Desafixar</> : <><Pin className="mr-2 h-4 w-4" />Fixar no topo</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    if (l.marked_unread || (l.unread_count ?? 0) > 0) {
                      await supabase.from("leads").update({ marked_unread: false, unread_count: 0 }).eq("id", l.id);
                    } else {
                      await supabase.from("leads").update({ marked_unread: true }).eq("id", l.id);
                    }
                  }}>
                    {isUnread ? <><MailOpen className="mr-2 h-4 w-4" />Marcar como lida</> : <><Mail className="mr-2 h-4 w-4" />Marcar não lida</>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-3 text-[11px] text-muted-foreground">
            {loadingMore && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {loadingMore ? "Carregando…" : ""}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover px-2 py-1.5 shadow-lg">
          <span className="px-2 text-xs font-medium tabular-nums">{selected.size} selecionada{selected.size > 1 ? "s" : ""}</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs"
            onClick={() => bulkPatch({ marked_unread: false, unread_count: 0 }, "Marcadas como lidas")}>
            <MailOpen className="h-3.5 w-3.5" /> Lida
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <UserPlus className="h-3.5 w-3.5" /> Atendente
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => bulkPatch({ attendant_id: null }, "Removido atendente")}>Não atribuído</DropdownMenuItem>
              {attendants.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => bulkPatch({ attendant_id: a.id }, `Atribuído a ${a.name}`)}>
                  <span className="mr-2 h-2 w-2 rounded-full" style={{ background: a.color }} />{a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <GitBranch className="h-3.5 w-3.5" /> Etapa
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {stages.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => bulkPatch({ stage_id: s.id }, `Movidas para ${s.name}`)}>
                  <span className="mr-2 h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs"
            onClick={() => bulkPatch({ archived_at: new Date().toISOString() }, "Arquivadas")}>
            <Archive className="h-3.5 w-3.5" /> Arquivar
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSel} title="Limpar seleção">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}
