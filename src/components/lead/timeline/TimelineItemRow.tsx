import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Globe, GitBranch, StickyNote, CheckSquare, Activity, ChevronDown, ChevronRight,
} from "lucide-react";
import type { TimelineCategory, TimelineItem } from "./types";

const ICON: Record<TimelineCategory, React.ComponentType<{ className?: string }>> = {
  site: Globe,
  stage: GitBranch,
  note: StickyNote,
  task: CheckSquare,
  crm: Activity,
};

const DOT_COLOR: Record<TimelineCategory, string> = {
  site: "bg-sky-500",
  stage: "bg-violet-500",
  note: "bg-amber-500",
  task: "bg-blue-500",
  crm: "bg-muted-foreground",
};


function relative(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.round((now - t) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function TimelineItemRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const Icon = ICON[item.category];
  const expandable = !!item.meta && Object.keys(item.meta).length > 0;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-white", DOT_COLOR[item.category])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-3">
        <button
          type="button"
          disabled={!expandable}
          onClick={() => expandable && setOpen((v) => !v)}
          className={cn(
            "flex w-full items-start justify-between gap-2 rounded-md border p-2 text-left text-xs transition",
            expandable ? "hover:bg-accent" : "cursor-default"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {expandable ? (open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />) : null}
              <span className="truncate font-medium">{item.title}</span>
            </div>
            {item.subtitle && <div className="mt-0.5 truncate text-muted-foreground">{item.subtitle}</div>}
            {item.actorName && !item.subtitle?.includes(item.actorName) && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">por {item.actorName}</div>
            )}
          </div>
          <span title={new Date(item.at).toLocaleString("pt-BR")} className="shrink-0 whitespace-nowrap text-muted-foreground">
            {relative(item.at)}
          </span>
        </button>
        {open && expandable && (
          <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 text-[10px]">{JSON.stringify(item.meta, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
