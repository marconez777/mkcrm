---
title: "Hooks e Utilitários do Frontend"
topic: frontend
kind: map
audience: agent
updated: 2026-07-13
summary: "Mapeamento dos Hooks customizados do React, subscrições Realtime (WebSockets) e funções utilitárias do sistema."
code_refs:
  - src/hooks/
  - src/lib/
  - src/utils/
  - src/integrations/
  - src/vite-env.d.ts
related_docs:
  - docs/maps/FRONTEND_CORE.md
---

# Hooks e Utilitários do Frontend

## 1. Visão Geral
A lógica de negócio não ligada a uma página específica, bem como abstrações de serviços externos, residem nestas pastas. O mapeamento centraliza as referências técnicas de como o frontend interage com estado complexo, mutações do Supabase e eventos em tempo real.

## 2. Hooks de Domínio (Supabase & React Query)
A aplicação depende massivamente do React Query (`@tanstack/react-query`) envolvendo o cliente do Supabase.

### 2.1 Hooks Core
- **`useAuth`**: Gerencia o ciclo de vida da sessão do Supabase Auth e expõe papéis (`isSuperAdmin`, `isOwner`, etc).
- **`useCrm`**: Contexto central do Kanban, gerencia pipelines selecionados e estágios da clínica.
- **`useLeadsPaginated`**: Lida com a busca otimizada, cache e filtros pesados de leads na placa Kanban.

### 2.2 Mutações Frequentes
Existem dezenas de hooks focados em mutações específicas (ex: notas internas via `internal-notes.ts`, edição de tags, mudança de estágio no Kanban com otimistic updates).

## 3. Subscrições Realtime (WebSockets)
A reatividade da aplicação depende de listeners de banco de dados:
- **Eventos de Mensagens (Inbox)**: Hooks customizados inscrevem-se no channel do Supabase (`supabase.channel('messages')`) para receber novas mensagens de WhatsApp instantaneamente, disparando o recarregamento (invalidação) do cache.
- **Eventos do Kanban**: Monitoramento em tempo real de mudanças na tabela `leads` para que vendedores vejam movimentações feitas pelo bot (`ai-chat` ou `pipeline-deterministic`) sem dar refresh.

## 4. Hooks Genéricos (`src/hooks/`)
Aqui encontram-se ganchos que abstraem lógica genérica de UI:
- **Estado e Feedback**: `use-toast.ts` e `use-mobile.tsx` controlam o sistema de notificações interativas e checagem de responsividade.
- **Acessibilidade & UX**: `useUnreadTitle.ts` (muda dinamicamente a tab do navegador se houver alertas não lidos).
- **Diálogos Globais**: `useDialogs.tsx` expõe métodos imperativos para abrir modais de confirmação.

> [!TIP]
> **Invariantes dos Hooks**: Sempre utilize `@tanstack/react-query` interno aos hooks de domínio para garantir cache. Invalide os caches após mutações bem sucedidas (`queryClient.invalidateQueries`).

## 5. Integrações (`src/integrations/`)
Esta pasta abriga os clientes gerados automaticamente e tipos fortemente tipados.
- `supabase/types.ts`: Definições globais de TypeScript extraídas diretamente do schema do banco via Supabase CLI. Usado ao longo de todo o sistema para tipar respostas do banco.
- Toda modificação estrutural no banco exige rodar a rotina de atualização de types.

## 6. Utilitários Globais (`src/lib/` e `src/utils/`)
- **Manipulação de Dados**: `csv.ts` para exportação, `format.ts` para formatação de moeda, datas e CPFs/CNPJs.
- **Rede e Controle**: `fetch-all.ts` para buscar dados paginados completos do Supabase (quando não dá pra usar uma rota só limitando a quantidade).
- **Tipagem Dinâmica e Strings**: Funções puras sem dependências do React usadas em transformações, como o clássico utilitário `cn()` para fusão de classes do Tailwind.
