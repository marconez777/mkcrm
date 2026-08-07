// Hook para ler assinatura atual do usuário, filtrando por ambiente.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";

export interface Subscription {
  id: string;
  status: string;
  price_id: string;
  product_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
}

export function useSubscription(userId?: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const env = isPaymentsConfigured() ? getStripeEnvironment() : "sandbox";

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let active = true;

    const refetch = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setSubscription((data as unknown as Subscription) ?? null);
      setLoading(false);
    };

    refetch();

    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => refetch(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, env]);

  const isActive =
    !!subscription &&
    ((["active", "trialing", "past_due"].includes(subscription.status) &&
      (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())) ||
      (subscription.status === "canceled" &&
        subscription.current_period_end &&
        new Date(subscription.current_period_end) > new Date()));

  return { subscription, loading, isActive };
}
