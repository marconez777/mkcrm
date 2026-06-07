---
title: Stack & Build
topic: architecture
kind: reference
audience: agent
updated: 2026-06-07
summary: Centralizadas em `src/lib/supabase-env.ts`. Use `getFunctionHeaders()` para chamadas raw a edge functions (streaming, downloads).
---
# Stack & Build

> **Quando ler:** ao avaliar dependências, configurar build/deploy, debugar problemas de build, ou pensar em upgrade de framework.
> **Última atualização:** 2026-06-03

---

## Stack

### Frontend (SPA)

| Camada | Versão | Observação |
|---|---|---|
| React | 18.3.1 | Sem Server Components, sem Suspense de data |
| Vite | 5.4.19 | Plugin `@vitejs/plugin-react-swc` |
| TypeScript | 5.8.3 | `strict: true` em `tsconfig.app.json` |
| Tailwind CSS | 3.4.17 | + `@tailwindcss/typography`, `tailwindcss-animate` |
| shadcn/ui (Radix) | varia | Primitives em `src/components/ui/` |
| React Router DOM | 6.30.1 | Modo BrowserRouter |
| TanStack Query | 5.83.0 | `@tanstack/react-virtual` 3.13 para listas grandes |
| react-hook-form | 7.61.1 | + `@hookform/resolvers` + `zod` |
| Tiptap | 3.23.4 | Editor de templates de email |
| DnD-kit | 6.3.1 | Kanban + Tasks board |
| date-fns | 3.6.0 | Não usar moment |
| Sonner | 1.7.4 | Toasts |
| Recharts | 2.15.4 | Gráficos (dashboard admin, métricas de email/IA) |
| xlsx | 0.18.5 | Import/export Excel |
| dompurify | 3.4.3 | Sanitização HTML do editor de email |
| framer-motion | 12.40.0 | Animações (site institucional + transições do shell) |
| cmdk | 1.1.1 | Command Palette (⌘K) |
| vaul | 0.9.9 | Drawers (mobile) |
| embla-carousel-react | 8.6.0 | Carrosséis no site |

**Path alias:** `@/` → `src/` (definido em `vite.config.ts` + `tsconfig.json`).

### Backend

- **Lovable Cloud** = Supabase gerenciado pela plataforma. Não é necessário acessar painel Supabase para uso normal — gestão via Lovable.
- **Postgres** com extensões: `pgvector` (RAG), `pg_net` (HTTP), `pg_cron`, `pgcrypto`, `vault`.
- **Edge Functions** em Deno (runtime padrão Supabase Functions).
- **Storage** (buckets) para mídia de WhatsApp, anexos de email, avatares.

### Externos

- **Evolution API** (WhatsApp não-oficial) — instâncias por clínica.
- **Resend** — email transacional/marketing com domínios próprios.
- **Lovable AI Gateway** — proxy unificado para Gemini, GPT-5, etc. Sem necessidade de chave do usuário.

---

## Scripts npm

```json
"dev"        → "vite"
"build"      → "vite build"
"build:dev"  → "vite build --mode development"
"lint"       → "eslint ."
"test"       → "vitest run"
"test:watch" → "vitest"
```

> Não rode `build` manualmente em sessão — o harness faz automaticamente. Não rode `tsc --noEmit` manualmente.

---

## Variáveis de ambiente

### Frontend (`.env` auto-gerado, **nunca editar**)

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

Centralizadas em `src/lib/supabase-env.ts`. Use `getFunctionHeaders()` para chamadas raw a edge functions (streaming, downloads).

### Edge functions (secrets)

Disponíveis via `Deno.env.get(...)`. Auto-presentes:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Configuráveis (via `secrets--add_secret`):
- `RESEND_API_KEY` — envio de email
- `LOVABLE_API_KEY` — Lovable AI Gateway
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` — WhatsApp
- `UNSUBSCRIBE_HMAC_SECRET` — também replicado em `app_settings`
- `CRON_SERVICE_ROLE_KEY` — usado por `invoke_edge_function` (em `app_settings`)

---

## Deploy

- Frontend: build Vite → publicação automática Lovable (`https://mkcrm.lovable.app` + custom domain `https://crm.mkart.com.br`).
- Edge functions: deploy automático ao salvar `supabase/functions/*/index.ts`.
- Migrações: auto-aplicadas após aprovação do usuário.

---

## Performance & build notas

- **SWC** no React plugin → builds rápidas.
- `react-virtual` em listas grandes (leads, mensagens).
- Code splitting: padrão do Vite por rota (lazy import quando vale a pena).
- Tailwind purge automático.

---

## Pegadinhas

| Sintoma | Causa |
|---|---|
| Tipos do Supabase quebrados | `types.ts` foi editado à mão. Reverter. |
| `import.meta.env.VITE_*` undefined | Variável não está em `.env` (lembrar do prefixo `VITE_`). |
| Build sem erro mas tela branca | Geralmente erro em runtime no provider/Router — abrir console. |
| `process.env` undefined | Use `import.meta.env`. Não há `process` no browser. |
