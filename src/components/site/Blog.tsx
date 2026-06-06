import { ArrowUpRight, BookOpen, LifeBuoy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

const POSTS = [
  {
    tag: "Guia",
    icon: BookOpen,
    title: "Como montar um funil de vendas para negócios em 7 passos",
    read: "8 min de leitura",
  },
  {
    tag: "Novidade",
    icon: Sparkles,
    title: "Agentes de IA chegam ao Chat Funnel AI com orçamento controlado",
    read: "4 min de leitura",
  },
  {
    tag: "Ajuda",
    icon: LifeBuoy,
    title: "Conectando seu WhatsApp via Evolution API passo a passo",
    read: "6 min de leitura",
  },
] as const;

export default function Blog() {
  return (
    <section
      id="blog"
      aria-label="Blog e central de ajuda"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2"
        background="radial-gradient(ellipse at center, hsl(var(--site-accent) / 0.5), transparent 70%)"
        opacity={0.5}
        duration={26}
      />
      <AuroraBlob
        className="left-[-12%] bottom-0 h-[400px] w-[400px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        opacity={0.4}
        duration={30}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <motion.span
              className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0, 12)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              Aprenda · Cresça
            </motion.span>
            <motion.h2
              className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.08, 28)}
            >
              Conteúdo e{" "}
              <span
                className="text-site-primary"
                style={{ textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)" }}
              >
                central de ajuda
              </span>
              .
            </motion.h2>
            <motion.p
              className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.16, 16)}
            >
              Guias práticos, tutoriais e novidades para seu negócio vender mais e operar melhor.
            </motion.p>
          </div>
          <motion.a
            href="#contato"
            className="site-font-body inline-flex h-11 items-center gap-2 self-start rounded-full border border-white/15 px-5 text-[14px] text-site-text transition-colors hover:border-site-primary/60 hover:text-site-primary md:self-auto"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.2, 12)}
          >
            Ver tudo
            <ArrowUpRight className="h-4 w-4" />
          </motion.a>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {POSTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.li
                key={p.title}
                initial="hidden"
                whileInView="show"
                viewport={viewportOnce}
                variants={fadeUp(0.08 * i, 40)}
              >
                <a
                  href="#"
                  className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-all hover:-translate-y-1 hover:border-site-accent/60"
                >
                  <div className="relative flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-site-primary/40 px-3 py-1 site-font-body text-[11px] uppercase tracking-wider text-site-primary">
                      <Icon className="h-3 w-3" />
                      {p.tag}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-site-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-site-primary" />
                  </div>

                  <h3 className="relative site-font-display text-[22px] leading-tight">{p.title}</h3>

                  <span className="relative site-font-body mt-auto text-[12px] text-site-muted">{p.read}</span>

                  <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)" }}
                  />
                </a>
              </motion.li>
            );
          })}
        </ul>

        <motion.p
          className="site-font-body mt-10 text-center text-[13px] text-site-muted"
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp(0.1, 12)}
        >
          Em breve: central de ajuda completa com busca e categorias.
        </motion.p>
      </div>
    </section>
  );
}
