import { useRef, type RefObject } from "react";
import {
  MessageCircle,
  Zap,
  Mail,
  Webhook,
  CalendarDays,
  BarChart3,
  CreditCard,
  Bot,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { SPRING, useIsMobile, AuroraBlob } from "./_anim";

const INTEGRATIONS = [
  { icon: MessageCircle, name: "WhatsApp Cloud API", desc: "Conexão oficial com Meta para envio em escala e templates aprovados." },
  { icon: Zap, name: "Evolution API", desc: "WhatsApp não-oficial multi-sessão, com QR Code e múltiplas instâncias." },
  { icon: Mail, name: "Resend", desc: "Envio transacional e campanhas de e-mail com alta entregabilidade." },
  { icon: Bot, name: "OpenAI · Gemini · Claude", desc: "Modelos plugáveis nos agentes de IA com controle de custo por orçamento." },
  { icon: Webhook, name: "Webhooks & API REST", desc: "Plugue qualquer ferramenta externa: agenda, ERP, BI ou automações próprias." },
  { icon: CalendarDays, name: "Google Calendar", desc: "Sincronize agendamentos e bloqueios direto da agenda do consultório." },
  { icon: CreditCard, name: "Stripe & Asaas", desc: "Cobranças, links de pagamento e assinaturas dentro do próprio funil." },
  { icon: BarChart3, name: "Meta Ads & Google Ads", desc: "Tracking de origem dos leads e ROI por campanha sem planilhas." },
] as const;

type CardProps = {
  icon: LucideIcon;
  name: string;
  desc: string;
  range: [number, number];
  peak: number;
  progress: MotionValue<number>;
  reduce: boolean;
  isMobile: boolean;
};

function IntegrationCard({ icon: Icon, name, desc, range, peak, progress, reduce, isMobile }: CardProps) {
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
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-site-bg p-5 transition-colors hover:border-site-accent/60"
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
        className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.6), transparent 70%)" }}
      />
      <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-site-surface text-site-primary transition-colors group-hover:border-site-accent/60">
        <Icon className="h-5 w-5" />
      </span>
      <div className="relative">
        <h3 className="site-font-display text-[17px] leading-tight">{name}</h3>
        <p className="site-font-body mt-2 text-[13px] leading-relaxed text-site-muted">{desc}</p>
      </div>
    </motion.li>
  );
}

export default function Integrations() {
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

  const tailO = useSpring(useTransform(scrollYProgress, [0.6, 0.78], [0, 1]), SPRING);
  const tailY = useSpring(useTransform(scrollYProgress, [0.6, 0.78], [reduce ? 0 : 12, 0]), SPRING);

  // 8 cards em cascata
  const cardConfig: Array<{ range: [number, number]; peak: number }> = [
    { range: [0.22, 0.4], peak: 0.3 },
    { range: [0.25, 0.43], peak: 0.34 },
    { range: [0.28, 0.46], peak: 0.38 },
    { range: [0.31, 0.49], peak: 0.42 },
    { range: [0.34, 0.52], peak: 0.46 },
    { range: [0.37, 0.55], peak: 0.5 },
    { range: [0.4, 0.58], peak: 0.54 },
    { range: [0.42, 0.6], peak: 0.58 },
  ];

  return (
    <section
      ref={sectionRef}
      id="integracoes"
      aria-label="Integrações"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <AuroraBlob
        className="right-[-12%] top-[-20%] h-[560px] w-[560px] opacity-60"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.5), transparent 70%)"
        parallaxY={pA}
        animate={{ x: [25, -25, 25], y: [-20, 20, -20], scale: [1, 1.07, 1] }}
        duration={22}
        reduce={reduce}
        isMobile={isMobile}
      />
      <AuroraBlob
        className="left-[-10%] bottom-[-10%] h-[440px] w-[440px] opacity-50"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        parallaxY={pB}
        animate={{ x: [-20, 20, -20], y: [25, -25, 25], scale: [1, 1.06, 1] }}
        duration={26}
        reduce={reduce}
        isMobile={isMobile}
      />
      {!isMobile && (
        <AuroraBlob
          className="left-1/2 top-1/4 h-[640px] w-[640px] -translate-x-1/2 opacity-30"
          background="radial-gradient(circle at center, hsl(var(--site-accent-glow) / 0.22), transparent 70%)"
          parallaxY={pC}
          animate={{ x: [-15, 15, -15], y: [-15, 15, -15], scale: [1, 1.05, 1] }}
          duration={28}
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
            Integrações nativas
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            style={{ opacity: reduce ? 1 : titleO, y: reduce ? 0 : titleY, willChange: "transform, opacity" }}
          >
            Conecta com{" "}
            <motion.span className="text-site-primary" style={{ textShadow: reduce ? "none" : wordShadow }}>
              tudo
            </motion.span>{" "}
            que sua clínica já usa.
          </motion.h2>
          <motion.p
            className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted"
            style={{ opacity: reduce ? 1 : paraO, y: reduce ? 0 : paraY, willChange: "transform, opacity" }}
          >
            WhatsApp, e-mail, IA, pagamentos e ads em um só lugar — sem gambiarra, sem Zapier no meio do caminho.
          </motion.p>
        </div>

        <ul
          className="mt-16 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
          style={{ perspective: 1200 }}
        >
          {INTEGRATIONS.map((it, i) => (
            <IntegrationCard
              key={it.name}
              icon={it.icon}
              name={it.name}
              desc={it.desc}
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
          Não vê a sua ferramenta?{" "}
          <a href="#contato" className="text-site-primary underline-offset-4 hover:underline">
            Fale com a gente
          </a>{" "}
          — construímos integrações sob demanda.
        </motion.p>
      </div>
    </section>
  );
}
