import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabAccent =
  | "slate"
  | "primary"
  | "info"
  | "violet"
  | "cyan"
  | "fuchsia"
  | "amber"
  | "emerald"
  | "teal"
  | "destructive";

export type CategoryTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  accent: TabAccent;
  badge?: React.ReactNode;
};

type Props = {
  tabs: CategoryTab[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

// Static class maps so Tailwind can pick them up at build time.
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

export function CategoryTabs({ tabs, value, onChange, ariaLabel, className }: Props) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.value;
        const accentVar = ACCENT_VAR[t.accent];
        const accentColor = `hsl(var(${accentVar}))`;

        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            style={
              {
                // Per-button CSS vars consumed below via arbitrary values.
                ["--accent" as string]: `var(${accentVar})`,
              } as React.CSSProperties
            }
            className={cn(
              "group relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
              "outline-none transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.10)] text-foreground shadow-[0_4px_14px_-6px_hsl(var(--accent)/0.45)] -translate-y-px"
                : "border-border/60 bg-card text-muted-foreground hover:-translate-y-px hover:border-[hsl(var(--accent)/0.35)] hover:bg-[hsl(var(--accent)/0.05)] hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-[hsl(var(--accent)/0.18)] text-[hsl(var(--accent))]"
                  : "bg-[hsl(var(--accent)/0.10)] text-[hsl(var(--accent)/0.85)] group-hover:bg-[hsl(var(--accent)/0.16)]"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap">{t.label}</span>
            {t.badge != null && (
              <span
                className={cn(
                  "ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
                  active
                    ? "bg-[hsl(var(--accent)/0.18)] text-[hsl(var(--accent))]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {t.badge}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-opacity",
                active ? "opacity-100" : "opacity-0"
              )}
              style={{ background: accentColor }}
            />
          </button>
        );
      })}
    </nav>
  );
}
