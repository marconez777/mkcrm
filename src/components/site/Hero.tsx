import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import hero3d from "@/assets/site/hero-3d.png";

export default function Hero() {
  return (
    <section
      id="hero"
      aria-label="Apresentação do MK-CRM"
      className="relative isolate overflow-hidden bg-site-bg"
    >
      {/* Glow ambiente roxo + verde */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 30%, hsl(var(--site-accent) / 0.55) 0%, transparent 60%), radial-gradient(45% 40% at 80% 70%, hsl(var(--site-primary) / 0.18) 0%, transparent 60%)",
        }}
      />
      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--site-text)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--site-text)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-24 pt-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pb-32 md:pt-24 lg:px-8">
        <div className="relative">
          <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-site-primary/40 bg-site-primary/10 px-3 py-1 text-[15px] font-medium text-site-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-site-primary" />
            Novo · IA nativa em todos os planos
          </span>

          <h1 className="site-font-display mt-6 text-[clamp(44px,7vw,92px)] font-bold leading-[0.95] tracking-tight text-site-text">
            O CRM que <span className="text-site-primary">vende</span>
            <br className="hidden sm:block" /> pela sua clínica.
          </h1>

          {/* TODO: copy final */}
          <p className="site-font-body mt-6 max-w-xl text-[clamp(16px,1.4vw,19px)] leading-relaxed text-site-muted">
            Pipeline Kanban, atendimento em WhatsApp, automações e agentes de IA dedicados —
            tudo em um só lugar, feito para clínicas brasileiras que não querem perder lead.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="site-font-display group inline-flex items-center gap-2 rounded-full bg-site-primary px-6 py-3.5 text-[16px] font-semibold text-site-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Começar grátis
              <span className="grid h-7 w-7 place-items-center rounded-full bg-site-primary-foreground/10 transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
            <a
              href="#features"
              className="site-font-display inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-[16px] font-semibold text-site-text transition-colors hover:border-site-primary/60 hover:text-site-primary"
            >
              <Play className="h-4 w-4 fill-current" />
              Ver demonstração
            </a>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/5 pt-6">
            {[
              { k: "+1.200", v: "clínicas" },
              { k: "98%", v: "uptime" },
              { k: "24/7", v: "suporte" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="site-font-display text-[clamp(22px,2vw,28px)] font-bold text-site-text">
                  {s.k}
                </dt>
                <dd className="site-font-body mt-1 text-[15px] text-site-muted">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          {/* Halo verde por trás da imagem */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, hsl(var(--site-primary) / 0.35) 0%, transparent 70%)",
            }}
          />
          <img
            src={hero3d}
            alt="Escultura 3D abstrata representando a inteligência do MK-CRM"
            width={1024}
            height={1024}
            className="h-auto w-full select-none drop-shadow-[0_30px_60px_rgba(30,212,0,0.18)]"
            draggable={false}
          />
        </div>
      </div>
    </section>
  );
}
