---
title: "Componentes de UI, Site e Domínio (Frontend)"
topic: frontend
kind: map
audience: agent
updated: 2026-07-13
summary: "Mapeamento dos componentes genéricos de interface (Shadcn), institucionais (Site) e a inteligência de componentes de negócio (Kanban, Inbox, Admin)."
code_refs:
  - src/components/ui/
  - src/components/site/
  - src/components/inbox/
  - src/components/kanban/
  - src/components/lead/
  - src/components/admin/
related_docs:
  - docs/maps/FRONTEND_CORE.md
---

# Componentes de UI, Site e Domínio

## 1. Visão Geral
Este documento cobre desde a camada base de interface ("dumb components") até as intrincadas árvores de componentes de estado global que compõem o CRM, como os motores visuais do Inbox e do Kanban.

## 2. Componentes de Domínio e Inteligência (CRM)
Estes componentes são fortemente acoplados a regras de negócio e dependem do Supabase (muitos escutando eventos via Realtime WebSockets) para funcionar:

### 2.1 Kanban (`src/components/kanban/`)
- Orquestra a placa de vendas drag-and-drop.
- Lida com otimistic updates (atualização imediata na interface antes da resposta do servidor) quando um card muda de estágio.
- Contém lógica para colapsar/expandir estágios, filtrar por vendedor e buscar leads paginados.

### 2.2 Inbox (`src/components/inbox/`)
- A central Omnichannel. 
- Gerencia o estado WebSocket das conversas de WhatsApp e Email.
- Permite invocar a IA (ai-assist) localmente para sugerir respostas.
- Lida com atualizações massivas de mensagens via eventos do banco em tempo real.

### 2.3 Gestão de Leads (`src/components/lead/`)
- O painel lateral/modal `LeadSheet` ou `LeadDrawer` que exibe a ficha completa do paciente.
- Consome mutações para atualizar tags, status, notas internas (`internal-notes`) e disparar e-mails individualizados.

### 2.4 Admin e Settings (`src/components/admin/`)
- Cartões de gerenciamento de Tenants, planos, faturas e controle de acesso a features.

## 3. Componentes UI Base (Shadcn - `src/components/ui/`)
Primitivas acessíveis de interface construídas primariamente com Radix UI e estilizadas com Tailwind CSS. 
Estes componentes são genéricos, não possuem regras de negócio acopladas e servem como blocos de montar.
- **Layout & Estrutura**: `card.tsx`, `accordion.tsx`, `tabs.tsx`, `resizable.tsx`.
- **Inputs & Formulários**: `input.tsx`, `button.tsx`, `checkbox.tsx`, `select.tsx`, `form.tsx`.
- **Feedback Visual**: `toast.tsx`, `sonner.tsx`, `skeleton.tsx`, `progress.tsx`.
- **Modais & Overlays**: `dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`, `tooltip.tsx`, `sheet.tsx`.

> [!CAUTION]
> **Invariante**: Nenhum componente em `ui/` deve fazer chamadas de rede ou acoplar-se ao Supabase.

## 4. Componentes do Site Institucional (`src/components/site/`)
Seções da Landing Page e páginas públicas voltadas para marketing.
- `Hero.tsx`: Seção principal e primeira dobra com CTA.
- `Pricing.tsx`: Planos e preços integrados à lógica de faturamento.
- `Blog.tsx` e `Testimonials.tsx`: Prova social e SEO.

## 5. Componentes Globais Independentes
- `CommandPalette.tsx`: O menu de busca global (`Ctrl+K` ou `Cmd+K`).
- `ErrorBoundary.tsx`: Captura erros de renderização React prevenindo que a tela inteira quebre (Crash Reports).
- `LanguageSwitcher.tsx`: Controle de i18n para troca de idiomas, conversando diretamente com a lib do i18next.
