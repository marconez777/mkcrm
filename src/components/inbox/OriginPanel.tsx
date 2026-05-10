import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Compass, ExternalLink, Globe, Link2, Loader2, MousePointerClick, Smartphone, FileText } from "lucide-react";
import { toast } from "sonner";

type Sess = {
  id: string;
  ref: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  first_url: string | null;
  first_referrer: string | null;
  landing_title: string | null;
  device: string | null;
  created_at: string;
};
type Ev = { id: string; type: string; url: string | null; title: string | null; occurred_at: string };

const ORIGIN_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  paid: "Tráfego pago",
  google_organic: "Google orgânico",
  instagram: "Instagram",
  facebook: "Facebook",
  direct: "Direto",
  referral: "Indicação / referral",
};

function timeFmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function OriginPanel({
  leadId,
  trackingSessionId,
  originSource,
  originConfidence,
  onChanged,
}: {
  leadId: string;
  trackingSessionId: string | null;
  originSource: string | null;
  originConfidence: string | null;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [session, setSession] = useState<Sess | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSrc, setDraftSrc] = useState(originSource ?? "");
  const [linking, setLinking] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [unclaimed, setUnclaimed] = useState<Sess[]>([]);

  useEffect(() => {
    setDraftSrc(originSource ?? "");
  }, [originSource]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!trackingSessionId) { setSession(null); setEvents([]); return; }
      setLoading(true);
      const [{ data: s }, { data: ev }] = await Promise.all([
        supabase.from("tracking_sessions" as any).select("*").eq("id", trackingSessionId).maybeSingle(),
        supabase.from("tracking_events" as any).select("id, type, url, title, occurred_at").eq("session_id", trackingSessionId).order("occurred_at").limit(200),
      ]);
      if (!active) return;
      setSession(s as Sess | null);
      setEvents((ev as Ev[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [trackingSessionId]);

  async function loadUnclaimed() {
    const { data } = await supabase.from("tracking_sessions" as any)
      .select("*").is("lead_id", null)
      .order("created_at", { ascending: false }).limit(20);
    setUnclaimed((data as Sess[]) ?? []);
  }

  async function saveOrigin() {
    const { error } = await supabase.from("leads")
      .update({ origin_source: draftSrc || null, origin_confidence: draftSrc ? "manual" : null } as any)
      .eq("id", leadId);
    if (error) { toast.error(error.message); return; }
    toast.success("Origem atualizada");
    setEditing(false);
    onChanged?.();
  }

  async function linkSession(sessionId: string) {
    setLinking(true);
    const { data, error } = await supabase.functions.invoke("tracking-claim", {
      body: { lead_id: leadId, manual_session_id: sessionId },
    });
    setLinking(false);
    if (error || (data as any)?.error) { toast.error("Falha: " + (error?.message || (data as any)?.error)); return; }
    toast.success("Sessão linkada");
    onChanged?.();
  }

  async function linkByRef() {
    if (!refInput.trim()) return;
    setLinking(true);
    const { data, error } = await supabase.functions.invoke("tracking-claim", {
      body: { lead_id: leadId, ref: refInput.trim() },
    });
    setLinking(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.not_found) { toast.error("Sessão com esse ref não encontrada"); return; }
    if ((data as any)?.session_id) {
      toast.success("Sessão linkada");
      setRefInput("");
      onChanged?.();
    } else {
      toast.error("Não foi possível linkar");
    }
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1.5"><Compass className="h-3 w-3" /> Origem & Navegação</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="space-y-3">
          {/* Origem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Origem detectada</Label>
              <button onClick={() => setEditing(!editing)} className="text-[10px] text-muted-foreground hover:text-foreground">
                {editing ? "cancelar" : "editar"}
              </button>
            </div>
            {!editing ? (
              <div className="flex items-center gap-2">
                {originSource ? (
                  <>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
                      {ORIGIN_LABELS[originSource] ?? originSource}
                    </span>
                    {originConfidence && (
                      <span className="text-[10px] text-muted-foreground">
                        ({originConfidence === "tracking" ? "via pixel" : originConfidence === "manual" ? "manual" : "conversa"})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] italic text-muted-foreground">Em branco — preencha manualmente</span>
                )}
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Select value={draftSrc || "__none"} onValueChange={(v) => setDraftSrc(v === "__none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— em branco —</SelectItem>
                    {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={saveOrigin}>Salvar</Button>
              </div>
            )}
          </div>

          {/* Sessão */}
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</div>
          ) : session ? (
            <div className="space-y-2 rounded border bg-background p-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium"><Globe className="h-3 w-3" /> Sessão de captura</div>
              <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
                {session.utm_source && <><span>utm_source</span><span className="text-foreground">{session.utm_source}</span></>}
                {session.utm_medium && <><span>utm_medium</span><span className="text-foreground">{session.utm_medium}</span></>}
                {session.utm_campaign && <><span>utm_campaign</span><span className="text-foreground">{session.utm_campaign}</span></>}
                {session.first_referrer && <><span>referrer</span><span className="text-foreground truncate" title={session.first_referrer}>{session.first_referrer}</span></>}
                {session.first_url && <><span>landing</span><a href={session.first_url} target="_blank" rel="noreferrer" className="text-primary truncate flex items-center gap-1" title={session.first_url}>{session.first_url} <ExternalLink className="h-2.5 w-2.5" /></a></>}
                {session.device && <><span><Smartphone className="inline h-2.5 w-2.5 mr-0.5" />device</span><span className="text-foreground">{session.device}</span></>}
                <span>captura</span><span className="text-foreground">{timeFmt(session.created_at)}</span>
                {session.ref && <><span>ref</span><span className="font-mono text-foreground">{session.ref}</span></>}
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed bg-background p-2 text-[11px] text-muted-foreground">
              Sem sessão de tracking ligada. Use o link manual abaixo se identificar a navegação.
            </div>
          )}

          {/* Timeline */}
          {events.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Timeline ({events.length})</Label>
              <ol className="relative space-y-1.5 border-l border-border pl-3 text-[11px] max-h-64 overflow-y-auto">
                {events.map((e) => {
                  const Icon = e.type === "wa_click" ? MousePointerClick : e.type === "click" ? MousePointerClick : FileText;
                  const color = e.type === "wa_click" ? "bg-emerald-500" : "bg-muted-foreground";
                  return (
                    <li key={e.id} className="relative">
                      <span className={`absolute -left-[14px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-1.5 w-1.5 text-white" />
                      </span>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate" title={e.url ?? ""}>
                          <span className="text-muted-foreground">[{e.type}]</span> {e.title || e.url || "—"}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeFmt(e.occurred_at)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Curadoria manual */}
          <div className="space-y-1.5 border-t pt-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" /> Curadoria manual</Label>
            <div className="flex gap-1.5">
              <Input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="Cole o ref (ex.: a3f9c2b1)"
                className="h-8 text-xs"
              />
              <Button size="sm" disabled={linking || !refInput.trim()} onClick={linkByRef}>Linkar</Button>
            </div>
            <button
              onClick={() => { if (unclaimed.length === 0) loadUnclaimed(); else setUnclaimed([]); }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {unclaimed.length === 0 ? "Ver últimas sessões não linkadas" : "Ocultar"}
            </button>
            {unclaimed.length > 0 && (
              <div className="space-y-1 rounded border bg-background p-2 max-h-48 overflow-y-auto">
                {unclaimed.map((s) => (
                  <button
                    key={s.id}
                    disabled={linking}
                    onClick={() => linkSession(s.id)}
                    className="w-full text-left text-[11px] hover:bg-muted/40 rounded px-1 py-0.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{s.utm_source ?? "—"} / {s.utm_medium ?? "—"}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeFmt(s.created_at)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.first_url ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
