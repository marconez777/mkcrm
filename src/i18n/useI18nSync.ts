// Mantém `i18n.language` em sincronia com `useRegion().locale`. F-INTL-1.

import { useEffect } from "react";
import i18n, { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { useRegion } from "@/hooks/useRegion";

function normalize(locale: string): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : "pt-BR";
}

export function useI18nSync(): void {
  const { locale } = useRegion();
  useEffect(() => {
    const target = normalize(locale);
    if (i18n.language !== target) void i18n.changeLanguage(target);
  }, [locale]);
}
