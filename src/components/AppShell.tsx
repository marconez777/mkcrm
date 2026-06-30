import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid, Inbox, Settings, Activity, Sparkles, LogOut, Keyboard,
  CalendarClock, Shield, Users, Mail, Radar, UserRound, ChevronsUpDown,
  Bug, Workflow,
} from "lucide-react";
import { usePipelineAllowlist } from "@/hooks/usePipelineAllowlist";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brandLockup from "@/assets/chat-funnel-ai-500.png";
import type { FeatureKey } from "@/lib/features";
import type { TabAccent } from "@/components/ui/category-tabs";
import SupportChatFab from "@/components/support/SupportChatFab";

type GroupKey = "work" | "marketing" | "admin";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  accent: TabAccent;
  group: GroupKey;
  feature?: FeatureKey;
  end?: boolean;
};

const GROUP_LABELS: Record<GroupKey, string> = {
  work: "Trabalho",
  marketing: "Marketing",
  admin: "Administração",
};

const ACCENT_VAR: Record<TabAccent, string> = {
  slate: "--tab-slate",
  primary: "--tab-primary",
  info: "--tab-info",
  violet: "--tab-violet",
  cyan: "--tab-cyan",
  fuchsia: "--tab-fuchsia",
  amber: "--tab-amber",
  emerald: "--tab-emerald",
  teal: "--tab-teal",
  destructive: "--tab-destructive",
};

const BASE_ITEMS: NavItem[] = [
  { to: "/", label: "Pipeline", icon: LayoutGrid, accent: "primary", group: "work", end: true },
  { to: "/inbox", label: "Conversas", icon: Inbox, accent: "info", group: "work", feature: "inbox" },
  { to: "/tasks", label: "Tarefas", icon: CalendarClock, accent: "violet", group: "work", feature: "tasks" },
  { to: "/ai", label: "IA", icon: Sparkles, accent: "primary", group: "marketing" },
];

function SidebarItem({
  item,
  badge,
}: {
  item: NavItem;
  badge?: number;
}) {
  const accentVar = ACCENT_VAR[item.accent];
  return (
    <NavLink
      to={item.to}
      end={item.end}
      style={{ ["--accent" as string]: `var(${accentVar})` } as React.CSSProperties}
      className={({ isActive }) =>
        cn(
          "relative mb-0.5 flex items-center gap-3 rounded-md pl-4 pr-3 py-2 text-[13px] transition-all duration-150",
          isActive
            ? "bg-[hsl(var(--accent)/0.12)] font-medium text-white shadow-[inset_0_1px_0_0_hsl(var(--accent)/0.15)]"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-opacity",
              isActive ? "opacity-100" : "opacity-0"
            )}
            style={{ background: `hsl(var(${accentVar}))` }}
          />
          <item.icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              isActive ? "text-[hsl(var(--accent))]" : "text-white/55"
            )}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {badge != null && badge > 0 && (
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none tabular-nums",
                isActive
                  ? "bg-[hsl(var(--accent)/0.22)] text-[hsl(var(--accent))]"
                  : "bg-white/15 text-white/75"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function useUnreadTotal() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("leads").select("unread_count").limit(1000);
      if (!active || !data) return;
      setTotal((data as any[]).reduce((s, r) => s + (r.unread_count ?? 0), 0));
    })();
    const ch = supabase
      .channel(`sidebar-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (p) => {
        const n = (p.new as any).unread_count ?? 0;
        const o = (p.old as any)?.unread_count ?? 0;
        if (n === o) return;
        setTotal((t) => Math.max(0, t + n - o));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => {
        setTotal((t) => t + ((p.new as any).unread_count ?? 0));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (p) => {
        setTotal((t) => Math.max(0, t - ((p.old as any)?.unread_count ?? 0)));
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return total;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { overall, health } = useHealth();
  const { user, isSuperAdmin, membership, hasFeature } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const unread = useUnreadTotal();
  const { enabled: pipelineAllowed } = usePipelineAllowlist();

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfile((data as any) ?? null));
  }, [user?.id]);

  const isClinicAdmin = membership?.role === "owner" || membership?.role === "admin";
  const isProfessional = membership?.role === "professional" && !isSuperAdmin;

  const navItems = useMemo<NavItem[]>(() => {
    const restricted = new Set(["/ai"]);
    let items = isProfessional ? BASE_ITEMS.filter((i) => !restricted.has(i.to)) : [...BASE_ITEMS];
    items = items.filter((i) => !i.feature || hasFeature(i.feature));

    if (hasFeature("email_marketing")) {
      items.push({ to: "/email", label: "Email", icon: Mail, accent: "cyan", group: "marketing", feature: "email_marketing" });
    }
    if (isClinicAdmin || isSuperAdmin) {
      items.push({ to: "/tracking", label: "Tracking", icon: Radar, accent: "fuchsia", group: "admin" });
      const debugEnabled = (membership?.clinic?.settings as any)?.tracking?.debug_enabled === true;
      if (isSuperAdmin || debugEnabled) {
        items.push({ to: "/tracking-debug", label: "Tracking Debug", icon: Bug, accent: "fuchsia", group: "admin" });
      }
    }
    if (isClinicAdmin && hasFeature("team")) {
      items.push({ to: "/team", label: "Equipe", icon: Users, accent: "teal", group: "admin" });
    }
    if (isClinicAdmin && pipelineAllowed) {
      items.push({ to: "/pipeline-runs", label: "Agente Pipeline", icon: Workflow, accent: "violet", group: "admin" });
    }
    items.push({ to: "/settings", label: "Configurações", icon: Settings, accent: "slate", group: "admin" });
    if (isSuperAdmin) {
      items.push({ to: "/admin", label: "Super Admin", icon: Shield, accent: "destructive", group: "admin" });
    }
    return items;
  }, [isProfessional, isClinicAdmin, isSuperAdmin, hasFeature, membership, pipelineAllowed]);

  const grouped = useMemo(() => {
    const g: Record<GroupKey, NavItem[]> = { work: [], marketing: [], admin: [] };
    navItems.forEach((i) => g[i.group].push(i));
    return g;
  }, [navItems]);

  const statusTone =
    overall === "ok" ? "emerald"
    : overall === "warn" ? "amber"
    : overall === "down" ? "destructive"
    : "slate";

  const statusVar =
    statusTone === "emerald" ? "--tab-emerald"
    : statusTone === "amber" ? "--tab-amber"
    : statusTone === "destructive" ? "--tab-destructive"
    : "--tab-slate";

  const label =
    overall === "ok" ? "Conectado"
    : overall === "warn" ? "Conectando…"
    : overall === "down" ? "Desconectado"
    : "Sem dados";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col bg-black text-white border-r border-white/10">
        {/* Header */}
        <div className="flex items-center bg-black px-4 py-4">
          <img src={brandLockup} alt="Chat Funnel AI" className="h-12 w-auto object-contain" />
        </div>

        <div className="mx-3 mb-2 h-px bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {(["work", "marketing", "admin"] as GroupKey[]).map((gk, idx) => {
            const list = grouped[gk];
            if (!list.length) return null;
            return (
              <div key={gk} className={idx === 0 ? "mt-1" : "mt-4"}>

                <div>
                  {list.map((it) => (
                    <SidebarItem
                      key={it.to}
                      item={it}
                      badge={it.to === "/inbox" ? unread : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Status WhatsApp */}
        <div
          className="mx-3 mb-2 flex items-center gap-1.5"
          style={{ ["--accent" as string]: `var(${statusVar})` } as React.CSSProperties}
        >
          <NavLink
            to={overall === "down" ? "/settings?qr=1" : "/settings"}
            className="group flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[11px] text-white/80 transition-colors hover:border-[hsl(var(--accent)/0.5)] hover:bg-white/15"
            title={overall === "down" ? "Clique para escanear o QR Code" : (health?.webhook_last_error ?? label)}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {(overall === "warn" || overall === "down") && (
                <span
                  className="absolute inset-0 rounded-full motion-safe:animate-ping"
                  style={{ background: `hsl(var(--accent) / 0.55)` }}
                />
              )}
              <span
                className="relative h-2 w-2 rounded-full"
                style={{ background: `hsl(var(--accent))` }}
              />
            </span>
            <Activity className="h-3 w-3 text-[hsl(var(--accent))]" />
            <span className="flex-1 truncate font-medium">
              {overall === "down" ? "Conectar WhatsApp" : label}
            </span>
          </NavLink>
          <button
            onClick={() => window.dispatchEvent(new Event("open-shortcuts"))}
            className="rounded-lg border border-white/10 bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="Atalhos de teclado (?)"
            aria-label="Atalhos de teclado"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Perfil */}
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
                  className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-left transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20"
                  title={user.email ?? "Conta"}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 ring-2 ring-white/20">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-[3px] ring-sidebar",
                        presenceColor,
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-sidebar-foreground">
                      {displayName}
                    </div>
                    <div className="truncate text-[11px] text-sidebar-foreground/55">
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
      <SupportChatFab />
    </div>
  );
}
