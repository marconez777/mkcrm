import { NavLink } from "react-router-dom";
import { LayoutGrid, Inbox, Settings, MessageSquareText, Activity, Bot, Zap, FileText, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/", label: "Pipeline", icon: LayoutGrid },
  { to: "/inbox", label: "Conversas", icon: Inbox },
  { to: "/agents", label: "Agentes IA", icon: Bot },
  { to: "/automations", label: "Automações", icon: Zap },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/metrics", label: "Métricas IA", icon: BarChart3 },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { overall, health } = useHealth();
  const { user } = useAuth();

  const dotColor =
    overall === "ok"
      ? "bg-emerald-500"
      : overall === "warn"
      ? "bg-amber-500"
      : overall === "down"
      ? "bg-destructive"
      : "bg-muted-foreground";

  const label =
    overall === "ok"
      ? "Conectado"
      : overall === "warn"
      ? "Conectando"
      : overall === "down"
      ? "Desconectado"
      : "Sem dados";

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
        <NavLink
          to="/settings"
          className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-sidebar-border/40 px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
          title={health?.webhook_last_error ?? label}
        >
          <span className={cn("h-2 w-2 rounded-full", dotColor)} />
          <Activity className="h-3 w-3" />
          <span className="flex-1 truncate">{label}</span>
        </NavLink>
        {user && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="mx-3 mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
            title={user.email ?? "Sair"}
          >
            <LogOut className="h-3 w-3" />
            <span className="flex-1 truncate text-left">{user.email}</span>
          </button>
        )}
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
