// Formatadores baseados em `Intl.*`, parametrizados por locale/currency/timezone
// vindos do `RegionConfig` (F-INTL-0). Use estes helpers em vez de hardcoded
// `R$`, `pt-BR`, `America/Sao_Paulo`.

import type { Currency, RegionConfig } from "@/lib/region";

export function formatMoney(amount: number, currency: Currency, locale: string): string {
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(
  date: Date | string | number | null | undefined,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      dateStyle: "short",
      ...options,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatTime(
  date: Date | string | number | null | undefined,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeStyle: "short",
      ...options,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  locale: string,
  timezone: string,
): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Conveniência: aplica todos os formatos com base no RegionConfig. */
export function formattersFor(cfg: RegionConfig) {
  return {
    money: (amount: number) => formatMoney(amount, cfg.currency, cfg.locale),
    number: (v: number, opts?: Intl.NumberFormatOptions) => formatNumber(v, cfg.locale, opts),
    date: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
      formatDate(d, cfg.locale, cfg.timezone, opts),
    time: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
      formatTime(d, cfg.locale, cfg.timezone, opts),
    dateTime: (d: Date | string | number | null | undefined) =>
      formatDateTime(d, cfg.locale, cfg.timezone),
  };
}
