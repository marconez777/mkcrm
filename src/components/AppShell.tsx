import { NavLink } from "react-router-dom";
import { LayoutGrid, Inbox, Settings, Activity, Bot, Zap, FileText, BarChart3, LogOut, Keyboard, CalendarClock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import mkLogo from "@/assets/mk-logo.png";

const items = [
  { to: "/", label: "Pipeline", icon: LayoutGrid },
  { to: "/inbox", label: "Conversas", icon: Inbox },
  { to: "/tasks", label: "Tarefas", icon: CalendarClock },
  { to: "/agents", label: "Agentes IA", icon: Bot },
  { to: "/automations", label: "Automações", icon: Zap },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/metrics", label: "Métricas", icon: BarChart3 },
  { to: "/metrics/ai", label: "Métricas IA", icon: Activity },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { overall, health } = useHealth();
  const { user, isSuperAdmin } = useAuth();
  const navItems = isSuperAdmin
    ? [...items, { to: "/admin", label: "Super Admin", icon: Shield }]
    : items;

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
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
            <img src={mkLogo} alt="MK-CRM" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">MK-CRM</div>
            <div className="mt-1 text-[11px] text-sidebar-foreground/60">WhatsApp Pipeline</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2">
          {navItems.map((it) => (
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
        <div className="mx-3 mb-2 flex items-center gap-1">
          <NavLink
            to={overall === "down" ? "/settings?qr=1" : "/settings"}
            className="flex flex-1 items-center gap-2 rounded-md border border-sidebar-border/40 px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
            title={overall === "down" ? "Clique para escanear o QR Code" : (health?.webhook_last_error ?? label)}
          >
            <span className={cn("h-2 w-2 rounded-full", dotColor)} />
            <Activity className="h-3 w-3" />
            <span className="flex-1 truncate">{overall === "down" ? "Conectar WhatsApp" : label}</span>
          </NavLink>
          <button
            onClick={() => window.dispatchEvent(new Event("open-shortcuts"))}
            className="rounded-md border border-sidebar-border/40 p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
            title="Atalhos de teclado (?)"
          >
            <Keyboard className="h-3 w-3" />
          </button>
        </div>
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
