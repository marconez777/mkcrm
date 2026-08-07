import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { StripeEmbeddedCheckout } from "@/components/payments/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/payments/PaymentTestModeBanner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Checkout() {
  const { priceId } = useParams<{ priceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Checkout — Chat Funnel AI";
  }, []);

  if (!priceId) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Plano não informado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <div className="rounded-2xl border bg-background p-2 shadow-sm">
          <StripeEmbeddedCheckout
            priceId={priceId}
            userId={user?.id}
            customerEmail={user?.email ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
