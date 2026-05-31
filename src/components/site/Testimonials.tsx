import { Quote, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Em 30 dias dobramos a taxa de resposta no WhatsApp. O Kanban deixou a operação visível pra todo mundo.",
    name: "Dra. Marina Alves",
    role: "Diretora · Clínica Vitalis",
    metric: "+112% leads respondidos",
  },
  {
    quote:
      "Os agentes de IA atendem fora do horário comercial e já agendam consulta. Parece mágica, mas é só configuração.",
    name: "Rafael Tonin",
    role: "Gestor comercial · OdontoPlus",
    metric: "37% das consultas agendadas pela IA",
  },
  {
    quote:
      "Trocamos 3 ferramentas por uma só. Custo caiu e a equipe finalmente para de perder lead em planilha.",
    name: "Camila Souza",
    role: "COO · Rede Estética Bem",
    metric: "−R$ 4.200/mês em ferramentas",
  },
];

export default function Testimonials() {
  return (
    <section
      id="depoimentos"
      aria-label="Depoimentos de clientes"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 opacity-65 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--site-accent) / 0.55), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
            Quem já usa
          </span>
          <h2 className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]">
            Clínicas que vendem mais
            <br />
            com o <span className="text-site-primary">MK-CRM</span>.
          </h2>
        </div>

        <ul className="mt-16 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li
              key={t.name}
              className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-site-surface p-7 transition-all hover:-translate-y-1 hover:border-site-accent/60"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(circle at center, hsl(var(--site-accent) / 0.6), transparent 70%)",
                }}
              />
              <Quote className="relative h-7 w-7 text-site-primary" aria-hidden />

              <p className="relative site-font-body text-[16px] leading-relaxed text-site-text">
                “{t.quote}”
              </p>

              <div className="relative mt-auto flex items-center justify-between gap-4 border-t border-white/5 pt-5">
                <div>
                  <p className="site-font-display text-[15px] leading-tight">
                    {t.name}
                  </p>
                  <p className="site-font-body mt-1 text-[12px] text-site-muted">
                    {t.role}
                  </p>
                </div>
                <div className="flex" aria-label="5 estrelas">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-site-primary text-site-primary"
                    />
                  ))}
                </div>
              </div>

              <div className="absolute -top-3 left-7 rounded-full border border-site-accent/50 bg-site-bg px-3 py-1">
                <span className="site-font-body text-[11px] uppercase tracking-wider text-site-primary">
                  {t.metric}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
