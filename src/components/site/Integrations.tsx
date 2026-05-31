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
import { motion } from "framer-motion";
import { AuroraBlob, fadeUp, viewportOnce } from "./_anim";

const INTEGRATIONS = [
  { icon: MessageCircle, name: "WhatsApp Cloud API", desc: "Conexão oficial com Meta para envio em escala e templates aprovados." },
  { icon: Zap, name: "Evolution API", desc: "WhatsApp não-oficial multi-sessão, com QR Code e múltiplas instâncias." },
  { icon: Mail, name: "Email marketing nativo", desc: "Domínio próprio com DNS guiado, entregabilidade gerenciada, opt-out automático e métricas de abertura, clique e bounce." },
  { icon: Bot, name: "OpenAI · Gemini · Claude", desc: "Modelos plugáveis nos agentes de IA com controle de custo por orçamento mensal." },
  { icon: Webhook, name: "Webhooks & API REST", desc: "Plugue qualquer ferramenta externa: agenda, ERP, BI ou automações próprias." },
  { icon: CalendarDays, name: "Google Calendar", desc: "Sincronize agendamentos e bloqueios direto da agenda do consultório." },
  { icon: CreditCard, name: "Stripe & Asaas", desc: "Cobranças, links de pagamento e assinaturas dentro do próprio funil." },
  { icon: BarChart3, name: "Meta Ads & Google Ads", desc: "Tracking de origem dos leads e ROI por campanha sem planilhas." },
] as const;

export default function Integrations() {
  return (
    <section
      id="integracoes"
      aria-label="Integrações"
      className="relative overflow-hidden border-t border-white/5 bg-site-surface py-24 sm:py-32"
    >
      <AuroraBlob
        className="right-[-12%] top-[-20%] h-[520px] w-[520px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.5), transparent 70%)"
        opacity={0.5}
        duration={24}
      />
      <AuroraBlob
        className="left-[-10%] bottom-[-10%] h-[420px] w-[420px]"
        background="radial-gradient(circle at center, hsl(var(--site-accent) / 0.4), transparent 70%)"
        opacity={0.4}
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
            Integrações nativas
          </motion.span>
          <motion.h2
            className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.08, 28)}
          >
            Conecta com{" "}
            <span
              className="text-site-primary"
              style={{ textShadow: "0 0 22px hsl(var(--site-primary) / 0.35)" }}
            >
              tudo
            </span>{" "}
            que sua clínica já usa.
          </motion.h2>
          <motion.p
            className="site-font-body mt-5 text-[17px] leading-relaxed text-site-muted"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp(0.16, 16)}
          >
            WhatsApp, e-mail, IA, pagamentos e ads em um só lugar — sem gambiarra, sem Zapier no meio do caminho.
          </motion.p>
        </div>

        <ul className="mt-16 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map((it, i) => {
            const Icon = it.icon;
            return (
              <motion.li
                key={it.name}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-site-bg p-5 transition-all hover:-translate-y-1 hover:border-site-accent/60"
                initial="hidden"
                whileInView="show"
                viewport={viewportOnce}
                variants={fadeUp(0.05 * i, 32)}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "radial-gradient(circle at center, hsl(var(--site-accent) / 0.6), transparent 70%)" }}
                />
                <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-site-surface text-site-primary transition-colors group-hover:border-site-accent/60">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="relative">
                  <h3 className="site-font-display text-[17px] leading-tight">{it.name}</h3>
                  <p className="site-font-body mt-2 text-[13px] leading-relaxed text-site-muted">{it.desc}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>

        <motion.p
          className="site-font-body mt-10 text-center text-[13px] text-site-muted"
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp(0.1, 12)}
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
