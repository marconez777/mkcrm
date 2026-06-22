import { useMemo, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type { DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useAppointments, appointmentToEvent } from "@/hooks/useAppointments";
import { updateAppointmentSchedule } from "@/lib/appointments-mutations";

type Props = {
  pipelineId: string;
  onEventClick?: (appointmentId: string) => void;
};

export default function PipelineCalendar({ pipelineId, onEventClick }: Props) {
  // Default range: current ISO week (will be replaced by FullCalendar's first datesSet)
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const day = now.getDay();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(now.getDate() - day);
    const to = new Date(from);
    to.setDate(from.getDate() + 7);
    return { from, to };
  });

  const { types } = useServiceTypes();
  const { appointments, loading } = useAppointments({
    pipelineId,
    from: range.from,
    to: range.to,
  });

  const events = useMemo(
    () => appointments.map((a) => appointmentToEvent(a, types)),
    [appointments, types],
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange((prev) => {
      if (prev.from.getTime() === arg.start.getTime() && prev.to.getTime() === arg.end.getTime()) {
        return prev;
      }
      return { from: arg.start, to: arg.end };
    });
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      onEventClick?.(arg.event.id);
    },
    [onEventClick],
  );

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        timeZone="America/Sao_Paulo"
        locale={ptBrLocale}
        firstDay={0}
        height="100%"
        expandRows
        nowIndicator
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{
          today: "hoje",
          month: "mês",
          week: "semana",
          day: "dia",
        }}
        events={events}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        selectable={false}
      />
    </div>
  );
}
