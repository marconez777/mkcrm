import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

const PLANS = [
  {
    name: "Starter",
    price: "R$ 77",
    period: "/mês",
    note: "ou R$ 470/ano (≈ R$ 39/mês)",
    desc: "Para quem está começando a estruturar o atendimento do negócio com CRM e IA.",
    cta: "Começar agora",
    highlight: false,
    badge: null as string | null,
    features: [
      "Até 2 usuários",
      "Até 2 números de WhatsApp",
      "Até 5.000 leads",
      "Até 1.000 e-mails / mês",
      "1 domínio de e-mail",
      "Até 10 agentes de IA",
      "Até 100 documentos na base de conhecimento",
      "500 MB de armazenamento",
    ],
  },
  {
    name: "Pro",
    price: "R$ 147",
    period: "/mês",
    note: "ou R$ 997/ano (≈ R$ 83/mês)",
    desc: "Para negócios que querem escalar atendimento, automação e disparos.",
    cta: "Quero o Pro",
    highlight: true,
    badge: "Mais escolhido" as string | null,
    features: [
      "Tudo do Starter incluso",
      "Até 10 usuários",
      "Até 10 números de WhatsApp",
      "Até 20.000 leads",
      "Até 10.000 e-mails / mês",
      "Até 20 domínios de e-mail",
      "Até 100 agentes de IA",
      
    ],
  },
  {
    name: "Supreme",
    price: "R$ 297",
    period: "/mês",
    note: "ou R$ 2.997/ano (≈ R$ 250/mês)",
    desc: "Para operações maduras que precisam de volume e prioridade máxima.",
    cta: "Quero o Supreme",
    highlight: false,
    badge: "Top tier" as string | null,
    features: [
      "Tudo do Pro incluso",
      "Usuários ilimitados",
      "Até 50.000 e-mails / mês",
      "Até 5 domínios de e-mail",
      "Limites estendidos de WhatsApp e leads",
      "Teto de IA personalizado",
      "Suporte prioritário",
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
            Mensal ou anual, com desconto significativo no plano anual. Sem fidelidade, cancela quando quiser.
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
              {plan.badge && (
                <span
                  className={[
                    "absolute top-4 right-4 z-10 rounded-full px-3 py-1 site-font-body text-[11px] uppercase tracking-wider",
                    plan.highlight
                      ? "bg-site-primary text-site-bg"
                      : "border border-site-accent/60 bg-site-bg text-site-text",
                  ].join(" ")}
                >
                  {plan.badge}
                </span>
              )}

              <div className="relative">
                <p className="site-font-display text-[15px] uppercase tracking-wider text-site-muted">{plan.name}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="site-font-display text-[48px] leading-none">{plan.price}</span>
                  {plan.period && <span className="site-font-body text-[15px] text-site-muted">{plan.period}</span>}
                </div>
                {plan.note && (
                  <p className="site-font-body mt-2 text-[12px] text-site-muted">{plan.note}</p>
                )}
                <p className="site-font-body mt-3 text-[14px] leading-relaxed text-site-muted">{plan.desc}</p>
              </div>


              <ul className="relative mt-8 flex flex-1 flex-col gap-3">
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
                href={`https://wa.me/5511991795436?text=${encodeURIComponent(`Quero assinar o plano ${plan.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative mt-10 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 site-font-body text-[14px] font-semibold text-black transition-all hover:brightness-110"
              >
                <svg viewBox="0 0 32 32" aria-hidden className="h-5 w-5 fill-black">
                  <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.158-.673.158-1.017 0-.058 0-.143-.014-.2-.097-.142-2.405-1.475-2.62-1.475zm-2.72 9.466c-1.793 0-3.55-.495-5.083-1.418L4.4 27l1.795-6.795A10.473 10.473 0 0 1 4.83 14.86c0-5.79 4.72-10.5 10.51-10.5 5.79 0 10.51 4.71 10.51 10.5 0 5.79-4.72 10.5-10.51 10.5h-.04zm0-22.74C9.78 3.93 4.43 9.27 4.43 15.86c0 2.11.56 4.17 1.62 5.98L4 30l8.32-2.16a12.4 12.4 0 0 0 5.95 1.52c6.59 0 11.94-5.35 11.94-11.93C30.21 9.27 24.87 3.93 18.28 3.93h-.02z"/>
                </svg>
                {plan.cta}
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
