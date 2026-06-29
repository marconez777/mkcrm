import { useState } from "react";
import { Wrench, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const STATUS_LABEL: Record<Status, { text: string; color: string; Icon: typeof Wrench }> = {
  missing_key: { text: "sem chave", color: "bg-destructive/20 text-destructive", Icon: AlertTriangle },
  unverified: { text: "não testado", color: "bg-amber-500/20 text-amber-700 dark:text-amber-400", Icon: AlertTriangle },
  verified: { text: "operacional", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2 },
  error: { text: "erro", color: "bg-destructive/20 text-destructive", Icon: AlertTriangle },
};

export function BuilderSetupCard({ builder, clinicId, selected, onSelect, onVerified }: Props) {
  const [testing, setTesting] = useState(false);
  const [lastError, setLastError] = useState<ProviderError | null>(null);
  const [status, setStatus] = useState<Status>(deriveStatus(builder));

  // Re-derive when builder prop changes
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

  const meta = STATUS_LABEL[effective];
  const Icon = meta.Icon;

  return (
    <div className="m-3 rounded-lg border bg-background p-3 shadow-sm">
      <button
        type="button"
        onClick={onSelect}
        className={`mb-2 flex w-full items-center gap-2 rounded-md p-1 text-left ${
          selected ? "bg-accent" : "hover:bg-accent/40"
        }`}
      >
        <Wrench className="h-4 w-4 text-primary" />
        <div className="flex-1 truncate">
          <p className="text-sm font-semibold">Construtor de Agentes</p>
          <p className="truncate text-[11px] text-muted-foreground">{builder?.model ?? "—"}</p>
        </div>
        <Badge variant="secondary" className={`gap-1 text-[10px] ${meta.color}`}>
          <Icon className="h-3 w-3" />
          {meta.text}
        </Badge>
      </button>

      {effective === "missing_key" && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Adicione sua chave de API no painel ao lado para começar.
        </p>
      )}
      {effective === "unverified" && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Teste a conexão antes de usar o assistente de criação.
        </p>
      )}

      <Button
        size="sm"
        variant={effective === "verified" ? "outline" : "default"}
        className="w-full"
        disabled={testing || !builder?.api_key_set}
        onClick={test}
      >
        {testing ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Testando…
          </>
        ) : (
          "Testar conexão"
        )}
      </Button>

      {lastError && <ProviderErrorBanner error={lastError} className="mt-2 text-xs" />}
    </div>
  );
}
