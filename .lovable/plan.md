## Atualização da Pricing Table

Vou atualizar **`src/components/site/Pricing.tsx`** com o novo conteúdo dos planos, mantendo todo o visual, animações e estrutura atuais (apenas troca de dados + um pequeno ajuste para suportar preço anual e selo "1x" no Scale).

### Novos planos

**Starter** — destaque: `false`
- Preço: `R$ 97` `/mês` · sublinha: "ou R$ 77/mês no anual · 3 dias grátis"
- Desc: "Para começar com IA, automação e disparos usando suas próprias APIs."
- CTA: "Começar grátis"
- Features:
  - 2 números de WhatsApp
  - Até 5 atendentes
  - CRM com IA
  - Agente de IA (sua API)
  - Disparos em massa (sua API)
  - Automações e cadências
  - Email marketing (1.000/dia)
  - Tracking avançado
  - Relatórios avançados
  - Suporte por IA
  - Onboarding via call (1h)

**Pro** — destaque: `true` (selo "Mais escolhido")
- Preço: `R$ 297` `/mês` · sublinha: "ou R$ 197/mês no anual · 3 dias grátis"
- Desc: "Para clínicas que querem escalar atendimento e operação com prioridade."
- CTA: "Quero o Pro"
- Features:
  - Tudo do Starter
  - 5 números de WhatsApp
  - Até 15 atendentes
  - Suporte prioritário via call
  - Onboarding via call dedicado

**Scale** — destaque: `false`, mas com badge "Pagamento único"
- Preço: `R$ 5.000` `1x` · sublinha: "1 ano de assinatura incluso"
- Desc: "Implementação done-for-you: copy, automações, IA e tracking configurados pela nossa equipe."
- CTA: "Falar com vendas"
- Features:
  - Tudo ilimitado (números e atendentes)
  - 1 ano de assinatura incluso
  - Copy mestre e definição de persona
  - Setup completo da ferramenta
  - Automações e sequências de e-mail prontas
  - Campanhas configuradas
  - Treinamento do agente de IA
  - Configuração do tracking
  - Treinamento da equipe

### Ajustes técnicos mínimos

- Adicionar campo opcional `note?: string` em cada plano e renderizá-lo como linha pequena (`text-[12px] text-site-muted`) logo abaixo do preço, quando existir — usado para "ou R$ X/mês no anual · 3 dias grátis" e "1 ano de assinatura incluso".
- Para o Scale, `period` vira `"1x"` (em vez de `/mês`) — o mesmo slot já existente renderiza isso, sem mudança estrutural.
- Nenhuma mudança em layout, cores, animações (`fadeUp`, `AuroraBlob`), espaçamentos, hierarquia, navbar ou em qualquer outra seção.

### Arquivo alterado
- `src/components/site/Pricing.tsx` (somente conteúdo do array `PLANS` + render do `note`).
