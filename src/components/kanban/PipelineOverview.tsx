import type { Stage, Lead } from "@/types/crm";
import { useMemo } from "react";

interface Props {
  stages: Stage[];
  leads: Lead[];
  scrollX: number;
  viewportW: number;
  contentW: number;
  onJump: (id: string) => void;
}

export default function PipelineOverview({ stages, leads, scrollX, viewportW, contentW, onJump }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => l.stage_id && m.set(l.stage_id, (m.get(l.stage_id) ?? 0) + 1));
    return m;
  }, [leads]);

  const ratio = contentW > 0 ? viewportW / contentW : 1;
  const offset = contentW > 0 ? scrollX / contentW : 0;

  return (
    <div className="border-b bg-card/50 px-6 py-2">
      <div className="relative">
        <div className="flex gap-1 overflow-hidden">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-left transition hover:border-primary hover:bg-accent"
              title={s.name}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color || "hsl(var(--muted-foreground))" }} />
              <span className="truncate text-[11px] font-medium">{s.name}</span>
              <span className="ml-auto shrink-0 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                {counts.get(s.id) ?? 0}
              </span>
            </button>
          ))}
        </div>
        {contentW > viewportW && (
          <div className="pointer-events-none mt-1 h-1 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60 transition-[width,margin]"
              style={{ width: `${Math.max(ratio * 100, 4)}%`, marginLeft: `${offset * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
