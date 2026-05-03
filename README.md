# CRM WhatsApp (Evolution API)

CRM com Inbox em tempo real e pipeline Kanban, integrado ao WhatsApp via Evolution API. Construído com React + Vite + Tailwind + shadcn/ui no frontend e Lovable Cloud (Supabase: Postgres + Edge Functions + Realtime) no backend.

- **Documentação do usuário:** [`docs/MANUAL.md`](docs/MANUAL.md)
- **Documentação técnica:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Integração Evolution / Webhook:** [`docs/EVOLUTION.md`](docs/EVOLUTION.md)
- **Modelo de dados:** [`docs/DATABASE.md`](docs/DATABASE.md)
- **Edge Functions:** [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md)

## Stack
- React 18 · Vite 5 · TypeScript · TailwindCSS · shadcn/ui · @dnd-kit · TanStack Query · React Router
- Supabase (Postgres, Realtime, Edge Functions Deno)
- Evolution API (WhatsApp)

## Scripts
```bash
npm run dev       # desenvolvimento
npm run build     # build de produção
npm run test      # testes (vitest)
npm run lint
```

## Estrutura
```
src/
  pages/          Inbox, Kanban, Settings, LeadDrawer
  components/
    inbox/        ChatPane, ConversationList, Composer, ContextRail, NewConversationDialog
    ui/           shadcn/ui primitives
  hooks/          useCrm, useAttendants, useQuickReplies, useHealth, useUnreadTitle
  integrations/supabase/  client + types (auto-gerados)
supabase/
  functions/
    _shared/evolution.ts        helpers + ingestMessage idempotente
    evolution-webhook/          recebe eventos do Evolution
    evolution-send/             envia mensagens
    evolution-sync-lead/        reconciliação por lead
    evolution-health/           health-check
    evolution-test/             debug
  config.toml
```
