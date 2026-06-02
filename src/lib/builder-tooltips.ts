// Tooltips "Por que isso importa?" exibidos no wizard de criação de agentes.
// Mantemos curtos, neutros a nicho e alinhados ao manual de boas práticas (Fase 1).

export type TooltipKey =
  | "niche"
  | "goal"
  | "provider"
  | "api_key"
  | "model"
  | "base_url"
  | "test_connection";

export const BUILDER_TOOLTIPS: Record<TooltipKey, { title: string; body: string }> = {
  niche: {
    title: "Por que escolher um nicho?",
    body:
      "O Construtor adapta a linguagem, as perguntas da entrevista, os cenários de teste e os exemplos do agente ao seu setor. Quanto mais específico, melhores os resultados.",
  },
  goal: {
    title: "Para que serve definir o objetivo?",
    body:
      "Define o caminho default do agente: qualificar e agendar (SDR), classificar conversas, dar suporte, agendar ou um fluxo customizado. Isso muda o prompt gerado e quais ferramentas serão sugeridas.",
  },
  provider: {
    title: "Qual provedor escolher?",
    body:
      "Use o provedor onde você já tem chave e crédito. OpenAI é o padrão recomendado pelo custo-benefício; Anthropic e Google funcionam igualmente bem com seus respectivos modelos.",
  },
  api_key: {
    title: "Por que a chave é sua?",
    body:
      "Você usa sua própria chave do provedor. Isso garante zero markup, controle total sobre o custo e privacidade — nenhuma conversa passa por intermediário.",
  },
  model: {
    title: "Qual modelo escolher?",
    body:
      "Modelos mini/flash custam pouco e respondem rápido — ótimos para conversas simples. Modelos completos custam mais mas raciocinam melhor em casos complexos. Você pode trocar a qualquer momento.",
  },
  base_url: {
    title: "Preciso preencher Base URL?",
    body:
      "Só preencha se você usa um endpoint compatível diferente (proxy corporativo, Azure OpenAI, etc.). Em branco usa o endpoint oficial do provedor.",
  },
  test_connection: {
    title: "Por que testar antes?",
    body:
      "Validamos chave, modelo e crédito agora — não depois que você terminar de construir. Se algo estiver errado, mostramos exatamente o que ajustar.",
  },
};
