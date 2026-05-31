import { useEffect, useRef, useState, type RefObject } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
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
    title: "Agentes dedicados que vendem por você",
    body: "Configure agentes por etapa do funil, com memórias da clínica, ferramentas e custo controlado por orçamento mensal.",
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
  img: string;
  eyebrow: string;
  title: string;
  body: string;
  range: [number, number];
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function FeatureCard({
  img,
  eyebrow,
  title,
  body,
  range,
  progress,
  reduce,
  isMobile,
}: CardProps) {
  const [start, end] = range;
  const peak = (start + end) / 2;

  // Entrada
  const opacityRaw = useTransform(progress, [start, end], [0, 1]);
  const yRaw = useTransform(
    progress,
    [start, end],
    [reduce ? 0 : isMobile ? 20 : 60, 0],
  );
  // scale com leve boost no pico (combina entrada + destaque ativo)
  const scaleRaw = useTransform(
    progress,
    [start, peak, end],
    reduce || isMobile ? [1, 1, 1] : [0.96, 1.015, 1],
  );
  const rotateXRaw = useTransform(
    progress,
    [start, end],
    [reduce || isMobile ? 0 : 5, 0],
  );

  const intensity = reduce ? 0.25 : isMobile ? 0.4 : 1;
  const highlightRaw = useTransform(
    progress,
    [start, peak, end, Math.min(1, end + 0.05)],
    [0, 1 * intensity, 0.35 * intensity, 0.25 * intensity],
  );

  // Parallax interno do mockup (faixa ampla)
  const parallaxRange: [number, number] = [start, Math.min(1, start + 0.45)];
  const imgYRaw = useTransform(
    progress,
    parallaxRange,
    [reduce || isMobile ? 0 : -8, reduce || isMobile ? 0 : 8],
  );
  const imgScaleRaw = useTransform(
    progress,
    parallaxRange,
    [1, reduce || isMobile ? 1 : 1.04],
  );

  const opacity = useSpring(opacityRaw, SPRING);
  const y = useSpring(yRaw, SPRING);
  const scale = useSpring(scaleRaw, SPRING);
  const rotateX = useSpring(rotateXRaw, SPRING);
  const highlight = useSpring(highlightRaw, SPRING);
  const imgY = useSpring(imgYRaw, SPRING);
  const imgScale = useSpring(imgScaleRaw, SPRING);

  const boxShadow = useTransform(
    highlight,
    (h) =>
      `inset 0 0 0 1px hsl(var(--site-primary) / ${0.4 * h}), 0 24px 60px -24px hsl(var(--site-accent) / ${0.35 * h})`,
  );

  return (
    <motion.article
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-site-surface transition-colors hover:border-site-primary/40"
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
      }}
    >
      {/* Destaque ativo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
        style={{
          opacity: highlight,
          background:
            "radial-gradient(120% 80% at 100% 0%, hsl(var(--site-accent) / 0.22) 0%, transparent 55%), radial-gradient(100% 80% at 0% 100%, hsl(var(--site-primary) / 0.16) 0%, transparent 60%)",
          boxShadow,
        }}
      />
      <div className="relative aspect-[5/4] overflow-hidden bg-site-bg">
        <motion.img
          src={img}
          alt={`Mockup do produto MK-CRM mostrando ${title}`}
          loading="lazy"
          width={1024}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            y: reduce ? 0 : imgY,
            scale: reduce ? 1 : imgScale,
            willChange: "transform",
          }}
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
          {eyebrow}
        </span>
        <h3 className="site-font-display mt-3 text-[22px] font-semibold leading-tight text-site-text">
          {title}
        </h3>
        <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
          {body}
        </p>
      </div>
    </motion.article>
  );
}

export default function Features() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef as RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  // Cabeçalho
  const badgeO = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [0, 1]), SPRING);
  const badgeY = useSpring(
    useTransform(scrollYProgress, [0.05, 0.22], [reduce ? 0 : 12, 0]),
    SPRING,
  );

  const titleO = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [0, 1]), SPRING);
  const titleY = useSpring(
    useTransform(scrollYProgress, [0.1, 0.3], [reduce ? 0 : 32, 0]),
    SPRING,
  );

  const glowRaw = useTransform(scrollYProgress, [0.12, 0.3, 0.45], [0, 1, 0.32]);
  const glow = useSpring(glowRaw, SPRING);
  const titleTextShadow = useTransform(glow, (g) => {
    const k = isMobile ? 0.4 : 1;
    return `0 0 ${28 * g * k}px hsl(var(--site-accent-glow) / ${0.55 * g * k})`;
  });

  const subO = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [0, 1]), SPRING);
  const subY = useSpring(
    useTransform(scrollYProgress, [0.18, 0.38], [reduce ? 0 : 16, 0]),
    SPRING,
  );

  const cardRanges: Array<[number, number]> = [
    [0.28, 0.5],
    [0.36, 0.58],
    [0.44, 0.66],
  ];

  return (
    <section
      ref={sectionRef}
      id="features"
      aria-label="Principais features"
      className="relative overflow-hidden bg-site-bg py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex flex-col items-center text-center">
          <motion.span
            className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
            style={{
              opacity: reduce ? 1 : badgeO,
              y: reduce ? 0 : badgeY,
              willChange: "transform, opacity",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Nossas features
          </motion.span>
          <motion.h2
            className="site-font-display mt-6 text-[clamp(56px,11vw,144px)] font-bold uppercase leading-[0.85] tracking-tight"
            style={{
              color: "transparent",
              WebkitTextStroke: "1.5px hsl(var(--site-accent-glow) / 0.55)",
              opacity: reduce ? 1 : titleO,
              y: reduce ? 0 : titleY,
              willChange: "transform, opacity",
            }}
            aria-label="Features"
          >
            <span className="text-site-text" style={{ WebkitTextStroke: "0" }}>
              Por que
            </span>{" "}
            <motion.span style={{ textShadow: reduce ? "none" : titleTextShadow }}>
              MK-CRM
            </motion.span>
          </motion.h2>
          <motion.p
            className="site-font-body mt-6 max-w-2xl text-[clamp(16px,1.3vw,18px)] leading-relaxed text-site-muted"
            style={{
              opacity: reduce ? 1 : subO,
              y: reduce ? 0 : subY,
              willChange: "transform, opacity",
            }}
          >
            Três pilares trabalhando juntos para virar conversa em paciente — e paciente em
            retorno previsível.
          </motion.p>
        </div>

        <div
          className="mt-16 grid gap-6 md:grid-cols-3"
          style={{ perspective: 1200 }}
        >
          {CARDS.map((c, i) => (
            <FeatureCard
              key={c.title}
              img={c.img}
              eyebrow={c.eyebrow}
              title={c.title}
              body={c.body}
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
