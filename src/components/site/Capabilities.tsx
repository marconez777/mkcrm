import {
  Inbox,
  KanbanSquare,
  ListChecks,
  Repeat2,
  Workflow,
  Megaphone,
  MailCheck,
  Radar,
  FileInput,
  SlidersHorizontal,
  LineChart,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

const ITEMS = [
  {
    icon: Inbox,
    title: "Inbox unificado",
    body: "Multi-atendente com áudios, mídias, encaminhar mensagem, agendar envio e respostas rápidas.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline Kanban",
    body: "Múltiplos funis, drag-and-drop, filtros por origem, UTM, atendente e período.",
  },
  {
    icon: ListChecks,
    title: "Tarefas estilo board",
    body: "Colunas, labels, checklists, anexos e responsáveis — tudo dentro do CRM.",
  },
  {
    icon: Repeat2,
    title: "Sequências (drip)",
    body: "Cadências de N passos com janela de envio e parada automática quando o lead responde.",
  },
  {
    icon: Workflow,
    title: "Automações event-driven",
    body: "Gatilhos como sem-resposta, estágio parado ou antes da consulta disparam ações sem intervenção.",
  },
  {
    icon: Megaphone,
    title: "Disparos em massa",
    body: "Campanhas WhatsApp com janela de envio, rotação por número e opt-out automático.",
  },
  {
    icon: MailCheck,
    title: "Email marketing",
    body: "Templates, segmentos, campanhas e automações com entregabilidade incluída e domínio próprio.",
  },
  {
    icon: Radar,
    title: "Tracking de visitantes",
    body: "UTM, gclid, fbclid e landing page conectados ao lead automaticamente quando ele preenche o formulário.",
  },
  {
    icon: FileInput,
    title: "Formulários externos",
    body: "Plugue formulários do seu site, landing ou ads e receba leads atribuídos no funil certo.",
  },
  {
    icon: SlidersHorizontal,
    title: "Campos personalizados",
    body: "Adapte o cadastro de lead à realidade da seu negócio sem mexer em código.",
  },
  {
    icon: LineChart,
    title: "Métricas de engajamento",
    body: "Taxas de resposta por sequência, broadcast e estágio, com snapshots históricos.",
  },
  {
    icon: Wallet,
    title: "Custo de IA sob controle",
    body: "Orçamento mensal por negócio, alerta automático e pausa segura ao estourar o limite.",
  },
] as const;

export default function Capabilities() {
  return (
    <section
      id="capacidades"
      aria-label="Tudo o que vem dentro do MK-CRM"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 90% at -10% 50%, hsl(var(--site-accent-glow) / 0.45), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 70% at 110% 50%, hsl(var(--site-primary) / 0.22), transparent)",
        }}
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
            Tudo o que vem dentro
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.08, 28)}
          >
            Um CRM completo,{" "}
            <span
              className="text-site-primary"
              style={{ textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)" }}
            >
              sem add-on escondido
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
            Cada recurso pensado para negócios que vivem de relacionamento — todos incluídos desde o plano de entrada.
          </motion.p>
        </div>

        <ul className="mt-16 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {ITEMS.map((it, i) => {
            const Icon = it.icon;
            return (
              <motion.li
                key={it.title}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-site-bg p-5 transition-all hover:-translate-y-1 hover:border-site-primary/50"
                initial="hidden"
                whileInView="show"
                viewport={viewportOnce}
                variants={fadeUp(0.04 * i, 28)}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(circle at center, hsl(var(--site-accent) / 0.55), transparent 70%)",
                  }}
                />
                <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-site-surface text-site-primary transition-colors group-hover:border-site-primary/60">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="relative">
                  <h3 className="site-font-display text-[17px] leading-tight">{it.title}</h3>
                  <p className="site-font-body mt-2 text-[13px] leading-relaxed text-site-muted">
                    {it.body}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
