import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import TimelineFilters from "./timeline/TimelineFilters";
import TimelineItemRow from "./timeline/TimelineItemRow";
import {
  CATEGORY_ORDER,
  compareItems,
  trackingEventTitle,
  crmEventTitle,
  MILESTONE_TRACKING_EVENTS,
  type TimelineCategory,
  type TimelineItem,
} from "./timeline/types";

const STORAGE_KEY = "lead_timeline_filters";

function loadFilters(): Set<TimelineCategory> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as TimelineCategory[];
      if (Array.isArray(arr) && arr.length) return new Set(arr);
    }
  } catch {/* noop */}
  return new Set(CATEGORY_ORDER);
}

export default function LeadTimelineTab({ leadId, clinicId }: { leadId: string; clinicId?: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [summary, setSummary] = useState<{
    visitorIds: string[];
    firstSource?: string | null;
    firstLandingPage?: string | null;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    sessionsCount: number;
    trackingEventsCount: number;
  } | null>(null);
  const [active, setActive] = useState<Set<TimelineCategory>>(() => loadFilters());
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(active))); } catch {/* noop */}
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setVisibleCount(100);

      let resolvedClinicId = clinicId;
      if (!resolvedClinicId) {
        const { data: leadRow } = await supabase.from("leads").select("clinic_id").eq("id", leadId).maybeSingle();
        resolvedClinicId = (leadRow as { clinic_id?: string } | null)?.clinic_id;
      }
      if (!resolvedClinicId) { setLoading(false); return; }

      // 1) identity links to get visitor_ids
      const { data: linkRows } = await supabase
        .from("tracking_identity_links")
        .select("visitor_id")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("linked_at", { ascending: true });
      const visitorIds = Array.from(new Set((linkRows || []).map((l) => l.visitor_id)));

      const trackingEventsQuery = supabase
        .from("tracking_events")
        .select("id, event_time, event_name, event_type, page_url, referrer, session_id, visitor_id, properties")
        .eq("clinic_id", resolvedClinicId)
        .or(`lead_id.eq.${leadId}${visitorIds.length ? `,visitor_id.in.(${visitorIds.map((v) => `"${v}"`).join(",")})` : ""}`)
        .order("event_time", { ascending: false })
        .limit(200);

      const firstMessageQuery = supabase
        .from("messages")
        .select("id, timestamp, from_me")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: true })
        .limit(1);

      const stageHistoryQuery = supabase
        .from("lead_stage_history")
        .select("id, moved_at, from_stage_id, to_stage_id, moved_by_user_id, moved_by_agent_id")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("moved_at", { ascending: false })
        .limit(200);

      const notesQuery = supabase
        .from("lead_internal_notes")
        .select("id, created_at, author_name, text")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(200);

      const crmEventsQuery = supabase
        .from("lead_events")
        .select("id, created_at, type, payload, actor_user_id")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(200);

      const tasksQuery = supabase
        .from("lead_tasks")
        .select("id, title, created_at, done_at, due_at")
        .eq("clinic_id", resolvedClinicId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(200);

      const visitorsQuery = visitorIds.length
        ? supabase
            .from("tracking_visitors")
            .select("visitor_id, first_seen_at, last_seen_at, first_landing_page, first_referrer, first_source")
            .eq("clinic_id", resolvedClinicId)
            .in("visitor_id", visitorIds)
        : Promise.resolve({ data: [] } as { data: never[] });

      const sessionsCountQuery = visitorIds.length
        ? supabase
            .from("tracking_sessions")
            .select("session_id", { count: "exact", head: true })
            .eq("clinic_id", resolvedClinicId)
            .in("visitor_id", visitorIds)
        : Promise.resolve({ count: 0 } as { count: number });

      const [trackRes, firstMsgRes, stageRes, noteRes, crmRes, taskRes, visitorsRes, sessionsCountRes] = await Promise.all([
        trackingEventsQuery, firstMessageQuery, stageHistoryQuery, notesQuery, crmEventsQuery, tasksQuery,
        visitorsQuery, sessionsCountQuery,
      ]);

      // Stage names lookup
      const stageIds = new Set<string>();
      (stageRes.data || []).forEach((r) => {
        if (r.from_stage_id) stageIds.add(r.from_stage_id);
        if (r.to_stage_id) stageIds.add(r.to_stage_id);
      });
      const stageMap = new Map<string, string>();
      if (stageIds.size) {
        const { data: stageRows } = await supabase
          .from("pipeline_stages")
          .select("id, name")
          .in("id", Array.from(stageIds));
        (stageRows || []).forEach((s) => stageMap.set(s.id, s.name));
      }

      const merged: TimelineItem[] = [];

      (trackRes.data || []).forEach((e) => {
        if (!MILESTONE_TRACKING_EVENTS.has(e.event_name)) return;
        merged.push({
          id: `te-${e.id}`,
          at: e.event_time,
          category: "site",
          title: trackingEventTitle(e.event_name),
          subtitle: e.page_url || e.referrer || undefined,
          meta: { event_name: e.event_name, event_type: e.event_type, page_url: e.page_url, referrer: e.referrer, properties: e.properties, visitor_id: e.visitor_id, session_id: e.session_id },
        });
      });

      const firstMsg = (firstMsgRes.data || [])[0];
      if (firstMsg) {
        merged.push({
          id: `first-contact-${firstMsg.id}`,
          at: firstMsg.timestamp,
          category: "site",
          title: firstMsg.from_me ? "Primeiro contato (enviado pela clínica)" : "Primeiro contato no WhatsApp",
          meta: null,
        });
      }

      (stageRes.data || []).forEach((s) => {
        const from = s.from_stage_id ? stageMap.get(s.from_stage_id) || "—" : "—";
        const to = s.to_stage_id ? stageMap.get(s.to_stage_id) || "—" : "—";
        merged.push({
          id: `stg-${s.id}`,
          at: s.moved_at,
          category: "stage",
          title: `Etapa: ${from} → ${to}`,
          subtitle: s.moved_by_agent_id ? "movido por agente IA" : s.moved_by_user_id ? "movido por usuário" : undefined,
          meta: null,
        });
      });

      (noteRes.data || []).forEach((n) => {
        merged.push({
          id: `note-${n.id}`,
          at: n.created_at,
          category: "note",
          title: `Nota interna${n.author_name ? ` — ${n.author_name}` : ""}`,
          subtitle: n.text ? (n.text.length > 140 ? n.text.slice(0, 140) + "…" : n.text) : undefined,
          meta: n.text && n.text.length > 140 ? { text: n.text } : null,
        });
      });

      (crmRes.data || []).forEach((e) => {
        merged.push({
          id: `crm-${e.id}`,
          at: e.created_at,
          category: "crm",
          title: crmEventTitle(e.type),
          subtitle: undefined,
          meta: e.payload as Record<string, unknown> | null,
        });
      });

      (taskRes.data || []).forEach((t) => {
        merged.push({
          id: `task-c-${t.id}`,
          at: t.created_at,
          category: "task",
          title: `Tarefa criada: ${t.title}`,
          meta: null,
        });
        if (t.done_at) {
          merged.push({
            id: `task-d-${t.id}`,
            at: t.done_at,
            category: "task",
            title: `Tarefa concluída: ${t.title}`,
            meta: null,
          });
        }
      });

      const visitors = (visitorsRes.data || []) as Array<{ visitor_id: string; first_seen_at: string; last_seen_at: string; first_landing_page: string | null; first_referrer: string | null; first_source: string | null }>;
      const primary = visitors[0];

      if (cancelled) return;
      merged.sort(compareItems);
      setItems(merged);
      setSummary({
        visitorIds,
        firstSource: primary?.first_source || primary?.first_referrer || null,
        firstLandingPage: primary?.first_landing_page || null,
        firstSeenAt: primary?.first_seen_at || null,
        lastSeenAt: primary?.last_seen_at || null,
        sessionsCount: (sessionsCountRes as { count?: number }).count || 0,
        trackingEventsCount: (trackRes.data || []).length,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leadId, clinicId]);

  const filtered = useMemo(() => {
    const list = items.filter((i) => active.has(i.category));
    if (order === "asc") return [...list].reverse();
    return list;
  }, [items, active, order]);

  const visible = filtered.slice(0, visibleCount);

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-5">
        {summary && summary.visitorIds.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo da jornada</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">Primeira origem</div><div className="truncate">{summary.firstSource || "—"}</div></div>
              <div><div className="text-muted-foreground">Primeira página</div><div className="truncate">{summary.firstLandingPage || "—"}</div></div>
              <div><div className="text-muted-foreground">Primeira visita</div><div>{summary.firstSeenAt ? new Date(summary.firstSeenAt).toLocaleString("pt-BR") : "—"}</div></div>
              <div><div className="text-muted-foreground">Última visita</div><div>{summary.lastSeenAt ? new Date(summary.lastSeenAt).toLocaleString("pt-BR") : "—"}</div></div>
              <div><div className="text-muted-foreground">Visitantes vinculados</div><div>{summary.visitorIds.length}</div></div>
              <div><div className="text-muted-foreground">Sessões / Eventos site</div><div>{summary.sessionsCount} / {summary.trackingEventsCount}</div></div>
            </CardContent>
          </Card>
        )}

        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 pb-2 pt-1 backdrop-blur">
          <TimelineFilters
            active={active}
            onChange={setActive}
            order={order}
            onToggleOrder={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            Nenhuma atividade para os filtros selecionados.
          </div>
        ) : (
          <div className="flex flex-col">
            {visible.map((it) => <TimelineItemRow key={it.id} item={it} />)}
          </div>
        )}

        {filtered.length > visible.length && (
          <div className="flex justify-center">
            <Button size="sm" variant="outline" onClick={() => setVisibleCount((n) => n + 100)}>
              Carregar mais ({filtered.length - visible.length})
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
