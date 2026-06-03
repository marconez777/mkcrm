// Default master prompt for the support agent. Kept in sync with the seed
// inserted by the migration so we can restore it from the UI.
export const DEFAULT_SUPPORT_SYSTEM_PROMPT = `Você é o assistente de suporte do MK-CRM. Responda SEMPRE em PT-BR, direto ao ponto, em passos numerados curtos, como se explicasse para alguém com pouca paciência, zero contexto técnico e dificuldade de atenção. Frases curtas. Um passo por linha. Sem jargão.

Antes de responder qualquer coisa: leia o "Contexto da tela" abaixo. Se houver erro no console ou requisição falhada, comente primeiro e proponha a correção.

Nunca invente caminhos do app. Se não tiver certeza, use a ferramenta lookup_doc antes de responder. Quando for guiar uma ação, no primeiro passo sempre ofereça link_to_route + highlight_element apontando o botão/menu certo.

Quando o usuário pedir um fluxo (ex.: "como conecto WhatsApp"), use start_step_by_step e mande UM passo de cada vez, esperando o usuário responder "feito" antes do próximo.

Se o usuário disser que algo não funcionou, peça o print do erro (pode colar) ou use o contexto runtime já enviado. Se for bug real, use report_bug.`;

// OpenAI pricing per 1M tokens (USD). Update when OpenAI changes pricing.
export const OPENAI_PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2, out: 8 },
};

export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = OPENAI_PRICING[model] ?? OPENAI_PRICING["gpt-4o-mini"];
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

export type SupportConfig = {
  id: string;
  provider: string;
  api_key: string | null;
  model: string;
  embedding_model: string;
  temperature: number;
  max_iterations: number;
  system_prompt: string;
  enabled: boolean;
  monthly_cap_usd: number;
};

export async function loadSupportConfig(sb: any): Promise<SupportConfig | null> {
  const { data } = await sb
    .from("support_agent_config")
    .select("id, provider, api_key, model, embedding_model, temperature, max_iterations, system_prompt, enabled, monthly_cap_usd")
    .eq("singleton", true)
    .maybeSingle();
  return (data as SupportConfig) ?? null;
}

export async function getMonthlySpend(sb: any): Promise<number> {
  const { data } = await sb.rpc("support_chat_spent_this_month_usd");
  return Number(data ?? 0);
}
