# Convenções — Código

> **Quando ler:** antes de criar componentes, hooks ou helpers.
> **Última atualização:** 2026-06-03

---

## Stack obrigatória

React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui + React Router v6 + React Query v5 + react-hook-form + zod.

Nunca trocar por Next/Vue/Svelte/Angular. Nunca adicionar SSR.

---

## Estrutura de pastas

```text
src/
├── pages/                Uma rota top-level por arquivo
├── components/<domínio>/ Agrupado por feature (inbox/, kanban/, email/, admin/)
├── components/ui/        shadcn primitives — não editar lógica, só estender variants
├── hooks/                Hooks reutilizáveis (use*.ts/.tsx)
├── lib/                  Helpers puros sem React (phone.ts, drafts.ts, features.ts)
├── types/                Tipos compartilhados
└── integrations/supabase Auto-gerado, não editar
```

---

## Componentes

- Componentes pequenos e focados. Se passar de ~200 linhas, considere quebrar.
- Props tipadas com `type Props = { ... }` no topo do arquivo.
- Cor/espacamento via tokens semânticos. **Nunca** classes cruas (`text-white`, `bg-black`).
- `cn(...)` de `@/lib/utils` para concatenar classes.
- Forms: `react-hook-form` + `zod` + componentes `<Form*>` do shadcn.

---

## Estado & dados

- **React Query** (`@tanstack/react-query`) para qualquer leitura de banco.
- Chaves de query estáveis e hierárquicas: `["leads", clinicId, filters]`.
- Invalidações específicas (`queryClient.invalidateQueries({ queryKey: [...] })`), não globais.
- Mutations otimistas onde valer a pena (inbox, kanban drag).
- Estado local: `useState` / `useReducer`. Para forms, sempre RHF.
- **Nunca** Redux. **Nunca** Zustand global novo sem discussão.

---

## Telefones

Sempre normalizar com `src/lib/phone.ts` (E.164) antes de qualquer `eq('phone', ...)` ou `insert`.

---

## Erros

- Frontend: capturar e usar `toast({ variant: "destructive", ... })` do shadcn.
- Edge: retornar JSON com `{ error, message, ... }` e status HTTP semântico:
  - `400` payload inválido
  - `401` sem auth
  - `402` limite de spend (sistema `ai_spend_limits`)
  - `403` sem permissão
  - `423` conta travada (lockout)
  - `429` rate limit
  - `500` erro interno (log estruturado)

---

## Imports

- Path alias `@/` sempre que possível.
- Ordenar: libs externas → `@/components` → `@/hooks` → `@/lib` → relativos → tipos.
- Não importar de `src/integrations/supabase/types.ts` direto se houver tipo em `src/types/`.

---

## Tests

`vitest` + `@testing-library`. Rodar com `bunx vitest run`. Setup em `src/test/setup.ts`.

---

## SEO (quando aplicável)

`<title>` < 60 chars, meta description < 160. Um único `<h1>`. Alt em imagens. JSON-LD se fizer sentido.
