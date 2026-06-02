import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabAccent } from "@/components/ui/category-tabs";

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

export const SectionAccordion = AccordionPrimitive.Root;

type Props = {
  value: string;
  icon: LucideIcon;
  title: React.ReactNode;
  accent: TabAccent;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  flagship?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function SectionAccordionItem({
  value,
  icon: Icon,
  title,
  accent,
  badge,
  subtitle,
  flagship,
  children,
  className,
}: Props) {
  const accentVar = ACCENT_VAR[accent];
  return (
    <AccordionPrimitive.Item
      value={value}
      style={{ ["--accent" as string]: `var(${accentVar})` } as React.CSSProperties}
      className={cn(
        "group/section relative overflow-hidden rounded-xl border bg-card transition-all duration-200",
        "border-border/60 hover:border-[hsl(var(--accent)/0.40)]",
        "data-[state=open]:border-[hsl(var(--accent)/0.45)]",
        "data-[state=open]:bg-[hsl(var(--accent)/0.04)]",
        "data-[state=open]:shadow-[0_6px_20px_-12px_hsl(var(--accent)/0.55)]",
        flagship && "ring-1 ring-[hsl(var(--accent)/0.35)]",
        className,
      )}
    >
      {/* faixa lateral colorida */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px] transition-opacity duration-200",
          "bg-[hsl(var(--accent))]",
          "opacity-30 group-hover/section:opacity-70",
          "group-data-[state=open]/section:opacity-100",
        )}
      />

      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            "group/trigger flex flex-1 items-center gap-3 px-4 py-3 text-left outline-none",
            "transition-colors hover:bg-[hsl(var(--accent)/0.04)]",
            "focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent)/0.55)] focus-visible:ring-inset",
            "[&[data-state=open]>svg.chev]:rotate-180",
          )}
        >
          {/* placa de ícone */}
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
              "bg-[hsl(var(--accent)/0.10)] text-[hsl(var(--accent))]",
              "group-hover/trigger:bg-[hsl(var(--accent)/0.16)]",
              "group-data-[state=open]/section:bg-[hsl(var(--accent)/0.18)]",
              "group-data-[state=open]/section:shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.30)]",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>

          {/* título + subtítulo */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{title}</span>
              {badge != null && (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none tabular-nums",
                    "bg-[hsl(var(--accent)/0.14)] text-[hsl(var(--accent))]",
                    "ring-1 ring-inset ring-[hsl(var(--accent)/0.25)]",
                  )}
                >
                  {badge}
                </span>
              )}
              {flagship && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--accent)/0.14)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--accent))]">
                  novo
                </span>
              )}
            </span>
            {subtitle != null && (
              <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</span>
            )}
          </span>

          <ChevronDown
            className={cn(
              "chev h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200",
              "group-data-[state=open]/section:text-[hsl(var(--accent))]",
            )}
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>

      <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="border-t border-[hsl(var(--accent)/0.18)] px-4 pb-4 pt-4">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
