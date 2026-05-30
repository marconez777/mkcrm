import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutGrid, Inbox, Settings, Activity, Sparkles, LogOut, Keyboard, CalendarClock, Shield, Users, Mail, Radar, UserRound, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import mkLogo from "@/assets/mk-logo.png";

import type { FeatureKey } from "@/lib/features";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; feature?: FeatureKey; children?: NavItem[] };

const items: NavItem[] = [
  { to: "/", label: "Pipeline", icon: LayoutGrid },
  { to: "/inbox", label: "Conversas", icon: Inbox, feature: "inbox" },
  { to: "/tasks", label: "Tarefas", icon: CalendarClock, feature: "tasks" },
  {
    to: "/ai",
    label: "IA",
    icon: Sparkles,
  },
];


export default function AppShell({ children }: { children: React.ReactNode }) {
  const { overall, health } = useHealth();
  const { user, isSuperAdmin, membership, hasFeature } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfile((data as any) ?? null));
  }, [user?.id]);

  const isClinicAdmin = membership?.role === "owner" || membership?.role === "admin";
  const isProfessional = membership?.role === "professional" && !isSuperAdmin;
  const restricted = new Set(["/ai"]);
  let navItems: NavItem[] = isProfessional ? items.filter((i) => !restricted.has(i.to)) : [...items];
  navItems = navItems.filter((i) => !i.feature || hasFeature(i.feature));
  if (hasFeature("email_marketing")) {
    navItems = [...navItems, { to: "/email", label: "Email", icon: Mail, feature: "email_marketing" }];
  }
  if (isClinicAdmin || isSuperAdmin) {
    navItems = [...navItems, { to: "/tracking", label: "Tracking", icon: Radar }];
    const debugEnabled = (membership?.clinic?.settings as any)?.tracking?.debug_enabled === true;
    if (isSuperAdmin || debugEnabled) {
      navItems = [...navItems, { to: "/tracking-debug", label: "Tracking Debug", icon: Radar }];
    }
  }
  if (isClinicAdmin && hasFeature("team")) {
    navItems = [...navItems, { to: "/team", label: "Equipe", icon: Users }];
  }
  
  navItems = [...navItems, { to: "/settings", label: "Configurações", icon: Settings }];
  if (isSuperAdmin) navItems = [...navItems, { to: "/admin", label: "Super Admin", icon: Shield }];

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
          {navItems.map((it) => {
            const childActive = it.children?.some((c) => location.pathname.startsWith(c.to));
            const showChildren = it.children && (location.pathname === it.to || childActive);
            return (
              <div key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === "/"}
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
                {showChildren && (
                  <div className="ml-4 mb-1 border-l border-sidebar-border/40 pl-2">
                    {it.children!.map((c) => (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        end
                        className={({ isActive }) =>
                          cn(
                            "mb-1 flex items-center gap-3 rounded-md px-3 py-1.5 text-xs transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          )
                        }
                      >
                        <c.icon className="h-3.5 w-3.5" />
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
        {user && (() => {
          const displayName = profile?.full_name?.trim() || user.email?.split("@")[0] || "Usuário";
          const initials = displayName
            .split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "U";
          const presenceColor =
            overall === "ok" ? "bg-emerald-500"
            : overall === "warn" ? "bg-amber-500"
            : overall === "down" ? "bg-destructive"
            : "bg-muted-foreground";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg border border-sidebar-border/40 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent/60 focus:outline-none focus:ring-2 focus:ring-sidebar-ring/40"
                  title={user.email ?? "Conta"}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 ring-2 ring-sidebar-border/30">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar",
                        presenceColor,
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-sidebar-foreground">
                      {displayName}
                    </div>
                    <div className="truncate text-[11px] text-sidebar-foreground/60">
                      {user.email}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings?tab=profile")}>
                  <UserRound className="mr-2 h-4 w-4" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => supabase.auth.signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
