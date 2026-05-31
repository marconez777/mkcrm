import { useEffect, useRef, useState, type RefObject } from "react";
import { Zap, BrainCircuit, HandCoins, type LucideIcon } from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

const PILLARS = [
  {
    icon: Zap,
    title: "Atendimento ágil",
    body: "Mensagens, áudios e mídias do WhatsApp num inbox unificado, com respostas rápidas, agendamentos e divisão por atendente.",
  },
  {
    icon: BrainCircuit,
    title: "Inteligência embarcada",
    body: "Agentes de IA dedicados respondem leads, qualificam, criam tarefas e abastecem o pipeline 24h por dia sem perder o tom da sua marca.",
  },
  {
    icon: HandCoins,
    title: "Custo justo",
    body: "Planos pensados para clínicas brasileiras: tudo incluso, sem complemento escondido. Pague pelo que usa em IA e cresça no seu ritmo.",
  },
] as const;

const SPRING = { stiffness: 80, damping: 22, mass: 0.5 };

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

type CardProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  range: [number, number];
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function PillarCard({
  icon: Icon,
  title,
  body,
  range,
  progress,
  reduce,
  isMobile,
}: CardProps) {
  const [start, end] = range;
  const peak = (start + end) / 2;

  const opacityRaw = useTransform(progress, [start, end], [0, 1]);
  const yRaw = useTransform(progress, [start, end], [reduce ? 0 : isMobile ? 16 : 40, 0]);
  const scaleRaw = useTransform(
    progress,
    [start, end],
    [reduce || isMobile ? 1 : 0.96, 1],
  );
  const rotateXRaw = useTransform(
    progress,
    [start, end],
    [reduce || isMobile ? 0 : 4, 0],
  );
  const intensity = reduce ? 0.25 : isMobile ? 0.4 : 1;
  const highlightRaw = useTransform(
    progress,
    [start, peak, end, Math.min(1, end + 0.05)],
    [0, 1 * intensity, 0.35 * intensity, 0.25 * intensity],
  );

  const opacity = useSpring(opacityRaw, SPRING);
  const y = useSpring(yRaw, SPRING);
  const scale = useSpring(scaleRaw, SPRING);
  const rotateX = useSpring(rotateXRaw, SPRING);
  const highlight = useSpring(highlightRaw, SPRING);

  const boxShadow = useTransform(
    highlight,
    (h) =>
      `inset 0 0 0 1px hsl(var(--site-primary) / ${0.45 * h}), 0 24px 60px -24px hsl(var(--site-primary) / ${0.35 * h})`,
  );

  return (
    <motion.article
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-colors hover:border-site-primary/40"
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
      }}
    >
      {/* Destaque ativo conforme entra na viewport */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          opacity: highlight,
          background:
            "radial-gradient(120% 80% at 100% 0%, hsl(var(--site-accent) / 0.28) 0%, transparent 55%), radial-gradient(100% 80% at 0% 100%, hsl(var(--site-primary) / 0.18) 0%, transparent 60%)",
          boxShadow,
        }}
      />
      {/* Halo roxo existente no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "hsl(var(--site-accent) / 0.5)" }}
      />
      <div className="relative">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-site-primary/30 bg-site-primary/10 text-site-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="site-font-display mt-6 text-[22px] font-semibold text-site-text">
          {title}
        </h3>
        <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
          {body}
        </p>
      </div>
    </motion.article>
  );
}

export default function About() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef as RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  // Título à esquerda — faixa [0.1, 0.35]
  const titleOpacityRaw = useTransform(scrollYProgress, [0.1, 0.35], [0, 1]);
  const titleXRaw = useTransform(
    scrollYProgress,
    [0.1, 0.35],
    [reduce ? 0 : -40, 0],
  );
  const titleOpacity = useSpring(titleOpacityRaw, SPRING);
  const titleX = useSpring(titleXRaw, SPRING);

  // Glow na palavra — pico em 0.25, residual em 0.4
  const glowRaw = useTransform(
    scrollYProgress,
    [0.15, 0.3, 0.45],
    [0, 1, 0.3],
  );
  const glow = useSpring(glowRaw, SPRING);
  const textShadow = useTransform(glow, (g) => {
    const k = isMobile ? 0.4 : 1;
    return `0 0 ${24 * g * k}px hsl(var(--site-primary) / ${0.55 * g * k})`;
  });

  // Parágrafo à direita — faixa [0.2, 0.4]
  const paraOpacityRaw = useTransform(scrollYProgress, [0.2, 0.4], [0, 1]);
  const paraYRaw = useTransform(
    scrollYProgress,
    [0.2, 0.4],
    [reduce ? 0 : 24, 0],
  );
  const paraOpacity = useSpring(paraOpacityRaw, SPRING);
  const paraY = useSpring(paraYRaw, SPRING);

  // Cards: sequenciados
  const cardRanges: Array<[number, number]> = [
    [0.3, 0.5],
    [0.38, 0.58],
    [0.46, 0.66],
  ];

  return (
    <section
      ref={sectionRef}
      id="sobre"
      aria-label="Sobre o MK-CRM"
      className="relative bg-site-bg py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-10 md:grid-cols-[1fr_1.1fr]">
          <motion.div
            style={{
              opacity: reduce ? 1 : titleOpacity,
              x: reduce ? 0 : titleX,
              willChange: "transform, opacity",
            }}
          >
            <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              Sobre o MK-CRM
            </span>
            <h2 className="site-font-display mt-6 text-[clamp(32px,4.5vw,56px)] font-bold leading-[1.05] tracking-tight text-site-text">
              Um CRM dedicado a quem
              <br /> vive de{" "}
              <motion.span
                className="text-site-primary"
                style={{ textShadow: reduce ? "none" : textShadow }}
              >
                relacionamento
              </motion.span>
              .
            </h2>
          </motion.div>

          <motion.p
            className="site-font-body text-[clamp(16px,1.3vw,18px)] leading-relaxed text-site-muted"
            style={{
              opacity: reduce ? 1 : paraOpacity,
              y: reduce ? 0 : paraY,
              willChange: "transform, opacity",
            }}
          >
            Nascemos dentro de uma operação real de marketing para clínicas e cada feature foi
            forjada resolvendo dor de quem atende paciente todo dia: tempo curto, time enxuto e
            margem que não permite ferramenta cara que ninguém usa.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3" style={{ perspective: 1200 }}>
          {PILLARS.map((p, i) => (
            <PillarCard
              key={p.title}
              icon={p.icon}
              title={p.title}
              body={p.body}
              range={cardRanges[i]}
              progress={scrollYProgress}
              reduce={reduce}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
