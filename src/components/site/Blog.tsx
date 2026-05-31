import { useRef, type RefObject } from "react";
import { ArrowUpRight, BookOpen, LifeBuoy, Sparkles, type LucideIcon } from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { SPRING, useIsMobile, AuroraBlob } from "./_anim";

const POSTS = [
  {
    tag: "Guia",
    icon: BookOpen,
    title: "Como montar um funil de vendas para clínicas em 7 passos",
    read: "8 min de leitura",
  },
  {
    tag: "Novidade",
    icon: Sparkles,
    title: "Agentes de IA chegam ao MK-CRM com orçamento controlado",
    read: "4 min de leitura",
  },
  {
    tag: "Ajuda",
    icon: LifeBuoy,
    title: "Conectando seu WhatsApp via Evolution API passo a passo",
    read: "6 min de leitura",
  },
] as const;

type PostProps = {
  tag: string;
  icon: LucideIcon;
  title: string;
  read: string;
  range: [number, number];
  peak: number;
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function PostCard({ tag, icon: Icon, title, read, range, peak, progress, reduce, isMobile }: PostProps) {
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
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
        boxShadow,
        borderRadius: "1.5rem",
      }}
    >
      <a
        href="#"
        className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-all hover:-translate-y-1 hover:border-site-accent/60"
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
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-site-primary/40 px-3 py-1 site-font-body text-[11px] uppercase tracking-wider text-site-primary">
            <Icon className="h-3 w-3" />
            {tag}
          </span>
          <ArrowUpRight className="h-4 w-4 text-site-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-site-primary" />
        </div>

        <h3 className="relative site-font-display text-[22px] leading-tight">{title}</h3>

        <span className="relative site-font-body mt-auto text-[12px] text-site-muted">{read}</span>

        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
          style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)" }}
        />
      </a>
    </motion.li>
  );
}

export default function Blog() {
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
  const subO = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [0, 1]), SPRING);
  const subY = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [reduce ? 0 : 16, 0]), SPRING);
  const ctaO = useSpring(useTransform(scrollYProgress, [0.2, 0.4], [0, 1]), SPRING);
  const ctaY = useSpring(useTransform(scrollYProgress, [0.2, 0.4], [reduce ? 0 : 12, 0]), SPRING);

  const tailO = useSpring(useTransform(scrollYProgress, [0.6, 0.78], [0, 1]), SPRING);
  const tailY = useSpring(useTransform(scrollYProgress, [0.6, 0.78], [reduce ? 0 : 12, 0]), SPRING);

  const cardConfig: Array<{ range: [number, number]; peak: number }> = [
    { range: [0.3, 0.5], peak: 0.4 },
    { range: [0.36, 0.56], peak: 0.46 },
    { range: [0.42, 0.62], peak: 0.52 },
  ];

  return (
    <section
      ref={sectionRef}
      id="blog"
      aria-label="Blog e central de ajuda"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-1/2 top-0 h-[460px] w-[820px] -translate-x-1/2 opacity-55"
        background="radial-gradient(ellipse at center, hsl(var(--site-accent) / 0.5), transparent 70%)"
        parallaxY={pA}
        animate={{ x: [-20, 20, -20], y: [-15, 15, -15], scale: [1, 1.06, 1] }}
        duration={24}
        reduce={reduce}
        isMobile={isMobile}
      />
      <AuroraBlob
        className="left-[-12%] bottom-0 h-[420px] w-[420px] opacity-50"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        parallaxY={pB}
        animate={{ x: [-20, 20, -20], y: [20, -20, 20], scale: [1, 1.07, 1] }}
        duration={28}
        reduce={reduce}
        isMobile={isMobile}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <motion.span
              className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
              style={{ opacity: reduce ? 1 : badgeO, y: reduce ? 0 : badgeY, willChange: "transform, opacity" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              Aprenda · Cresça
            </motion.span>
            <motion.h2
              className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
              style={{ opacity: reduce ? 1 : titleO, y: reduce ? 0 : titleY, willChange: "transform, opacity" }}
            >
              Conteúdo e{" "}
              <motion.span className="text-site-primary" style={{ textShadow: reduce ? "none" : wordShadow }}>
                central de ajuda
              </motion.span>
              .
            </motion.h2>
            <motion.p
              className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted"
              style={{ opacity: reduce ? 1 : subO, y: reduce ? 0 : subY, willChange: "transform, opacity" }}
            >
              Guias práticos, tutoriais e novidades para sua clínica vender mais e operar melhor.
            </motion.p>
          </div>
          <motion.a
            href="#contato"
            className="site-font-body inline-flex h-11 items-center gap-2 self-start rounded-full border border-white/15 px-5 text-[14px] text-site-text transition-colors hover:border-site-primary/60 hover:text-site-primary md:self-auto"
            style={{ opacity: reduce ? 1 : ctaO, y: reduce ? 0 : ctaY, willChange: "transform, opacity" }}
          >
            Ver tudo
            <ArrowUpRight className="h-4 w-4" />
          </motion.a>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-3" style={{ perspective: 1200 }}>
          {POSTS.map((p, i) => (
            <PostCard
              key={p.title}
              tag={p.tag}
              icon={p.icon}
              title={p.title}
              read={p.read}
              range={cardConfig[i].range}
              peak={cardConfig[i].peak}
              progress={scrollYProgress}
              reduce={reduce}
              isMobile={isMobile}
            />
          ))}
        </ul>

        <motion.p
          className="site-font-body mt-10 text-center text-[13px] text-site-muted"
          style={{ opacity: reduce ? 1 : tailO, y: reduce ? 0 : tailY, willChange: "transform, opacity" }}
        >
          Em breve: central de ajuda completa com busca e categorias.
        </motion.p>
      </div>
    </section>
  );
}
