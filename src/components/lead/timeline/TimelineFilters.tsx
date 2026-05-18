import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, CATEGORY_ORDER, type TimelineCategory } from "./types";

export default function TimelineFilters({
  active,
  onChange,
  order,
  onToggleOrder,
}: {
  active: Set<TimelineCategory>;
  onChange: (next: Set<TimelineCategory>) => void;
  order: "desc" | "asc";
  onToggleOrder: () => void;
}) {
  const allOn = active.size === CATEGORY_ORDER.length;
  function toggle(cat: TimelineCategory) {
    const next = new Set(active);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    if (next.size === 0) {
      // re-enable all if user empties
      CATEGORY_ORDER.forEach((c) => next.add(c));
    }
    onChange(next);
  }
  function setAll() {
    onChange(new Set(CATEGORY_ORDER));
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={setAll}
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs transition",
          allOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"
        )}
      >
        Tudo
      </button>
      {CATEGORY_ORDER.map((cat) => {
        const on = active.has(cat) && !allOn;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"
            )}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        );
      })}
      <div className="ml-auto">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onToggleOrder}>
          {order === "desc" ? "Mais recente ↓" : "Mais antigo ↑"}
        </Button>
      </div>
    </div>
  );
}
