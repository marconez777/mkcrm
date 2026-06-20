---
title: "Guia de Integração Lovable e Extensibilidade"
topic: ui
kind: reference
audience: developer
updated: 2026-06-20
summary: "Boas práticas, convenções de código e diretrizes para prompts enviados a IAs geradoras de UI (Lovable, Cursor, Bolt) atuarem no repositório."
---

# Lovable e Integrações de IA Generativa de UI

A interface do MK CRM (Frontend) foi majoritariamente construída utilizando tecnologias modernas via **Lovable** e aprimorada via agentes. Sempre que for necessário instruir uma IA para mexer na interface, siga as regras abaixo.

## 1. Stack do Frontend

- **React 18** com **Vite**.
- **TypeScript** rigoroso (`strict: true`).
- **TailwindCSS** para estilização.
- **shadcn/ui** e **Radix UI** para componentes base (Acessibilidade out-of-the-box).
- **React Query (TanStack Query)** para Data Fetching assíncrono e Cache de requisições do Supabase.
- **Supabase JS Client** nativo para comunicação de backend.
- **Lucide React** para iconografia.

## 2. Prompts Recomendados para a IA

Quando fornecer o código a uma IA geradora de tela (como Lovable), utilize as seguintes restrições:

> "Sempre extraia a lógica de fetching de dados (Supabase) para Custom Hooks dentro da pasta `src/hooks/`. Nunca injete a lógica de DB diretamente dentro do `.tsx` visual do componente."

> "Qualquer alteração visual no Kanban deve estar ciente de que as colunas são geradas dinamicamente e que a tabela `pipeline_stages` determina a ordem. Use componentes pequenos."

> "Para Mutate (Atualizações de banco), sempre utilize `useMutation` do `@tanstack/react-query` e sempre invoque `queryClient.invalidateQueries` nas chaves relevantes após o sucesso, para evitar descompasso na tela."

## 3. Topologia das Telas Principais

- `src/pages/Kanban.tsx` → Tela principal (Drag & Drop), sub-componentes geralmente ficam em `src/components/kanban/`.
- `src/pages/Leads.tsx` → Visualização em Tabela para ações em massa (Bulk Updates).
- `src/components/LeadDialog/` → O painel lateral ultra-complexo onde reside a Timeline de mensagens, os Custom Fields dinâmicos e abas de tarefas/agendamentos.

## 4. Novas Tabelas e Telas
Se a IA for instruída a criar uma Tela "Configurações X", garanta que ela declare as RLS (Row Level Security) no Supabase em uma instrução `SQL` separada antes de apenas jogar o código do React. Todo acesso ao banco pelo React requer RLS habilitado e com política `auth.uid() = user_id`.
