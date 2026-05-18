import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

type Link = { visitor_id: string; link_source: string | null; linked_at: string };
type Visitor = {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  first_landing_page: string | null;
  first_referrer: string | null;
  first_source: string | null;
};
type Session = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  landing_page: string | null;
  referrer: string | null;
  source: string | null;
  device_type: string | null;
  browser: string | null;
};
type Event = {
  id: string;
  event_time: string;
  event_name: string;
  event_type: string;
  page_url: string | null;
  referrer: string | null;
  session_id: string | null;
  visitor_id: string;
  properties: Record<string, unknown> | null;
};

const HIGHLIGHT = new Set([
  "page_view", "whatsapp_click", "form_start", "form_submit_attempt",
  "form_submit_success", "mental_test_start", "mental_test_completed", "lead_identified",
]);

function eventVariant(name: string): "default" | "secondary" | "outline" {
  if (name === "lead_identified" || name === "form_submit_success") return "default";
  if (HIGHLIGHT.has(name)) return "secondary";
  return "outline";
}

export default function LeadJourneyTab({ leadId, clinicId }: { leadId: string; clinicId: string }) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<Link[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: linkRows } = await supabase
        .from("tracking_identity_links")
        .select("visitor_id, link_source, linked_at")
        .eq("clinic_id", clinicId)
        .eq("lead_id", leadId)
        .order("linked_at", { ascending: true });

      const visitorIds = Array.from(new Set((linkRows || []).map((l) => l.visitor_id)));

      const [vRes, sRes, eRes] = await Promise.all([
        visitorIds.length
          ? supabase.from("tracking_visitors")
              .select("visitor_id, first_seen_at, last_seen_at, first_landing_page, first_referrer, first_source")
              .eq("clinic_id", clinicId).in("visitor_id", visitorIds)
          : Promise.resolve({ data: [] as Visitor[] } as any),
        visitorIds.length
          ? supabase.from("tracking_sessions")
              .select("session_id, visitor_id, started_at, landing_page, referrer, source, device_type, browser")
              .eq("clinic_id", clinicId).in("visitor_id", visitorIds)
              .order("started_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [] as Session[] } as any),
        supabase.from("tracking_events")
          .select("id, event_time, event_name, event_type, page_url, referrer, session_id, visitor_id, properties")
          .eq("clinic_id", clinicId)
          .or(`lead_id.eq.${leadId}${visitorIds.length ? `,visitor_id.in.(${visitorIds.map((v) => `"${v}"`).join(",")})` : ""}`)
          .order("event_time", { ascending: false })
          .limit(200),
      ]);

      if (cancelled) return;
      setLinks((linkRows || []) as Link[]);
      setVisitors((vRes.data || []) as Visitor[]);
      setSessions((sRes.data || []) as Session[]);
      setEvents((eRes.data || []) as Event[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leadId, clinicId]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (visitors.length === 0 && events.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Nenhum visitante anônimo foi vinculado a este lead ainda.
      </div>
    );
  }

  const primary = visitors[0];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-5">
        {primary && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">visitor_id principal</div><div className="truncate font-mono">{primary.visitor_id}</div></div>
              <div><div className="text-muted-foreground">Primeira visita</div><div>{new Date(primary.first_seen_at).toLocaleString("pt-BR")}</div></div>
              <div><div className="text-muted-foreground">Última visita</div><div>{new Date(primary.last_seen_at).toLocaleString("pt-BR")}</div></div>
              <div><div className="text-muted-foreground">Primeira página</div><div className="truncate">{primary.first_landing_page || "—"}</div></div>
              <div><div className="text-muted-foreground">Primeira origem</div><div>{primary.first_source || primary.first_referrer || "—"}</div></div>
              <div><div className="text-muted-foreground">Sessões / Eventos</div><div>{sessions.length} / {events.length}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground">Último evento</div><div>{events[0] ? `${events[0].event_name} — ${new Date(events[0].event_time).toLocaleString("pt-BR")}` : "—"}</div></div>
            </CardContent>
          </Card>
        )}

        {links.length > 1 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Visitantes vinculados ({links.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {links.map((l) => (
                <div key={l.visitor_id} className="flex items-center justify-between">
                  <span className="font-mono">{l.visitor_id}</span>
                  <span className="text-muted-foreground">{l.link_source || "—"} · {new Date(l.linked_at).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Linha do tempo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && <div className="text-xs text-muted-foreground">Sem eventos.</div>}
            {events.map((e) => (
              <div key={e.id} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={eventVariant(e.event_name)}>{e.event_name}</Badge>
                    <span className="text-muted-foreground">{new Date(e.event_time).toLocaleString("pt-BR")}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">{e.session_id?.slice(0, 8) || "—"}</span>
                </div>
                {e.page_url && <div className="truncate text-muted-foreground">{e.page_url}</div>}
                {e.referrer && <div className="truncate text-muted-foreground">ref: {e.referrer}</div>}
                {e.properties && Object.keys(e.properties).length > 0 && (
                  <pre className="overflow-x-auto rounded bg-muted px-2 py-1 text-[10px]">{JSON.stringify(e.properties, null, 2)}</pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sessões ({sessions.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {sessions.length === 0 && <div className="text-muted-foreground">Sem sessões.</div>}
            {sessions.map((s) => (
              <div key={s.session_id} className="flex items-center justify-between border-b py-1 last:border-0">
                <span className="font-mono">{s.session_id.slice(0, 12)}</span>
                <span className="text-muted-foreground">{s.source || s.referrer || "direct"} · {s.device_type || "—"}</span>
                <span className="text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
