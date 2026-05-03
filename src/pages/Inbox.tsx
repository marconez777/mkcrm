import { useState } from "react";
import { useLeads } from "@/hooks/useCrm";
import LeadDrawer from "./LeadDrawer";
import type { Lead } from "@/types/crm";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "agora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export default function InboxPage() {
  const { leads } = useLeads();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);

  const sorted = [...leads]
    .filter((l) => !q || (l.name?.toLowerCase().includes(q.toLowerCase()) || l.phone.includes(q)))
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b bg-card px-6 py-3">
        <h1 className="text-lg font-semibold">Conversas</h1>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
      </header>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
              Nenhuma conversa ainda.<br />Aguardando mensagens da Evolution.
            </div>
          </div>
        )}
        {sorted.map((l) => {
          const initials = (l.name || l.phone).slice(0, 2).toUpperCase();
          return (
            <button
              key={l.id}
              onClick={() => setOpen(l)}
              className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{l.name || l.phone}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(l.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-xs text-muted-foreground">{l.last_message_preview || "—"}</span>
                  {l.unread_count > 0 && (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{l.unread_count}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <LeadDrawer lead={open} onClose={() => setOpen(null)} />
    </div>
  );
}
