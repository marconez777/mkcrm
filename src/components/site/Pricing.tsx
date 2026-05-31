import { useRef, type RefObject } from "react";
import { Check } from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { SPRING, useIsMobile, AuroraBlob } from "./_anim";

const PLANS = [
  {
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    desc: "Para clínicas começando a organizar o funil de vendas.",
    cta: "Começar grátis",
    highlight: false,
    features: [
      "1 número de WhatsApp",
      "Até 3 atendentes",
      "Kanban + funil ilimitado",
      "Inbox unificado",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Pro",
    price: "R$ 497",
    period: "/mês",
    desc: "O combo completo: automação, IA e disparos em massa.",
    cta: "Quero o Pro",
    highlight: true,
    features: [
      "Até 5 números de WhatsApp",
      "Até 15 atendentes",
      "Agentes de IA (orçamento incluso)",
      "Automações e cadências",
      "Disparos em massa + Resend",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
  {
    name: "Scale",
    price: "Sob consulta",
    period: "",
    desc: "Para redes e operações que precisam de SLA dedicado.",
    cta: "Falar com vendas",
    highlight: false,
    features: [
      "Números e atendentes ilimitados",
      "IA com orçamento custom",
      "Integrações sob medida",
      "Onboarding white-glove",
      "SLA + gerente dedicado",
      "Treinamento da equipe",
    ],
  },
] as const;

type PlanProps = {
  plan: (typeof PLANS)[number];
  range: [number, number];
  peak: number;
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function PlanCard({ plan, range, peak, progress, reduce, isMobile }: PlanProps) {
  const [start, end] = range;
  const opacity = useSpring(useTransform(progress, [start, end], [0, 1]), SPRING);
  const y = useSpring(useTransform(progress, [start, end], [reduce ? 0 : isMobile ? 20 : 50, 0]), SPRING);
  const scale = useSpring(
    useTransform(progress, [start, peak, end], reduce || isMobile ? [1, 1, 1] : [0.96, 1.015, 1]),
    SPRING,
  );
  const rotateX = useSpring(useTransform(progress, [start, end], [reduce || isMobile ? 0 : 4, 0]), SPRING);

  // Floor maior para o plano destaque, garantindo brilho residual permanente
  const floor = plan.highlight ? 0.4 : 0;
  const active = useSpring(
    useTransform(
      progress,
      [Math.max(0, peak - 0.06), peak, Math.min(1, peak + 0.06)],
      [floor, 1, floor],
    ),
    SPRING,
  );
  const intensity = reduce ? 0.25 : isMobile ? 0.4 : 1;
  const overlayOpacity = useTransform(active, (a) => a * 0.6 * intensity);

  return (
    <motion.li
      className={[
        "group relative flex flex-col overflow-hidden rounded-3xl border p-8 transition-colors",
        plan.highlight
          ? "border-site-accent/60 bg-site-bg shadow-[0_30px_80px_-30px_hsl(var(--site-accent)/0.6)]"
          : "border-white/10 bg-site-bg hover:border-site-accent/50",
      ].join(" ")}
      style={{
        opacity: reduce ? 1 : opacity,
        y: reduce ? 0 : y,
        scale: reduce ? 1 : scale,
        rotateX: reduce ? 0 : rotateX,
        transformPerspective: 1200,
        willChange: "transform, opacity",
      }}
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
        className={[
          "pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full blur-3xl transition-opacity",
          plan.highlight ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)" }}
      />
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-site-primary px-3 py-1 site-font-body text-[11px] uppercase tracking-wider text-site-bg">
          Mais escolhido
        </span>
      )}

      <div className="relative">
        <p className="site-font-display text-[15px] uppercase tracking-wider text-site-muted">{plan.name}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="site-font-display text-[48px] leading-none">{plan.price}</span>
          {plan.period && <span className="site-font-body text-[15px] text-site-muted">{plan.period}</span>}
        </div>
        <p className="site-font-body mt-3 text-[14px] leading-relaxed text-site-muted">{plan.desc}</p>
      </div>

      <ul className="relative mt-8 flex flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="site-font-body flex items-start gap-3 text-[14px] text-site-text">
            <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-site-primary/40 text-site-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <a
        href="#contato"
        className={[
          "relative mt-10 inline-flex h-12 items-center justify-center rounded-full px-6 site-font-body text-[14px] transition-all",
          plan.highlight
            ? "bg-site-primary text-site-bg hover:brightness-110"
            : "border border-white/15 text-site-text hover:border-site-accent/70 hover:text-site-text",
        ].join(" ")}
      >
        {plan.cta}
      </a>
    </motion.li>
  );
}

export default function Pricing() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef as RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  const pA = useSpring(useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : -40, reduce || isMobile ? 0 : 40]), SPRING);
  const pB = useSpring(useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : 30, reduce || isMobile ? 0 : -30]), SPRING);
  const pC = useSpring(useTransform(scrollYProgress, [0, 1], [reduce || isMobile ? 0 : -20, reduce || isMobile ? 0 : 20]), SPRING);

  const badgeO = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [0, 1]), SPRING);
  const badgeY = useSpring(useTransform(scrollYProgress, [0.05, 0.22], [reduce ? 0 : 12, 0]), SPRING);
  const titleO = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [0, 1]), SPRING);
  const titleY = useSpring(useTransform(scrollYProgress, [0.1, 0.3], [reduce ? 0 : 28, 0]), SPRING);
  const glow = useSpring(useTransform(scrollYProgress, [0.12, 0.3, 0.45], [0, 1, 0.32]), SPRING);
  const wordShadow = useTransform(glow, (g) => {
    const k = isMobile ? 0.4 : 1;
    return `0 0 ${22 * g * k}px hsl(var(--site-primary) / ${0.5 * g * k})`;
  });
  const paraO = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [0, 1]), SPRING);
  const paraY = useSpring(useTransform(scrollYProgress, [0.18, 0.38], [reduce ? 0 : 16, 0]), SPRING);

  const cardConfig: Array<{ range: [number, number]; peak: number }> = [
    { range: [0.22, 0.44], peak: 0.33 },
    { range: [0.28, 0.5], peak: 0.39 },
    { range: [0.34, 0.56], peak: 0.45 },
  ];

  return (
    <section
      ref={sectionRef}
      id="planos"
      aria-label="Planos e preços"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-[-10%] top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-65"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)"
        parallaxY={pA}
        animate={{ x: [-25, 25, -25], y: [-20, 20, -20], scale: [1, 1.07, 1] }}
        duration={22}
        reduce={reduce}
        isMobile={isMobile}
      />
      <AuroraBlob
        className="right-[-12%] top-0 h-[440px] w-[440px] opacity-55"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.45), transparent 70%)"
        parallaxY={pB}
        animate={{ x: [25, -25, 25], y: [20, -20, 20], scale: [1, 1.06, 1] }}
        duration={26}
        reduce={reduce}
        isMobile={isMobile}
      />
      {!isMobile && (
        <AuroraBlob
          className="left-1/2 bottom-0 h-[640px] w-[640px] -translate-x-1/2 opacity-25"
          background="radial-gradient(circle at center, hsl(285 80% 35% / 0.28), transparent 70%)"
          parallaxY={pC}
          animate={{ x: [-15, 15, -15], y: [15, -15, 15], scale: [1, 1.05, 1] }}
          duration={30}
          reduce={reduce}
          isMobile={isMobile}
        />
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
            style={{ opacity: reduce ? 1 : badgeO, y: reduce ? 0 : badgeY, willChange: "transform, opacity" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Planos
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            style={{ opacity: reduce ? 1 : titleO, y: reduce ? 0 : titleY, willChange: "transform, opacity" }}
          >
            Preço justo,
            <br />
            <motion.span className="text-site-primary" style={{ textShadow: reduce ? "none" : wordShadow }}>
              sem letra miúda
            </motion.span>
            .
          </motion.h2>
          <motion.p
            className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted"
            style={{ opacity: reduce ? 1 : paraO, y: reduce ? 0 : paraY, willChange: "transform, opacity" }}
          >
            Comece grátis por 14 dias. Sem cartão de crédito, sem fidelidade, cancela quando quiser.
          </motion.p>
        </div>

        <ul className="mt-16 grid gap-5 lg:grid-cols-3" style={{ perspective: 1200 }}>
          {PLANS.map((p, i) => (
            <PlanCard
              key={p.name}
              plan={p}
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
