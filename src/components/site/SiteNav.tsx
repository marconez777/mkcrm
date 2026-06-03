import { Link } from "react-router-dom";
import mkLogo from "@/assets/mk-logo.png";

const NAV_LINKS = [
  { href: "#sobre", label: "Sobre" },
  { href: "#features", label: "Features" },
  { href: "#servicos", label: "Serviços" },
  { href: "#integracoes", label: "Integrações" },
  { href: "#planos", label: "Planos" },
  { href: "#contato", label: "Contato" },
];

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-site-bg/80 backdrop-blur supports-[backdrop-filter]:bg-site-bg/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/site" className="flex items-center gap-2 text-site-text">
          <img src={mkLogo} alt="MK-CRM" className="h-8 w-8 rounded-lg object-cover" />
          <span className="site-font-display text-base font-semibold tracking-tight">MK-CRM</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="site-font-body text-[15px] text-site-muted transition-colors hover:text-site-text"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="site-font-body hidden text-[15px] text-site-muted transition-colors hover:text-site-text sm:inline-block"
          >
            Entrar
          </Link>
          <a
            href="#planos"
            className="site-font-display inline-flex items-center gap-2 rounded-full bg-site-primary px-4 py-2 text-[15px] font-semibold text-site-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Assinar
          </a>
        </div>
      </div>
    </header>
  );
}
