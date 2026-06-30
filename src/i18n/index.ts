// i18n bootstrap — react-i18next + 3 idiomas (pt-BR, es-ES, en-US).
// Sincronizado com `useRegion()` por `useI18nSync()` para trocar o idioma
// conforme `clinics.locale`. F-INTL-1.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptBR from "./locales/pt-BR.json";
import esES from "./locales/es-ES.json";
import enUS from "./locales/en-US.json";

export const SUPPORTED_LOCALES = ["pt-BR", "es-ES", "en-US"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    resources: {
      "pt-BR": { translation: ptBR },
      "es-ES": { translation: esES },
      "en-US": { translation: enUS },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
