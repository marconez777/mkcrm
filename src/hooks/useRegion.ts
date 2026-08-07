// Hook que devolve o `RegionConfig` da clínica ativa. Cai no default BR enquanto
// a clínica carrega ou quando ainda não há membership (ex.: super admin sem clínica).
//
// F-INTL-0: usa colunas `region`/`locale`/`timezone`/`currency`/`phone_country`
// adicionadas em `public.clinics`.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buildRegionConfig, type RegionConfig } from "@/lib/region";

type ClinicRegionRow = {
  region: string | null;
  locale: string | null;
  timezone: string | null;
  currency: string | null;
  phone_country: string | null;
};

export function useRegion(): RegionConfig {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id ?? null;

  const { data } = useQuery({
    queryKey: ["clinic-region", clinicId],
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ClinicRegionRow | null> => {
      const { data } = await supabase
        .from("clinics")
        .select("region, locale, timezone, currency, phone_country")
        .eq("id", clinicId!)
        .maybeSingle();
      return (data as ClinicRegionRow) ?? null;
    },
  });

  const cfg = buildRegionConfig(data?.region, {
    locale: data?.locale ?? undefined,
    timezone: data?.timezone ?? undefined,
    currency: (data?.currency as RegionConfig["currency"]) ?? undefined,
    phoneCountry: (data?.phone_country as RegionConfig["phoneCountry"]) ?? undefined,
  });

  // Mantém <html lang> sincronizado com o locale ativo.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = cfg.locale;
    }
  }, [cfg.locale]);

  // Compat: alguns consumidores antigos poderão usar `useState` para evitar
  // recriar referência. Retornamos direto — `buildRegionConfig` já é puro.
  const [pinned] = useState(cfg);
  void pinned;
  return cfg;
}
