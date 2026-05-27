import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 25;

export function TablePager({
  page,
  pageSize = PAGE_SIZE,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (p: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <div className="tabular-nums">
        {total === 0 ? "Sem resultados" : `Mostrando ${from}–${to} de ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
