# Changelog da Documentação

> Mudanças relevantes da documentação propriamente dita (não do código).
> Para o que mudou no produto, ver release notes do app.

---

## 2026-05-30 — Auditoria Fase 4 (resto): features & fluxos

### Adicionado
- `docs/features/EMAIL_CAMPAIGNS.md`: feature completa de campanhas — multi-segmento (`segment_ids[]` + dedup union, com fallback `segment_id` legado), A/B (R-20), rotação de domínio + warmup (R-21/R-12), throttle por destinatário, cota, supressão por bounce, agendamento, pause/resume/duplicar/teste.
- `docs/features/ENGAGEMENT.md`: feature de engajamento — RPCs `engagement_broadcasts_summary`/`_sequences_summary`/`_sequence_steps`, colunas snapshot em `message_sequence_runs`, UI via aba `/ai/engagement`.

### Mudado
- `docs/flows/EMAIL_CAMPAIGN.md`: passo de resolução de audiência explicita multi-segmento (loop sobre `segment_ids[]` + dedup por email) e fallback `segment_id` legado.
- `docs/flows/AI_AGENT_LOOP.md`: pegadinha "loop bot-↔-bot" via `messages.bot_agent_id`; nota sobre `replied_at`/`stage_*_at_send` alimentando RPCs de engajamento.

---

## 2026-05-30 — Auditoria Fase 4 (features & fluxos): Engajamento vira aba de IA

### Código
- `src/components/AppShell.tsx`: removido o submenu lateral "IA → Engajamento". O item "IA" do sidebar volta a ser simples.
- `src/pages/ai/AiHub.tsx`: nova aba **Engajamento** entre "Relatórios agendados" e "Memórias IA". Rota canônica `/ai/engagement`, com aliases `/metrics/engagement` e `/metrics` (compatibilidade).
- `src/App.tsx`: rotas `/ai/engagement`, `/metrics/engagement` e `/metrics` agora montam `<AiHub />` para manter sidebar + tabs consistentes; import direto de `MetricsEngagement` removido.
- `src/components/CommandPalette.tsx`: atalho "Engajamento (respostas)" passa a apontar para `/ai/engagement`.

### Documentação
- `docs/frontend/PAGES.md`: seção 2.3 IA reescrita listando todas as 9 abas do AiHub na ordem atual, com nota explicando que Engajamento, ScheduledReports e AgentMemories vivem como abas (sem item próprio no sidebar).
- `docs/frontend/ROUTING.md`: tabela de rotas atualizada com `/ai/reports` e `/ai/engagement` (+ aliases `/metrics/engagement`, `/metrics`).

---

## 2026-05-30 — Auditoria Fase 2 (banco & backend core)

### Adicionado
- `docs/AUDIT_PHASE1.md`: inventário completo de 70 arquivos de doc, status por arquivo, migrations pós-CHANGELOG, ordem sugerida das fases.

### Mudado (refletindo mudanças de código de 2026-05-27 a 2026-05-30)
- `docs/database/SCHEMA.md`: tabela Email Marketing reescrita com `email_campaigns.segment_ids[]` (multi-segmento), novas colunas `send_rate_per_minute`/`variant_strategy`/`winner_picked_at`/`from_domain_pool`/`last_sent_at`/`from_name_override`; novas tabelas `email_campaign_variants`, `email_domain_warmup`, `email_recipient_throttle`, `email_health_alerts`, `email_operational_alerts`, `email_send_dedup`, `campaign_throughput`; novas colunas `email_queue.priority/variant_id/from_domain_override`, `email_logs.variant_id/from_domain_override`, `email_domains.rotation_pool/weight`, `messages.bot_agent_id`, `message_sequence_runs.replied_at/stage_id_at_send/stage_position_at_send`; views `email_throughput_stats` e `email_system_health`; novos índices; lista de Realtime atualizada (incluindo `campaign_throughput` e `email_campaigns`); 5 novos pitfalls.
- `docs/database/FUNCTIONS_TRIGGERS.md`: novos triggers (`tg_email_queue_campaign_counters` idempotente, `email_queue_health_trigger`, `tg_suppress_on_bounce`, `email_logs_bounce_health_trigger`, `touch_email_domain_warmup`); constraint `message_sequences_trigger_type_check` com `pipeline_enter`; novas funções de negócio (`report_template_stats`, `claim_email_quota`, `claim_domain_warmup`/`release_domain_warmup`, `claim_recipient_throttle`, `pick_ab_winner`, `pick_rotation_domain`, `check_email_operational_health`, `check_clinic_bounce_health`); helpers de segmentos (`_email_segment_rule_to_sql`, `_email_segment_filters_to_where`, `resolve_email_segment`, `resolve_email_segment_preview`); RPCs de engajamento (`engagement_broadcasts_summary`, `engagement_sequences_summary`, `engagement_sequence_steps`).
- `docs/database/RLS_POLICIES.md`: nova seção "Endurecimentos recentes" com tabela de revokes em `clinic_email_integrations`, `whatsapp_instances`, `form_integrations`, `ai_agents` e RPCs `engagement_*`.
- `docs/database/MIGRATIONS.md`: cronologia estendida até 2026-05-30 (4 novas faixas semanais), contagem de migrations atualizada.
- `docs/architecture/REALTIME.md`: `campaign_throughput` e `email_campaigns` adicionadas à lista da publication.
- `docs/architecture/AUTH.md`: nota de endurecimento apontando para a nova seção em `RLS_POLICIES.md`.

---

## 2026-05-26 — email R-17 implementado (métricas em tempo real)

### Adicionado
- Views `email_throughput_stats` (estatísticas por clínica: pendentes, enviados, falhos, abertos, cliques, taxas de bounce/complaint) e `email_system_health` (resumo global: fila total, jobs presos, alertas ativos).
- Tabela `email_operational_alerts` com tipos (`queue_backlog`, `stuck_processing`, `high_failure_rate`, `domain_warmup_limit`, `recipient_throttle_limit`).
- Função `check_email_operational_health`: detecta backlog (>500 jobs), jobs presos em processing (>10min) e taxa de falha alta por clínica (>10%).
- Trigger `email_queue_health_trigger`: dispara health check a cada 100 novos inserts na fila.

---

## 2026-05-26 — email Tier 3 implementado (recursos enterprise)

### Adicionado
- **R-18 Throttling por campanha**: coluna `email_campaigns.send_rate_per_minute`. `dispatch-campaign` espalha `scheduled_at` em janelas de 1 minuto quando configurado.
- **R-19 Segmentação avançada**: regras `last_message_at_range`, `deal_value_range` e `custom_field` no helper `_email_segment_rule_to_sql`.
- **R-20 A/B test**: nova tabela `email_campaign_variants` (label, weight, subject/template/from_name overrides, contadores, is_winner). `email_campaigns.variant_strategy` + `winner_picked_at`. RPC `pick_ab_winner`. Colunas `variant_id` em `email_queue` e `email_logs`.
- **R-21 Multi-domínio rotativo**: colunas `rotation_pool` + `rotation_weight` em `email_domains`. `email_campaigns.from_domain_pool`. RPC `pick_rotation_domain` (weighted random). Colunas `from_domain_override` em `email_queue` e `email_logs`. `send-email` e `send-email-batch` aplicam o override preservando o local-part; warmup/throttle/validação operam no domínio efetivo. `process-email-queue` agrupa batches incluindo o override no key.

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
