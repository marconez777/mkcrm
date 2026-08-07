import { X } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import PipelineCalendar from "./PipelineCalendar";
import CalendarLegend from "./CalendarLegend";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  pipelineName?: string;
};

export default function CalendarSheet({ open, onOpenChange, pipelineId, pipelineName }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-screen w-screen max-w-none flex-col p-0 sm:max-w-none"
      >
        <header className="flex items-start justify-between gap-4 border-b bg-card px-6 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">
              Calendário {pipelineName ? <span className="text-muted-foreground font-normal">· {pipelineName}</span> : null}
            </h2>
            <div className="mt-2">
              <CalendarLegend />
            </div>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 p-4">
          {pipelineId ? (
            <PipelineCalendar pipelineId={pipelineId} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione um pipeline.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
