import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import {
  startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subDays, subMonths, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type DateFilterValue = {
  from: Date | null;
  to: Date | null;
  label: string | null;
  preset?: string;
};

export const EMPTY_DATE_FILTER: DateFilterValue = { from: null, to: null, label: null };

interface Props {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
}

function rangeFor(preset: string): DateFilterValue {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Hoje", preset };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y), label: "Ontem", preset };
    }
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), label: "Últimos 7 dias", preset };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), label: "Últimos 30 dias", preset };
    case "90d":
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now), label: "Últimos 90 dias", preset };
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now), label: "Este mês", preset };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: "Mês passado", preset };
    }
    case "thisYear":
      return { from: startOfYear(now), to: endOfYear(now), label: "Este ano", preset };
    default:
      return EMPTY_DATE_FILTER;
  }
}

export function presetToValue(preset: string): DateFilterValue {
  return rangeFor(preset);
}

export default function PipelineDateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"day" | "month" | "custom">("day");
  const [monthDraft, setMonthDraft] = useState<Date>(value.from ?? new Date());
  const [range, setRange] = useState<{ from?: Date; to?: Date }>(
    value.from ? { from: value.from, to: value.to ?? value.from } : {},
  );

  const active = !!value.from;

  const dayPresets = [
    { id: "today", label: "Hoje" },
    { id: "yesterday", label: "Ontem" },
    { id: "7d", label: "Últimos 7 dias" },
    { id: "30d", label: "Últimos 30 dias" },
    { id: "90d", label: "Últimos 90 dias" },
  ];
  const monthPresets = [
    { id: "thisMonth", label: "Este mês" },
    { id: "lastMonth", label: "Mês passado" },
    { id: "thisYear", label: "Este ano" },
  ];

  const monthOptions = useMemo(() => {
    const arr: { value: string; label: string; date: Date }[] = [];
    const base = new Date();
    for (let i = 0; i < 24; i++) {
      const d = subMonths(base, i);
      arr.push({
        value: `${d.getFullYear()}-${d.getMonth()}`,
        label: format(d, "MMM yyyy", { locale: ptBR }),
        date: d,
      });
    }
    return arr;
  }, []);

  function pick(preset: string) {
    onChange(rangeFor(preset));
    setOpen(false);
  }

  function pickMonth(d: Date) {
    onChange({
      from: startOfMonth(d),
      to: endOfMonth(d),
      label: format(d, "MMM yyyy", { locale: ptBR }),
      preset: `m:${d.getFullYear()}-${d.getMonth()}`,
    });
    setOpen(false);
  }

  function applyCustom() {
    if (!range.from) return;
    const from = startOfDay(range.from);
    const to = endOfDay(range.to ?? range.from);
    const label =
      range.to && range.from.getTime() !== range.to.getTime()
        ? `${format(from, "dd/MM/yy")}–${format(to, "dd/MM/yy")}`
        : format(from, "dd/MM/yyyy");
    onChange({ from, to, label, preset: "custom" });
    setOpen(false);
  }

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn("h-8", active && "pr-1")}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {value.label ?? "Período"}
            {active && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange(EMPTY_DATE_FILTER); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(EMPTY_DATE_FILTER); } }}
                className="ml-1.5 rounded p-0.5 hover:bg-primary-foreground/20"
                aria-label="Limpar filtro"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <div className="flex border-b">
            {(["day", "month", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "day" ? "Por dia" : t === "month" ? "Por mês" : "Personalizado"}
              </button>
            ))}
          </div>

          {tab === "day" && (
            <div className="flex w-56 flex-col p-1">
              {dayPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    value.preset === p.id && "bg-accent font-medium",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {tab === "month" && (
            <div className="flex w-56 flex-col p-1">
              {monthPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    value.preset === p.id && "bg-accent font-medium",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <Separator className="my-1" />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Escolher mês
              </div>
              <div className="max-h-56 overflow-y-auto">
                {monthOptions.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => pickMonth(m.date)}
                    className={cn(
                      "block w-full rounded px-2 py-1.5 text-left text-sm capitalize hover:bg-accent",
                      value.preset === `m:${m.value}` && "bg-accent font-medium",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "custom" && (
            <div className="p-2">
              <Calendar
                mode="range"
                selected={range as any}
                onSelect={(r: any) => setRange(r ?? {})}
                numberOfMonths={1}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="flex items-center justify-between gap-2 border-t p-2">
                <Button variant="ghost" size="sm" onClick={() => setRange({})}>
                  Limpar
                </Button>
                <Button size="sm" onClick={applyCustom} disabled={!range.from}>
                  Aplicar
                </Button>
              </div>
            </div>
          )}

          {active && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { onChange(EMPTY_DATE_FILTER); setOpen(false); }}
              >
                Limpar filtro
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
