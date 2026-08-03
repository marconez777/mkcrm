// Frontend mirror of supabase/functions/_shared/template-vars.ts
// Keep both implementations in sync.

export type CustomFieldDefLite = {
  field_key: string;
  field_type: string;
};

export type LeadLike = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  custom_fields?: Record<string, any> | null;
};

const DEFAULT_TZ = "America/Sao_Paulo";
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function partsInTZ(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return map;
}

const DATE_MODIFIERS = new Set(["data", "hora", "extenso", "dia_semana", "weekday"]);
const ISO_LIKE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function formatCustom(value: any, fieldType: string, modifier: string | null, tz: string): string {
  if (value == null || value === "") return "";
  let effectiveType = fieldType;
  if (effectiveType !== "date" && effectiveType !== "datetime") {
    const mod = (modifier || "").toLowerCase();
    const isoLike = typeof value === "string" && ISO_LIKE_RE.test(value.trim());
    if ((DATE_MODIFIERS.has(mod) && (isoLike || value instanceof Date)) || isoLike) {
      effectiveType = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) ? "date" : "datetime";
    }
  }
  if (effectiveType === "date" || effectiveType === "datetime") {
    const d = parseDate(value);
    if (!d) return String(value);
    const p = partsInTZ(d, tz);
    const { day, month, year, hour, minute } = p;
    const weekday = (p.weekday || "").toLowerCase();
    const monthIdx = Number(month) - 1;
    switch ((modifier || "").toLowerCase()) {
      case "data": return `${day}/${month}/${year}`;
      case "hora": return `${hour}:${minute}`;
      case "dia_semana":
      case "weekday": return weekday;
      case "extenso": return `${Number(day)} de ${MONTHS_PT[monthIdx] ?? month} de ${year} às ${hour}:${minute}`;
      default:
        return effectiveType === "date" ? `${day}/${month}/${year}` : `${day}/${month}/${year} ${hour}:${minute}`;
    }
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

export function renderTemplate(
  text: string,
  lead: LeadLike,
  customFieldDefs: CustomFieldDefLite[] = [],
  tz: string = DEFAULT_TZ,
  context?: { appointment_at?: string },
): string {
  if (!text) return text;
  const name = lead?.name || lead?.phone || "";
  const first = String(name).split(" ")[0] || "";
  const defByKey = new Map(customFieldDefs.map((d) => [d.field_key, d.field_type]));
  const cf = lead?.custom_fields || {};

  const apptRaw = context?.appointment_at || (cf as any).consulta_agendada_em || (cf as any).procedimento_agendado_em;
  let dataStr = "", horaStr = "", dataExtensoStr = "", diaSemanaStr = "";
  if (apptRaw) {
    dataStr = formatCustom(apptRaw, "datetime", "data", tz);
    horaStr = formatCustom(apptRaw, "datetime", "hora", tz);
    dataExtensoStr = formatCustom(apptRaw, "datetime", "extenso", tz);
    diaSemanaStr = formatCustom(apptRaw, "datetime", "dia_semana", tz);
  }

  const replaced = text
    .split("{{nome}}").join(name)
    .split("{{primeiro_nome}}").join(first)
    .split("{{telefone}}").join(lead?.phone ?? "")
    .split("{{email}}").join(lead?.email ?? "")
    .split("{{empresa}}").join(lead?.company ?? "")
    .split("{{data}}").join(dataStr)
    .split("{{horario}}").join(horaStr)
    .split("{{data_extenso}}").join(dataExtensoStr)
    .split("{{dia_semana}}").join(diaSemanaStr)
    .replace(/\{\{\s*campo\.([a-zA-Z0-9_]+)(?::([a-zA-Z_]+))?\s*\}\}/g, (_m, key: string, mod?: string) => {
      const val = (cf as any)[key];
      const ftype = defByKey.get(key) || "text";
      return formatCustom(val, ftype, mod ?? null, tz);
    });

  return replaced.replace(/\{\{[^}]+\}\}/g, (match) => {
    console.warn(`[renderTemplate] Unrecognized or empty token stripped: ${match}`);
    return "";
  });
}
