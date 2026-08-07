import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRegion } from "@/hooks/useRegion";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { PLAN_CATALOG, planLabelFromPriceId } from "@/lib/plans";

function formatPrice(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function Billing() {
  const { user } = useAuth();
  const region = useRegion();
  const { subscription, loading, isActive } = useSubscription(user?.id ?? null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    document.title = "Assinatura — Chat Funnel AI";
  }, []);

  const currency = region.currency.toLowerCase();
  const plans = PLAN_CATALOG.map((p) => ({
    ...p,
    monthlyPriceId: `${p.id}_monthly_${currency}`,
    yearlyPriceId: `${p.id}_yearly_${currency}`,
    monthlyAmount: p.prices[currency as "brl" | "eur" | "usd"]?.monthly ?? 0,
    yearlyAmount: p.prices[currency as "brl" | "eur" | "usd"]?.yearly ?? 0,
  }));

  async function openPortal() {
    if (!isPaymentsConfigured()) {
      toast.error("Pagamentos não configurados nesta build.");
      return;
    }
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || data?.error || "Falha");
      window.open(data.url as string, "_blank");
    } catch (e) {
      toast.error("Erro ao abrir portal", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setOpeningPortal(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Assinatura & Cobrança</h1>
        <p className="text-sm text-muted-foreground">
          Moeda da sua conta: <strong>{region.currency}</strong>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plano atual</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : subscription ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {subscription.status.toUpperCase()}
                </Badge>
                <span className="font-medium">{planLabelFromPriceId(subscription.price_id)}</span>
              </div>
              {subscription.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end
                    ? "Cancelamento agendado. Acesso até "
                    : "Próxima cobrança em "}
                  {new Date(subscription.current_period_end).toLocaleDateString(region.locale)}
                </p>
              )}
              <Button onClick={openPortal} disabled={openingPortal} variant="outline">
                {openingPortal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Gerenciar pagamento
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem uma assinatura ativa. Escolha um plano abaixo.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent =
            subscription?.price_id === plan.monthlyPriceId ||
            subscription?.price_id === plan.yearlyPriceId;
          return (
            <Card key={plan.id} className={plan.highlight ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {isCurrent && <Badge>Atual</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-semibold">
                  {formatPrice(plan.monthlyAmount, region.currency, region.locale)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ou {formatPrice(plan.yearlyAmount, region.currency, region.locale)}/ano
                </p>
                <ul className="space-y-1 text-sm">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="text-muted-foreground">• {f}</li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 pt-2">
                  <Button asChild disabled={isCurrent}>
                    <Link to={`/checkout/${plan.monthlyPriceId}`}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Assinar mensal
                    </Link>
                  </Button>
                  <Button asChild variant="outline" disabled={isCurrent}>
                    <Link to={`/checkout/${plan.yearlyPriceId}`}>Assinar anual</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
