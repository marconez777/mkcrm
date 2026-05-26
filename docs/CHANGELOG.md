# Changelog da Documentação

> Mudanças relevantes da documentação propriamente dita (não do código).
> Para o que mudou no produto, ver release notes do app.

---

## 2026-05-26 — email Tier 2 implementado (escala e deliverability)

### Adicionado
- `supabase/functions/send-email-batch`: nova edge function que envia até 100 e-mails por chamada via Resend `/emails/batch`. Aplica dedup, cota, warm-up e throttle por destino ANTES de mandar; o que não passa é re-agendado.
- Tabela `email_domain_warmup` (warm-up automático: 50→100→500→1k→5k→10k→25k→ilimitado por dia).
- Tabela `email_recipient_throttle` (limite por domínio destinatário, default 1000/h).
- Tabela `email_health_alerts` (registro de alertas de bounce/complaint e ação tomada).
- RPCs `claim_domain_warmup`, `release_domain_warmup`, `claim_recipient_throttle`.
- Trigger `email_logs_bounce_health_trigger` → função `check_clinic_bounce_health`: pausa automaticamente campanhas em execução quando bounce_rate >5% ou complaint_rate >0,3% nas últimas 1000 mensagens.

### Mudado
- `supabase/functions/send-email`: aplica warm-up de domínio remetente e throttle por domínio destinatário antes do envio; libera vagas em caso de falha.
- `supabase/functions/process-email-queue`: agrupa jobs por `(clinic_id, template_slug)` e usa `send-email-batch` quando grupo ≥3; fallback automático para singular se o batch falhar. Reduz drasticamente HTTPs para Resend em campanhas.

---


## 2026-05-26 — email Tier 1 implementado (performance estrutural)

### Mudado
- `supabase/functions/send-email`: cache em memória (templates, domínios, integrações, slug da clínica) com TTL 60s; idempotência atômica via nova tabela `email_send_dedup` (INSERT ON CONFLICT, sem race); cota diária atômica via novo RPC `claim_email_quota`. Reduz ~6 queries por envio para ~3 e elimina contenção.
- `supabase/functions/process-email-queue`: dispatcher agora ordena por `priority ASC, scheduled_at ASC` — auth/transacional passa à frente de campanha.
- `supabase/functions/dispatch-campaign`: paginação streaming da lista de leads (suporta >1000 destinatários sem hit no limite default do PostgREST); novos jobs marcados com `priority=5`.
- `supabase/functions/email-automations-tick`: processa automações em paralelo (Promise.all, concurrency 10) em vez de serialmente.
- Migration: nova coluna `email_queue.priority`, índice `email_queue_pending_priority_idx`, tabela `email_send_dedup` + UNIQUE, RPCs `enqueue_email` (sobrecarga c/ `_priority`) e `claim_email_quota`.

### Próximos passos
- Tier 2: warm-up automático de domínio, rate-limit per-domain destinatário, Resend Batch API, feedback loop bounce/complaint.

---

## 2026-05-26 — roadmap de escala do módulo de email

### Adicionado
- `docs/roadmap/EMAIL_SCALE.md`: roadmap completo de performance e escala do módulo de email marketing — 10 gargalos identificados na auditoria do código + 21 melhorias em 4 tiers (R-1 a R-21), SLOs propostos e sugestão de priorização para subir cliente de alto volume.
- `docs/edge-functions/EMAIL.md` §11 "Performance & throughput": tabela com limites atuais (cron, batch, cota, etc.) e referência ao roadmap.

### Mudado
- `docs/roadmap/EMAIL.md`: aviso de escopo agora aponta também para `EMAIL_SCALE.md`.

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
