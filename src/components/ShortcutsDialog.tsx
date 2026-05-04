import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

const SHORTCUTS: { keys: string[]; label: string; group: string }[] = [
  { keys: ["⌘", "K"], label: "Abrir paleta de comandos", group: "Geral" },
  { keys: ["?"], label: "Abrir esta ajuda", group: "Geral" },
  { keys: ["/"], label: "Focar busca de conversas", group: "Conversas" },
  { keys: ["j"], label: "Conversa abaixo", group: "Conversas" },
  { keys: ["k"], label: "Conversa acima", group: "Conversas" },
  { keys: ["Esc"], label: "Voltar / fechar", group: "Conversas" },
  { keys: ["Enter"], label: "Enviar mensagem", group: "Composer" },
  { keys: ["Shift", "Enter"], label: "Quebrar linha", group: "Composer" },
  { keys: ["/"], label: "Abrir respostas rápidas (no composer)", group: "Composer" },
];

export default function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Allow opening via custom event (button in AppShell)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-shortcuts", handler);
    return () => window.removeEventListener("open-shortcuts", handler);
  }, []);

  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{g}</div>
              <div className="space-y-1">
                {SHORTCUTS.filter((s) => s.group === g).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
