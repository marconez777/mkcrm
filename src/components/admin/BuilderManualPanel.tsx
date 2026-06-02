import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, History, RotateCcw, Eye, Save } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

type Version = {
  id: string;
  version: number;
  content: string;
  summary: string | null;
  source: "seed" | "manual" | "revert";
  published_at: string;
  published_by: string | null;
  is_active: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  seed: "Seed inicial",
  manual: "Edição manual",
  revert: "Restauração",
};

function diffStats(a: string, b: string) {
  const la = a.split("\n").length;
  const lb = b.split("\n").length;
  return { lines: lb - la, chars: b.length - a.length };
}

export default function BuilderManualPanel() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [summary, setSummary] = useState("");
  const [preview, setPreview] = useState<Version | null>(null);
  const confirm = useConfirm();

  const active = useMemo(() => versions.find((v) => v.is_active) ?? null, [versions]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("builder_manual_versions" as any)
      .select("id, version, content, summary, source, published_at, published_by, is_active")
      .order("version", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    const rows = (data as Version[]) ?? [];
    setVersions(rows);
    const act = rows.find((v) => v.is_active);
    if (act) setDraftContent(act.content);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = active ? draftContent !== active.content : draftContent.length > 0;
  const stats = active ? diffStats(active.content, draftContent) : { lines: 0, chars: 0 };

  async function publish() {
    if (!dirty) {
      toast.info("Nenhuma alteração para publicar.");
      return;
    }
    if (draftContent.trim().length < 50) {
      toast.error("Conteúdo muito curto (mínimo 50 caracteres).");
      return;
    }
    if (summary.trim().length < 3 || summary.trim().length > 120) {
      toast.error("Resumo precisa ter entre 3 e 120 caracteres.");
      return;
    }
    if (
      !(await confirm({
        title: "Publicar nova versão?",
        description: "O Builder vai começar a usar este conteúdo em até 60 segundos.",
        confirmLabel: "Publicar",
      }))
    )
      return;
    setSaving(true);
    const { data, error } = await supabase.rpc("publish_builder_manual" as any, {
      _content: draftContent,
      _summary: summary.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Publicada v${data}. O Builder vai usar em até 60s.`);
    setSummary("");
    await load();
  }

  async function revert(v: Version) {
    if (
      !(await confirm({
        title: `Reverter para v${v.version}?`,
        description: "Uma nova versão será criada com o conteúdo dessa.",
        confirmLabel: "Reverter",
      }))
    )
      return;
    const { data, error } = await supabase.rpc("revert_builder_manual" as any, {
      _version: v.version,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Criada v${data} a partir de v${v.version}.`);
    await load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Editor do manual</span>
            {active && (
              <Badge variant="default" className="text-[10px]">
                Ativa: v{active.version}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            className="font-mono text-xs min-h-[420px]"
            placeholder="Conteúdo markdown do manual..."
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{draftContent.length} caracteres · {draftContent.split("\n").length} linhas</span>
            {dirty && (
              <Badge variant="secondary" className="text-[10px]">
                {stats.lines >= 0 ? "+" : ""}
                {stats.lines} linhas · {stats.chars >= 0 ? "+" : ""}
                {stats.chars} chars vs ativa
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Resumo da mudança (obrigatório)</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ex.: Adicionada seção sobre nicho clínica"
              maxLength={120}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => active && setDraftContent(active.content)}
              disabled={!dirty || saving}
            >
              Descartar alterações
            </Button>
            <Button size="sm" onClick={publish} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Publicar nova versão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico
            </span>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-2">
              {versions.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-6">Sem versões.</p>
              )}
              {versions.map((v) => (
                <div key={v.id} className="rounded border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={v.is_active ? "default" : "secondary"} className="text-[10px]">
                      v{v.version}
                      {v.is_active ? " · ativa" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABEL[v.source] ?? v.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.published_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {v.summary && <p className="text-xs text-muted-foreground mt-1">{v.summary}</p>}
                  <div className="flex items-center gap-1 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setPreview(v)}>
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                    {!v.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => revert(v)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reverter
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              v{preview?.version} · {preview ? SOURCE_LABEL[preview.source] ?? preview.source : ""} ·{" "}
              {preview ? new Date(preview.published_at).toLocaleString("pt-BR") : ""}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] rounded border bg-muted/30 p-3">
            <pre className="text-xs whitespace-pre-wrap break-words">{preview?.content}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
