// Mantém `i18n.language` em sincronia com `useRegion().locale`. F-INTL-1.
// Respeita override manual do usuário armazenado em localStorage
// (`i18n.override`), definido pelo `<LanguageSwitcher />`.

import { useEffect } from "react";
import i18n, { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { useRegion } from "@/hooks/useRegion";
import { getLanguageOverride } from "@/components/LanguageSwitcher";

function normalize(locale: string): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : "pt-BR";
}

export function useI18nSync(): void {
  const { locale } = useRegion();
  useEffect(() => {
    const override = getLanguageOverride();
    const target = override ?? normalize(locale);
    if (i18n.language !== target) void i18n.changeLanguage(target);
  }, [locale]);
}
