const ITEMS = [
  "ATENDIMENTO WHATSAPP",
  "PIPELINE KANBAN",
  "AGENTES DE IA",
  "AUTOMAÇÕES",
  "DISPARO EM MASSA",
  "RELATÓRIOS",
  "EMAIL MARKETING",
  "TRACKING DE LEADS",
];

function Row() {
  return (
    <ul className="flex shrink-0 items-center gap-10 px-5">
      {ITEMS.map((it) => (
        <li key={it} className="flex items-center gap-10">
          <span className="site-font-display whitespace-nowrap text-[clamp(20px,2.4vw,32px)] font-semibold tracking-tight text-site-primary-foreground">
            {it}
          </span>
          <span aria-hidden className="text-site-primary-foreground/70" role="presentation">
            ✦
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Marquee() {
  return (
    <section
      aria-label="Recursos do Chat Funnel AI"
      className="relative isolate overflow-hidden border-y border-site-primary/40 bg-site-primary py-5"
    >
      <div className="site-marquee-track">
        {/* Duplicado para loop sem corte */}
        <Row />
        <Row />
      </div>
    </section>
  );
}
