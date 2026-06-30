import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  useEffect(() => {
    document.title = "Pagamento concluído — Chat Funnel AI";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
        <h1 className="text-xl font-semibold">Pagamento concluído!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua assinatura está sendo processada. Em instantes você verá o novo plano ativo.
        </p>
        {sessionId && (
          <p className="mt-3 break-all text-[11px] text-muted-foreground/70">
            Sessão: {sessionId}
          </p>
        )}
        <Link
          to="/billing"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ver minha assinatura
        </Link>
      </div>
    </div>
  );
}
