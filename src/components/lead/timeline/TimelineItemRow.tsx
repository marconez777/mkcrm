import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Globe, GitBranch, StickyNote, CheckSquare, Activity, ChevronDown, ChevronRight, Bot
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

function EventDiagnosticPayload({ meta }: { meta: any }) {
  if (!meta) return null;

  if (meta.changes) {
    return (
      <div className="mt-1 flex flex-col gap-2 rounded bg-muted px-3 py-2 text-[10px]">
        {Object.entries(meta.changes).map(([key, diff]: [string, any]) => (
          <div key={key} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">{key}</span>
            <div className="mt-1 flex flex-col gap-1 whitespace-pre-wrap break-words">
              {diff?.from && (
                <div className="rounded bg-background/50 p-1.5 text-muted-foreground line-through opacity-70">
                  {String(diff.from)}
                </div>
              )}
              {diff?.to && (
                <div className="rounded bg-background p-1.5 text-foreground shadow-sm border">
                  {String(diff.to)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (meta.reasons || meta.message_id) {
    return (
      <div className="mt-1 rounded bg-muted px-2 py-1.5 text-[10px]">
        {meta.reasons && (
          <div className="mb-1 whitespace-pre-wrap break-words">
            <span className="font-semibold">Motivo: </span>
            {Array.isArray(meta.reasons) ? meta.reasons.join(", ") : meta.reasons}
          </div>
        )}
        {meta.message_id && (
          <div className="text-muted-foreground">Msg ID: {meta.message_id}</div>
        )}
      </div>
    );
  }

  if (meta.res) {
    const res = meta.res as any;
    return (
      <div className="mt-1 rounded bg-muted px-2 py-1.5 text-[10px]">
        {res.moved !== undefined && (
          <div className="whitespace-pre-wrap break-words">
            <span className="font-semibold">Ação do Sistema: </span>
            {res.moved ? "O lead foi movido automaticamente." : "Condição não atingida para mover."}
          </div>
        )}
        {res.reason && (
          <div className="mt-0.5 text-muted-foreground whitespace-pre-wrap break-words">
            Detalhe: {res.reason}
          </div>
        )}
      </div>
    );
  }

  const renderValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "object") {
      return (
        <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l-2 border-border/50 pl-2">
          {Object.entries(val).map(([k, v]) => (
            <div key={k}>
              <span className="font-medium text-muted-foreground">{k}: </span>
              <span className="text-foreground">{renderValue(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return String(val);
  };

  return (
    <div className="mt-1 flex flex-col gap-1 whitespace-pre-wrap break-words rounded bg-muted px-3 py-2 text-[10px]">
      <span className="font-semibold text-muted-foreground mb-1 border-b border-border/50 pb-1">Detalhes Adicionais</span>
      {Object.entries(meta).map(([key, val]) => (
        <div key={key}>
          <span className="font-medium capitalize">{key}: </span>
          {renderValue(val)}
        </div>
      ))}
    </div>
  );
}

export default function TimelineItemRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  
  let Icon = ICON[item.category];
  let dotColor = DOT_COLOR[item.category];
  
  if (item.actorName === "Sistema" || item.title.includes("Robô:") || item.title.includes("Automação:")) {
    Icon = Bot;
    dotColor = "bg-slate-400";
  }

  const expandable = !!item.meta && Object.keys(item.meta).length > 0;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-white", dotColor)}>
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
            {item.subtitle && <div className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground leading-relaxed">{item.subtitle}</div>}
            {item.actorName && !item.subtitle?.includes(item.actorName) && (
              <div className="mt-1 text-[10px] text-muted-foreground font-medium">por {item.actorName}</div>
            )}
          </div>
          <span title={new Date(item.at).toLocaleString("pt-BR")} className="shrink-0 whitespace-nowrap text-muted-foreground">
            {relative(item.at)}
          </span>
        </button>
        {open && expandable && (
          <EventDiagnosticPayload meta={item.meta} />
        )}
      </div>
    </div>
  );
}
