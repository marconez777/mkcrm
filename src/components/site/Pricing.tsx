import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

const PLANS = [
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    note: "ou R$ 77/mês no anual · 3 dias grátis",
    desc: "Para começar com IA, automação e disparos usando suas próprias APIs.",
    cta: "Começar grátis",
    highlight: false,
    badge: null as string | null,
    features: [
      "2 números de WhatsApp",
      "Até 5 atendentes",
      "CRM com IA",
      "Agente de IA (sua API)",
      "Disparos em massa (sua API)",
      "Automações e cadências",
      "Email marketing (1.000/dia)",
      "Tracking avançado",
      "Relatórios avançados",
      "Suporte por IA",
      "Onboarding via call (1h)",
    ],
  },
  {
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    note: "ou R$ 197/mês no anual · 3 dias grátis",
    desc: "Para clínicas que querem escalar atendimento e operação com prioridade.",
    cta: "Quero o Pro",
    highlight: true,
    badge: "Mais escolhido" as string | null,
    features: [
      "Tudo do Starter",
      "5 números de WhatsApp",
      "Até 15 atendentes",
      "Suporte prioritário via call",
      "Onboarding via call dedicado",
    ],
  },
  {
    name: "Scale",
    price: "R$ 5.000",
    period: "1x",
    note: "1 ano de assinatura incluso",
    desc: "Implementação done-for-you: copy, automações, IA e tracking configurados pela nossa equipe.",
    cta: "Falar com vendas",
    highlight: false,
    badge: "Pagamento único" as string | null,
    features: [
      "Tudo ilimitado (números e atendentes)",
      "1 ano de assinatura incluso",
      "Copy mestre e definição de persona",
      "Setup completo da ferramenta",
      "Automações e sequências de e-mail prontas",
      "Campanhas configuradas",
      "Treinamento do agente de IA",
      "Configuração do tracking",
      "Treinamento da equipe",
    ],
  },
] as const;


export default function Pricing() {
  return (
    <section
      id="planos"
      aria-label="Planos e preços"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <AuroraBlob
        className="left-[-10%] top-1/2 h-[520px] w-[520px] -translate-y-1/2"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)"
        opacity={0.55}
        duration={26}
      />
      <AuroraBlob
        className="right-[-12%] top-0 h-[420px] w-[420px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.45), transparent 70%)"
        opacity={0.45}
        duration={30}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0, 12)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Planos
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.08, 28)}
          >
            Preço justo,
            <br />
            <span
              className="text-site-primary"
              style={{ textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)" }}
            >
              sem letra miúda
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
            Comece grátis por 14 dias. Sem cartão de crédito, sem fidelidade, cancela quando quiser.
          </motion.p>
        </div>

        <ul className="mt-16 grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.li
              key={plan.name}
              className={[
                "group relative flex flex-col overflow-hidden rounded-3xl border p-8 transition-colors",
                plan.highlight
                  ? "border-site-accent/60 bg-site-bg shadow-[0_30px_80px_-30px_hsl(var(--site-accent)/0.6)]"
                  : "border-white/10 bg-site-bg hover:border-site-accent/50",
              ].join(" ")}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.08 * i, 40)}
            >
              <div
                aria-hidden
                className={[
                  "pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full blur-2xl transition-opacity",
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
          ))}
        </ul>
      </div>
    </section>
  );
}
