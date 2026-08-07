import { Check, Sparkles } from "lucide-react";
import type { ProposalSlideData } from "./proposalContent";

const TOTAL = 12;

interface Props {
  data: ProposalSlideData;
}

export default function ProposalSlide({ data }: Props) {
  const { number, kicker, title, subtitle, body, bullets, variant, footnote } = data;

  const isCover = variant === "cover";
  const isCta = variant === "cta";
  const isPricing = variant === "pricing";

  return (
    <section
      className={[
        "proposal-slide relative overflow-hidden",
        "w-[1280px] h-[720px] shrink-0",
        "flex flex-col",
        isCover || isCta
          ? "bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground"
          : "bg-card text-card-foreground",
        "border border-border rounded-2xl shadow-xl",
      ].join(" ")}
    >
      {/* Decorative accents */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 w-[380px] h-[380px] rounded-full bg-primary/10 blur-3xl" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-16 pt-12">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
          <Sparkles className="w-3.5 h-3.5" />
          Chat Funnel AI
        </div>
        <div className="text-xs uppercase tracking-[0.2em] opacity-70 tabular-nums">
          {String(number).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
        </div>
      </header>

      {/* Body */}
      <div className="relative flex-1 px-16 py-10 flex flex-col">
        {kicker && (
          <div
            className={[
              "text-xs font-semibold uppercase tracking-[0.25em] mb-5",
              isCover || isCta ? "text-primary-foreground/80" : "text-primary",
            ].join(" ")}
          >
            {kicker}
          </div>
        )}

        <h1
          className={[
            "font-bold leading-[1.05] tracking-tight",
            isCover ? "text-7xl max-w-[900px]" : "text-5xl max-w-[1000px]",
          ].join(" ")}
        >
          {title}
        </h1>

        {subtitle && (
          <p className="mt-6 text-2xl opacity-90 max-w-[900px] leading-snug">
            {subtitle}
          </p>
        )}

        {body && body.length > 0 && (
          <div className={["mt-8 space-y-4 max-w-[980px]", isCover ? "text-xl" : "text-lg"].join(" ")}>
            {body.map((p, i) => (
              <p key={i} className={isCover || isCta ? "opacity-95" : "text-muted-foreground"}>
                {p}
              </p>
            ))}
          </div>
        )}

        {bullets && bullets.length > 0 && (
          <ul
            className={[
              "mt-8 grid gap-x-10 gap-y-4 max-w-[1080px]",
              bullets.length > 5 ? "grid-cols-2" : "grid-cols-1",
            ].join(" ")}
          >
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-lg">
                <span
                  className={[
                    "mt-1 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                    isPricing
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-primary/10 text-primary",
                  ].join(" ")}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {footnote && (
          <p
            className={[
              "mt-auto pt-8 text-sm italic max-w-[900px]",
              isCover || isCta ? "opacity-80" : "text-muted-foreground",
            ].join(" ")}
          >
            {footnote}
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="relative flex items-center justify-between px-16 pb-10 text-xs uppercase tracking-[0.2em] opacity-70">
        <span>Proposta Comercial</span>
        <span>Chat Funnel AI · {new Date().getFullYear()}</span>
      </footer>
    </section>
  );
}
