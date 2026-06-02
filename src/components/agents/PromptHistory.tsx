import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useDialogs";

type Version = {
  id: string;
  prompt: string;
  source: string;
  summary: string | null;
  created_at: string;
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Edição manual",
  builder: "Gerado pelo Construtor",
  eval_patch: "Patch de avaliação",
  revert: "Restauração",
  initial: "Versão inicial",
};

function diffStats(a: string, b: string) {
  const la = a.split("\n").length;
  const lb = b.split("\n").length;
  const ca = a.length;
  const cb = b.length;
  return { lines: lb - la, chars: cb - ca };
}

export function PromptHistory({
  agentId,
  currentPrompt,
  onRevert,
}: {
  agentId: string;
  currentPrompt: string;
  onRevert: (prompt: string, fromVersionId: string) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Version | null>(null);
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_prompt_versions")
      .select("id, prompt, source, summary, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    setVersions((data as Version[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleRevert = async (v: Version) => {
    if (!(await confirm({
      title: "Restaurar versão?",
      description: "O prompt atual será substituído. Salve para aplicar.",
      confirmLabel: "Restaurar",
    }))) return;
    onRevert(v.prompt, v.id);
    toast.success("Versão carregada. Clique em Salvar para aplicar.");
  };

  const sortedDates = useMemo(
    () => versions.map((v) => new Date(v.created_at).toLocaleString("pt-BR")),
    [versions],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <History className="h-3 w-3" /> Cada vez que você salva, uma nova versão é criada automaticamente.
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {versions.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Sem versões salvas ainda.
        </p>
      )}

      <div className="space-y-2">
        {versions.map((v, i) => {
          const prev = versions[i + 1]?.prompt ?? "";
          const stats = diffStats(prev, v.prompt);
          const isLatest = i === 0;
          return (
            <div key={v.id} className="rounded border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={isLatest ? "default" : "secondary"} className="text-[10px]">
                    {isLatest ? "Atual" : `v-${versions.length - i}`}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {SOURCE_LABEL[v.source] ?? v.source}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{sortedDates[i]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(v)}>
                    <Eye className="h-3 w-3 mr-1" /> Ver
                  </Button>
                  {!isLatest && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevert(v)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                    </Button>
                  )}
                </div>
              </div>
              {v.summary && <p className="text-xs text-muted-foreground mt-1">{v.summary}</p>}
              {i < versions.length - 1 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {stats.lines >= 0 ? "+" : ""}{stats.lines} linhas · {stats.chars >= 0 ? "+" : ""}{stats.chars} chars vs anterior
                </p>
              )}
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="rounded border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">
              Prévia: {SOURCE_LABEL[preview.source] ?? preview.source} ·{" "}
              {new Date(preview.created_at).toLocaleString("pt-BR")}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Fechar</Button>
          </div>
          <ScrollArea className="h-64 rounded border bg-muted/30 p-2">
            <pre className="text-xs whitespace-pre-wrap break-words">{preview.prompt}</pre>
          </ScrollArea>
          {preview.prompt !== currentPrompt && (
            <Button size="sm" onClick={() => handleRevert(preview)}>
              <RotateCcw className="h-3 w-3 mr-1" /> Restaurar esta versão
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
