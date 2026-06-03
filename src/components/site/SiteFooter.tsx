import { Link } from "react-router-dom";
import { Sparkles, Mail, MapPin, Phone } from "lucide-react";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Features", href: "#features" },
      { label: "Integrações", href: "#integracoes" },
      { label: "Planos", href: "#planos" },
      { label: "Roadmap", href: "#" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Blog", href: "#blog" },
      { label: "Central de ajuda", href: "#blog" },
      { label: "Status", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "#sobre" },
      { label: "Contato", href: "#contato" },
      { label: "Termos", href: "#" },
      { label: "Privacidade", href: "#" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-site-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link to="/site" className="flex items-center gap-2 text-site-text">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-site-primary text-site-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="site-font-display text-base font-semibold">MK-CRM</span>
            </Link>
            {/* TODO: copy final */}
            <p className="site-font-body mt-4 max-w-sm text-[15px] leading-relaxed text-site-muted">
              CRM com pipeline Kanban, atendimento via WhatsApp e inteligência artificial dedicada
              para negócios que querem crescer sem perder o toque humano.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="site-font-display text-[15px] font-semibold text-site-text">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="site-font-body text-[15px] text-site-muted transition-colors hover:text-site-primary"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 border-t border-white/5 pt-8 md:grid-cols-3">
          <div className="flex items-center gap-3 text-site-muted">
            <Mail className="h-4 w-4 text-site-primary" />
            <span className="site-font-body text-[15px]">contato@mkart.com.br</span>
          </div>
          <div className="flex items-center gap-3 text-site-muted">
            <Phone className="h-4 w-4 text-site-primary" />
            <span className="site-font-body text-[15px]">+55 (00) 00000-0000</span>
          </div>
          <div className="flex items-center gap-3 text-site-muted">
            <MapPin className="h-4 w-4 text-site-primary" />
            <span className="site-font-body text-[15px]">Brasil · Atendimento remoto</span>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-white/5 pt-6 text-site-muted md:flex-row md:items-center">
          <p className="site-font-body text-[15px]">© {new Date().getFullYear()} MK-CRM. Todos os direitos reservados.</p>
          <p className="site-font-body text-[15px]">Feito com cuidado para negócios brasileiras.</p>
        </div>
      </div>
    </footer>
  );
}
