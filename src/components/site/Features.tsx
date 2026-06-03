import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";
import featureKanban from "@/assets/site/feature-kanban.png";
import featureInbox from "@/assets/site/feature-inbox.png";
import featureIa from "@/assets/site/feature-ia.png";

const CARDS = [
  {
    img: featureKanban,
    eyebrow: "Pipeline",
    title: "Kanban que pensa pelo seu time",
    body: "Arraste leads entre etapas, automatize próximos passos e veja gargalos em tempo real, com filtros por atendente, origem e data.",
  },
  {
    img: featureInbox,
    eyebrow: "WhatsApp",
    title: "Inbox unificado, multiatendente",
    body: "Conversas centralizadas, divisão por atendente, agendamento de mensagens, áudios, mídias e tudo o que seu time precisa para responder rápido.",
  },
  {
    img: featureIa,
    eyebrow: "IA",
    title: "Agentes que vendem, organizam e resumem",
    body: "Um agente responde no WhatsApp 24/7 com a base de conhecimento da negócio. Outro observa em silêncio e move os cards no Kanban, tagueia e cria tarefas. Um terceiro entrega um resumo de cada conversa. Tudo com controle de orçamento mensal.",
  },
] as const;

export default function Features() {
  return (
    <section
      id="features"
      aria-label="Principais features"
      className="relative overflow-hidden bg-site-bg py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-[-10%] top-1/4 h-[420px] w-[420px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.45), transparent 70%)"
        opacity={0.35}
        duration={26}
      />
      <AuroraBlob
        className="right-[-10%] bottom-0 h-[380px] w-[380px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        opacity={0.3}
        duration={30}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex flex-col items-center text-center">
          <motion.span
            className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0, 12)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Nossas features
          </motion.span>
          <motion.h2
            className="site-font-display mt-6 text-[clamp(56px,11vw,144px)] font-bold uppercase leading-[0.85] tracking-tight"
            style={{
              color: "transparent",
              WebkitTextStroke: "1.5px hsl(var(--site-accent-glow) / 0.55)",
            }}
            aria-label="Por que MK-CRM"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.08, 28)}
          >
            <span className="text-site-text" style={{ WebkitTextStroke: "0" }}>
              Por que
            </span>{" "}
            <span
              style={{
                textShadow:
                  "0 0 28px hsl(var(--site-accent-glow) / 0.45)",
              }}
            >
              MK-CRM
            </span>
          </motion.h2>
          <motion.p
            className="site-font-body mt-6 max-w-2xl text-[clamp(16px,1.3vw,18px)] leading-relaxed text-site-muted"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.16, 16)}
          >
            Três pilares trabalhando juntos para virar conversa em paciente — e paciente em
            retorno previsível.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.article
              key={c.title}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-site-surface transition-colors hover:border-site-primary/40"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.08 * i, 40)}
            >
              <div className="relative aspect-[5/4] overflow-hidden bg-site-bg">
                <img
                  src={c.img}
                  alt={`Mockup do produto MK-CRM mostrando ${c.title}`}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen transition-opacity duration-500 group-hover:opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 70%, hsl(var(--site-accent) / 0.55) 0%, transparent 65%)",
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, hsl(var(--site-surface)) 95%)",
                  }}
                />
              </div>

              <div className="relative flex flex-1 flex-col p-7">
                <span className="site-font-body text-[15px] font-semibold uppercase tracking-wider text-site-primary">
                  {c.eyebrow}
                </span>
                <h3 className="site-font-display mt-3 text-[22px] font-semibold leading-tight text-site-text">
                  {c.title}
                </h3>
                <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
                  {c.body}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
