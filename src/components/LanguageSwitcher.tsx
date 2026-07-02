// Seletor de idioma reutilizável (site + app). Persiste a escolha do usuário em
// localStorage (`i18n.override`); `useI18nSync` respeita esse override antes
// de aplicar o locale da clínica.

import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import i18n, { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const LANG_STORAGE_KEY = "i18n.override";

const LANG_LABELS: Record<Locale, { label: string; short: string; flag: string }> = {
  "pt-BR": { label: "Português (Brasil)", short: "PT", flag: "🇧🇷" },
  "es-ES": { label: "Español", short: "ES", flag: "🇪🇸" },
  "en-US": { label: "English", short: "EN", flag: "🇺🇸" },
};

export function setLanguageOverride(locale: Locale) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, locale);
  } catch {}
  void i18n.changeLanguage(locale);
}

export function getLanguageOverride(): Locale | null {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v && (SUPPORTED_LOCALES as readonly string[]).includes(v)) return v as Locale;
  } catch {}
  return null;
}

type Variant = "site" | "app";

export default function LanguageSwitcher({
  variant = "app",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { i18n: i18nInstance } = useTranslation();
  const current = (i18nInstance.language as Locale) ?? "pt-BR";
  const meta = LANG_LABELS[current] ?? LANG_LABELS["pt-BR"];

  const triggerClass =
    variant === "site"
      ? "site-font-body inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] text-site-muted transition-colors hover:border-white/20 hover:text-site-text"
      : "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(triggerClass, className)}
        aria-label="Selecionar idioma"
      >
        <Globe className={variant === "site" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        <span>{meta.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {SUPPORTED_LOCALES.map((loc) => {
          const info = LANG_LABELS[loc];
          const active = loc === current;
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => setLanguageOverride(loc)}
              className="flex items-center gap-2"
            >
              <span className="text-base leading-none">{info.flag}</span>
              <span className="flex-1 text-sm">{info.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
