import { useEffect } from "react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Hero from "@/components/site/Hero";
import Marquee from "@/components/site/Marquee";
import About from "@/components/site/About";
import Features from "@/components/site/Features";
import Services from "@/components/site/Services";
import Integrations from "@/components/site/Integrations";
import Capabilities from "@/components/site/Capabilities";
import Testimonials from "@/components/site/Testimonials";
import Pricing from "@/components/site/Pricing";
import Blog from "@/components/site/Blog";


/**
 * Site institucional do Chat Funnel AI (deslogado).
 */
export default function MarketingSite() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Chat Funnel AI · CRM com WhatsApp, Kanban e IA para negócios";
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

        <About />
        <Features />
        <Capabilities />

        <Services />
        <Integrations />

        {/* <Testimonials /> */}
        <Pricing />
        {/* <Blog /> */}
      </main>

      <SiteFooter />
    </div>
  );
}
