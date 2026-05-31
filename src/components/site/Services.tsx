import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

const SERVICES = [
  {
    n: "01",
    title: "Implantação guiada",
    body: "Configuramos pipeline, etapas, integrações e usuários junto com sua equipe, em até 7 dias.",
    tags: ["Onboarding", "Setup WhatsApp", "Importação"],
  },
  {
    n: "02",
    title: "Automação de funil",
    body: "Criamos regras, gatilhos e disparos automáticos para nutrir leads sem ninguém esquecer follow-up.",
    tags: ["Triggers", "Templates", "Cadências"],
  },
  {
    n: "03",
    title: "IA aplicada à clínica",
    body: "Agentes treinados com o tom da sua clínica, integrados ao histórico do paciente e ao funil de vendas.",
    tags: ["Agentes", "Memórias", "Custos controlados"],
  },
  {
    n: "04",
    title: "Disparos em massa responsáveis",
    body: "Campanhas segmentadas via WhatsApp e e-mail com controle de janela, limite e opt-out automático.",
    tags: ["Segmentação", "Resend", "Compliance"],
  },
  {
    n: "05",
    title: "Relatórios e BI",
    body: "Dashboards de conversão, produtividade por atendente e ROI por canal — sem precisar abrir planilha.",
    tags: ["Dashboards", "Export CSV", "API"],
  },
  {
    n: "06",
    title: "Suporte e evolução contínua",
    body: "Atendimento humano, roadmap aberto e atualizações constantes para sua clínica nunca parar de crescer.",
    tags: ["Suporte 24/7", "Roadmap", "SLA"],
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

type ServiceCardProps = {
  n: string;
  title: string;
  body: string;
  tags: readonly string[];
  range: [number, number];
  peak: number;
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function ServiceCard({
  n,
  title,
  body,
  tags,
  range,
  peak,
  progress,
  reduce,
  isMobile,
}: ServiceCardProps) {
  const [start, end] = range;

  const opacityRaw = useTransform(progress, [start, end], [0, 1]);
  const yRaw = useTransform(
    progress,
    [start, end],
    [reduce ? 0 : isMobile ? 20 : 50, 0],
  );
  const scaleRaw = useTransform(
    progress,
    [start, peak, end],
    reduce || isMobile ? [1, 1, 1] : [0.96, 1.012, 1],
  );
  const rotateXRaw = useTransform(
    progress,
    [start, end],
    [reduce || isMobile ? 0 : 4, 0],
  );

  const activeRaw = useTransform(
    progress,
    [Math.max(0, peak - 0.06), peak, Math.min(1, peak + 0.06)],
    [0, 1, 0],
  );
  const intensity = reduce ? 0.25 : isMobile ? 0.4 : 1;

  const opacity = useSpring(opacityRaw, SPRING);
  const y = useSpring(yRaw, SPRING);
  const scale = useSpring(scaleRaw, SPRING);
  const rotateX = useSpring(rotateXRaw, SPRING);
  const active = useSpring(activeRaw, SPRING);

  const boxShadow = useTransform(
    active,
    (a) =>
      `inset 0 0 0 1px hsl(var(--site-primary) / ${0.35 * a * intensity}), 0 24px 60px -24px hsl(var(--site-accent) / ${0.45 * a * intensity})`,
  );
  const overlayOpacity = useTransform(active, (a) => a * 0.6 * intensity);

  return (
    <motion.li
      className="group relative flex flex-col gap-6 overflow-hidden bg-site-bg p-8 transition-colors hover:bg-site-surface"
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
        boxShadow,
      }}
    >
      {/* Overlay gradiente verde→roxo do destaque ativo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: overlayOpacity,
          background:
            "radial-gradient(120% 80% at 100% 0%, hsl(var(--site-accent) / 0.22) 0%, transparent 55%), radial-gradient(100% 80% at 0% 100%, hsl(var(--site-primary) / 0.14) 0%, transparent 60%)",
        }}
      />
      {/* halo roxo no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)",
        }}
      />
      <div className="relative flex items-start justify-between">
        <span className="site-font-display text-[44px] leading-none text-site-primary">
          {n}
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-site-muted transition-all group-hover:border-site-accent/70 group-hover:text-site-text">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="relative">
        <h3 className="site-font-display text-[22px] leading-tight">{title}</h3>
        <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
          {body}
        </p>
      </div>

      <ul className="relative mt-auto flex flex-wrap gap-2 pt-2">
        {tags.map((t) => (
          <li
            key={t}
            className="site-font-body rounded-full border border-white/10 px-3 py-1 text-[12px] text-site-muted"
          >
            {t}
          </li>
        ))}
      </ul>
    </motion.li>
  );
}

type BlobProps = {
  className: string;
  background: string;
  parallaxY: MotionValue<number>;
  animate?: {
    x?: number[];
    y?: number[];
    scale?: number[];
  };
  duration: number;
  reduce: boolean;
  isMobile: boolean;
};

function AuroraBlob({
  className,
  background,
  parallaxY,
  animate,
  duration,
  reduce,
  isMobile,
}: BlobProps) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background, y: reduce ? 0 : parallaxY, willChange: "transform" }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background, willChange: "transform, opacity" }}
        animate={
          reduce
            ? undefined
            : isMobile
              ? { opacity: [0.55, 0.75, 0.55] }
              : animate
        }
        transition={{
          duration,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "mirror",
        }}
      />
    </motion.div>
  );
}

export default function Services() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef as RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  // Parallax suave do fundo
  const bgParallaxA = useSpring(
    useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : -40, reduce || isMobile ? 0 : 40]),
    SPRING,
  );
  const bgParallaxB = useSpring(
    useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : 30, reduce || isMobile ? 0 : -30]),
    SPRING,
  );
  const bgParallaxC = useSpring(
    useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : -20, reduce || isMobile ? 0 : 20]),
    SPRING,
  );
  const bgParallaxD = useSpring(
    useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : 20, reduce || isMobile ? 0 : -20]),
    SPRING,
  );

  // Cabeçalho
  const badgeO = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [0, 1]), SPRING);
  const badgeY = useSpring(
    useTransform(scrollYProgress, [0.05, 0.22], [reduce ? 0 : 12, 0]),
    SPRING,
  );

  const titleO = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [0, 1]), SPRING);
  const titleY = useSpring(
    useTransform(scrollYProgress, [0.1, 0.3], [reduce ? 0 : 28, 0]),
    SPRING,
  );

  const glowRaw = useTransform(scrollYProgress, [0.12, 0.3, 0.45], [0, 1, 0.32]);
  const glow = useSpring(glowRaw, SPRING);
  const wordShadow = useTransform(glow, (g) => {
    const k = isMobile ? 0.4 : 1;
    return `0 0 ${22 * g * k}px hsl(var(--site-primary) / ${0.5 * g * k})`;
  });

  const paraO = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [0, 1]), SPRING);
  const paraY = useSpring(
    useTransform(scrollYProgress, [0.18, 0.38], [reduce ? 0 : 16, 0]),
    SPRING,
  );

  // Cards: cascata 3+3 + picos distribuídos
  const cardConfig: Array<{ range: [number, number]; peak: number }> = [
    { range: [0.22, 0.42], peak: 0.32 },
    { range: [0.26, 0.46], peak: 0.38 },
    { range: [0.3, 0.5], peak: 0.44 },
    { range: [0.36, 0.56], peak: 0.5 },
    { range: [0.4, 0.6], peak: 0.56 },
    { range: [0.44, 0.64], peak: 0.62 },
  ];

  return (
    <section
      ref={sectionRef}
      id="servicos"
      aria-label="Serviços"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      {/* Auroras roxas animadas */}
      <AuroraBlob
        className="-left-40 top-1/3 h-[560px] w-[560px] opacity-70"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)"
        parallaxY={bgParallaxA}
        animate={{ x: [-30, 30, -30], y: [-20, 20, -20], scale: [1, 1.08, 1] }}
        duration={18}
        reduce={reduce}
        isMobile={isMobile}
      />
      <AuroraBlob
        className="-right-32 bottom-0 h-[420px] w-[420px] opacity-50"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        parallaxY={bgParallaxB}
        animate={{ x: [25, -25, 25], y: [30, -30, 30], scale: [1, 1.06, 1] }}
        duration={22}
        reduce={reduce}
        isMobile={isMobile}
      />
      {!isMobile && (
        <>
          <AuroraBlob
            className="left-1/2 top-10 h-[720px] w-[720px] -translate-x-1/2 opacity-40"
            background="radial-gradient(circle at center, hsl(var(--site-accent-glow) / 0.22), transparent 70%)"
            parallaxY={bgParallaxC}
            animate={{ x: [-20, 20, -20], y: [-15, 15, -15], scale: [1, 1.05, 1] }}
            duration={26}
            reduce={reduce}
            isMobile={isMobile}
          />
          <AuroraBlob
            className="left-1/3 bottom-10 h-[640px] w-[640px] opacity-30"
            background="radial-gradient(circle at center, hsl(285 80% 35% / 0.28), transparent 70%)"
            parallaxY={bgParallaxD}
            animate={{ x: [15, -15, 15], y: [20, -20, 20], scale: [1, 1.07, 1] }}
            duration={30}
            reduce={reduce}
            isMobile={isMobile}
          />
        </>
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-end">
          <div>
            <motion.span
              className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
              style={{
                opacity: reduce ? 1 : badgeO,
                y: reduce ? 0 : badgeY,
                willChange: "transform, opacity",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              O que entregamos
            </motion.span>
            <motion.h2
              className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
              style={{
                opacity: reduce ? 1 : titleO,
                y: reduce ? 0 : titleY,
                willChange: "transform, opacity",
              }}
            >
              Serviços que
              <br />
              fazem o{" "}
              <motion.span
                className="text-site-primary"
                style={{ textShadow: reduce ? "none" : wordShadow }}
              >
                funil
              </motion.span>{" "}
              <motion.span
                className="text-site-primary"
                style={{ textShadow: reduce ? "none" : wordShadow }}
              >
                girar
              </motion.span>
              .
            </motion.h2>
          </div>
          <motion.p
            className="site-font-body max-w-xl text-[17px] leading-relaxed text-site-muted md:justify-self-end"
            style={{
              opacity: reduce ? 1 : paraO,
              y: reduce ? 0 : paraY,
              willChange: "transform, opacity",
            }}
          >
            Mais do que software: um time e um método para colocar sua operação
            de vendas em outro patamar — do primeiro contato no WhatsApp ao
            paciente fidelizado.
          </motion.p>
        </div>

        <ol
          className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3"
          style={{ perspective: 1200 }}
        >
          {SERVICES.map((s, i) => (
            <ServiceCard
              key={s.n}
              n={s.n}
              title={s.title}
              body={s.body}
              tags={s.tags}
              range={cardConfig[i].range}
              peak={cardConfig[i].peak}
              progress={scrollYProgress}
              reduce={reduce}
              isMobile={isMobile}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
