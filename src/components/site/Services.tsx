import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

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
    body: "Sequências por entrada de pipeline, mudança de estágio, sem-resposta ou antes da consulta — com janelas de envio e parada automática ao receber resposta.",
    tags: ["Triggers de pipeline", "Janelas de envio", "Stop on reply"],
  },
  {
    n: "03",
    title: "IA aplicada à negócio",
    body: "Agente vendedor com RAG sobre sua base, agente classificador que move cards no Kanban e resumo automático de cada conversa — tudo com orçamento mensal controlado.",
    tags: ["RAG", "Move Kanban", "Resumo automático"],
  },
  {
    n: "04",
    title: "Disparos em massa responsáveis",
    body: "Campanhas segmentadas via WhatsApp e e-mail com controle de janela, limite e opt-out automático.",
    tags: ["Segmentação", "Entregabilidade gerenciada", "Compliance"],
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
    body: "Atendimento humano, roadmap aberto e atualizações constantes para seu negócio nunca parar de crescer.",
    tags: ["Suporte 24/7", "Roadmap", "SLA"],
  },
] as const;

export default function Services() {
  return (
    <section
      id="servicos"
      aria-label="Serviços"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <AuroraBlob
        className="-left-40 top-1/3 h-[520px] w-[520px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)"
        opacity={0.55}
        duration={24}
      />
      <AuroraBlob
        className="-right-32 bottom-0 h-[400px] w-[400px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        opacity={0.4}
        duration={30}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-end">
          <div>
            <motion.span
              className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0, 12)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              O que entregamos
            </motion.span>
            <motion.h2
              className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.08, 28)}
            >
              Serviços que
              <br />
              fazem o{" "}
              <span
                className="text-site-primary"
                style={{
                  textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)",
                }}
              >
                funil
              </span>{" "}
              <span
                className="text-site-primary"
                style={{
                  textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)",
                }}
              >
                girar
              </span>
              .
            </motion.h2>
          </div>
          <motion.p
            className="site-font-body max-w-xl text-[17px] leading-relaxed text-site-muted md:justify-self-end"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.16, 16)}
          >
            Mais do que software: um time e um método para colocar sua operação
            de vendas em outro patamar — do primeiro contato no WhatsApp ao
            paciente fidelizado.
          </motion.p>
        </div>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.li
              key={s.n}
              className="group relative flex flex-col gap-6 overflow-hidden bg-site-bg p-8 transition-colors hover:bg-site-surface"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={fadeUp(0.06 * i, 40)}
            >
              {/* halo roxo no hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)",
                }}
              />
              <div className="relative flex items-start justify-between">
                <span className="site-font-display text-[44px] leading-none text-site-primary">
                  {s.n}
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-site-muted transition-all group-hover:border-site-accent/70 group-hover:text-site-text">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div className="relative">
                <h3 className="site-font-display text-[22px] leading-tight">{s.title}</h3>
                <p className="site-font-body mt-3 text-[15px] leading-relaxed text-site-muted">
                  {s.body}
                </p>
              </div>

              <ul className="relative mt-auto flex flex-wrap gap-2 pt-2">
                {s.tags.map((t) => (
                  <li
                    key={t}
                    className="site-font-body rounded-full border border-white/10 px-3 py-1 text-[12px] text-site-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
