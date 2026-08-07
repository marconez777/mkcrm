import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Filter } from "lucide-react";

type PipelineRow = {
  id: string;
  name: string;
  is_default: boolean | null;
  is_system: boolean | null;
};

interface Props {
  clinicId: string;
  canManage: boolean;
}

export default function AIPipelinesCard({ clinicId, canManage }: Props) {
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: pipes }, { data: clinic }] = await Promise.all([
      supabase
        .from("pipelines")
        .select("id, name, is_default, is_system")
        .order("position", { ascending: true }),
      supabase
        .from("clinics")
        .select("settings")
        .eq("id", clinicId)
        .maybeSingle(),
    ]);

    setPipelines((pipes ?? []) as PipelineRow[]);
    const settings = ((clinic as any)?.settings ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(settings.ai_target_pipeline_ids)
      ? (settings.ai_target_pipeline_ids as string[])
      : [];
    setSelectedIds(ids);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  async function save() {
    setSaving(true);
    const { data: cur } = await supabase
      .from("clinics")
      .select("settings")
      .eq("id", clinicId)
      .maybeSingle();

    const settings = ((cur as any)?.settings ?? {}) as Record<string, unknown>;
    const next = { ...settings, ai_target_pipeline_ids: selectedIds };

    const { error } = await supabase
      .from("clinics")
      .update({ settings: next as never })
      .eq("id", clinicId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Filtro de pipelines salvo");
  }

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
    );
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Filter className="h-4 w-4" />
            Filtro de Pipelines da IA
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecione em quais pipelines a Inteligência Artificial e as automações devem atuar.
            Se nenhum estiver selecionado, as automações atuarão em todos os pipelines por padrão.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={save} disabled={loading || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Salvar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {pipelines.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <Checkbox
                  id={`ai-pipe-${p.id}`}
                  checked={checked}
                  disabled={!canManage}
                  onCheckedChange={(c) => toggle(p.id, !!c)}
                />
                <Label htmlFor={`ai-pipe-${p.id}`} className="cursor-pointer text-sm">
                  {p.name}{" "}
                  {p.is_default && (
                    <span className="text-xs text-muted-foreground">(Padrão)</span>
                  )}
                </Label>
              </div>
            );
          })}
          {pipelines.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum pipeline encontrado.</p>
          )}
        </div>
      )}
    </Card>
  );
}
