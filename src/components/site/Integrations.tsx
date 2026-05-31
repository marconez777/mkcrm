import {
  MessageCircle,
  Zap,
  Mail,
  Webhook,
  CalendarDays,
  BarChart3,
  CreditCard,
  Bot,
} from "lucide-react";

const INTEGRATIONS = [
  {
    icon: MessageCircle,
    name: "WhatsApp Cloud API",
    desc: "Conexão oficial com Meta para envio em escala e templates aprovados.",
  },
  {
    icon: Zap,
    name: "Evolution API",
    desc: "WhatsApp não-oficial multi-sessão, com QR Code e múltiplas instâncias.",
  },
  {
    icon: Mail,
    name: "Resend",
    desc: "Envio transacional e campanhas de e-mail com alta entregabilidade.",
  },
  {
    icon: Bot,
    name: "OpenAI · Gemini · Claude",
    desc: "Modelos plugáveis nos agentes de IA com controle de custo por orçamento.",
  },
  {
    icon: Webhook,
    name: "Webhooks & API REST",
    desc: "Plugue qualquer ferramenta externa: agenda, ERP, BI ou automações próprias.",
  },
  {
    icon: CalendarDays,
    name: "Google Calendar",
    desc: "Sincronize agendamentos e bloqueios direto da agenda do consultório.",
  },
  {
    icon: CreditCard,
    name: "Stripe & Asaas",
    desc: "Cobranças, links de pagamento e assinaturas dentro do próprio funil.",
  },
  {
    icon: BarChart3,
    name: "Meta Ads & Google Ads",
    desc: "Tracking de origem dos leads e ROI por campanha sem planilhas.",
  },
];

export default function Integrations() {
  return (
    <section
      id="integracoes"
      aria-label="Integrações"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-12%] top-[-20%] h-[560px] w-[560px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.5), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] bottom-[-10%] h-[440px] w-[440px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Integrações nativas
          </span>
          <h2 className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]">
            Conecta com{" "}
            <span className="text-site-primary">tudo</span> que sua
            clínica já usa.
          </h2>
          <p className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted">
            WhatsApp, e-mail, IA, pagamentos e ads em um só lugar — sem gambiarra,
            sem Zapier no meio do caminho.
          </p>
        </div>

        <ul className="mt-16 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map(({ icon: Icon, name, desc }) => (
            <li
              key={name}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-site-bg p-5 transition-all hover:-translate-y-1 hover:border-site-accent/60"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(circle at center, hsl(var(--site-accent) / 0.6), transparent 70%)",
                }}
              />
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-site-surface text-site-primary transition-colors group-hover:border-site-accent/60">
                <Icon className="h-5 w-5" />
              </span>
              <div className="relative">
                <h3 className="site-font-display text-[17px] leading-tight">
                  {name}
                </h3>
                <p className="site-font-body mt-2 text-[13px] leading-relaxed text-site-muted">
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="site-font-body mt-10 text-center text-[13px] text-site-muted">
          Não vê a sua ferramenta?{" "}
          <a
            href="#contato"
            className="text-site-primary underline-offset-4 hover:underline"
          >
            Fale com a gente
          </a>{" "}
          — construímos integrações sob demanda.
        </p>
      </div>
    </section>
  );
}
