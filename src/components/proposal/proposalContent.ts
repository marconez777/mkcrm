export type SlideVariant = "cover" | "section" | "feature" | "pricing" | "cta";

export interface ProposalSlideData {
  number: number;
  kicker?: string;
  title: string;
  subtitle?: string;
  body?: string[];
  bullets?: string[];
  variant: SlideVariant;
  footnote?: string;
}

export const proposalSlides: ProposalSlideData[] = [
  {
    number: 1,
    variant: "cover",
    kicker: "Proposta Comercial",
    title: "Implantação do Chat Funnel AI",
    subtitle:
      "Prospecção e atendimento comercial de escolas para o seu ERP escolar.",
    body: [
      "Setup completo da ferramenta, agentes de IA, pipeline comercial e disparos via WhatsApp para a operação de vendas.",
    ],
  },
  {
    number: 2,
    variant: "section",
    kicker: "Objetivo",
    title: "Operação comercial mais organizada, rápida e escalável",
    body: [
      "Estruturar a prospecção de escolas via WhatsApp para que a equipe consiga executar todo o ciclo comercial com clareza.",
    ],
    bullets: [
      "Prospectar escolas com disparos controlados",
      "Receber respostas em um pipeline organizado",
      "Qualificar interessados com apoio de IA",
      "Acompanhar cada lead até a próxima etapa comercial",
    ],
  },
  {
    number: 3,
    variant: "feature",
    kicker: "Escopo",
    title: "O que será configurado",
    body: [
      "Configuração inicial do ambiente Chat Funnel AI, pronto para operar.",
    ],
    bullets: [
      "CRM e pipeline comercial",
      "Instância de WhatsApp para prospecção",
      "Disparo em massa com regras de segurança",
      "Agente de IA para atendimento",
      "Agente de IA para movimentação dos cards",
      "Tags, etapas, campos e automações",
      "Modelo de processo comercial para a operação",
    ],
  },
  {
    number: 4,
    variant: "feature",
    kicker: "Agente de IA · Atendimento",
    title: "Atendimento automatizado com inteligência",
    body: [
      "Um agente de IA treinado para conversar com escolas interessadas no ERP, reduzindo tempo de resposta e perda de oportunidades.",
    ],
    bullets: [
      "Responder dúvidas iniciais",
      "Identificar interesse real",
      "Coletar informações importantes",
      "Entender o perfil da escola",
      "Direcionar o lead para a próxima etapa",
      "Apoiar a equipe comercial no primeiro atendimento",
    ],
  },
  {
    number: 5,
    variant: "feature",
    kicker: "Agente de IA · Pipeline",
    title: "Movimentação inteligente do pipeline",
    body: [
      "Um agente responsável por analisar conversas e organizar os cards dentro do pipeline.",
    ],
    bullets: [
      "Identificar a intenção do lead",
      "Sugerir ou executar movimentações de etapa",
      "Aplicar tags comerciais",
      "Apoiar na classificação dos contatos",
      "Separar leads frios, mornos e quentes",
      "Manter a operação mais organizada",
    ],
  },
  {
    number: 6,
    variant: "feature",
    kicker: "Disparo em massa",
    title: "Campanhas de prospecção via WhatsApp",
    body: [
      "Configuração das campanhas respeitando boas práticas de envio.",
    ],
    bullets: [
      "Campanha de disparo",
      "Janela de envio",
      "Intervalo entre mensagens",
      "Seleção de instância WhatsApp",
      "Organização da audiência",
      "Mensagens iniciais de prospecção",
      "Acompanhamento dos eventos da campanha",
    ],
    footnote:
      "Recomendamos uma instância dedicada para prospecção, separada do atendimento principal.",
  },
  {
    number: 7,
    variant: "section",
    kicker: "Processo comercial",
    title: "Fluxo desenhado para a sua operação",
    body: [
      "Além da configuração técnica, estruturamos a jornada para que a equipe saiba exatamente o que fazer em cada etapa.",
    ],
    bullets: [
      "Lead prospectado",
      "Resposta no WhatsApp",
      "Qualificação inicial",
      "Interesse no ERP",
      "Agendamento de apresentação",
      "Follow-up",
      "Fechamento ou nutrição",
    ],
  },
  {
    number: 8,
    variant: "feature",
    kicker: "Entregáveis",
    title: "O que está incluso no setup",
    bullets: [
      "Configuração inicial da conta",
      "Estruturação do pipeline",
      "Criação das etapas comerciais",
      "Configuração dos agentes de IA",
      "Treinamento inicial dos agentes",
      "Configuração de tags e campos",
      "Configuração do disparo em massa",
      "Criação das primeiras mensagens",
      "Ajustes no processo comercial",
      "Orientação de uso para a equipe",
    ],
  },
  {
    number: 9,
    variant: "pricing",
    kicker: "Investimento",
    title: "Setup + Plano Chat Funnel AI Pro",
    body: [
      "Setup de implantação: R$ 5.000 à vista — configuração, estruturação comercial, treinamento dos agentes e preparação da operação.",
      "Plano Chat Funnel AI Pro: R$ 147/mês ou R$ 997/ano à vista.",
    ],
    bullets: [
      "Até 10 usuários",
      "10 números de WhatsApp",
      "20.000 leads",
      "10.000 e-mails por mês",
      "100 agentes de IA",
      "2 GB de armazenamento",
    ],
  },
  {
    number: 10,
    variant: "pricing",
    kicker: "Opções de contratação",
    title: "Escolha o formato ideal",
    body: [
      "Opção 1 — Setup + plano mensal: R$ 5.000 (setup) + R$ 147/mês.",
      "Opção 2 — Setup + plano anual: R$ 5.000 (setup) + R$ 997/ano. Total inicial: R$ 5.997.",
    ],
    footnote:
      "A opção anual reduz o custo mensal equivalente da ferramenta e evita pagamentos recorrentes durante o primeiro ano.",
  },
  {
    number: 11,
    variant: "section",
    kicker: "Prazo",
    title: "Implantação em 7 a 15 dias úteis",
    body: [
      "Prazo estimado conforme a velocidade de envio das informações necessárias para iniciar.",
    ],
    bullets: [
      "Dados da empresa",
      "Oferta do ERP",
      "Lista ou critérios de público",
      "Número de WhatsApp para prospecção",
      "Principais objeções comerciais",
      "Informações que o agente deve saber responder",
    ],
  },
  {
    number: 12,
    variant: "cta",
    kicker: "Próximo passo",
    title: "Vamos colocar a operação em campo",
    body: [
      "Após a aprovação da proposta, iniciamos a implantação do Chat Funnel AI com foco em deixar a operação pronta para prospectar, atender, qualificar e acompanhar escolas interessadas no ERP.",
    ],
    footnote: "Investimento inicial recomendado: R$ 5.997 — Setup completo + plano anual Pro.",
  },
];
