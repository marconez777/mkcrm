import { AlertCircle } from "lucide-react";
import type { ProviderError } from "@/lib/builder-errors";

interface Props {
  error: ProviderError;
  className?: string;
}

export function ProviderErrorBanner({ error, className }: Props) {
  return (
    <div
      className={`flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm ${
        className ?? ""
      }`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-destructive">{error.title}</p>
        <p className="text-foreground/80">{error.message}</p>
        {error.action && <p className="text-xs text-muted-foreground">{error.action}</p>}
      </div>
    </div>
  );
}
