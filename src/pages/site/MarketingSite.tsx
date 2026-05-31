import { useEffect } from "react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Hero from "@/components/site/Hero";
import Marquee from "@/components/site/Marquee";

/**
 * Site institucional do MK-CRM.
 * Etapa 1 — apenas shell visual com navbar + footer e placeholders das seções.
 * Próximas etapas preenchem Hero, Marquee, Sobre, Features, etc.
 */
export default function MarketingSite() {
  useEffect(() => {
    const prev = document.title;
    document.title = "MK-CRM · CRM com WhatsApp, Kanban e IA para clínicas";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-screen bg-site-bg text-site-text site-font-body antialiased">
      <SiteNav />

      <main>
        <Hero />
        <Marquee />

        {/* Etapa 3 */}
        <SectionPlaceholder id="sobre" label="Sobre" />
        <SectionPlaceholder id="features" label="Features" />

        {/* Etapa 4 */}
        <SectionPlaceholder id="servicos" label="Serviços numerados" />
        <SectionPlaceholder id="integracoes" label="Integrações" />

        {/* Etapa 5 */}
        <SectionPlaceholder id="depoimentos" label="Depoimentos" />
        <SectionPlaceholder id="planos" label="Pricing" />
        <SectionPlaceholder id="blog" label="Blog / Central (placeholder)" />

        {/* Etapa 6 */}
        <SectionPlaceholder id="contato" label="Contato" />
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionPlaceholder({
  id,
  label,
  minH = "min-h-[40vh]",
}: {
  id: string;
  label: string;
  minH?: string;
}) {
  return (
    <section
      id={id}
      className={`${minH} border-b border-white/5 bg-site-bg`}
      aria-label={`Placeholder ${label}`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
        <span className="site-font-display rounded-full border border-white/10 px-4 py-2 text-[15px] text-site-muted">
          {label}
        </span>
      </div>
    </section>
  );
}
