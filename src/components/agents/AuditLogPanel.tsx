import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Entry = {
  id: string;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  diff: any;
};

const FIELD_LABEL: Record<string, string> = {
  system_prompt: "Prompt",
  model: "Modelo",
  provider: "Provedor",
  temperature: "Temperatura",
  enabled: "Ativo",
  tools: "Ferramentas",
  draft_mode: "Modo rascunho",
  use_hyde: "HyDE",
  use_hybrid_search: "Busca híbrida",
  use_memory: "Memória",
  planning_mode: "Modo planejamento",
  rag_top_k: "RAG top_k",
  max_iterations: "Iterações máx.",
  name: "Nome",
  description: "Descrição",
};

function fmt(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

export function AuditLogPanel({ agentId }: { agentId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, actor_user_id, created_at, diff")
        .eq("entity", "ai_agent")
        .eq("entity_id", agentId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        // sem permissão (não-admin) — esconder gracefully
        setAllowed(false);
      } else {
        setEntries((data as Entry[]) ?? []);
      }
      setLoading(false);
    })();
  }, [agentId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!allowed) {
    return <p className="text-sm text-muted-foreground">Apenas administradores da empresa podem ver a auditoria.</p>;
  }
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const changes = e.diff?.changes ?? {};
        const fields = Object.keys(changes);
        return (
          <div key={e.id} className="rounded border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
              <Badge variant="outline" className="text-[10px]">
                {fields.length} campo(s) alterado(s)
              </Badge>
            </div>
            <ul className="mt-1 space-y-1">
              {fields.map((f) => (
                <li key={f} className="text-xs">
                  <span className="font-medium">{FIELD_LABEL[f] ?? f}:</span>{" "}
                  <span className="text-muted-foreground line-through">{fmt(changes[f]?.from)}</span>{" "}
                  → <span>{fmt(changes[f]?.to)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
