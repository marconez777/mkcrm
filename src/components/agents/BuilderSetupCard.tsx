import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBuilderError, type ProviderError } from "@/lib/builder-errors";
import { ProviderErrorBanner } from "./ProviderErrorBanner";

interface BuilderLike {
  id: string;
  name: string;
  api_key_set: boolean;
  model: string;
  provider: string;
  builder_verified_at?: string | null;
}

interface Props {
  builder: BuilderLike | null;
  clinicId: string | null;
  selected: boolean;
  onSelect: () => void;
  onVerified: () => void;
}

type Status = "missing_key" | "unverified" | "verified" | "error";

function deriveStatus(b: BuilderLike | null): Status {
  if (!b) return "missing_key";
  if (!b.api_key_set) return "missing_key";
  if (!b.builder_verified_at) return "unverified";
  return "verified";
}

const STATUS_DOT: Record<Status, { dot: string; label: string; pulse: boolean }> = {
  missing_key: { dot: "bg-destructive", label: "Sem chave", pulse: false },
  unverified: { dot: "bg-amber-500", label: "Não testado", pulse: true },
  verified: { dot: "bg-emerald-500", label: "Operacional", pulse: true },
  error: { dot: "bg-destructive", label: "Erro", pulse: false },
};

export function BuilderSetupCard({ builder, clinicId, selected, onSelect, onVerified }: Props) {
  const [testing, setTesting] = useState(false);
  const [lastError, setLastError] = useState<ProviderError | null>(null);
  const [status, setStatus] = useState<Status>(deriveStatus(builder));

  const derived = deriveStatus(builder);
  const effective: Status = lastError ? "error" : derived !== status && !testing ? derived : status;

  const test = async () => {
    if (!clinicId) {
      toast.error("Empresa não identificada.");
      return;
    }
    setTesting(true);
    setLastError(null);
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: { action: "ping", clinic_id: clinicId },
    });
    setTesting(false);
    if (error) {
      const parsed = parseBuilderError({ message: error.message });
      setLastError(parsed);
      setStatus("error");
      toast.error(parsed.title);
      return;
    }
    const result = data as { ok?: boolean; latency_ms?: number } & Record<string, unknown>;
    if (!result?.ok) {
      const parsed = parseBuilderError(result);
      setLastError(parsed);
      setStatus("error");
      toast.error(parsed.title);
      return;
    }
    setStatus("verified");
    setLastError(null);
    toast.success(`Construtor operacional (${result.latency_ms} ms)`);
    onVerified();
  };

  const meta = STATUS_DOT[effective];

  return (
    <div className="border-b border-border/50 px-3 py-2.5">
      <button
        type="button"
        onClick={onSelect}
        className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
          selected ? "bg-muted" : "hover:bg-muted/40"
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {meta.pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${meta.dot} opacity-60`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Construtor
          </p>
          <p className="truncate text-xs text-foreground">{builder?.model ?? meta.label}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground"
          disabled={testing || !builder?.api_key_set}
          onClick={(e) => {
            e.stopPropagation();
            test();
          }}
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
        </Button>
      </button>

      {effective === "missing_key" && (
        <p className="mt-1 px-2 text-[11px] text-muted-foreground">
          Adicione sua chave de API ao lado.
        </p>
      )}

      {lastError && <ProviderErrorBanner error={lastError} className="mt-2 text-xs" />}
    </div>
  );
}
