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

// Códigos de país conhecidos (DDIs) usados para detectar números internacionais
// quando a planilha perdeu o `+` (Excel converte para número). Ordem importa:
// prefixos mais longos primeiro para evitar ambiguidade (ex.: 351 antes de 35 inexistente).
const KNOWN_COUNTRY_CODES = [
  "1", "7",
  "20", "27", "30", "31", "32", "33", "34", "36", "39",
  "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58",
  "60", "61", "62", "63", "64", "65", "66",
  "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98",
  "212", "213", "216", "218", "220", "233", "234", "254", "255", "256",
  "351", "352", "353", "354", "355", "356", "357", "358", "359",
  "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "385", "386", "387", "389",
  "420", "421", "423",
  "500", "501", "502", "503", "504", "505", "506", "507", "509",
  "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
  "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692",
  "852", "853", "855", "856",
  "880", "886",
  "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977",
];
// Ordena por tamanho desc para prefix-match determinístico
const SORTED_COUNTRY_CODES = [...KNOWN_COUNTRY_CODES].sort((a, b) => b.length - a.length);

/**
 * Normaliza aceitando números internacionais mesmo sem `+` explícito.
 * 1) Se tem `+`, deixa libphonenumber decidir o país.
 * 2) Se não tem `+`, tenta detectar country code por prefixo (ex.: 34..., 1..., 351...).
 * 3) Cai no comportamento nacional de `normalizePhone(raw, defaultCountry)`.
 */
export function normalizePhoneIntl(raw: string, defaultCountry: PhoneCountry = "BR"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // 1) Formato internacional explícito com `+`
  if (trimmed.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
    } catch { /* fall through */ }
  }

  const digits = trimmed.replace(/\D/g, "");

  // 2) Tentar como nacional primeiro (mais provável para a região da conta)
  const national = normalizePhone(trimmed, defaultCountry);
  if (national) {
    // Se o resultado do libphonenumber bate com prefixo de país conhecido diferente
    // do default, aceita. Se estamos em BR e o número resultante começa com "55" mas
    // o input não incluía "55", ok também.
    return national;
  }

  // 3) Tentar prefix-match com country codes conhecidos
  if (digits.length >= 8) {
    for (const cc of SORTED_COUNTRY_CODES) {
      if (digits.startsWith(cc) && digits.length > cc.length + 5) {
        try {
          const parsed = parsePhoneNumberFromString("+" + digits);
          if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
        } catch { /* fall through */ }
        break;
      }
    }
  }

  return null;
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
