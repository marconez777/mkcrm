import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  // campaigns
  draft: "rascunho",
  scheduled: "agendada",
  sending: "enviando",
  sent: "enviada",
  paused: "pausada",
  failed: "falhou",
  // logs
  delivered: "entregue",
  opened: "aberto",
  clicked: "clicado",
  bounced: "bounce",
  complained: "spam",
  // queue
  pending: "pendente",
  cancelled: "cancelado",
};

// All styles reuse the same token system from index.css (--status-*-bg/fg).
const STYLES: Record<string, string> = {
  draft:
    "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-fg))] border-[hsl(var(--status-draft-fg)/0.15)]",
  scheduled:
    "bg-[hsl(var(--status-scheduled-bg))] text-[hsl(var(--status-scheduled-fg))] border-[hsl(var(--status-scheduled-fg)/0.15)]",
  sending:
    "bg-[hsl(var(--status-sending-bg))] text-[hsl(var(--status-sending-fg))] border-[hsl(var(--status-sending-fg)/0.15)]",
  sent: "bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))] border-[hsl(var(--status-sent-fg)/0.15)]",
  paused:
    "bg-[hsl(var(--status-paused-bg))] text-[hsl(var(--status-paused-fg))] border-[hsl(var(--status-paused-fg)/0.15)]",
  failed:
    "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] border-[hsl(var(--status-failed-fg)/0.15)]",
  // mapped reuses
  delivered:
    "bg-[hsl(var(--status-sending-bg))] text-[hsl(var(--status-sending-fg))] border-[hsl(var(--status-sending-fg)/0.15)]",
  opened:
    "bg-[hsl(var(--status-scheduled-bg))] text-[hsl(var(--status-scheduled-fg))] border-[hsl(var(--status-scheduled-fg)/0.15)]",
  clicked:
    "bg-[hsl(var(--status-clicked-bg))] text-[hsl(var(--status-clicked-fg))] border-[hsl(var(--status-clicked-fg)/0.15)]",
  bounced:
    "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] border-[hsl(var(--status-failed-fg)/0.15)]",
  complained:
    "bg-[hsl(var(--status-paused-bg))] text-[hsl(var(--status-paused-fg))] border-[hsl(var(--status-paused-fg)/0.15)]",
  pending:
    "bg-[hsl(var(--status-paused-bg))] text-[hsl(var(--status-paused-fg))] border-[hsl(var(--status-paused-fg)/0.15)]",
  cancelled:
    "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-fg))] border-[hsl(var(--status-draft-fg)/0.15)]",
};

const SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
} as const;

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const style = STYLES[status] ?? STYLES.draft;
  const label = LABELS[status] ?? status;
  const isSending = status === "sending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        SIZES[size],
        style,
        className,
      )}
    >
      {isSending && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--status-sending-fg))] opacity-60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-sending-fg))]" />
        </span>
      )}
      {label}
    </span>
  );
}
