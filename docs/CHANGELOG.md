# Changelog da Documentação

> Mudanças relevantes da documentação propriamente dita (não do código).
> Para o que mudou no produto, ver release notes do app.

---

## 2026-05-26 — atualização do módulo de email

### Mudado
- `docs/edge-functions/EMAIL.md`: hub agora tem **10 abas** (era 9); adicionada subseção `EmailContacts.tsx` (`/email/contacts`); corrigida descrição do envio Resend (chamada direta a `api.resend.com`, sem connector gateway); seção 7 (Secrets) atualizada — removida menção falsa a `LOVABLE_API_KEY`.
- `docs/flows/EMAIL_CAMPAIGN.md`: reescrito por completo. Removidas referências às tabelas inexistentes `email_recipients` e `email_events`; fluxo agora reflete o real (`dispatch-campaign` → RPC `enqueue_email` → `email_queue` → `process-email-queue` → `send-email` → `email_logs`).
- `docs/integrations/RESEND.md`: corrigida arquitetura — não usa connector gateway Lovable; endpoints listados com URL completa (`https://api.resend.com/...`).
- `docs/roadmap/EMAIL.md`: adicionado aviso de escopo no topo (somente auth emails) para evitar confusão com o módulo de marketing.

---

## 2026-05-25 — v1.0 (build inicial completo)

Documentação construída em 12 etapas. Estrutura final consolidada.

### Adicionado
- `README.md`, `OVERVIEW.md`, `GLOSSARY.md`.
- `conventions/`: CODE_STYLE, COMMIT_PR, SECURITY, SUPABASE_RULES.
- `architecture/`: STACK, MULTI_TENANCY, AUTH, FEATURE_FLAGS, REALTIME.
- `database/`: SCHEMA, RLS_POLICIES, FUNCTIONS_TRIGGERS, MIGRATIONS.
- `edge-functions/`: INDEX, WHATSAPP, AI, EMAIL, TRACKING, SHARED_HELPERS.
- `features/`: BROADCASTS, SEQUENCES_AUTOMATIONS, FORMS.
- `frontend/`: ROUTING, PAGES, COMPONENTS, HOOKS_LIB, DESIGN_SYSTEM, STATE_DATA.
- `flows/`: INBOUND_WHATSAPP, OUTBOUND_WHATSAPP, AI_AGENT_LOOP, EMAIL_CAMPAIGN, LEAD_LIFECYCLE, BROADCAST, TRACKING_TO_LEAD.
- `integrations/`: EVOLUTION_API, RESEND, LOVABLE_AI, PG_NET_CRON, EXTERNAL_FORMS.
- `operations/`: COSTS_LIMITS, OBSERVABILITY, ERROR_HANDLING, BACKUPS_RECOVERY, PERFORMANCE.
- `known-issues/`: PITFALLS (40 itens), DEBT (20 itens).
- `roadmap/IMPROVEMENTS.md` (22 itens em 3 tiers).

### Movido
- `docs/AI.md` → `docs/edge-functions/AI.md` (stub redirect mantido).
- `docs/EMAIL.md` → `docs/edge-functions/EMAIL.md` (stub redirect mantido).
- `docs/TRACKING.md` → `docs/edge-functions/TRACKING.md` (stub redirect mantido).

### Total
- 52 arquivos `.md`.
- ~7500 linhas.
- 100% em português técnico.

---

## Como registrar mudanças aqui

Use formato:

```
## YYYY-MM-DD — descrição curta

### Adicionado / Mudado / Removido / Movido
- `caminho/arquivo.md`: o que mudou em 1 linha.
```

Atualizar `Última atualização:` no topo dos arquivos tocados.
