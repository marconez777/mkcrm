import { NavLink } from "react-router-dom";
import { LayoutGrid, Inbox, Settings, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Pipeline", icon: LayoutGrid },
  { to: "/inbox", label: "Conversas", icon: Inbox },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Zappy CRM</div>
            <div className="mt-1 text-[11px] text-sidebar-foreground/60">WhatsApp Pipeline</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              className={({ isActive }) =>
                cn(
                  "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[11px] text-sidebar-foreground/40">
          MVP · uso pessoal
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
