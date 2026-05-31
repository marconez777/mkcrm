import { Zap, BrainCircuit, HandCoins } from "lucide-react";

const PILLARS = [
  {
    icon: Zap,
    title: "Atendimento ágil",
    // TODO: copy final
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
];

export default function About() {
  return (
    <section
      id="sobre"
      aria-label="Sobre o MK-CRM"
      className="relative bg-site-bg py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-10 md:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              Sobre o MK-CRM
            </span>
            <h2 className="site-font-display mt-6 text-[clamp(32px,4.5vw,56px)] font-bold leading-[1.05] tracking-tight text-site-text">
              Um CRM dedicado a quem
              <br /> vive de <span className="text-site-primary">relacionamento</span>.
            </h2>
          </div>
          {/* TODO: copy final */}
          <p className="site-font-body text-[clamp(16px,1.3vw,18px)] leading-relaxed text-site-muted">
            Nascemos dentro de uma operação real de marketing para clínicas e cada feature foi
            forjada resolvendo dor de quem atende paciente todo dia: tempo curto, time enxuto e
            margem que não permite ferramenta cara que ninguém usa.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-colors hover:border-site-primary/40"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: "hsl(var(--site-accent) / 0.5)" }}
              />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-site-primary/30 bg-site-primary/10 text-site-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="site-font-display mt-6 text-[22px] font-semibold text-site-text">
                  {p.title}
                </h3>
                <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
                  {p.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
