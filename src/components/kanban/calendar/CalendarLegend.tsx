import { useMemo } from "react";
import { useServiceTypes, type ServiceKind } from "@/hooks/useServiceTypes";

const KIND_LABEL: Record<ServiceKind, string> = {
  consulta: "Consultas",
  procedimento: "Procedimentos",
  retorno: "Retornos",
};

export default function CalendarLegend() {
  const { types } = useServiceTypes();
  const grouped = useMemo(() => {
    const out: Record<ServiceKind, typeof types> = {
      consulta: [],
      procedimento: [],
      retorno: [],
    };
    for (const t of types) out[t.kind].push(t);
    return out;
  }, [types]);

  return (
    <div className="flex flex-wrap items-start gap-4 text-xs">
      {(Object.keys(grouped) as ServiceKind[]).map((kind) => {
        const items = grouped[kind];
        if (!items.length) return null;
        return (
          <div key={kind} className="flex items-center gap-2">
            <span className="text-muted-foreground">{KIND_LABEL[kind]}:</span>
            <div className="flex flex-wrap items-center gap-2">
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: t.color_hex }}
                  />
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
