// Tradutor de erros do provedor de IA para mensagens PT-BR acionáveis.
// Usado pelo Construtor de Agentes e pelo wizard ao testar conexões.

export type ProviderErrorCode =
  | "missing_key"
  | "invalid_key"
  | "no_credit"
  | "rate_limit"
  | "model_not_found"
  | "network"
  | "provider_down"
  | "unknown";

export interface ProviderError {
  code: ProviderErrorCode;
  title: string;
  message: string;
  action?: string;
}

const TITLES: Record<ProviderErrorCode, string> = {
  missing_key: "Chave de API não configurada",
  invalid_key: "Chave de API inválida",
  no_credit: "Sem crédito no provedor",
  rate_limit: "Limite de requisições",
  model_not_found: "Modelo não encontrado",
  network: "Falha de rede",
  provider_down: "Provedor instável",
  unknown: "Erro inesperado",
};

const ACTIONS: Partial<Record<ProviderErrorCode, string>> = {
  missing_key: "Cole sua chave no campo abaixo e teste de novo.",
  invalid_key: "Gere uma nova chave no painel do provedor e cole aqui.",
  no_credit: "Adicione saldo na sua conta do provedor.",
  rate_limit: "Espere alguns segundos e tente de novo.",
  model_not_found: "Escolha outro modelo na lista.",
  network: "Verifique sua conexão e a Base URL configurada.",
  provider_down: "Aguarde e tente de novo. Costuma resolver em minutos.",
};

export function parseBuilderError(body: unknown): ProviderError {
  const obj = (body ?? {}) as { code?: string; message?: string; error?: string };
  const code = (obj.code as ProviderErrorCode) ?? "unknown";
  const safeCode: ProviderErrorCode = (Object.keys(TITLES) as ProviderErrorCode[]).includes(code)
    ? code
    : "unknown";
  return {
    code: safeCode,
    title: TITLES[safeCode],
    message: obj.message ?? obj.error ?? "Algo deu errado ao falar com o provedor.",
    action: ACTIONS[safeCode],
  };
}
