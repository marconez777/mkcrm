---
title: FUNCTIONS_TRIGGERS — Funções e Triggers
topic: database
kind: reference
audience: agent
updated: 2026-06-07
summary: Todas são `SECURITY DEFINER` com `search_path = public` e abrem com `IF NOT public.is_super_admin() THEN RAISE EXCEPTION '...' END IF;`. Introduzidas pela migração de jun/2026 para alimentar o painel `/admin` v2.
---
# FUNCTIONS_TRIGGERS — Funções e Triggers

> Última atualização: 2026-06-03
> Fonte: `pg_proc` (schema `public`) e `information_schema.triggers`.
> Funções da extensão `vector` (pgvector) são listadas em `pg_proc` mas omitidas aqui — fazem parte do extension e não devem ser modificadas.

## Regras gerais

- Toda função do projeto declara `SET search_path = public` (evita `search_path` injection).
- Funções que precisam ler/escrever atravessando RLS são `SECURITY DEFINER` e definem `search_path` explicitamente.
- Funções `STABLE` quando não modificam estado; `IMMUTABLE` apenas para puras (ex.: hashing).
- Não há triggers em schemas reservados (`auth`, `storage`, `realtime`, `vault`, `supabase_functions`).

---

## Funções helper (segurança / tenancy)

### `current_clinic_id() → uuid`
Retorna a clínica do usuário autenticado. Lê `clinic_members WHERE user_id = auth.uid()` ordenado por `created_at` (estável). **STABLE SECURITY DEFINER**.

### `current_clinic_role() → clinic_role`
Role do user na sua clínica atual.

### `has_clinic_access(_clinic_id uuid) → bool`
`is_super_admin() OR EXISTS(clinic_members ...)`. Usada em policies cross-tenant e em funções de relatório.

### `is_clinic_admin(_user_id uuid = auth.uid()) → bool`
True se role é `owner` ou `admin` na clínica corrente.

### `is_super_admin(_user_id uuid = auth.uid()) → bool`
True se existe row em `user_roles` com `role='super_admin'`.

### `clinic_has_feature(_clinic_id, _key) → bool`
Lê `clinics.settings.features.<key>`. Default true (feature liberada salvo se explicitamente `"false"`).

### `current_clinic_has_feature(_key) → bool`
Atalho de `clinic_has_feature(current_clinic_id(), _key)`.

---

## Funções de admin (super admin only)

Todas são `SECURITY DEFINER` com `search_path = public` e abrem com `IF NOT public.is_super_admin() THEN RAISE EXCEPTION '...' END IF;`. Introduzidas pela migração de jun/2026 para alimentar o painel `/admin` v2.

### `admin_overview_metrics() → jsonb`
KPIs cross-tenant para a aba **Dashboard** do `/admin`. Retorna um único jsonb com chaves agrupadas: `clinics` (total/active/suspended/new_30d), `users` (total/active_7d/new_month), `whatsapp` (sent/recv/failed nos últimos 30d), `ai` (usd_total, tokens, requests 30d), `email` (sent/opened/clicked 30d), `leads` (new/converted 30d).

### `admin_top_clinics(_limit int DEFAULT 5) → setof record`
Ranking das top clínicas consolidando múltiplas métricas em uma chamada. Retorna `(clinic_id uuid, clinic_name text, messages_30d numeric, ai_usd_30d numeric, emails_30d numeric, leads_30d numeric)`. (Assinatura **não** aceita `_metric` — agregação completa por design para reduzir round-trips.)

### `admin_clinic_usage(_clinic uuid) → jsonb`
Snapshot consolidado da clínica (não recebe intervalo — usa janelas fixas internas: 30d para volumes, mês corrente para spend). Consumido pelo drawer de detalhes da aba **Clínicas** do `/admin`.

### `admin_daily_metrics(_days int DEFAULT 30) → setof record`
Série diária global (cross-tenant) com mensagens, IA USD, emails e leads. Alimenta o gráfico de tendência da aba **Dashboard** do `/admin`.

---

## Funções de manutenção (chamadas por cron)

### `cleanup_agent_caches() → void`
Limpa `rag_cache` (>1h), `webhook_dedup` (expirado), `lead_reply_counters` (>7d), `agent_traces` (>14d), `ai_usage` (>90d), `embedding_cache` (>30d).

### `cleanup_webhook_events() → void`
Remove `webhook_events` com `received_at < now() - 14d`.

### `cleanup_webhook_dedup() → void`
Remove `webhook_dedup` expirado.

### `reset_email_send_state() → void`
Zera `sent_today` e avança `quota_resets_at` para clínicas cujo `quota_resets_at <= now()`.

> Os jobs do `pg_cron` que invocam essas funções estão em `cron.job` (não acessível via tools — usar dashboard). Tipicamente rodam a cada 5–15 min.

### `check_email_operational_health() → void`
Detecta backlog (>500 jobs na fila), jobs presos em `processing` (>10min) e taxa de falha alta por clínica (>10% nas últimas 100 mensagens). Insere em `email_operational_alerts`. Chamada pelo trigger `email_queue_health_trigger` (a cada ~100 inserts na fila).

### `check_clinic_bounce_health(_clinic_id uuid) → void`
Calcula `bounce_rate` e `complaint_rate` nas últimas 1000 mensagens da clínica. Se passar dos limites (5% / 0,3%), **pausa automaticamente** campanhas em execução e grava `email_health_alerts`. Chamada pelo trigger `email_logs_bounce_health_trigger`.

---

## Triggers utilitárias

### `set_updated_at() / set_updated_at_generic()`
BEFORE UPDATE — seta `NEW.updated_at = now()`. Aplicada em ~40 tabelas (ver lista em `pg_trigger`).

### `assert_clinic_id_not_null()`
BEFORE INSERT — se `NEW.clinic_id IS NULL`, tenta derivar a partir de `agent_id`, `lead_id` ou `thread_id`. Lança `clinic_id_required` se nada funciona. Aplicada em: `agent_memory`, `agent_traces`, `ai_insights`, `ai_usage`, `lead_events`, `lead_tasks`.

---

## Triggers de domínio

### `handle_new_user()` em `auth.users` AFTER INSERT
1. Cria row em `profiles` (idempotente).
2. Promove `contato@mkart.com.br` a `super_admin`.
3. Aceita o invite mais recente válido (se houver) e cria `clinic_members`.

### Em `clinics`
- `clinics_guard_features` BEFORE UPDATE — bloqueia mudanças em `settings.features` se não for super_admin (`guard_clinic_features()`).
- `clinics_seed_system_agents` AFTER INSERT — chama `seed_system_agents(NEW.id)` para criar agentes default.

### Em `leads`
| Trigger | Quando | Faz |
|---|---|---|
| `trg_leads_sync_pipeline` | BEFORE INS/UPD | Preenche `pipeline_id` a partir de `stage_id` (`sync_lead_pipeline_id`) |
| `leads_stage_changed` | BEFORE UPDATE | Atualiza `stage_changed_at` quando muda stage |
| `leads_updated` | BEFORE UPDATE | `updated_at = now()` |
| `log_lead_changes_trg` | AFTER UPDATE | Insere em `lead_events` (stage_changed, attendant_changed) |
| `trg_lead_stage_history` | AFTER UPDATE | Insere em `lead_stage_history` com `moved_by_user_id` |
| `trg_enroll_on_stage_change` | AFTER UPDATE | Cria enrollments em `message_sequences` (trigger `stage_enter`) |
| `trg_email_on_lead_created` | AFTER INSERT | Enfileira emails de `email_automations` com `trigger_type='lead_created'` |
| `trg_email_on_stage_change` | AFTER UPDATE | Enfileira emails de `email_automations` com `trigger_type='stage_change'` |

### Em `messages`
- `trg_stop_sequences_on_reply` AFTER INSERT — se `from_me=false`, marca enrollments `stop_on_reply=true` como `stopped_by_reply`.

### Em `pipelines`
- `trg_enforce_pipeline_kind_instance` BEFORE INS/UPD — força `whatsapp_instance_id=NULL` quando `kind='internal'`.

### Em `email_unsubscribes`
- `trg_cancel_pending_on_unsubscribe` AFTER INSERT — chama `cancel_pending_emails_for(clinic_id, email)` para invalidar fila.

### Em `email_queue`
- `trg_email_queue_campaign_counters` AFTER INSERT/UPDATE — incrementa `campaign_throughput` quando `sent_at` vai de NULL → preenchido. **Idempotente** (só conta uma vez por linha — adicionado em 2026-05-28).
- `email_queue_health_trigger` AFTER INSERT (statement-level, a cada ~100 rows) — chama `check_email_operational_health()`.

### Em `email_logs`
- `trg_email_logs_suppress_on_bounce` AFTER INSERT/UPDATE — adicionado em 2026-05-28; gera `email_unsubscribes` (suppression) quando `bounced_at` é preenchido com `bounce_type='hard'` ou `complained_at`.
- `email_logs_bounce_health_trigger` AFTER INSERT/UPDATE — chama `check_clinic_bounce_health(clinic_id)`.

### Em `email_domain_warmup`
- `touch_email_domain_warmup` BEFORE UPDATE — set `updated_at = now()`.

### Em `message_sequences`
- Constraint `message_sequences_trigger_type_check` (2026-05-28) — `trigger_type IN ('stage_enter','pipeline_enter','webhook','manual')`.

### Em `ai_agents`
- `ai_agents_prevent_system_delete` BEFORE DELETE — bloqueia delete de agentes com `is_system=true`.

### Em `ai_usage`
- `trg_ai_usage_spend_guard` AFTER INSERT — chama `ai_usage_spend_guard()` que agrega gasto diário/mensal por clínica em `ai_spend_events` e, se ultrapassar limites em `ai_spend_limits`, marca `block`/`warn`. (Função adicionada em migration de 2026-05-25.)

---

## Funções de negócio (chamadas pelo app/edge)

### `accept_clinic_invite(_token text) → uuid`
SECURITY DEFINER. Validações: user autenticado, invite existe, não expirou, email do invite == email do user. Insere `clinic_members` (ON CONFLICT user_id DO NOTHING) e marca invite como aceito.

### `enqueue_email(...) → uuid`
Insere em `email_queue` respeitando: feature flag `email_marketing`, dedup, template ativo. Retorna `NULL` se bloqueado. **Use sempre essa função** ao invés de INSERT direto.

### `cancel_pending_emails_for(clinic_id, email) → int`
Marca emails pendentes (não `force_send`) como `cancelled`. Chamada pelo trigger de unsubscribe.

### `lead_matches_segment(_lead_id, _segment_id) → bool`
Avalia filtros do segmento. Suporta dois formatos:
- **Legado** (filters root-level, AND): `has_email`, `tags[]`, `stage_id`.
- **Novo** (`filters.rules[]`, OR): `form_source`, `tag`, `stage`, `has_email`, `utm_campaign`.
- Tipo `static`: matcheia se email do lead está em `email_segment_contacts`.

### `generate_unsubscribe_token(clinic_id, email) → text`
HMAC-SHA256 com `unsubscribe_hmac_secret` (de `app_settings`). Determinístico.

### `verify_unsubscribe_token(clinic_id, email, token) → bool`
Compara token com o gerado. Constante-time não garantido — aceitável para esse uso.

### `broadcast_mark_replied(clinic_id, phone) → void`
Atualiza `broadcast_recipients` e grava evento em `broadcast_events`.

### `enroll_lead_on_stage_change()` (trigger function)
Para cada `message_sequence` ativa com trigger `stage_enter` casando, cria enrollment respeitando `cooldown_days`.

### `stop_sequences_on_reply()` (trigger function)
Ver acima (trigger em `messages`).

### `record_lead_stage_history()` (trigger function)
Insere em `lead_stage_history` com `auth.uid()`. Cuidado: quando chamado de edge function via service_role, `auth.uid()` é NULL.

### `log_lead_changes()` (trigger function)
Insere `stage_changed` e `attendant_changed` em `lead_events`.

### `tg_email_on_lead_created()` / `tg_email_on_stage_change()`
Iteram `email_automations` da clínica e enfileiram via `enqueue_email()`, aplicando `lead_matches_segment` se o automation tem `trigger_config.segment_id`.

### `seed_system_agents(_clinic_id)` + trigger `tg_seed_system_agents_on_clinic`
Cria agentes padrão (atendimento, qualificação, etc.) para nova clínica.

### `increment_unread(p_lead_id, p_preview, p_ts) → void`
Incrementa `unread_count` e atualiza `last_message_*` no lead (usado pelo webhook do WhatsApp).

### `report_campaign_stats(clinic_id, campaign_id)` → table
Estatísticas agregadas de campanha de email: enviado, entregue, aberto, clicado, rejeitado, reclamado, falhado + taxas + melhor hora + breakdown horário JSONB. Valida `has_clinic_access(clinic_id)`. Adicionada em 2026-05-27.

### `report_template_stats(clinic_id, template_slug, _from, _to)` → table
Mesma assinatura da anterior, mas agregando por `template_slug` numa janela de tempo (default 30 dias). Usada pelo dashboard de templates.

### `log_agent_trace(...)`
Insere em `agent_traces`. Deriva `clinic_id` a partir de `agent_id` / `lead_id` / `thread_id`.

### Email — quota & throttling

#### `claim_email_quota(_clinic_id uuid)` → `(allowed bool, sent_today int, quota int)`
Consumo **atômico** da cota diária. Insert/upsert em `email_send_state` com `ON CONFLICT`; se a janela expirou, reseta. Retorna `allowed=false` quando a cota seria estourada (e nesse caso decrementa de volta para não "consumir" indevidamente). Substituiu a contagem SELECT/UPDATE separada que tinha race condition.

#### `claim_domain_warmup(_clinic_id uuid, _domain text)` → `(allowed bool, sent_today int, daily_cap int)`
Tier 2 / R-15. Consome 1 vaga no warm-up automático de um domínio remetente. `release_domain_warmup(_clinic_id, _domain)` devolve a vaga quando o envio falha.

#### `claim_recipient_throttle(_clinic_id uuid, _domain text)` → `(allowed bool, sent_in_window int, cap int)`
Tier 2. Limite por **domínio destinatário** (default 1000/h), janela rolante de 1 hora.

#### `pick_ab_winner(_campaign_id uuid)` → uuid
R-20. Seleciona variante vencedora de uma campanha por melhor taxa de abertura/clique. Marca `is_winner=true` e atualiza `email_campaigns.winner_picked_at`.

#### `pick_rotation_domain(_clinic_id uuid, _pool text)` → text
R-21. Sorteio ponderado (`weighted random`) entre `email_domains` com `rotation_pool = _pool` e `status='verified'`. Retorna o domínio escolhido para preencher `email_queue.from_domain_override`.

### Segmentos (helpers internos)

#### `_email_segment_rule_to_sql(_rule jsonb)` → text
Converte uma regra individual (`type ∈ {form_source, tag, stage, has_email, utm_campaign, created_at_range, last_message_at_range, deal_value_range, custom_field}`) numa expressão SQL parametrizada. Suporta flag `negate` (NOT) por regra.

#### `_email_segment_filters_to_where(_filters jsonb)` → text
Junta as regras usando `match ∈ {any, all}` (default `any` = OR). Faz fallback para os campos legados (`tags`, `stage_id`, `stage_ids`, `has_email`) quando `rules[]` está vazio.

#### `resolve_email_segment(_segment_id uuid)` → `TABLE(email, name, lead_id)`
Materializa um segmento (`dynamic` ou `static`). `dispatch-campaign` chama uma vez por id em `email_campaigns.segment_ids[]` e une os resultados (dedup por email) antes de enfileirar.

#### `resolve_email_segment_preview(_clinic_id uuid, _filters jsonb)` → `TABLE(email, name, lead_id)`
Preview ao vivo dos filtros (sem precisar de segmento persistido). Limite hard-coded de 5000 linhas. Usado em `CampaignRecipientsPreview` e no editor de segmentos.

### Engajamento (relatórios)

#### `engagement_broadcasts_summary(_from timestamptz, _to timestamptz)` → table
Métricas agregadas de broadcasts (enviados, respondidos, taxa de resposta). **REVOKE EXECUTE FROM PUBLIC, anon** (2026-05-30) — acessível só a `authenticated`. Tenant scoping via `current_clinic_id()` dentro da função.

#### `engagement_sequences_summary(_from, _to)` → table
Mesma ideia para sequências (envios, respostas, conversão por step). Idem revoke.

#### `engagement_sequence_steps(_sequence_id uuid, _from, _to)` → table
Drill-down por step de uma sequência específica. Idem revoke.

---

## Funções RAG (pgvector)

### `match_chunks(query_embedding, p_agent_id, match_count=5)`
KNN por cosine distance em `ai_chunks.embedding`.

### `match_chunks_hybrid(query_embedding, query_text, p_agent_id, match_count=20)`
Reciprocal Rank Fusion entre vetorial (`<=>`) e FTS (`tsv @@ plainto_tsquery('portuguese', ...)`).

### `match_memories(query_embedding, p_agent_id, p_lead_id, match_count=3)`
KNN em `agent_memory` filtrado por agente e (opcional) lead.

---

## Funções de infra

### `invoke_edge_function(_function_name, _body) → bigint`
Chama uma edge function via `pg_net.http_post` usando `cron_service_role_key` e `supabase_url` de `app_settings`. Retorna `request_id` do `pg_net`. Usada por jobs do `pg_cron`. **Não chamar do app** — usar `supabase.functions.invoke` do client.

> **Setup obrigatório**: `app_settings` deve ter `cron_service_role_key` (não PLACEHOLDER) e `supabase_url`. Sem isso, jobs do cron emitem `NOTICE` e não fazem nada.

---

## Pitfalls

- **`auth.uid()` em SECURITY DEFINER chamado por service_role retorna NULL.** Funções como `record_lead_stage_history` gravam `NULL` em `moved_by_user_id` quando o stage muda via webhook — comportamento desejado, mas tem que estar ciente.
- **Triggers em `leads` rodam em cascata.** Um UPDATE de `stage_id` dispara 5+ triggers AFTER. Em batch updates grandes, considere `SET session_replication_role = 'replica'` (apenas em manutenção controlada).
- **`trg_email_on_stage_change` ainda não consta na lista de triggers** (não foi listada no dump anterior). Verifique se foi criada — caso contrário, automações por mudança de stage não disparam.
- **`enqueue_email` retorna NULL silenciosamente** quando a feature `email_marketing` está OFF ou o template não existe/está inativo. Ao chamar do código, logue resposta.
- **`assert_clinic_id_not_null` derivação**: se o INSERT envia `clinic_id=NULL` propositalmente sem ter FK preenchida, falha com `23502 clinic_id_required`. Sempre passe `clinic_id` explicitamente.
- **`cleanup_*` funções não rodam se o cron não estiver configurado.** Verifique `cron.job` periodicamente.
- **`tg_email_queue_campaign_counters` é idempotente** desde 2026-05-28: só conta quando `sent_at` vai de NULL → preenchido. Antes podia inflar `campaign_throughput` em UPDATEs repetidos.
- **RPCs `engagement_*` não são executáveis por `anon`/`PUBLIC`** desde 2026-05-30. Chamar a partir do frontend exige sessão autenticada.
- **`pick_rotation_domain` retorna NULL** se nenhum domínio do pool está `status='verified'`. `send-email-batch` então cai no `from` default da clínica.
- **`claim_email_quota` decrementa de volta** quando ultrapassa o limite, mas isso vira uma operação dupla (insert + update). Em alto volume vale monitorar contenção em `email_send_state`.

## Lista completa

Para listagem programática:

```sql
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'vector%' AND p.proname NOT LIKE 'halfvec%'
  AND p.proname NOT LIKE 'sparsevec%'
ORDER BY p.proname;
```

```sql
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers WHERE trigger_schema='public'
ORDER BY event_object_table, trigger_name;
```
