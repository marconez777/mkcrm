// Helpers de telefone multi-região.
// API canônica: `normalizePhone(raw, country)` via libphonenumber-js (F-INTL-0).
// `normalizePhoneIntl` é usado no import de disparo — prioriza detecção
// internacional antes do fallback BR (evita prefixar 55 em número estrangeiro
// cujo `+` foi apagado pelo Excel).

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneCountry = "BR" | "ES" | "US";

// DDDs BR válidos (Anatel). Usado para evitar que um "34…" estrangeiro seja
// interpretado como número nacional BR pelo fallback legado.
const BR_AREA_CODES = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

// Códigos de país conhecidos (DDIs). Ordenados por comprimento desc para
// prefix-match determinístico (351 antes de 35, etc.).
const KNOWN_COUNTRY_CODES = [
  "1","7",
  "20","27","30","31","32","33","34","36","39",
  "40","41","43","44","45","46","47","48","49",
  "51","52","53","54","55","56","57","58",
  "60","61","62","63","64","65","66",
  "81","82","84","86","90","91","92","93","94","95","98",
  "212","213","216","218","220","233","234","254","255","256",
  "351","352","353","354","355","356","357","358","359",
  "370","371","372","373","374","375","376","377","378","379",
  "380","381","382","385","386","387","389",
  "420","421","423",
  "500","501","502","503","504","505","506","507","509",
  "590","591","592","593","594","595","596","597","598","599",
  "670","672","673","674","675","676","677","678","679","680",
  "681","682","683","685","686","687","688","689","690","691","692",
  "852","853","855","856",
  "880","886",
  "960","961","962","963","964","965","966","967","968",
  "970","971","972","973","974","975","976","977",
];
const SORTED_COUNTRY_CODES = [...KNOWN_COUNTRY_CODES].sort((a, b) => b.length - a.length);

function tryParseIntl(digitsWithoutPlus: string): string | null {
  try {
    const parsed = parsePhoneNumberFromString("+" + digitsWithoutPlus);
    if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
  } catch { /* noop */ }
  return null;
}

/**
 * Normaliza um telefone para E.164 sem `+`.
 * Aceita nacional (usa `country`) ou internacional (com `+`).
 * Fallback legado BR: 10/11 dígitos prefixa "55" — mas SÓ se o DDD for válido.
 */
export function normalizePhone(raw: string, country: PhoneCountry = "BR"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  try {
    const parsed = parsePhoneNumberFromString(trimmed, country as CountryCode);
    if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
  } catch { /* fall through */ }

  if (country === "BR") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      const ddd = digits.slice(0, 2);
      if (BR_AREA_CODES.has(ddd)) return "55" + digits;
      return null;
    }
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
      const ddd = digits.slice(2, 4);
      if (BR_AREA_CODES.has(ddd)) return digits;
      return null;
    }
  }

  return null;
}

/** @deprecated use `normalizePhone(raw, 'BR')`. */
export function normalizePhoneBR(raw: string): string | null {
  return normalizePhone(raw, "BR");
}

/**
 * Normaliza aceitando números internacionais mesmo sem `+` (comum quando
 * o Excel salva a célula como número). Ordem:
 *  1) Se tem `+` → parse internacional.
 *  2) Prefix-match com DDIs conhecidos ≠ do default → parse como internacional.
 *  3) Parse nacional estrito (libphonenumber) com `defaultCountry`.
 *  4) Fallback legado BR (DDD válido → 55+digits).
 */
export function normalizePhoneIntl(raw: string, defaultCountry: PhoneCountry = "BR"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // 1) Internacional explícito
  if (trimmed.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
    } catch { /* fall through */ }
  }

  const digits = trimmed.replace(/\D/g, "");
  const defaultDdi: Record<PhoneCountry, string> = { BR: "55", ES: "34", US: "1" };
  const ownDdi = defaultDdi[defaultCountry];

  // 2) Prefix-match de DDI estrangeiro conhecido (evita fallback BR pisar em número ES/US/etc.)
  if (digits.length >= 8) {
    for (const cc of SORTED_COUNTRY_CODES) {
      if (cc === ownDdi) continue; // deixa o passo 3/4 tratar como nacional
      if (digits.startsWith(cc) && digits.length > cc.length + 5) {
        const intl = tryParseIntl(digits);
        if (intl) return intl;
        break; // achou prefixo mas número inválido — não tenta outros
      }
    }
  }

  // 3) Parse nacional estrito
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry as CountryCode);
    if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
  } catch { /* fall through */ }

  // 4) Fallback legado nacional (só BR, com DDD válido)
  return normalizePhone(trimmed, defaultCountry);
}

export function formatPhoneDisplay(p: string | null | undefined): string {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  const withPlus = digits.startsWith("+") ? digits : `+${digits}`;
  try {
    const parsed = parsePhoneNumberFromString(withPlus);
    if (parsed) return parsed.formatInternational();
  } catch {
    /* fall through */
  }
  if (digits.length >= 12) {
    const cc = digits.slice(0, 2), area = digits.slice(2, 4), n = digits.slice(4);
    return `+${cc} (${area}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
  }
  return p;
}
