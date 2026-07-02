// Helpers de telefone multi-região.
// API canônica: `normalizePhone(raw, country)` via libphonenumber-js (F-INTL-0).
// `normalizePhoneBR` permanece como wrapper deprecated para callers legados.

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneCountry = "BR" | "ES" | "US";

/**
 * Normaliza um telefone para o formato E.164 SEM `+` (ex.: `5511999998888`).
 * Aceita números nacionais (assume `country`) ou internacionais.
 * Retorna `null` se o número for inválido.
 */
export function normalizePhone(raw: string, country: PhoneCountry = "BR"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  try {
    const parsed = parsePhoneNumberFromString(trimmed, country as CountryCode);
    if (parsed && parsed.isValid()) {
      // E.164 = `+5511999998888` → removemos o `+` para manter compat com o resto do app.
      return parsed.number.replace(/^\+/, "");
    }
  } catch {
    /* fall through */
  }

  // Fallback BR legado: aceita 10–11 dígitos nacionais e prefixa 55.
  if (country === "BR") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    if (digits.length === 12 || digits.length === 13) return digits;
  }

  return null;
}

/** @deprecated use `normalizePhone(raw, 'BR')`. */
export function normalizePhoneBR(raw: string): string | null {
  return normalizePhone(raw, "BR");
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
  // Fallback BR
  if (digits.length >= 12) {
    const cc = digits.slice(0, 2), area = digits.slice(2, 4), n = digits.slice(4);
    return `+${cc} (${area}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
  }
  return p;
}
