import { cn } from "@/lib/utils";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed";

const LABELS: Record<string, string> = {
  draft: "rascunho",
  scheduled: "agendada",
  sending: "enviando",
  sent: "enviada",
  paused: "pausada",
  failed: "falhou",
};

const STYLES: Record<string, string> = {
  draft: "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-fg))] border-[hsl(var(--status-draft-fg)/0.15)]",
  scheduled: "bg-[hsl(var(--status-scheduled-bg))] text-[hsl(var(--status-scheduled-fg))] border-[hsl(var(--status-scheduled-fg)/0.15)]",
  sending: "bg-[hsl(var(--status-sending-bg))] text-[hsl(var(--status-sending-fg))] border-[hsl(var(--status-sending-fg)/0.15)]",
  sent: "bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))] border-[hsl(var(--status-sent-fg)/0.15)]",
  paused: "bg-[hsl(var(--status-paused-bg))] text-[hsl(var(--status-paused-fg))] border-[hsl(var(--status-paused-fg)/0.15)]",
  failed: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] border-[hsl(var(--status-failed-fg)/0.15)]",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const style = STYLES[status] ?? STYLES.draft;
  const label = LABELS[status] ?? status;
  const isSending = status === "sending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
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
