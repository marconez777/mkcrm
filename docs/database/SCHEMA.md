---
title: SCHEMA — Banco de dados Postgres (Supabase)
topic: auth
kind: reference
audience: agent
updated: 2026-06-07
summary: As tabelas são agrupadas por domínio funcional. Cada domínio tem sua própria seção abaixo com as colunas relevantes (campos padrão omitidos).
---
# SCHEMA — Banco de dados Postgres (Supabase)

> Última atualização: 2026-06-03
> Fontes de verdade: `supabase/migrations/*.sql` e introspecção via `information_schema` / `pg_catalog`.
> Para regras de acesso veja `RLS_POLICIES.md`; para funções/triggers veja `FUNCTIONS_TRIGGERS.md`.

## Convenções globais

- Schema único utilizado pelo app: **`public`**. Schemas reservados (`auth`, `storage`, `realtime`, `vault`, `supabase_functions`) nunca são alterados pelo projeto.
- Todas as tabelas de negócio têm:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()` (mantido por trigger `set_updated_at` — ver `FUNCTIONS_TRIGGERS.md`)
  - `clinic_id uuid NOT NULL` (multi-tenant — ver `architecture/MULTI_TENANCY.md`)
- Extensões habilitadas: `pgcrypto`, `pg_net`, `pg_cron`, `vector` (pgvector), `pg_trgm`, `unaccent`.
- **111 relações** no schema `public` (109 base tables + 2 views: `email_throughput_stats`, `email_system_health`). **RLS ativado em 100% das base tables.**

## Domínios (agrupamento lógico)

As tabelas são agrupadas por domínio funcional. Cada domínio tem sua própria seção abaixo com as colunas relevantes (campos padrão omitidos).

| Domínio | Tabelas principais |
|---|---|
| Tenancy & Identidade | `clinics`, `clinic_members`, `clinic_invites`, `profiles`, `user_roles`, `attendants`, `settings`, `app_settings`, `audit_log`, `data_access_log`, **`plans`** |
| Pipelines & Leads | `pipelines`, `pipeline_stages`, `leads`, `lead_events`, `lead_stage_history`, `lead_custom_fields`, `lead_internal_notes`, `lead_tasks`, `lead_ai_settings`, `lead_thread_classifications`, `deleted_leads`, `stage_ai_defaults` |
| WhatsApp & Mensageria | `whatsapp_instances`, `whatsapp_intents`, `messages`, `message_templates`, `quick_replies`, `scheduled_messages`, `pending_replies`, `webhook_events`, `webhook_dedup` |
| Relatórios agendados (WA) | `scheduled_reports`, `scheduled_report_runs` |
| Tasks (Kanban) | `task_boards`, `task_columns`, `tasks`, `task_assignees`, `task_labels`, `task_label_links`, `task_checklist_items`, `task_attachments` |
| Email Marketing | `email_templates`, `email_template_folders`, `email_queue`, `email_logs`, `email_campaigns`, `email_campaign_variants`, `email_automations`, `email_automation_enrollments`, `email_segments`, `email_segment_contacts`, `email_unsubscribes`, `email_send_state`, `email_send_dedup`, `email_domains`, `email_domain_warmup`, `email_recipient_throttle`, `email_health_alerts`, `email_operational_alerts`, `email_metrics_daily`, `campaign_throughput`, `clinic_email_integrations`, `resend_webhook_events` |
| Sequências / Automações | `message_sequences`, `message_sequence_steps`, `message_sequence_enrollments`, `message_sequence_runs`, `automations`, `automation_runs` |
| Broadcasts | `broadcasts`, `broadcast_recipients`, `broadcast_message_groups`, `broadcast_message_parts`, `broadcast_events` |
| Forms públicos | `form_definitions`, `form_submissions`, `form_integrations` |
| Tracking | `tracking_events`, `tracking_sessions`, `tracking_visitors`, `tracking_identity_links`, `tracking_lead_sources`, `traffic_source_rules` |
| IA (Agentes / RAG / Observabilidade) | `ai_agents`, `ai_agent_drafts`, `agent_personas`, `agent_prompt_versions`, `agent_stages`, `ai_threads`, `ai_messages`, `ai_documents`, `ai_chunks`, `ai_kb_defaults`, `ai_insights`, `ai_usage`, `ai_usage_daily`, `ai_spend_events`, `ai_spend_limits`, `ai_spend_notifications_sent`, `agent_traces`, `ai_chat_traces`, `agent_evals`, `agent_memory`, `agent_mcp_servers`, `rag_cache`, `embedding_cache`, `lead_reply_counters` |
| Builder / Lovable Agent | `builder_manual_versions` |

## Tenancy & Identidade

### `clinics`
Tenant raiz. Toda outra tabela carrega `clinic_id` apontando aqui.
- `name text NOT NULL`, `slug text UNIQUE`, `logo_url text`
- `plan text DEFAULT 'free'` — referência lógica para `plans.code` (não é FK estrita; edição via `<Select>` no `/admin` desde jun/2026).
- `settings jsonb DEFAULT '{}'` — guarda **feature flags** (`settings.features.*`), **limites por clínica** (`settings.limits.*`, override do plano — ver `architecture/PLANS_LIMITS.md`), quotas (`settings.email.quota_daily`), config de IA, etc. Mudanças em `settings.features` são bloqueadas pelo trigger `clinics_guard_features` exceto para super_admin.
- Trigger `clinics_seed_system_agents` cria agentes de IA padrão ao inserir uma clínica.

### `plans` *(novo — jun/2026)*
Catálogo configurável de planos comerciais. Substitui o uso de `clinics.plan` como texto livre.
- `code text UNIQUE NOT NULL`, `name`, `description`
- `price_monthly_brl`, `price_yearly_brl` numeric(10,2) default 0
- `features jsonb` — defaults aplicáveis a `clinics.settings.features` via edge `admin-apply-plan`
- `limits jsonb` — caps numéricos (`max_users`, `max_leads`, `ai_monthly_usd_cap`, …). `null`/ausente = ilimitado.
- `sort_order int`, `is_active bool`, `is_public bool`

Seed inicial: `free`, `starter`, `pro`, `enterprise`. Documentação completa em `architecture/PLANS_LIMITS.md`.

### `clinic_members`
Vínculo `user_id ↔ clinic_id` com `role clinic_role` ∈ `{owner, admin, member}`. Constraint `UNIQUE(user_id)` (um usuário em uma única clínica — ver pitfall em `known-issues/PITFALLS.md`).

### `clinic_invites`
Convites pendentes. Campos: `email`, `role`, `token text UNIQUE`, `expires_at`, `accepted_at`. Consumidos por `accept_clinic_invite(token)` ou automaticamente em `handle_new_user()`.

### `profiles`
1:1 com `auth.users` via `user_id uuid UNIQUE`. Campos: `email`, `display_name`, `avatar_url`. Populada pelo trigger `handle_new_user`.

### `user_roles`
Roles globais (`app_role` ∈ `{super_admin}`). Tabela separada por segurança — **nunca** coloque roles em `profiles`. Função canônica: `is_super_admin(_user_id)`.

### `attendants`
Atendentes da clínica (podem ou não ter `user_id` em auth). Usados para atribuição de leads.

### `settings` / `app_settings`
- `settings`: configurações por clínica (chave/valor JSON).
- `app_settings`: chave/valor global (somente super_admin). Usado para `cron_service_role_key`, `supabase_url`, `unsubscribe_hmac_secret`.

> **Nota:** uma tabela `auth_lockouts` foi planejada (lockout de login após N tentativas) mas **não existe atualmente** no schema. A autenticação usa `supabase.auth.signInWithPassword` direto, sem lockout customizado — ver `architecture/AUTH.md`.


### `audit_log` / `data_access_log`
Trilha de auditoria de ações sensíveis e acessos a dados (PII).

## Pipelines & Leads

### `pipelines`
- `name text`, `kind text` ∈ `{whatsapp, internal}`, `whatsapp_instance_id uuid`.
- Trigger `trg_enforce_pipeline_kind_instance` zera `whatsapp_instance_id` quando `kind='internal'`.

### `pipeline_stages`
- `pipeline_id uuid`, `name text`, `position int`, `color text`, `is_won bool`, `is_lost bool`.

### `leads`
Tabela central. Campos relevantes:
- `name`, `email`, `phone`, `tags text[]`, `notes text`
- `pipeline_id`, `stage_id`, `stage_changed_at` (mantido por trigger `leads_stage_changed`)
- `attendant_id`, `unread_count int`, `last_message_at`, `last_message_preview`
- `form_source text`, `utm_source/medium/campaign/term/content`, `referrer`, `landing_page`
- `whatsapp_instance_id`, `external_id text` (id da conversa externa)

Triggers em `leads` (ver `FUNCTIONS_TRIGGERS.md`):
- `trg_leads_sync_pipeline` — sincroniza `pipeline_id` a partir do `stage_id`.
- `leads_stage_changed` — atualiza `stage_changed_at`.
- `log_lead_changes_trg` → grava em `lead_events`.
- `trg_lead_stage_history` → grava em `lead_stage_history`.
- `trg_enroll_on_stage_change` → cria enrollments em `message_sequences` com trigger `stage_enter`.
- `trg_email_on_lead_created` / `trg_email_on_stage_change` → enfileira emails de `email_automations`.

### `lead_events`
Timeline imutável de eventos do lead (`type`, `payload jsonb`).

### `lead_stage_history`
Histórico de movimentações de stage com `moved_by_user_id`.

### `lead_custom_fields`
Campos customizados por clínica (`key`, `value`, `lead_id`).

### `lead_internal_notes`
Notas internas (não vão para o WhatsApp).

### `lead_tasks`
Tarefas leves vinculadas a um lead (diferente de `tasks` do Kanban).

### `lead_ai_settings`
Override por-lead do agente de IA (pausar auto-reply, trocar agente, etc.).

### `stage_ai_defaults`
Defaults de IA por stage (qual agente usar quando lead entrar na stage).

### `deleted_leads`
Soft-delete histórico para auditoria.

## WhatsApp & Mensageria

### `whatsapp_instances`
Instâncias da Evolution API. Campos: `instance_name`, `phone_number`, `status`, `qr_code`, `webhook_url`, `api_key text` (segredo — não exposto via select público).

### `whatsapp_intents`
Mapeia intents/regex a respostas automáticas ou agentes.

### `messages`
Mensagens trocadas (in/out). Campos: `lead_id`, `clinic_id`, `from_me bool`, `body text`, `media_url`, `media_type`, `wa_message_id text UNIQUE`, `status` ∈ `{pending,sent,delivered,read,failed}`, `sent_at`, `delivered_at`, `read_at`, `bot_agent_id uuid` (preenchido pelo `scheduled-dispatcher` quando o envio veio de um agente — usado pelo `ai-auto-reply` como **loop-guard**: se a última mensagem `from_me` tem `bot_agent_id`, não responde).
Trigger `trg_stop_sequences_on_reply` — quando `from_me=false`, encerra enrollments de `message_sequences` com `stop_on_reply=true`.

### `message_templates`
Templates de mensagem WA (texto + variáveis).

### `quick_replies`
Respostas rápidas por atendente/clínica.

### `scheduled_messages`
Mensagens agendadas para envio futuro (processadas por cron).

### `pending_replies`
Buffer de respostas geradas por IA aguardando aprovação humana.

### `webhook_events` / `webhook_dedup`
- `webhook_events`: log bruto de eventos recebidos (Evolution, Resend, etc.) com `received_at`. Limpos por `cleanup_webhook_events()` (>14d).
- `webhook_dedup`: chaves de idempotência com `expires_at`. Limpas por `cleanup_webhook_dedup()`.

## Tasks (Kanban)

| Tabela | Função |
|---|---|
| `task_boards` | Quadros |
| `task_columns` | Colunas (status) com `position` |
| `tasks` | Cartões (`title`, `description`, `due_date`, `priority`, `column_id`, `position`) |
| `task_assignees` | N:N com `attendants`/`profiles` |
| `task_labels` + `task_label_links` | Etiquetas N:N |
| `task_checklist_items` | Subtarefas (`done bool`, `position`) |
| `task_attachments` | Anexos via `storage` (`path`, `mime_type`, `size_bytes`) |

## Email Marketing

### `email_templates`
- `slug text` (único por clínica), `subject`, `html_body`, `text_body`, `variables jsonb`, `active bool`.

### `email_template_folders`
Organização hierárquica de templates.

### `email_queue`
Fila de envio. Status ∈ `{pending, sending, sent, failed, cancelled}`. Campos importantes:
- `scheduled_at`, `force_send bool`, `related_lead_id`, `related_lead_table text` (usado também como "contexto" — ex.: `auto_<uuid>`, `campaign_<uuid>`).
- `priority smallint` (default 10) — `process-email-queue` ordena por `priority ASC, scheduled_at ASC`; transacional/auth usa `priority=1`, campanha `priority=5`.
- `variant_id uuid` — referência opcional a `email_campaign_variants` (A/B test).
- `from_domain_override text` — domínio remetente efetivo escolhido pela rotação (R-21). Quando preenchido, `send-email`/`send-email-batch` reescrevem o `from` preservando o local-part.
- `from_name_override text` — sobrescreve o nome do remetente por job.
**Dedup**: a função `enqueue_email` recusa duplicatas de (clinic, template, recipient, related_lead_table) com `status=pending`.
Índice especial: `email_queue_pending_priority_idx (clinic_id, status, priority, scheduled_at)`.

### `email_send_dedup`
UNIQUE `(clinic_id, template_slug, recipient_email, related_lead_table)` usada para **idempotência atômica** em `send-email` (INSERT ON CONFLICT, sem race). Substituiu a checagem em duas etapas anterior.

### `email_logs`
Resultado dos envios. Campos: `resend_id text UNIQUE`, `status`, `sent_at`, `delivered_at`, `opened_at`, `clicked_at`, `bounced_at`, `complained_at`, `error text`, `variant_id uuid`, `from_domain_override text`. Alimenta `report_campaign_stats()` e `report_template_stats()`.

### `email_campaigns`
Campanhas one-shot. `status` ∈ `{draft, scheduled, sending, sent, failed}`, `template_slug`, `scheduled_for`, `last_sent_at`.
- `segment_ids uuid[]` (default `'{}'`) — **multi-segmento** (união/OR de N segmentos). Vazio significa "todos os leads".
- `segment_id uuid` — **deprecado**, mantido para retro-compat; sempre sincronizado com `segment_ids[1]` quando há 1 segmento, `NULL` quando 0 ou >1.
- `send_rate_per_minute int` — R-18: throttling por campanha. `dispatch-campaign` espalha `scheduled_at` em janelas de 1 minuto.
- `variant_strategy text` ∈ `{none, ab}` + `winner_picked_at timestamptz` — R-20: A/B testing.
- `from_domain_pool text` — R-21: nome do pool em `email_domains.rotation_pool` para rotação de remetente.
- `from_name_override text`, `test_email text`, `test_sent_at timestamptz`.

### `email_campaign_variants` (R-20)
Variantes de A/B test por campanha. Campos: `campaign_id`, `label`, `weight int`, overrides (`subject`, `template_slug`, `from_name`), contadores (`sent_count`, `opened_count`, `clicked_count`) e `is_winner bool`. RPC `pick_ab_winner` seleciona o vencedor por taxa de abertura/clique.

### `campaign_throughput`
Contadores em tempo real por campanha (alimentados pelo trigger `tg_email_queue_campaign_counters`). Publicada em `supabase_realtime` para o dashboard ao vivo.

### `email_automations` + `email_automation_enrollments`
Automações disparadas por `trigger_type` ∈ `{lead_created, stage_enter, lead_stage_changed, manual}`. `steps jsonb` define cada passo (`template_slug`, `delay_days`/`delay_minutes`). `trigger_config` aceita `segment_id` para filtrar.

### `email_segments` + `email_segment_contacts`
- `email_segments.filters jsonb` — regras dinâmicas ou lista estática (`kind ∈ {dynamic, static}`).
- `email_segment_contacts` — lista estática de emails. Índice `esc_clinic_created_idx (clinic_id, created_at DESC)`.
- Função `lead_matches_segment(_lead_id, _segment_id)` aplica regras (legado AND ou `rules[]` OR).
- Helper `_email_segment_rule_to_sql(_rule)` cobre: `form_source`, `tag`, `stage`, `has_email`, `utm_campaign`, `created_at_range`, `last_message_at_range`, `deal_value_range` e `custom_field` (R-19).
- RPC `resolve_email_segment(_segment_id)` / `resolve_email_segment_preview(_clinic_id, _filters)` expandem o segmento para `(email, name, lead_id)`.

### `email_unsubscribes`
Opt-outs. Trigger `trg_cancel_pending_on_unsubscribe` cancela emails pendentes para o email descadastrado.

### `email_send_state`
Quota diária por clínica (`sent_today`, `quota_resets_at`). Consumo **atômico** via RPC `claim_email_quota(_clinic_id)` (INSERT … ON CONFLICT) — substituiu a contagem por SELECT/UPDATE separados.

### `email_domains` / `clinic_email_integrations`
- `email_domains`: domínios verificados no Resend. Campos `domain`, `status`, `dns_records jsonb`, `region`, `last_checked_at`. **R-21**: `rotation_pool text` (nome do pool) e `rotation_weight int` (peso para `pick_rotation_domain`).
- `clinic_email_integrations`: chaves API + from_email por clínica. SELECT restrito a admins da clínica (hardening 2026-05-27).

### `email_domain_warmup` (R-15/Tier 2)
Warm-up automático por domínio remetente: 50→100→500→1k→5k→10k→25k→ilimitado/dia. Consumo atômico via RPCs `claim_domain_warmup` / `release_domain_warmup`.

### `email_recipient_throttle` (Tier 2)
Limite por domínio destinatário (default 1000/h). RPC `claim_recipient_throttle`.

### `email_health_alerts` / `email_operational_alerts` (R-16/R-17)
Registro de alertas:
- `email_health_alerts` — bounces/complaints com `action_taken` (pausa de campanha). Trigger `email_logs_bounce_health_trigger` → `check_clinic_bounce_health`: pausa campanhas em execução quando `bounce_rate > 5%` ou `complaint_rate > 0,3%` nas últimas 1000 mensagens.
- `email_operational_alerts` — alertas operacionais: `queue_backlog` (>500 jobs), `stuck_processing` (>10min), `high_failure_rate` (>10%), `domain_warmup_limit`, `recipient_throttle_limit`. Trigger `email_queue_health_trigger` dispara a cada 100 inserts; alimentado por `check_email_operational_health`.

### Views: `email_throughput_stats` / `email_system_health`
Métricas em tempo real:
- `email_throughput_stats` (por clínica): pendentes, enviados, falhos, abertos, cliques, taxas de bounce/complaint.
- `email_system_health` (global): fila total, jobs presos, alertas ativos.

## Sequências / Automações WhatsApp

### `message_sequences`
- `name`, `trigger_type` ∈ `{stage_enter, pipeline_enter, webhook, manual}` (`pipeline_enter` adicionado em 2026-05-28), `trigger_config jsonb`, `enabled bool`, `stop_on_reply bool`, `cooldown_days int`, `public_token text`.

### `message_sequence_steps`
- `sequence_id`, `position int`, `delay_minutes int`, `template_slug`, `body text`.

### `message_sequence_enrollments`
- `sequence_id`, `lead_id`, `status` ∈ `{active, completed, stopped_by_reply, cancelled}`, `current_step`, `next_run_at`, `started_at`, `ended_at`, `source jsonb`.

### `message_sequence_runs`
Log de cada step executado (sucesso/erro). Adicionados em 2026-05-30:
- `replied_at timestamptz` — preenchido quando o lead respondeu após o envio (alimenta métricas de engajamento).
- `stage_id_at_send uuid` + `stage_position_at_send int` — snapshot da stage no momento do envio (atribuição correta mesmo se o lead mudar de stage depois).

### `automations` / `automation_runs`
Automações genéricas (gatilho → ação). Versão mais geral; uso mais reduzido.

## Broadcasts

### `broadcasts`
Disparo em massa de WhatsApp. `status`, `template_slug`, `audience jsonb`, `scheduled_at`, `started_at`, `finished_at`.

### `broadcast_recipients`
Por destinatário. `status` ∈ `{pending, sent, failed, replied}`, `phone`, `replied_at`. Função `broadcast_mark_replied(clinic_id, phone)` é chamada quando entra mensagem inbound.

### `broadcast_message_groups` + `broadcast_message_parts`
Multi-mensagem (texto + mídia + etc.) por broadcast.

### `broadcast_events`
Telemetria (`type` ∈ `{sent, delivered, read, replied, bounced, error}`, `payload jsonb`).

## Forms públicos

### `form_definitions`
Schema de formulários públicos. `fields jsonb`, `slug text UNIQUE`, `redirect_url`, `pipeline_id`, `stage_id`, `tags text[]`.

### `form_submissions`
Submissões. Campos coletados (`payload jsonb`), `lead_id` gerado.

### `form_integrations`
Webhooks externos por form (n8n, Zapier, Make...).

## Tracking (Pixel & atribuição)

### `tracking_visitors`
Cookie-id ↔ first_seen/last_seen. Sem PII direto.

### `tracking_sessions`
Sessão (UTM, referrer, landing_page, device, country).

### `tracking_events`
Pageviews/eventos. `event_name`, `path`, `payload jsonb`.

### `tracking_identity_links`
Vincula `visitor_id` ↔ `lead_id` (quando lead se identifica).

### `tracking_lead_sources`
Primeira fonte atribuída a cada lead.

### `traffic_source_rules`
Regras de normalização de utm/origin para canais (`Google Ads`, `Meta`, etc.).

## IA — Agentes, RAG e observabilidade

### `ai_agents`
Agentes configurados por clínica. `name`, `system_prompt`, `model`, `tools jsonb`, `temperature`, `is_system bool` (semente). Trigger `ai_agents_prevent_system_delete` impede deletar agentes de sistema.

### `ai_threads` / `ai_messages`
Conversas com agentes (usadas no chat interno e na auto-resposta). `ai_messages.role` ∈ `{system, user, assistant, tool}`.

### `ai_documents` / `ai_chunks`
Base de conhecimento RAG. `ai_chunks` tem `embedding vector(1536)`, `tsv tsvector` para busca híbrida. Funções: `match_chunks`, `match_chunks_hybrid` (RRF de vetor + FTS).

### `agent_memory`
Memória de longo prazo do agente (com embedding). Função `match_memories`.

### `ai_insights`
Insights gerados sobre conversas/leads (resumos, classificações).

### `ai_usage`
Log granular de cada chamada LLM. Campos: `model`, `tokens_in`, `tokens_out`, `cost_usd numeric`, `feature text`, `latency_ms`. Trigger `trg_ai_usage_spend_guard` agrega e dispara `ai_spend_events` ao cruzar limites.

### `ai_usage_daily`
Agregação diária (materializada via job ou trigger) para dashboards.

### `ai_spend_limits` / `ai_spend_events` / `ai_spend_notifications_sent`
Sistema de limite de gasto (ver `flows/AI_SPEND_GUARD.md` quando documentado). Limits por clínica (daily/monthly), warn thresholds, modo de bloqueio. Eventos disparam edge function `ai-spend-notify`.

### `agent_traces`
Trace estruturado de cada execução de agente (steps, ferramentas, tokens, erros). Limpos após 14 dias.

### `agent_evals`
Avaliações qualitativas (rating + notes) sobre runs.

### `agent_mcp_servers`
Servidores MCP conectados por agente.

### `rag_cache` / `embedding_cache`
Caches de resultados de RAG e embeddings. Limpos por `cleanup_agent_caches()`.

### `lead_reply_counters`
Janela horária (`hour_bucket`) usada para rate-limit de auto-reply por lead.

### `ai_agent_drafts`
Estado de progresso do **wizard de criação de agente** (`/agents/new`). Campos: `user_id`, `step int`, `niche`/`niche_other`, `goal`/`goal_other`, `provider`, `api_key`, `base_url`, `model`, `provider_verified_at`, `interview_answers jsonb`, `generated_prompt`, `settings jsonb`. Persiste o rascunho entre sessões.

### `agent_personas`
Personas (clientes-teste) associadas a um agente para playground e simulação. Campos: `agent_id`, `name`, `phone`, `channel`, `persona_text`, `custom_fields jsonb`, `opening_message`, `tags text[]`, `created_by`.

### `agent_prompt_versions`
Histórico de versões do `system_prompt` de cada agente. Campos: `agent_id`, `prompt text`, `source text` (manual/auto/import), `summary`, `created_by`.

### `agent_stages`
Estágios sequenciais opcionais de um agente (fluxo de qualificação multi-etapa). Campos: `agent_id`, `order_idx`, `name`, `goal`, `system_prompt_delta`, `advance_when`, `allowed_tools text[]`, `follow_up_after_min`, `follow_up_message`, `follow_up_tool_name`.

### `ai_kb_defaults`
Documentos de KB padrão (globais, sem `clinic_id`) usados para popular novas KBs. Campos: `slug UNIQUE`, `title`, `content`, `position`, `enabled`, `niche`.

### `ai_chat_traces`
Trace simplificado de cada turno do agente no **chat playground** (`/agents/[id]/chat`). Campos: `agent_id`, `source`, `lead_id`, `persona_id`, `user_message`, `agent_message`, `system_prompt_excerpt`, `kb_hits jsonb`, `tool_calls jsonb`, `model`, `tokens_in`, `tokens_out`, `latency_ms`, `stage_meta jsonb`. Diferente de `agent_traces` (estruturado, full) e `ai_usage` (cost).

### `lead_thread_classifications`
Rótulos manuais aplicados pelo atendente a uma thread (`label`, `note`, `anchor_message_id`). Suporta promoção a `agent_evals` via `promoted_eval_id`.

## Builder / Lovable Agent

### `builder_manual_versions`
Versões do "manual" interno usado pelo agente Lovable (instruções de plataforma). Campos: `version int`, `content text`, `summary`, `source`, `published_at`, `published_by`, `is_active bool`. Função `get_active_builder_manual()` retorna a versão ativa.

## Email — agregações & webhooks adicionais

### `email_metrics_daily`
Materialização diária por `(clinic_id, day, template_slug)`: `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `failed`. Alimenta dashboards históricos sem varrer `email_logs` inteiro.

### `resend_webhook_events`
Idempotência de webhook Resend: `svix_id` (UNIQUE no provedor), `event_type`, `resend_id`, `received_at`. Edge `resend-webhook` faz upsert antes de processar para garantir entrega exactly-once.

## Relatórios agendados (WhatsApp)

### `scheduled_reports`
Relatórios recorrentes enviados para um grupo de WhatsApp. Campos: `instance_id`, `group_jid`, `group_name`, `send_time text` (HH:MM), `tz`, `weekdays int[]`, `metrics jsonb`, `enabled bool`, `last_sent_at`, `last_status`, `last_error`.

### `scheduled_report_runs`
Histórico de execuções: `report_id`, `status`, `message_preview`, `metrics jsonb`, `error`.



## Indices relevantes

- `ai_chunks` — IVFFlat/HNSW em `embedding`, GIN em `tsv`.
- `messages` — `(clinic_id, lead_id, created_at)`, `wa_message_id UNIQUE`.
- `leads` — `(clinic_id, stage_id)`, `(clinic_id, phone)`, `leads_clinic_created_email_idx (clinic_id, created_at DESC) WHERE email IS NOT NULL` (acelera resolução de segmentos dinâmicos).
- `email_queue` — `(clinic_id, status, scheduled_at)`, `email_queue_pending_priority_idx (clinic_id, status, priority, scheduled_at)`.
- `email_segment_contacts` — `esc_clinic_created_idx (clinic_id, created_at DESC)`.
- `tracking_events` — `(clinic_id, visitor_id, created_at)`.

> Lista completa em `pg_indexes` (filtrar por `schemaname='public'`).

## Foreign Keys

113 FKs no schema `public`. Padrão: toda tabela referenciando `leads`, `pipelines`, `clinics` etc. usa `ON DELETE CASCADE` ou `SET NULL` conforme o caso. Use `psql -c "SELECT ... FROM pg_constraint WHERE contype='f'"` para lista completa.

## Realtime

Tabelas no publication `supabase_realtime` (assinaturas em tempo real do frontend):
`campaign_throughput`, `email_campaigns`, `email_logs`, `email_queue`, `lead_internal_notes`, `lead_tasks`, `leads`, `messages`, `pipeline_stages`, `pipelines`, `scheduled_messages`, `task_assignees`, `task_attachments`, `task_boards`, `task_checklist_items`, `task_columns`, `task_label_links`, `task_labels`, `tasks`, `webhook_events`.

`campaign_throughput` e `email_campaigns` foram adicionadas em 2026-05-27 com `REPLICA IDENTITY FULL` para alimentar o painel ao vivo de campanhas.

Ver `architecture/REALTIME.md` para padrão de uso no frontend.

## Pitfalls do schema

- `clinic_members.user_id` é `UNIQUE` — um usuário não pode pertencer a duas clínicas. Mudar isso exige revisar `current_clinic_id()`.
- Várias tabelas têm trigger `assert_clinic_id_not_null` que **deriva** `clinic_id` de FKs (`agent_id`, `lead_id`, `thread_id`). Se um insert não tiver nenhum desses, falha com `clinic_id_required`.
- `email_queue.related_lead_table` é usado também como **contexto/escopo** (ex.: `campaign_<uuid>`, `auto_<uuid>`), não apenas como nome de tabela. Não filtre por igualdade com `'leads'` esperando todos os emails de leads.
- `messages.wa_message_id` pode ser `NULL` para mensagens internas; `UNIQUE` permite múltiplos NULL.
- `ai_chunks.embedding` é `vector(1536)`. Trocar de modelo de embedding exige reindexar tudo.
- `email_campaigns.segment_ids` **vazio** (`'{}'`) significa "todos os leads", **não** "nenhum destinatário". A coluna legada `segment_id` continua existindo para retro-compat (sincronizada apenas quando há exatamente 1 segmento).
- `email_queue.priority` é `smallint` com default 10. Valores menores são processados antes; transacional usa `1`, campanhas usam `5`. Esquecer de preencher faz o job ficar no fim da fila.
- `email_send_dedup` é a fonte de verdade de idempotência. Reenviar o mesmo template para o mesmo destinatário no mesmo dia exige preencher `force_send=true` no job da fila.
- `email_domains.rotation_pool` precisa estar **igual** no `email_campaigns.from_domain_pool` para que o RPC `pick_rotation_domain` encontre o conjunto. Pools nomeados são case-sensitive.
