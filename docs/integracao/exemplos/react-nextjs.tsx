/**
 * Exemplo Next.js 13+ (App Router) — integração completa com MK-CRM
 *
 * Estrutura:
 *  app/layout.tsx                  — carrega os snippets globalmente
 *  app/contato/page.tsx            — form de contato (capturado automaticamente)
 *  app/components/track-cta.tsx    — exemplo de evento customizado
 */

// ============================================================
// app/layout.tsx
// ============================================================
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Tracker primeiro */}
        <Script
          id="mk-tracker"
          src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=SEU_PROJECT_ID"
          strategy="afterInteractive"
        />
        {/* Forms depois */}
        <Script
          id="mk-forms"
          src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-snippet?token=SEU_TOKEN_PUBLICO"
          strategy="afterInteractive"
        />
        {/* Fila pré-load para chamadas precoces */}
        <Script id="mk-queue" strategy="beforeInteractive">{`
          window.MK = window.MK || { _q: [] };
          ["track","identify","page"].forEach(function(m){
            window.MK[m] = window.MK[m] || function(){ window.MK._q.push([m, arguments]); };
          });
        `}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}

// ============================================================
// app/contato/page.tsx — form padrão, capturado automaticamente
// ============================================================
export default function ContatoPage() {
  return (
    <main>
      <h1>Fale conosco</h1>
      <form
        data-mk-form="contato"
        data-mk-name="Contato (Next.js)"
        action="/api/contato"
        method="POST"
      >
        <input name="nome" placeholder="Nome" required />
        <input name="email" type="email" placeholder="E-mail" required />
        <input name="whatsapp" type="tel" placeholder="WhatsApp" required />
        <textarea name="mensagem" />
        <button type="submit">Enviar</button>
      </form>
    </main>
  );
}

// ============================================================
// app/components/track-cta.tsx — evento customizado
// ============================================================
"use client";

declare global {
  interface Window {
    MK?: {
      track: (event: string, props?: Record<string, unknown>) => void;
      identify: (traits: Record<string, unknown>) => void;
      page: (props?: Record<string, unknown>) => void;
    };
  }
}

export function TrackedCTA({ children, eventName, props }: {
  children: React.ReactNode;
  eventName: string;
  props?: Record<string, unknown>;
}) {
  return (
    <button onClick={() => window.MK?.track(eventName, props)}>
      {children}
    </button>
  );
}

// Uso:
// <TrackedCTA eventName="clicou_agendar" props={{ origem: "hero" }}>
//   Agendar consulta
// </TrackedCTA>

// ============================================================
// app/page-tracking.tsx — page_view manual em route change
// ============================================================
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PageTracker() {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    window.MK?.page({ url: location.href, path, title: document.title });
  }, [path, search]);
  return null;
}
// Inclua <PageTracker /> dentro do <body> em layout.tsx.
