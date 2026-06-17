import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, CreditCard, Gauge, DollarSign,
  Activity, LifeBuoy, Plug, ShieldCheck, BookOpen, ChevronLeft, ChevronRight,
  Search, Bell, Sun, Moon, Command, Palette, ShoppingCart, FolderTree, LogOut, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import { supabase } from "@/integrations/supabase/client";

function useBrandingSync() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "platform_branding")
        .maybeSingle();
      if (!data?.value) return;
      try {
        const b = JSON.parse(data.value);
        const root = document.documentElement;
        if (b.primary) root.style.setProperty("--admin-primary", b.primary);
        if (b.accent) root.style.setProperty("--admin-accent", b.accent);
        if (b.positive) root.style.setProperty("--admin-positive", b.positive);
        if (b.negative) root.style.setProperty("--admin-negative", b.negative);
      } catch {}
    })();
  }, []);
}

type NavItem = { to: string; label: string; icon: any; end?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Visão Geral",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: "Clientes",
    items: [
      { to: "/admin/clinics", label: "Clínicas", icon: Building2 },
      { to: "/admin/users", label: "Usuários", icon: Users },
    ],
  },
  {
    title: "Receita",
    items: [
      { to: "/admin/plans", label: "Planos", icon: CreditCard },
      { to: "/admin/usage", label: "Uso & Limites", icon: Gauge },
      { to: "/admin/finance", label: "Financeiro", icon: DollarSign },
    ],
  },
  {
    title: "Operações",
    items: [
      { to: "/admin/observability", label: "Observabilidade", icon: Activity },
      { to: "/admin/support", label: "Suporte IA", icon: LifeBuoy },
      { to: "/admin/reclassify", label: "Reclassificar Leads", icon: Sparkles },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { to: "/admin/integrations", label: "Integrações", icon: Plug },
      { to: "/admin/integrations/eduzz", label: "Eduzz", icon: ShoppingCart },
      { to: "/admin/audit", label: "Auditoria", icon: ShieldCheck },
      { to: "/admin/builder-manual", label: "Manual do Builder", icon: BookOpen },
      { to: "/admin/docs", label: "Documentação", icon: FolderTree },
      { to: "/admin/branding", label: "Whitelabel", icon: Palette },
    ],
  },
];

function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export default function AdminShell() {
  useBrandingSync();
  const { session, isSuperAdmin, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { document.title = "Super Admin — MK CRM"; }, []);

  // Keyboard: cmd+k focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-text-muted">Carregando…</div>;
  }
  // Sem sessão OU não é super admin → portal admin (login dedicado).
  if (!session || !isSuperAdmin) return <Navigate to="/admin/login" replace />;

  const currentLabel = NAV.flatMap((g) => g.items).find((i) => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))?.label ?? "Admin";

  return (
    <div className="min-h-screen flex w-full bg-admin-bg text-admin-text">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-admin-sidebar-bg border-r border-admin-sidebar-border transition-all duration-200",
          collapsed ? "w-[68px]" : "w-[244px]"
        )}
      >
        {/* Brand */}
        <div className="h-16 px-4 flex items-center gap-2 border-b border-admin-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-admin-primary to-admin-accent flex items-center justify-center text-admin-primary-foreground font-bold">
            M
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-admin-sidebar-text-active">MK Admin</span>
              <span className="text-[11px] text-admin-sidebar-muted">Painel da plataforma</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-2 scrollbar-thin">
          {NAV.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 mb-0.5 text-[9px] font-semibold tracking-wider uppercase text-admin-sidebar-muted">
                  {group.title}
                </div>
              )}
              <div className="space-y-px">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-tight transition-colors",
                        "text-admin-sidebar-text hover:text-admin-sidebar-text-active hover:bg-admin-sidebar-surface",
                        isActive && "bg-admin-sidebar-active-bg text-admin-sidebar-text-active font-medium shadow-[inset_3px_0_0_hsl(var(--admin-primary))]"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse */}
        <div className="p-2 border-t border-admin-sidebar-border">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-admin-sidebar-muted hover:text-admin-sidebar-text-active hover:bg-admin-sidebar-surface transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Recolher</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={cn("flex-1 flex flex-col transition-all duration-200", collapsed ? "ml-[68px]" : "ml-[244px]")}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-admin-surface/95 backdrop-blur border-b border-admin-border flex items-center gap-3 px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-admin-text-muted">Admin</span>
            <span className="text-admin-text-subtle">/</span>
            <span className="font-medium">{currentLabel}</span>
          </div>

          {/* Search trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex flex-1 max-w-md ml-4 relative items-center h-9 rounded-lg bg-admin-surface-2 border border-admin-border px-3 text-sm text-admin-text-subtle hover:border-admin-primary/40 hover:text-admin-text-muted transition-colors"
          >
            <Search className="h-4 w-4 mr-2 shrink-0" />
            <span className="flex-1 text-left truncate">Buscar clínica, usuário, ações…</span>
            <kbd className="hidden lg:flex items-center gap-1 rounded-md border border-admin-border bg-admin-surface px-1.5 py-0.5 text-[10px] text-admin-text-muted ml-2">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} className="h-9 w-9 text-admin-text-muted hover:text-admin-text">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-admin-text-muted hover:text-admin-text relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-admin-negative" />
            </Button>
            <div className="h-6 w-px bg-admin-border mx-2" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-admin-text-muted">
              Voltar ao app
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/admin/login";
              }}
              className="text-admin-text-muted hover:text-admin-negative gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onToggleTheme={toggle}
        isDark={dark}
      />
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-admin-text">{title}</h1>
        {description && <p className="text-sm text-admin-text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--admin-radius)] bg-admin-surface border border-admin-border shadow-admin-card", className)}>
      {children}
    </div>
  );
}
