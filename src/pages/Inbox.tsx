import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLeads, useStages } from "@/hooks/useCrm";
import { useAttendants } from "@/hooks/useAttendants";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/crm";
import ConversationList from "@/components/inbox/ConversationList";
import ChatPane from "@/components/inbox/ChatPane";
import ContextRail from "@/components/inbox/ContextRail";
import NewConversationDialog from "@/components/inbox/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { playPing } from "@/hooks/useUnreadTitle";

export type FilterKey = "all" | "unread" | "mine" | "unassigned" | "archived";
export type SortKey = "recent" | "unread" | "oldest";

export default function InboxPage() {
  const { leads, loaded: leadsLoaded } = useLeads();
  const { stages } = useStages();
  const { attendants } = useAttendants();
  const nav = useNavigate();
  const { leadId } = useParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [showList, setShowList] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const lastSeenRef = useRef<string | null>(null);
  const openLeadRef = useRef<string | undefined>(leadId);
  openLeadRef.current = leadId;

  // Ping on incoming messages when tab not focused (and not the open chat)
  useEffect(() => {
    const ch = supabase
      .channel(`inbox-ping-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "from_me=eq.false" },
        (payload) => {
          const m = payload.new as any;
          if (lastSeenRef.current === m.id) return;
          lastSeenRef.current = m.id;
          if (m.lead_id === openLeadRef.current) return;
          if (document.hidden) playPing();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => (l.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let arr = leads.filter((l) => {
      if (filter === "archived") {
        if (!l.archived_at) return false;
      } else if (l.archived_at) return false;
      if (filter === "unread" && (l.unread_count ?? 0) <= 0 && !l.marked_unread) return false;
      if (filter === "unassigned" && l.attendant_id) return false;
      if (stageFilter && l.stage_id !== stageFilter) return false;
      if (tagFilter && !(l.tags ?? []).includes(tagFilter)) return false;
      if (ql) {
        const hay = `${l.name ?? ""} ${l.phone} ${l.last_message_preview ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
    if (sort === "oldest") {
      arr.sort((a, b) => (a.last_message_at ?? "").localeCompare(b.last_message_at ?? ""));
    } else if (sort === "unread") {
      arr.sort((a, b) => {
        if ((b.unread_count ?? 0) !== (a.unread_count ?? 0)) return (b.unread_count ?? 0) - (a.unread_count ?? 0);
        return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
      });
    } else {
      arr.sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
    }
    // Pinned first regardless of sort
    arr.sort((a, b) => {
      const ap = a.pinned_at ? 1 : 0;
      const bp = b.pinned_at ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });
    return arr;
  }, [leads, q, filter, stageFilter, tagFilter, sort]);

  const selected: Lead | null = useMemo(
    () => leads.find((l) => l.id === leadId) ?? null,
    [leads, leadId],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") {
        e.preventDefault();
        (document.getElementById("inbox-search") as HTMLInputElement | null)?.focus();
      } else if (e.key === "Escape") {
        if (selected) nav("/inbox");
      } else if (e.key === "j" || e.key === "k") {
        const idx = filtered.findIndex((l) => l.id === selected?.id);
        const next = e.key === "j" ? idx + 1 : idx - 1;
        if (next >= 0 && next < filtered.length) nav(`/inbox/${filtered[next].id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, nav]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* List */}
      {showList && (
        <aside
          className={`flex w-full shrink-0 flex-col border-r bg-card lg:w-80 ${selected ? "hidden lg:flex" : "flex"}`}
        >
          <ConversationList
            leads={filtered}
            stages={stages}
            attendants={attendants}
            allTags={allTags}
            selectedId={selected?.id ?? null}
            onSelect={(l) => nav(`/inbox/${l.id}`)}
            q={q}
            setQ={setQ}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            onNew={() => setNewOpen(true)}
            loaded={leadsLoaded}
            onCollapse={() => setShowList(false)}
          />
        </aside>
      )}

      {/* Chat */}
      <section className={`flex min-w-0 flex-1 flex-col ${!selected ? "hidden lg:flex" : "flex"}`}>
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b bg-card px-3 py-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => nav("/inbox")} className="lg:hidden">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowList((v) => !v)}
                  title={showList ? "Ocultar lista" : "Mostrar lista"}
                  className="hidden lg:inline-flex"
                >
                  {showList ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowContext((v) => !v)}
                title={showContext ? "Ocultar contexto" : "Mostrar contexto"}
                className="hidden lg:inline-flex"
              >
                {showContext ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
            <ChatPane lead={selected} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Plus className="h-6 w-6 opacity-40" />
              </div>
              Selecione uma conversa à esquerda
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Nova conversa
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Context */}
      {selected && showContext && (
        <aside className="hidden w-80 shrink-0 flex-col border-l bg-card lg:flex">
          <ContextRail lead={selected} stages={stages} attendants={attendants} onClose={() => setShowContext(false)} />
        </aside>
      )}

      <NewConversationDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(lid) => { setNewOpen(false); nav(`/inbox/${lid}`); }}
        defaultStageId={stages[0]?.id ?? null}
      />
    </div>
  );
}
