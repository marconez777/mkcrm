import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Usage = { feature: string; day: string; events: number; users: number; clinics: number };
type Dead = { feature: string; last_event: string | null; total_events: number };
type ErrSummary = { day: string; surface: string; severity: string; count: number };
type ErrRow = {
  id: string; created_at: string; surface: string; severity: string;
  route: string | null; function_name: string | null;
  error_message: string; error_stack: string | null;
};

export default function ObservabilityPanel() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [dead, setDead] = useState<Dead[]>([]);
  const [errSum, setErrSum] = useState<ErrSummary[]>([]);
  const [errors, setErrors] = useState<ErrRow[]>([]);
  const [days, setDays] = useState("7");
  const [severity, setSeverity] = useState("all");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<ErrRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = Number(days);
      const [{ data: u }, { data: dd }, { data: s }] = await Promise.all([
        supabase.rpc("admin_feature_usage", { _days: d }),
        supabase.rpc("admin_dead_features", { _days: 30 }),
        supabase.rpc("admin_error_summary", { _days: d }),
      ]);
      setUsage((u as any) ?? []);
      setDead((dd as any) ?? []);
      setErrSum((s as any) ?? []);

      let q = supabase.from("error_events").select("*").order("created_at", { ascending: false }).limit(100);
      if (severity !== "all") q = q.eq("severity", severity);
      const { data: errs } = await q;
      setErrors((errs as any) ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [days, severity]);

  // Agrega usage por feature
  const usageByFeature = usage.reduce<Record<string, { events: number; users: Set<string>; clinics: Set<string> }>>((acc, r) => {
    const k = r.feature;
    if (!acc[k]) acc[k] = { events: 0, users: new Set(), clinics: new Set() };
    acc[k].events += Number(r.events);
    return acc;
  }, {});
  const featureRows = Object.entries(usageByFeature).sort((a, b) => b[1].events - a[1].events);

  const totalEvents = usage.reduce((a, r) => a + Number(r.events), 0);
  const totalErrors = errSum.reduce((a, r) => a + Number(r.count), 0);
  const fatalCount = errSum.filter((r) => r.severity === "fatal" || r.severity === "error").reduce((a, r) => a + Number(r.count), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24h</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidade</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="fatal">Fatal</SelectItem>
          </SelectContent>
        </Select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Eventos no período</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totalEvents.toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Erros no período</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totalErrors.toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Error+Fatal</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{fatalCount.toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Features sem uso 30d</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{dead.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Uso por feature</CardTitle></CardHeader>
        <CardContent>
          {featureRows.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem eventos no período.</div>
          ) : (
            <div className="space-y-1">
              {featureRows.map(([feature, agg]) => {
                const max = featureRows[0][1].events || 1;
                const pct = (agg.events / max) * 100;
                return (
                  <div key={feature} className="grid grid-cols-[180px_1fr_80px] gap-2 items-center text-xs">
                    <span className="font-medium truncate">{feature}</span>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-right text-muted-foreground">{agg.events.toLocaleString("pt-BR")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Features sem uso há mais de 30 dias</CardTitle></CardHeader>
        <CardContent>
          {dead.length === 0 ? <div className="text-xs text-muted-foreground">Tudo em uso 🎉</div> : (
            <div className="rounded-md border divide-y">
              {dead.map((d) => (
                <div key={d.feature} className="px-3 py-2 text-xs flex justify-between">
                  <span className="font-medium">{d.feature}</span>
                  <span className="text-muted-foreground">último: {d.last_event ? new Date(d.last_event).toLocaleDateString("pt-BR") : "nunca"} · {d.total_events} eventos</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Erros recentes</CardTitle></CardHeader>
        <CardContent>
          {errors.length === 0 ? <div className="text-xs text-muted-foreground">Sem erros registrados.</div> : (
            <div className="rounded-md border divide-y">
              {errors.map((e) => (
                <button key={e.id} onClick={() => setOpen(e)} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 grid grid-cols-[140px_80px_80px_1fr] gap-2 items-baseline">
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                  <Badge variant={e.severity === "fatal" || e.severity === "error" ? "destructive" : "outline"}>{e.severity}</Badge>
                  <span className="text-muted-foreground">{e.surface}</span>
                  <span className="truncate font-medium">{e.error_message}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(null)}>
          <div className="max-w-2xl w-full max-h-[80vh] overflow-auto rounded-lg bg-background p-4 border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={open.severity === "fatal" || open.severity === "error" ? "destructive" : "outline"}>{open.severity}</Badge>
              <Badge variant="outline">{open.surface}</Badge>
              {open.route && <span className="text-xs text-muted-foreground">{open.route}</span>}
              {open.function_name && <span className="text-xs text-muted-foreground">{open.function_name}</span>}
            </div>
            <div className="text-sm font-semibold mb-2">{open.error_message}</div>
            <pre className="text-[11px] bg-muted p-2 rounded overflow-auto whitespace-pre-wrap">{open.error_stack ?? "(sem stack)"}</pre>
            <div className="text-xs text-muted-foreground mt-2">{new Date(open.created_at).toLocaleString("pt-BR")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
