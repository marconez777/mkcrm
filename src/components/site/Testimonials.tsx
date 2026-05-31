import { useRef, type RefObject } from "react";
import { Quote, Star } from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { SPRING, useIsMobile, AuroraBlob } from "./_anim";

const TESTIMONIALS = [
  {
    quote:
      "Em 30 dias dobramos a taxa de resposta no WhatsApp. O Kanban deixou a operação visível pra todo mundo.",
    name: "Dra. Marina Alves",
    role: "Diretora · Clínica Vitalis",
    metric: "+112% leads respondidos",
  },
  {
    quote:
      "Os agentes de IA atendem fora do horário comercial e já agendam consulta. Parece mágica, mas é só configuração.",
    name: "Rafael Tonin",
    role: "Gestor comercial · OdontoPlus",
    metric: "37% das consultas agendadas pela IA",
  },
  {
    quote:
      "Trocamos 3 ferramentas por uma só. Custo caiu e a equipe finalmente para de perder lead em planilha.",
    name: "Camila Souza",
    role: "COO · Rede Estética Bem",
    metric: "−R$ 4.200/mês em ferramentas",
  },
] as const;

type TProps = {
  quote: string;
  name: string;
  role: string;
  metric: string;
  range: [number, number];
  peak: number;
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function TestimonialCard({ quote, name, role, metric, range, peak, progress, reduce, isMobile }: TProps) {
  const [start, end] = range;
  const opacity = useSpring(useTransform(progress, [start, end], [0, 1]), SPRING);
  const y = useSpring(useTransform(progress, [start, end], [reduce ? 0 : isMobile ? 20 : 50, 0]), SPRING);
  const scale = useSpring(
    useTransform(progress, [start, peak, end], reduce || isMobile ? [1, 1, 1] : [0.96, 1.012, 1]),
    SPRING,
  );
  const rotateX = useSpring(useTransform(progress, [start, end], [reduce || isMobile ? 0 : 4, 0]), SPRING);

  const active = useSpring(
    useTransform(progress, [Math.max(0, peak - 0.06), peak, Math.min(1, peak + 0.06)], [0, 1, 0]),
    SPRING,
  );
  const intensity = reduce ? 0.25 : isMobile ? 0.4 : 1;
  const boxShadow = useTransform(
    active,
    (a) =>
      `inset 0 0 0 1px hsl(var(--site-primary) / ${0.35 * a * intensity}), 0 24px 60px -24px hsl(var(--site-accent) / ${0.45 * a * intensity})`,
  );
  const overlayOpacity = useTransform(active, (a) => a * 0.6 * intensity);

  return (
    <motion.li
      className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-colors hover:border-site-accent/60"
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
        boxShadow,
      }}
      whileHover={reduce ? undefined : { y: -4 }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: overlayOpacity,
          background:
            "radial-gradient(120% 80% at 100% 0%, hsl(var(--site-accent) / 0.22) 0%, transparent 55%), radial-gradient(100% 80% at 0% 100%, hsl(var(--site-primary) / 0.14) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.6), transparent 70%)" }}
      />
      <Quote className="relative h-7 w-7 text-site-primary" aria-hidden />

      <p className="relative site-font-body text-[16px] leading-relaxed text-site-text">“{quote}”</p>

      <div className="relative mt-auto flex items-center justify-between gap-4 border-t border-white/5 pt-5">
        <div>
          <p className="site-font-display text-[15px] leading-tight">{name}</p>
          <p className="site-font-body mt-1 text-[12px] text-site-muted">{role}</p>
        </div>
        <div className="flex" aria-label="5 estrelas">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-site-primary text-site-primary" />
          ))}
        </div>
      </div>

      <div className="absolute -top-3 left-7 rounded-full border border-site-accent/50 bg-site-bg px-3 py-1">
        <span className="site-font-body text-[11px] uppercase tracking-wider text-site-primary">{metric}</span>
      </div>
    </motion.li>
  );
}

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef as RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  const pA = useSpring(useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : -40, reduce || isMobile ? 0 : 40]), SPRING);
  const pB = useSpring(useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : 30, reduce || isMobile ? 0 : -30]), SPRING);

  const badgeO = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [0, 1]), SPRING);
  const badgeY = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [reduce ? 0 : 12, 0]), SPRING);
  const titleO = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [0, 1]), SPRING);
  const titleY = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [reduce ? 0 : 28, 0]), SPRING);
  const glow = useSpring(useTransform(scrollYProgress, [0.12, 0.3, 0.45], [0, 1, 0.32]), SPRING);
  const wordShadow = useTransform(glow, (g) => {
    const k = isMobile ? 0.4 : 1;
    return `0 0 ${22 * g * k}px hsl(var(--site-primary) / ${0.5 * g * k})`;
  });

  const cardConfig: Array<{ range: [number, number]; peak: number }> = [
    { range: [0.22, 0.42], peak: 0.32 },
    { range: [0.28, 0.48], peak: 0.38 },
    { range: [0.34, 0.54], peak: 0.44 },
  ];

  return (
    <section
      ref={sectionRef}
      id="depoimentos"
      aria-label="Depoimentos de clientes"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 opacity-65"
        background="radial-gradient(ellipse at center, hsl(var(--site-accent) / 0.55), transparent 70%)"
        parallaxY={pA}
        animate={{ x: [-20, 20, -20], y: [-15, 15, -15], scale: [1, 1.06, 1] }}
        duration={24}
        reduce={reduce}
        isMobile={isMobile}
      />
      <AuroraBlob
        className="right-[-10%] bottom-[-10%] h-[420px] w-[420px] opacity-50"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        parallaxY={pB}
        animate={{ x: [20, -20, 20], y: [25, -25, 25], scale: [1, 1.07, 1] }}
        duration={28}
        reduce={reduce}
        isMobile={isMobile}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
            style={{ opacity: reduce ? 1 : badgeO, y: reduce ? 0 : badgeY, willChange: "transform, opacity" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Quem já usa
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            style={{ opacity: reduce ? 1 : titleO, y: reduce ? 0 : titleY, willChange: "transform, opacity" }}
          >
            Clínicas que vendem mais
            <br />
            com o{" "}
            <motion.span className="text-site-primary" style={{ textShadow: reduce ? "none" : wordShadow }}>
              MK-CRM
            </motion.span>
            .
          </motion.h2>
        </div>

        <ul className="mt-16 grid gap-5 md:grid-cols-3" style={{ perspective: 1200 }}>
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard
              key={t.name}
              quote={t.quote}
              name={t.name}
              role={t.role}
              metric={t.metric}
              range={cardConfig[i].range}
              peak={cardConfig[i].peak}
              progress={scrollYProgress}
              reduce={reduce}
              isMobile={isMobile}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
