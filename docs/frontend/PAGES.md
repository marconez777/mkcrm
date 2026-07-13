---
title: "Páginas do Frontend"
topic: frontend
kind: map
audience: agent
updated: 2026-07-13
summary: "Mapeamento das páginas de roteamento principais do React (src/pages)."
code_refs:
  - src/pages/
  - src/test/
  - src/components/settings/
  - src/components/proposal/
  - src/components/payments/
  - src/components/support/
related_docs:
  - docs/maps/FRONTEND_CORE.md
---

# Páginas e Componentes Específicos (Frontend)

## 1. Visão Geral
Este documento cobre as views principais ligadas a rotas do `react-router-dom` (em `src/pages/`) e sub-componentes específicos que dão suporte exclusivo a certas lógicas (testes, configurações de pagamento, painéis). A arquitetura divide-se amplamente entre as views do negócio (CRM) e de configuração/admin.

## 2. Rotas Principais de Negócio (CRM Mestre)
- **`/kanban` (`Kanban.tsx`)**: O coração da gestão visual. Interface pesada de drag-and-drop renderizando as colunas do funil de vendas ativo.
- **`/inbox` (`Inbox.tsx`)**: Central de atendimento Omnichannel (WhatsApp e E-mail integrados), permitindo bate-papo em tempo real.
- **`/ai/*` (`AI Hub / Agents.tsx`)**: Hub de Inteligência artificial para construir, avaliar e monitorar Agentes.
- **`/automations`, `/email`**: Fluxos de marketing, cadência de disparos (Sequences e Broadcasts) e construção visual de e-mails.
- `Index.tsx`: A tela inicial padrão pós-login (Dashboard/Visão Geral com gráficos e sumários diários).

## 3. Rotas Administrativas e de Conta
- `Onboarding.tsx`: Fluxo de boas-vindas e configuração inicial da Clínica.
- `Billing.tsx`, `Checkout.tsx`, `CheckoutReturn.tsx`: Telas do fluxo de assinatura e gestão financeira (Stripe).
- `Settings.tsx`, `SettingsAppointmentKinds.tsx`: Painel de configurações gerais do tenant.
- `Team.tsx`, `Invite.tsx`: Gestão de permissões, membros da equipe e aceitação de convite.
- `PipelineRuns.tsx`: Acompanhamento da execução de fluxos e pipelines (CRM).
- `QueueLogs.tsx`: Visualização de logs de filas/processamento em background.
- `MarketingSite.tsx`: Ponto de montagem para as landing pages não-autenticadas.
- `NotFound.tsx`: Tela de Erro 404.

## 4. Componentes de Domínio Acoplados
Ao invés de estarem em `ui/`, estes componentes dependem fortemente da regra de negócio:
- `src/components/settings/`: Cartões de limite de AI (`AILimitsCard.tsx`), pipelines, e inserção da chave da OpenAI (`OpenAIKeyCard.tsx`).
- `src/components/payments/`: O wrapper do Stripe Embedded Checkout (`StripeEmbeddedCheckout.tsx`) e banners de teste (`PaymentTestModeBanner.tsx`).
- `src/components/proposal/`: Montagem e exibição de slides/propostas comerciais geradas (`ProposalSlide.tsx`).
- `src/components/support/`: O Botão flutuante (FAB) de chat de suporte (`SupportChatFab.tsx`).

## 5. Testes do Frontend
O diretório `src/test/` consolida utilitários e setup para o `Vitest` / `React Testing Library`.
- `setup.ts`: Configuração do DOM virtual (jsdom) e mocks globais antes dos testes rodarem.
- `example.test.ts`: Demonstração da estrutura de um teste unitário básico no projeto.
