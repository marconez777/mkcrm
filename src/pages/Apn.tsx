import { useEffect } from "react";
import { Printer, Download } from "lucide-react";
import ProposalSlide from "@/components/proposal/ProposalSlide";
import { proposalSlides } from "@/components/proposal/proposalContent";
import { Button } from "@/components/ui/button";

export default function Apn() {
  useEffect(() => {
    document.title = "Proposta Comercial — Chat Funnel AI";
  }, []);

  const handlePrint = () => {
    const prev = document.title;
    document.title = "Proposta-ChatFunnelAI";
    window.print();
    setTimeout(() => {
      document.title = prev;
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Toolbar */}
      <div className="proposal-toolbar sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Proposta Comercial
            </div>
            <h1 className="text-lg font-semibold">
              Implantação Chat Funnel AI · ERP Escolar
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Slides */}
      <div className="proposal-stage py-10 px-4 flex flex-col items-center gap-8">
        {proposalSlides.map((slide) => (
          <div key={slide.number} className="proposal-slide-wrap">
            <ProposalSlide data={slide} />
          </div>
        ))}
      </div>

      <div className="proposal-toolbar text-center text-xs text-muted-foreground pb-10">
        Use <kbd className="px-1.5 py-0.5 rounded bg-muted">Imprimir</kbd> → "Salvar como PDF" para exportar.
      </div>
    </div>
  );
}
