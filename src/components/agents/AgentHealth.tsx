import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";

type Check = { label: string; ok: boolean; warn?: boolean; detail?: string };

export function AgentHealth({ agentId }: { agentId: string }) {
  const [checks, setChecks] = useState<Check[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setChecks(null);
      const [agentRes, docsRes, tracesRes, evalsRes] = await Promise.all([
        supabase.from("ai_agents").select("draft_mode, enabled, api_key, builder_verified_at, system_prompt").eq("id", agentId).maybeSingle(),
        supabase.from("ai_documents").select("id", { count: "exact", head: true }).eq("agent_id", agentId),
        supabase.from("agent_traces")
          .select("id, error, created_at")
          .eq("agent_id", agentId)
          .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .limit(500),
        supabase.from("agent_evals").select("last_passed").eq("agent_id", agentId),
      ]);

      const a: any = agentRes.data ?? {};
      const docsCount = docsRes.count ?? 0;
      const traces = (tracesRes.data as any[]) ?? [];
      const errors = traces.filter((t) => t.error).length;
      const evalsData = (evalsRes.data as any[]) ?? [];
      const evalsTotal = evalsData.length;
      const evalsPassed = evalsData.filter((e) => e.last_passed === true).length;

      const verified = a.builder_verified_at
        ? (Date.now() - new Date(a.builder_verified_at).getTime()) < 30 * 86400 * 1000
        : false;

      const list: Check[] = [
        { label: "Provedor", ok: !!a.api_key, detail: a.api_key ? "Chave configurada" : "Sem chave de API" },
        { label: "Conexão verificada", ok: verified, warn: !verified, detail: a.builder_verified_at ? `Último ping: ${new Date(a.builder_verified_at).toLocaleDateString("pt-BR")}` : "Nunca testada" },
        { label: "Base de conhecimento", ok: docsCount > 0, warn: docsCount === 0, detail: `${docsCount} documento(s)` },
        { label: "Erros (24h)", ok: errors === 0, warn: errors > 0 && errors < 5, detail: `${errors} erro(s) em ${traces.length} execuções` },
        { label: "Evals", ok: evalsTotal === 0 || evalsPassed / Math.max(1, evalsTotal) >= 0.7, warn: evalsTotal > 0 && evalsPassed / evalsTotal < 0.7, detail: evalsTotal ? `${evalsPassed}/${evalsTotal} passando` : "Sem evals" },
      ];

      if (alive) setChecks(list);
    })();
    return () => { alive = false; };
  }, [agentId]);

  if (!checks) {
    return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando saúde…</Badge>;
  }

  const fail = checks.filter((c) => !c.ok && !c.warn).length;
  const warn = checks.filter((c) => c.warn).length;
  const status: "green" | "yellow" | "red" = fail > 0 ? "red" : warn > 0 ? "yellow" : "green";

  const Icon = status === "green" ? ShieldCheck : status === "yellow" ? AlertTriangle : ShieldAlert;
  const variant = status === "green" ? "default" : status === "yellow" ? "secondary" : "destructive";
  const label = status === "green" ? "Saudável" : status === "yellow" ? "Atenção" : "Crítico";

  return (
    <div className="group relative inline-block">
      <Badge variant={variant as any} className="gap-1 cursor-help">
        <Icon className="h-3 w-3" /> {label}
      </Badge>
      <div className="absolute right-0 top-full z-50 mt-1 hidden w-72 rounded-md border bg-popover p-2 text-xs shadow-md group-hover:block">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-1 border-b last:border-b-0">
            <span className={c.ok ? "text-foreground" : c.warn ? "text-yellow-600" : "text-destructive"}>
              {c.ok ? "✓" : c.warn ? "!" : "✕"} {c.label}
            </span>
            <span className="text-muted-foreground text-right">{c.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
