import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Building2, Users, CreditCard, Gauge, DollarSign,
  Activity, LifeBuoy, Plug, ShieldCheck, BookOpen, Sun, Moon,
  ArrowRight, ArrowLeft, LogOut, RefreshCcw, User as UserIcon,
} from "lucide-react";

type ClinicHit = { id: string; name: string };
type UserHit = { id: string; full_name: string | null; email: string | null };

const NAV_ITEMS: { label: string; to: string; icon: any; group: string }[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, group: "Visão Geral" },
  { label: "Empresas", to: "/admin/clinics", icon: Building2, group: "Clientes" },
  { label: "Usuários", to: "/admin/users", icon: Users, group: "Clientes" },
  { label: "Planos", to: "/admin/plans", icon: CreditCard, group: "Receita" },
  { label: "Uso & Limites", to: "/admin/usage", icon: Gauge, group: "Receita" },
  { label: "Financeiro", to: "/admin/finance", icon: DollarSign, group: "Receita" },
  { label: "Observabilidade", to: "/admin/observability", icon: Activity, group: "Operações" },
  { label: "Suporte IA", to: "/admin/support", icon: LifeBuoy, group: "Operações" },
  { label: "Integrações", to: "/admin/integrations", icon: Plug, group: "Plataforma" },
  { label: "Auditoria", to: "/admin/audit", icon: ShieldCheck, group: "Plataforma" },
  { label: "Manual do Builder", to: "/admin/builder-manual", icon: BookOpen, group: "Plataforma" },
];

export default function AdminCommandPalette({
  open,
  onOpenChange,
  onToggleTheme,
  isDark,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToggleTheme: () => void;
  isDark: boolean;
}) {
  const [q, setQ] = useState("");
  const [clinics, setClinics] = useState<ClinicHit[]>([]);
  const [users, setUsers] = useState<UserHit[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      const [{ data: cs }, { data: us }] = await Promise.all([
        (term
          ? supabase.from("clinics").select("id,name").ilike("name", `%${term}%`).order("name").limit(6)
          : supabase.from("clinics").select("id,name").order("created_at", { ascending: false }).limit(6)),
        (term
          ? supabase.from("profiles").select("id,full_name,email").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(6)
          : supabase.from("profiles").select("id,full_name,email").order("created_at", { ascending: false }).limit(6)),
      ]);
      setClinics((cs ?? []) as any);
      setUsers((us ?? []) as any);
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(path: string) {
    onOpenChange(false);
    nav(path);
  }

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV_ITEMS>();
    NAV_ITEMS.forEach((it) => {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar empresa, usuário, ir para…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {clinics.length > 0 && (
          <CommandGroup heading="Empresas">
            {clinics.map((c) => (
              <CommandItem
                key={`clinic-${c.id}`}
                value={`clinic-${c.id}-${c.name}`}
                onSelect={() => go(`/admin/clinics?clinic=${c.id}`)}
              >
                <Building2 className="mr-2 h-4 w-4 text-admin-primary" />
                <span className="flex-1 truncate">{c.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-admin-text-subtle" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {users.length > 0 && (
          <CommandGroup heading="Usuários">
            {users.map((u) => (
              <CommandItem
                key={`user-${u.id}`}
                value={`user-${u.id}-${u.full_name ?? ""}-${u.email ?? ""}`}
                onSelect={() => go(`/admin/users?user=${u.id}`)}
              >
                <UserIcon className="mr-2 h-4 w-4 text-admin-accent" />
                <span className="flex-1 truncate">{u.full_name || u.email || "Sem nome"}</span>
                {u.email && (
                  <span className="text-xs text-admin-text-subtle truncate max-w-[180px]">{u.email}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((it) => (
              <CommandItem
                key={it.to}
                value={`nav-${group}-${it.label}`}
                onSelect={() => go(it.to)}
              >
                <it.icon className="mr-2 h-4 w-4 text-admin-text-muted" />
                {it.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <CommandItem
            value="action-theme"
            onSelect={() => {
              onToggleTheme();
            }}
          >
            {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Alternar tema ({isDark ? "claro" : "escuro"})
          </CommandItem>
          <CommandItem
            value="action-reload"
            onSelect={() => {
              onOpenChange(false);
              setTimeout(() => window.location.reload(), 50);
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Recarregar painel
          </CommandItem>
          <CommandItem
            value="action-back-app"
            onSelect={() => go("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao app
          </CommandItem>
          <CommandItem
            value="action-signout"
            onSelect={async () => {
              onOpenChange(false);
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="mr-2 h-4 w-4 text-admin-negative" /> Sair da conta
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
