import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { ORIGIN_CHANNELS, ORIGIN_LABELS, type OriginChannel } from "@/lib/lead-origin";

type Props = {
  lead: {
    id: string;
    origin_channel?: string | null;
    origin_label?: string | null;
    origin_detail?: string | null;
    origin_locked_by_user?: boolean | null;
  };
  onChange?: (patch: Record<string, any>) => void;
};

/**
 * Origem do lead — campo nativo, preenchido automaticamente pelo tracking.
 * Editar manualmente trava o campo (a automação não sobrescreve mais).
 */
export default function LeadOriginField({ lead, onChange }: Props) {
  const [channel, setChannel] = useState<string>(lead.origin_channel ?? "unknown");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChannel(lead.origin_channel ?? "unknown");
  }, [lead.id, lead.origin_channel]);

  async function save(next: OriginChannel) {
    setChannel(next);
    setSaving(true);
    const patch = {
      origin_channel: next,
      origin_label: ORIGIN_LABELS[next],
      origin_source_type: "manual:user",
      origin_locked_by_user: true,
      origin_updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    setSaving(false);
    if (error) {
      console.error("[LeadOriginField] update failed", error.message);
      setChannel(lead.origin_channel ?? "unknown");
      return;
    }
    onChange?.(patch);
  }

  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground">
        Origem
        {lead.origin_locked_by_user && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Definida manualmente — a automação não sobrescreve.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="grid min-h-[28px] grid-cols-[auto_1fr] items-start gap-x-3 py-1">
        <span className="pt-0.5 text-xs text-foreground">Canal</span>
        <Select value={channel} onValueChange={(v) => save(v as OriginChannel)} disabled={saving}>
          <SelectTrigger className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-sm text-foreground shadow-none hover:text-primary focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {ORIGIN_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>{ORIGIN_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {lead.origin_detail && (
        <div className="pt-0.5 text-[11px] text-muted-foreground" title={lead.origin_detail}>
          {lead.origin_detail}
        </div>
      )}
    </div>
  );
}
