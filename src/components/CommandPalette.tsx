import { useEffect, useState } from "react";
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
  LayoutGrid,
  Inbox,
  Bot,
  Zap,
  FileText,
  BarChart3,
  Settings,
  CalendarClock,
  MessageSquare,
  Keyboard,
  User,
} from "lucide-react";

type LeadHit = { id: string; name: string | null; phone: string };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onCustom);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      let req = supabase
        .from("leads")
        .select("id, name, phone")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(8);
      if (term) {
        req = req.or(`name.ilike.%${term}%,phone.ilike.%${term}%`) as any;
      }
      const { data } = await req;
      setLeads((data ?? []) as LeadHit[]);
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(path: string) {
    setOpen(false);
    nav(path);
  }

  const navItems = [
    { label: "Pipeline", path: "/", icon: LayoutGrid },
    { label: "Conversas", path: "/inbox", icon: Inbox },
    { label: "Tarefas", path: "/tasks", icon: CalendarClock },
    { label: "Agentes IA", path: "/agents", icon: Bot },
    { label: "Mensagens", path: "/ai/messages", icon: Zap },
    { label: "Sequências", path: "/ai/messages/sequences", icon: Zap },
    { label: "Automações", path: "/ai/messages/automations", icon: Zap },
    { label: "Templates", path: "/ai/messages/templates", icon: FileText },
    { label: "Métricas", path: "/metrics", icon: BarChart3 },
    { label: "Engajamento (respostas)", path: "/ai/messages/engagement", icon: BarChart3 },
    { label: "Configurações", path: "/settings", icon: Settings },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar conversas, navegar, ações…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {leads.length > 0 && (
          <CommandGroup heading="Conversas">
            {leads.map((l) => (
              <CommandItem key={l.id} value={`lead-${l.id}-${l.name ?? ""}-${l.phone}`} onSelect={() => go(`/inbox/${l.id}`)}>
                <User className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">{l.name || l.phone}</span>
                <span className="text-xs text-muted-foreground">{l.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Navegação">
          {navItems.map((it) => (
            <CommandItem key={it.path} value={`nav-${it.label}`} onSelect={() => go(it.path)}>
              <it.icon className="mr-2 h-4 w-4" />
              {it.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <CommandItem
            value="action-new-conversation"
            onSelect={() => {
              setOpen(false);
              nav("/inbox");
              setTimeout(() => window.dispatchEvent(new Event("open-new-conversation")), 50);
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Nova conversa
          </CommandItem>
          <CommandItem
            value="action-shortcuts"
            onSelect={() => {
              setOpen(false);
              setTimeout(() => window.dispatchEvent(new Event("open-shortcuts")), 50);
            }}
          >
            <Keyboard className="mr-2 h-4 w-4" /> Atalhos de teclado
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
