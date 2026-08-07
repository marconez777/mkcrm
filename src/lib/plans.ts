// Catálogo central de planos. Mantém-se em sincronia com os products criados no Stripe.
// Price IDs seguem o padrão `{plan}_{interval}_{currency}` (ex: pro_monthly_brl).

export type PlanCurrency = "brl" | "eur" | "usd";

export interface PlanDef {
  id: "starter" | "pro" | "supreme";
  name: string;
  description: string;
  highlight: boolean;
  badge?: string;
  features: string[];
  prices: Record<PlanCurrency, { monthly: number; yearly: number }>;
}

export const PLAN_CATALOG: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Para quem está começando a estruturar o atendimento com CRM e IA.",
    highlight: false,
    features: [
      "Até 2 usuários",
      "Até 2 números de WhatsApp",
      "Até 5.000 leads",
      "Até 1.000 e-mails / mês",
      "1 domínio de e-mail",
      "Até 10 agentes de IA",
      "Até 100 documentos na base",
      "500 MB de armazenamento",
    ],
    prices: {
      brl: { monthly: 77, yearly: 470 },
      eur: { monthly: 17, yearly: 109 },
      usd: { monthly: 19, yearly: 119 },
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para negócios que querem escalar atendimento, automação e disparos.",
    highlight: true,
    badge: "Mais escolhido",
    features: [
      "Tudo do Starter incluso",
      "Até 10 usuários",
      "Até 10 números de WhatsApp",
      "Até 20.000 leads",
      "Até 10.000 e-mails / mês",
      "Até 20 domínios de e-mail",
      "Até 100 agentes de IA",
      "2 GB de armazenamento",
    ],
    prices: {
      brl: { monthly: 147, yearly: 997 },
      eur: { monthly: 35, yearly: 229 },
      usd: { monthly: 39, yearly: 249 },
    },
  },
  {
    id: "supreme",
    name: "Supreme",
    description: "Para operações maduras que precisam de volume e prioridade máxima.",
    highlight: false,
    badge: "Top tier",
    features: [
      "Tudo do Pro incluso",
      "Usuários ilimitados",
      "Até 50.000 e-mails / mês",
      "Limites estendidos de WhatsApp e leads",
      "Criador de Landing Pages",
      "Publicação de Posts com IA",
      "Armazenamento ilimitado",
      "White Label",
      "Suporte prioritário",
    ],
    prices: {
      brl: { monthly: 297, yearly: 2997 },
      eur: { monthly: 69, yearly: 689 },
      usd: { monthly: 79, yearly: 749 },
    },
  },
];

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  supreme: "Supreme",
};

export function planLabelFromPriceId(priceId: string): string {
  // ex: pro_monthly_brl
  const [plan, interval] = priceId.split("_");
  const name = PLAN_NAMES[plan] ?? plan;
  const intl = interval === "yearly" ? "anual" : "mensal";
  return `${name} (${intl})`;
}
