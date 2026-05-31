import { Check } from "lucide-react";

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
];

export default function Pricing() {
  return (
    <section
      id="planos"
      aria-label="Planos e preços"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.35), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Planos
          </span>
          <h2 className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]">
            Preço justo,
            <br />
            <span className="text-site-primary">sem letra miúda</span>.
          </h2>
          <p className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted">
            Comece grátis por 14 dias. Sem cartão de crédito, sem fidelidade,
            cancela quando quiser.
          </p>
        </div>

        <ul className="mt-16 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <li
              key={p.name}
              className={[
                "relative flex flex-col rounded-3xl border p-8 transition-all",
                p.highlight
                  ? "border-site-primary/60 bg-site-bg shadow-[0_30px_80px_-30px_hsl(var(--site-primary)/0.4)]"
                  : "border-white/10 bg-site-bg hover:border-white/20",
              ].join(" ")}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-site-primary px-3 py-1 site-font-body text-[11px] uppercase tracking-wider text-site-bg">
                  Mais escolhido
                </span>
              )}

              <div>
                <p className="site-font-display text-[15px] uppercase tracking-wider text-site-muted">
                  {p.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="site-font-display text-[48px] leading-none">
                    {p.price}
                  </span>
                  {p.period && (
                    <span className="site-font-body text-[15px] text-site-muted">
                      {p.period}
                    </span>
                  )}
                </div>
                <p className="site-font-body mt-3 text-[14px] leading-relaxed text-site-muted">
                  {p.desc}
                </p>
              </div>

              <ul className="mt-8 flex flex-col gap-3">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="site-font-body flex items-start gap-3 text-[14px] text-site-text"
                  >
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
                  "mt-10 inline-flex h-12 items-center justify-center rounded-full px-6 site-font-body text-[14px] transition-all",
                  p.highlight
                    ? "bg-site-primary text-site-bg hover:brightness-110"
                    : "border border-white/15 text-site-text hover:border-site-primary/60 hover:text-site-primary",
                ].join(" ")}
              >
                {p.cta}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
