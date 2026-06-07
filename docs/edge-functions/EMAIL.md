---
title: Email Marketing — Documentação Detalhada
topic: email
kind: reference
audience: agent
updated: 2026-06-07
summary: "O módulo de Email é um sistema completo de envio transacional + campanhas com:"
---
# Email Marketing — Documentação Detalhada

> Referência completa do módulo de Email Marketing do CRM mkart.
> Cobre: telas, edge functions, tabelas, fluxos, integrações (Resend), helpers e regras de negócio.
> Última atualização: 2026-05-27.

---

## 1. Visão geral

O módulo de Email é um sistema completo de envio transacional + campanhas com:

- **Templates** (editor visual em blocos + HTML cru) com pastas
- **Campanhas** (template + segmento + agendamento)
- **Automações** (drip triggered por eventos de lead)
- **Segmentos** salvos com filtros JSON
- **Fila** persistente com retry/backoff/idempotência
- **Domínios próprios por clínica** verificados via Resend (SPF/DKIM/DMARC)
- **Cota diária** por clínica
- **Suppression list** (descadastros, bounces, complaints)
- **Tracking** (delivered/opened/clicked) via webhook do Resend
- **Página pública de descadastro** assinada por token

**Provedor**: Resend.
**Gate de feature**: `email_marketing` (em `clinics.settings.features`).
**Acesso**: rotas `/email/*` e `/settings/email`. Configuração de domínio é feita por **super admin**.

---

## 2. Telas

Todas em `src/pages/email/`. O hub (`/email`) é um `Tabs` que troca o conteúdo entre as sub-páginas.

### 2.1 `EmailHub.tsx` (`/email`)
Container com 10 abas: Dashboard, Templates, Automações, Campanhas, Relatórios, Segmentos, **Contatos**, Fila, Logs, Descadastros. Sincroniza a tab ativa com `location.pathname` via React Router (cada aba é uma rota dedicada).

### 2.2 `EmailDashboard.tsx` (`/email`)
Visão geral em tempo real:
- Filtros: período (24h / 7d / 30d) + template.
- Cards de KPI: enviados, entregues, abertos, clicados, bounces, falhas.
- Gráficos (Recharts): séries temporais (Area), pizza de status, barras por template.
- Tabela com os logs recentes.
- Fonte: `email_logs` + agregação client-side (deduplicação por `id` do log, não por `message_id` — cada `email_logs.id` já representa um envio único).

### 2.3 `EmailTemplates.tsx` (`/email/templates`)
Lista de templates organizados por **pastas** (`email_template_folders`).
- Criar/excluir pastas.
- Criar template a partir do zero (abre o editor) ou duplicar.
- Toggle `active`.
- Enviar teste rápido para um email arbitrário (chama `send-email` com `force: true` + `related_lead_table = "quick_test_<id>"`).
- Slug auto-gerado a partir do nome; precisa casar `/^[a-z][a-z0-9-]*$/`.

Campos do template (`email_templates`):
`name, slug, subject, preheader, from_name, from_email, reply_to, category, html_body, text_body, blocks_json, folder_id, active, version, variables_schema, is_preset, preset_label`.

### 2.4 `EmailTemplateEditor.tsx` (`/email/templates/:id`)
Editor visual de 3 colunas (DnD-kit):

1. **Palette** (`components/email/editor/Palette.tsx`) — paleta de blocos (Título, Parágrafo, Imagem, CTA, Divisor, Espaço, Avatar, Assinatura, YouTube, Colunas, HTML cru).
2. **Canvas** (`components/email/editor/Canvas.tsx`) — área central com os blocos arrastáveis/reordenáveis.
3. **Inspector** (`components/email/editor/Inspector.tsx`) — propriedades do bloco selecionado (cor, tamanho, alinhamento, href, etc).

Recursos:
- **Tiptap** (rich text) para blocos de parágrafo (`TipTapEditor.tsx`).
- **Autosave** debounced.
- **Preview** modal (renderiza HTML final com variáveis sample).
- **Importar HTML** (substituir ou anexar) — converte via `htmlToBlocks`.
- **Ver/editar HTML cru** em diálogo.
- **Enviar teste** com `force: true` (ignora suppression e idempotência).
- Validação: bloqueia salvar se o HTML não contiver `{{ unsubscribe_url }}` (compliance).

Modelo interno em `src/lib/email/types.ts` (`EmailBlock`). Renderização: `blocksToHtml.ts`. Higienização: `sanitize.ts`. Variáveis disponíveis: `src/lib/email/variables.ts`.

### 2.5 `EmailCampaigns.tsx` (`/email/campaigns`)
CRUD de campanhas (`email_campaigns`):
- Selecionar template (ativo) + segmento (opcional) + agendamento + `from_name_override` + `from_domain_pool` + `send_rate_per_minute`.
- **Pré-visualizar destinatários**: `CampaignRecipientsPreview` mostra amostra do segmento resolvido.
- **A/B variants** (R-20): editar `email_campaign_variants` (label, weight, overrides de subject/template/from_name) com `variant_strategy = 'none' | 'ab' | 'multi'`.
- **Enviar agora**: invoca `dispatch-campaign` com o `campaign_id`.
- **Enviar teste** (Beaker): `dispatch-campaign` com `test_only: true` e `test_email_override` — usa amostra de 1 lead do segmento para preencher variáveis.
- **Pause / Resume**: alterna `status='paused'` ↔ `sending/scheduled`. Pausar bloqueia novo dispatch; jobs já enfileirados continuam.
- **Duplicar**: copia template, segmento, variants e configurações para uma nova campanha em `draft`.
- **Acompanhar ao vivo**: `CampaignLiveDialog` mostra throughput em tempo real (view `campaign_throughput`) com `ThroughputChart`, `RadialProgress` e `LivePulseDot`.
- Mostra status: `draft | scheduled | sending | sent | paused | failed`.
- Totais: `total_recipients`, `enqueued_count`, `sent_count`, `failed_count`.

### 2.6 `EmailAutomations.tsx` (`/email/automations`)
Drip automatizado (`email_automations`):
- Triggers: `lead_created`, `lead_stage_changed`, `lead_tag_added`.
- Steps: lista `[{ template_slug, delay_minutes }]` (helpers `toDays/toHours/toMinutes`).
- Presets: `welcome`, `warmup` (3 emails / 7 dias), `reactivation`.
- Toggle `active`.

Processamento por `email-automations-tick` (cron a cada 5 min). Ver §3.10.

### 2.7 `EmailSegments.tsx` (`/email/segments`)
Filtros salvos sobre `leads` (`email_segments`):
- Formulário JSON em textarea (ex.: `{ "tags": ["lead"], "stage_ids": ["uuid"] }`).
- Pré-visualização: conta quantos leads casam.
- Filtros suportados pelo `dispatch-campaign`: `tags` (overlaps), `stage_ids` (in).

### 2.8 `EmailContacts.tsx` (`/email/contacts`)
Gestão da base de contatos para campanhas. Unifica duas fontes:
- **Leads** da clínica (`leads` com `email NOT NULL`, limit 2000).
- **Contatos manuais** (`email_segment_contacts`) — inseridos um a um ou via import de CSV/XLSX (usando `xlsx`).

Funcionalidades:
- Filtros: busca por email/nome, origem (`lead | manual`), segmento.
- Adicionar contato manual com seleção opcional de segmento.
- **Importar planilha** com mapeamento de colunas (`email`, `nome`) e segmento de destino; dedup local + insert em lotes de 500.
- **Exportar CSV** com os contatos filtrados.
- Excluir contato (manual → `email_segment_contacts`; lead → `leads`).
- Stats no topo: total único, leads, manuais.

> Contatos sem segmento contam como "contatos gerais" e entram em campanhas que miram "todos os leads".

### 2.9 `EmailQueue.tsx` (`/email/queue`)
Inspetor da fila:
- Tabela de `email_queue` (limit 200, ordem por `created_at desc`).
- Filtro por status: `pending | sending | sent | failed | cancelled`.
- Botão **"Processar agora"**: invoca `process-email-queue` manualmente.
- Mostra `attempts`, `scheduled_at`, `error`.


### 2.10 `EmailLogs.tsx` (`/email/logs`)
Histórico de envios (`email_logs`, até 500 linhas):
- Busca por `recipient_email` (ilike).
- Filtro por status: `sent | delivered | opened | clicked | bounced | complained | failed`.
- Colunas: destinatário, template, assunto, status, `sent_at`, `delivered_at`, `opened_at`, `clicked_at`, erro.

### 2.11 `EmailReports.tsx` (`/email/reports`)
Relatórios agregados (7d / 30d / 90d):
- KPIs: enviados, entregues, abertos, clicados, bounces, complaints, falhas.
- Taxas: `open_rate`, `click_rate`, `bounce_rate`.
- Melhor horário (heurístico).
- Gráfico de barras por hora do dia.
- Botão de export CSV.

### 2.12 `EmailUnsubscribes.tsx` (`/email/unsubscribes`)
Lista de descadastros da clínica (`email_unsubscribes`).
- Origem: `user-link` (clicou no email), `resend-webhook` (bounce/complaint), `backfill`, etc.
- Reativação: apenas admin pode deletar entry (RLS).

### 2.13 `SettingsEmailDomain.tsx` (`/settings/email`)
Configuração do domínio remetente da clínica:
- Lista `email_domains` da clínica (read-only para clínica; CRUD é super admin).
- Renderiza `DnsWizard` para cada domínio.
- Padrões de envio salvos em `clinics.settings.email = { from_name, reply_to }`.
- Sem domínio: exibe instrução para pedir ao suporte abrir o domínio.

### 2.14 `src/pages/Unsubscribe.tsx` (`/unsubscribe`) — pública
Página de descadastro sem auth.
- Lê `clinic`, `email`, `token` da query string.
- 1) `action: "validate"` na função `email-unsubscribe`.
- 2) Mostra botão "Confirmar descadastro".
- 3) Em sucesso: `action: "unsubscribe"`; permite "Reativar" depois.
- Estados: `validating | ready | done | reactivated | error`.

### 2.15 `components/email/DnsWizard.tsx`
Assistente DNS para o domínio:
- Agrupa registros em **SPF**, **DKIM**, **DMARC** (classifica por `name`/`type`/`value`).
- Mostra status por grupo: `verified | pending | failed | missing`.
- Copy-to-clipboard de cada registro.
- Botão **Re-verificar**: invoca `email-domain-manage` com `action: "verify"`.

---

## 3. Edge functions

Todas em `supabase/functions/`. Helpers compartilhados em `_shared/email.ts` (`corsHeaders`, `jsonResponse`, `renderTemplate`, `sanitizeTagValue`, `isInternalContext`).

### 3.1 `send-email`
**Envio unitário.** Caminho usado por automações, testes e fallback do batch. Auth: service-role **ou** JWT de admin/super-admin.

Body:
```json
{
  "clinic_id": "uuid",
  "template_slug": "string",
  "recipient_email": "email",
  "recipient_name": "string?",
  "variables": { "...": "..." },
  "related_lead_id": "uuid?",
  "related_lead_table": "string?",
  "force": false,
  "queue_id": "uuid?",
  "from_domain_override": "string?",
  "variant_id": "uuid?"
}
```

Pipeline atual (pós Tier 1/2):
1. **Feature gate** `clinic_has_feature(clinic_id, 'email_marketing')`. Off → marca queue `cancelled` e retorna `{ skipped: true, reason: "feature_disabled" }`.
2. **Carrega template** ativo por `(clinic_id, slug)` — com cache em memória do isolate (TTL 60s, R-6). Mesma cache para `email_domains`, `clinic_email_integrations`, `clinics.slug`.
3. **Resolve domínio efetivo**: se `from_domain_override` veio do dispatcher (R-21 multi-domínio), substitui o domínio do `from_email` preservando o local-part.
4. **Verifica domínio**: linha em `email_domains` com `status = 'verified'`. Senão → `412`.
5. **Suppression**: se não `force`, checa `email_unsubscribes`. Match → marca queue `cancelled`.
6. **Idempotência atômica (R-10)**: `INSERT INTO email_send_dedup(clinic, slug, email, context) ON CONFLICT DO NOTHING`. Conflito = já enviado, pula. Falhas posteriores no envio fazem `DELETE` para liberar reenvio.
7. **Cota diária (R-11)**: RPC `claim_email_quota(_clinic_id)` (UPSERT atômico com reset diário). Estourou → libera dedup + reagenda job para 12:00 UTC do dia seguinte (~9h BRT).
8. **Warmup do domínio (R-12)**: RPC `claim_domain_warmup(_clinic_id, _domain)`. Curva `50→100→500→1k→5k→10k→25k→ilimitado` por dia desde `started_at`. Estourou → libera dedup + reagenda +30min.
9. **Throttle por domínio destino (R-13)**: RPC `claim_recipient_throttle(_clinic_id, _dest_domain, _limit_per_hour: 1000)`. Estourou → libera dedup + reagenda próxima janela horária.
10. **Unsubscribe URL**: `generate_unsubscribe_token(clinic_id, email)` (HMAC) → `${SITE_URL}/unsubscribe?clinic=...&email=...&token=...`.
11. **Render**: `renderTemplate` substitui `{{ var }}` em `subject`, `html_body`, `text_body`. Vars auto-injetadas: `recipient_email`, `recipient_name`, `unsubscribe_url`, `site_url`, `year`.
12. **Envio Resend** — `POST https://api.resend.com/emails` **direto** (não usa gateway), autenticando com `Bearer ${RESEND_API_KEY}`. Headers `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`. Tags: `template`, `category`, `clinic`, `variant` (sanitizadas). Links recebem UTMs anexadas — open/click tracking é do Resend nativo.
13. **Loga** em `email_logs` (`status: sent`, `resend_id`, `variant_id`, `from_domain_override`).
14. Em erro → libera dedup, release de warmup/throttle, loga `status: failed` + retorna `502`.

### 3.2 `send-email-batch`
**Envio em lote — caminho principal de campanhas (R-15).** Auth: service-role.

Body: `{ clinic_id, template_slug, jobs: [...], from_domain_override?, idempotency_key? }`.

Características:
- Até **100 destinatários por chamada** (Resend Batch API `POST /emails/batch`).
- Pre-checks por job (suppression, dedup `email_send_dedup`, cota, warmup, throttle) — jobs reprovados são pulados/reagendados antes da chamada batch.
- Envia o batch para `https://api.resend.com/emails/batch`.
- **Fallback automático para singular** se a chamada batch retornar erro completo.
- Loga cada envio individualmente em `email_logs` com `variant_id` e `from_domain_override`.
- Reduz ~95% das chamadas HTTP ao Resend em campanhas grandes.

### 3.3 `process-email-queue`
Dispatcher da fila (cron ~15s + self-trigger R-3):
- **Reaper**: jobs com `status='processing'` há mais de **10 min** (`STALE_PROCESSING_MIN`) voltam para `pending`.
- Pega até **400** jobs `pending` (`BATCH_SIZE`) com `scheduled_at <= now()`, ordenados por `priority ASC, scheduled_at ASC` (R-7: `auth=1, transacional=2, campaign=3, drip=4, batch=5`).
- Marca como `processing`.
- **Agrupa** por `(clinic_id, template_slug, from_domain_override)`:
  - Grupo com **≥3** jobs → `send-email-batch` (Resend Batch API).
  - Grupos menores → `send-email` singular, em chunks de `CONCURRENCY=2` (respeita 2 req/s do Resend).
- **Self-trigger** ao final se ainda há `pending` na fila.
- Erros classificados:
  - **Permanentes** (`not found or inactive`, `invalid to field`, `not verified`) → `failed` sem retry.
  - **Quota** → reagenda para 12 UTC amanhã.
  - **Warmup / throttle** → reagenda conforme a política de cada RPC.
  - **Rate limit** (`retry after Xs|ms`) → reagenda com delay parseado + 1s.
  - **Outros**: até **3 tentativas** (`MAX_ATTEMPTS`) com backoff `1min → 5min → 30min`.

### 3.4 `dispatch-campaign`
Resolve uma campanha em recipients e enfileira (em lote, R-4):
- Auth: service-role ou admin/super-admin.
- Body: `{ campaign_id, test_only?, test_email_override? }`.
- **Teste**: pega 1 lead amostral do segmento, enfileira 1 job com `force: true`, marca `test_sent_at`, dispara `process-email-queue` imediatamente.
- **Real**:
  - Se `test_email` no campaign → 1 recipient.
  - Senão, resolve **audience multi-segmento** (2026-05-30):
    - `email_campaigns.segment_ids uuid[]` (novo) → faz **OR/union** de N segmentos com **dedup por email** (1ª ocorrência vence). Mantém compat com `segment_id` (legacy single) e com "sem segmento" = todos os leads da clínica + `email_segment_contacts`.
    - Para cada segmento, carrega leads + contatos manuais via paginação (range 1k em 1k, R-8) com `email IS NOT NULL`, aplicando `segment.filters` (`stage_ids`, `tags`, `last_message_at_range`, `deal_value_range`, `custom_field` — R-19).
  - Para cada destinatário (já deduplicado), pré-calcula:
    - **A/B variant** via round-robin ponderado determinístico por email (R-20) → grava `email_queue.variant_id`.
    - **Rotation domain** via RPC `pick_rotation_domain(_pool, _clinic)` (R-21) → grava `email_queue.from_domain_override`.
    - **Schedule espalhado** em janelas de 1 min se `send_rate_per_minute` setado (R-18).
  - INSERT em lote em `email_queue` (chunks de 500).
  - Atualiza `email_campaigns` com `status`, `total_recipients`, `enqueued_count`, `sent_at`.
  - `status='paused'` na campanha aborta novos despachos.

### 3.5 `resend-webhook`
Receptor de eventos do Resend.
- **Valida assinatura Svix** (via svix SDK oficial) se `RESEND_WEBHOOK_SECRET` setado (sem secret aceita unsigned — só dev).
- **Dedup por `svix-id` (R-5)**: INSERT em `resend_webhook_events(svix_id PK, event_type, resend_id)`. Conflito `23505` → `{ deduped: true }` sem reprocessar.
- Eventos consumidos: `email.delivered | email.opened | email.clicked | email.bounced | email.complained`. (`email.sent` e `email.delivery_delayed` vão para `events[]` apenas.)
- Encontra `email_logs` por `resend_id`, faz `events.push(...)` e atualiza colunas `*_at` + `status`.
- **Bounce hard ou Permanent** → upsert em `email_unsubscribes(reason: 'bounce', source: 'resend-webhook')`.
- **Complaint** → upsert em `email_unsubscribes(reason: 'complaint', source: 'resend-webhook')`.
- Trigger `email_logs_bounce_health_trigger` chama `check_clinic_bounce_health` — se bounce>5% ou complaint>0.3% nas últimas 1000 → pausa campanhas e grava em `email_health_alerts` (R-16).

### 3.6 `email-unsubscribe` (público, sem JWT)
- Actions: `validate | unsubscribe | reactivate`.
- Sempre exige `clinic_id + email + token` válidos via RPC `verify_unsubscribe_token` (HMAC).
- `unsubscribe`: upsert em `email_unsubscribes` + **cascade**: cancela todos jobs pendentes (`status=pending`, `force_send=false`) daquela combinação clinic+email.
- `reactivate`: `DELETE FROM email_unsubscribes WHERE clinic_id=? AND email=?`.
- Reasons aceitos: `too-many | not-interested | never-signed | other | user-request`.

### 3.7 `email-domain-manage` (super admin only)
Gerencia domínios via Resend:
- `action: create` → `POST /domains` no Resend, upsert em `email_domains` com `status`, `dns_records`, `region`.
- `action: verify` → `POST /domains/{id}/verify`, depois `GET /domains/{id}` para refresh do status; atualiza linha.
- `action: delete` → `DELETE /domains/{id}` no Resend + `DELETE` local.

### 3.8 `backfill-resend-events` (super admin only)
Sincroniza histórico:
- Pega até 200 `email_logs` com `resend_id NOT NULL` e `delivered_at IS NULL`.
- Para cada, `GET /emails/{id}` no Resend e atualiza status/timestamps.
- Bounces/complaints viram entries em `email_unsubscribes`.

### 3.9 `process-scheduled-campaigns`
Cron a cada 5 min. Busca `email_campaigns` com `status='scheduled'` e `scheduled_for <= now()` (limit 20) e dispara `dispatch-campaign` para cada uma. É o que faz "Agendar campanha" funcionar.

### 3.10 `scheduled-dispatcher` (referência cruzada)
**Não pertence ao módulo de email** — processa `scheduled_messages` (WhatsApp) e `pending_replies` (auto-reply IA). Listado aqui só para evitar confusão com o `process-scheduled-campaigns`.

### 3.11 `email-automations-tick`
Cron a cada 5 min. Motor de drip para `email_automations` (paralelo, concorrência 10 — R-9):
- Lê todas as automações com `active = true`.
- Detecta leads candidatos desde `last_run_at` (cursor por automação):
  - `lead_created` → `leads.created_at > since` (com `email IS NOT NULL`), e quando houver `trigger_config.segment_id` o match é feito via `lead_matches_segment()` para suportar segmentos dinâmicos e estáticos.
  - `lead_stage_changed` → `lead_stage_history.moved_at > since`; respeita `trigger_config.to_stage_id` (ou `stage_id`).
  - `lead_tag_added` → `lead_events` com `type='tag_added'` e filtro opcional `payload.tag`.
  - `segment_contact_added` → entrada nova em `email_segment_contacts` (ou lead que passou a casar o segmento) desde `since`.
- Para cada lead novo, tenta INSERT em `email_automation_enrollments` (`UNIQUE(automation_id, lead_id)`). Unique violation = já enrolado, ignorado silenciosamente.
- **Importante:** `segment_contact_added` depende de materialização em `email_segment_contacts`; já `lead_created` com segmento usa a lógica real do segmento sobre `leads` e não depende dessa tabela estar preenchida.
- Enfileira **todos os steps** da automação via RPC `enqueue_email` com `scheduled_at = now() + delay_minutes`.
- `related_lead_table = "automation_<id>"` → idempotência/deduplicação delegada ao `send-email`.
- Atualiza `steps_enqueued` no enrollment e avança `last_run_at` da automação.

Suppression, idempotência atômica, cota, warmup, throttle e verificação de domínio ficam por conta do `send-email`/`send-email-batch` no momento do envio.

---

## 4. Tabelas (Postgres + RLS por `clinic_id`)

Todas (exceto domínios e logs) usam RLS `clinic_id = current_clinic_id() AND clinic_has_feature(clinic_id, 'email_marketing')`.

| Tabela | Função |
|---|---|
| `email_domains` | Domínios verificados (1+ por clínica). Colunas extras: `rotation_pool`, `rotation_weight` (R-21). Read: clínica; Write: super admin. |
| `email_templates` | Templates (HTML + blocks JSON). |
| `email_template_folders` | Pastas para organizar templates. |
| `email_segments` | Filtros JSON salvos sobre `leads` (suporta `tags`, `stage_ids`, `last_message_at_range`, `deal_value_range`, `custom_field` — R-19). |
| `email_segment_contacts` | Contatos manuais (fora de `leads`) usados em campanhas. |
| `email_campaigns` | Campanhas (template + segmento(s) + agendamento + totais). Colunas: `status` (`draft\|scheduled\|sending\|sent\|paused\|failed`), **`segment_ids uuid[]`** (multi-segmento, union/OR — 2026-05-30), `segment_id` (legacy single, mantido para retrocompat), `variant_strategy`, `from_name_override`, `from_domain_pool`, `send_rate_per_minute`, `test_email`, `winner_picked_at`, `last_sent_at`. |
| `email_campaign_variants` | Variantes A/B/multi (R-20): `label`, `weight`, `subject_override`, `template_slug_override`, `from_name_override`, `sent_count`, `opened_count`, `clicked_count`, `is_winner`. |
| `email_automations` | Drip por trigger (steps JSON). Triggers: `lead_created`, `lead_stage_changed`, `lead_tag_added`, `segment_contact_added`. |
| `email_automation_enrollments` | Leads enrolados numa automação (`UNIQUE(automation_id, lead_id)`). Conta `steps_enqueued`. |
| `email_queue` | Fila de envio. Colunas-chave: `status` (`pending\|processing\|sent\|failed\|cancelled`), `priority` (R-7), `attempts`, `scheduled_at`, `error`, `force_send`, `variables`, `related_lead_id`, `related_lead_table`, `variant_id`, `from_domain_override`. |
| `email_logs` | Histórico de envios + timestamps de delivery/open/click/bounce/complaint + `variant_id`, `from_domain_override`. **Read-only** para o app. |
| `email_send_dedup` | Idempotência atômica (R-10) — UNIQUE `(clinic_id, template_slug, email, context)`. |
| `email_unsubscribes` | Lista de supressão por clinic+email. Admin pode deletar (reativar). |
| `email_send_state` | Contador diário de envios (`sent_today`, `quota_resets_at`). Acesso via RPC `claim_email_quota` (R-11). |
| `email_domain_warmup` | Curva de aquecimento por `(clinic_id, domain)` — R-12. Opt-in. |
| `email_recipient_throttle` | Throttle por `(clinic_id, dest_domain, window_start)` — R-13. |
| `clinic_email_integrations` | Configuração de integração de email por clínica (provider, secret_name). |
| `resend_webhook_events` | Dedup de eventos do Resend por `svix_id` (R-5). |
| `email_health_alerts` | Alertas de saúde (bounce/complaint > threshold) — R-16. |
| `email_operational_alerts` | Alertas operacionais (backlog, stuck, failure_rate) — R-17. |
| `campaign_throughput` | Throughput por minuto por campanha (alimenta `CampaignLiveDialog`). |

Views: `email_throughput_stats` (por clínica), `email_system_health` (global) — R-17.

Funções SQL relevantes:
- `claim_email_quota(_clinic_id) → { allowed, sent_today, quota }` — UPSERT atômico (R-11).
- `claim_domain_warmup(_clinic_id, _domain) → { allowed, ... }` — R-12.
- `claim_recipient_throttle(_clinic_id, _dest_domain, _limit_per_hour) → { allowed, ... }` — R-13.
- `release_domain_warmup(_clinic_id, _domain)` — libera vaga em caso de falha.
- `pick_rotation_domain(_pool, _clinic_id) → text` — R-21.
- `pick_ab_winner(_campaign_id)` — recalcula métricas e marca vencedor (R-20).
- `check_clinic_bounce_health(_clinic_id)` — pausa campanhas se threshold estourado (R-16).
- `check_email_operational_health()` — gera alertas operacionais (R-17).
- `clinic_email_quota(_clinic_id) → integer` — cota diária da clínica.
- `enqueue_email(...) → uuid` — insert em `email_queue` (usado por automações e teste).
- `generate_unsubscribe_token(_clinic_id, _email) → text` — HMAC.
- `verify_unsubscribe_token(_clinic_id, _email, _token) → boolean`.
- `clinic_has_feature(_clinic_id, _key)` — feature flag check.

---

## 5. Modelo de blocos do editor

Definido em `src/lib/email/types.ts`.

| Bloco | Campos principais |
|---|---|
| `heading` | text, level (1-3), align, color |
| `paragraph` | html (Tiptap), align, color, fontSize |
| `image` | src, alt, width (≤600), href?, align |
| `cta` | text, href, bg, color, align, radius, paddingX/Y |
| `divider` | color, thickness |
| `spacer` | height |
| `avatar` | src, initials, size, align |
| `signature` | avatarSrc, name, role, extra, site |
| `youtube` | url, caption, width |
| `columns` | cols (2/3), children[][] |
| `raw` | html (cru) |

Helpers:
- `blocksToHtml.ts` — gera HTML email-safe (tabelas inline, sem CSS externo) + `htmlContainsUnsubscribeVar` checa presença do `{{ unsubscribe_url }}`.
- `htmlToBlocks.ts` — parsing reverso para importar HTML existente.
- `sanitize.ts` — DOMPurify em runtime.
- `variables.ts` — lista as variáveis disponíveis no editor.

---

## 6. Fluxos completos

### 6.1 Enviar campanha
```text
UI EmailCampaigns "Enviar"
   └──▶ supabase.functions.invoke('dispatch-campaign', { campaign_id })
         ├── carrega campaign + segment filters + variants
         ├── paginação leads/contatos (range 1k)
         ├── pick A/B variant + rotation domain + schedule spread
         ├── INSERT em lote em email_queue (chunks 500, status='pending')
         └── update email_campaigns (status='sending', totals)

CRON ~15s (+ self-trigger) → process-email-queue
   ├── reaper de jobs travados (>10min em 'processing')
   ├── pega até 400 pending (ORDER BY priority, scheduled_at)
   ├── agrupa por (clinic, slug, from_domain_override)
   │     ├── grupos ≥3 → send-email-batch (Resend Batch API)
   │     └── singulares → send-email (CONCURRENCY=2)
   │           ├── feature gate, template (cache), domain verified
   │           ├── suppression check
   │           ├── INSERT email_send_dedup (atômico — R-10)
   │           ├── claim_email_quota (atômico — R-11)
   │           ├── claim_domain_warmup (R-12)
   │           ├── claim_recipient_throttle (R-13)
   │           ├── render + Resend POST
   │           └── insert email_logs (status='sent', resend_id, variant_id)
   └── update email_queue (sent | failed | reschedule por quota/warmup/throttle)

Resend → POST /functions/v1/resend-webhook
   ├── svix verify + dedup por svix-id (resend_webhook_events)
   ├── update email_logs status/timestamps + events[]
   ├── on bounce/complaint: upsert email_unsubscribes
   └── trigger bounce_health → pausa campanhas se >5%/>0.3% (R-16)
```

### 6.2 Descadastro
```text
Email com link → /unsubscribe?clinic=&email=&token=
   ├── (mount) fetch email-unsubscribe { action: validate }
   ├── usuário clica "Confirmar"
   ├── fetch email-unsubscribe { action: unsubscribe, reason }
   │     ├── verify_unsubscribe_token (RPC)
   │     ├── upsert email_unsubscribes
   │     └── cancel email_queue (pending, !force_send)
   └── opcional: { action: reactivate } → delete email_unsubscribes
```

### 6.3 Setup de domínio
```text
Super admin → /admin (Cloud Connectors etc.)
   └──▶ email-domain-manage { action: create, clinic_id, domain }
         ├── Resend POST /domains
         └── upsert email_domains (status='pending', dns_records=[...])

Clínica → /settings/email (DnsWizard)
   ├── copia registros DNS, configura no provedor
   └── clica "Re-verificar"
         └──▶ email-domain-manage { action: verify, domain_id }
               ├── Resend POST /domains/{id}/verify
               ├── Resend GET /domains/{id}
               └── update email_domains.status (verified|pending|failed)
```

---

## 7. Variáveis e secrets

Edge functions exigem:
- `RESEND_API_KEY` — chave do Resend usada diretamente contra `api.resend.com` (sem ela, `send-email` e admins de domínio retornam 503). **Não há `LOVABLE_API_KEY` no fluxo de email** — a integração não usa o connector gateway.
- `RESEND_WEBHOOK_SECRET` — para validar assinatura Svix no `resend-webhook` (opcional, mas recomendado em prod).
- `PUBLIC_SITE_URL` — base do app (default `https://mkcrm.lovable.app`) usada no `unsubscribe_url`.
- Padrão Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.


---

## 8. Convenções e regras de negócio

1. **Sempre passar `clinic_id` explícito** em chamadas server-side (não dá pra usar `current_clinic_id()` em edge function).
2. **`related_lead_table` define escopo de idempotência**:
   - `null` ou prefixos `leads_internal | quick_test_* | campaign_test_*` → **sem dedup** (envios livres).
   - Qualquer outro → dedup por `(clinic, slug, email, table)`.
3. **Domínio precisa estar `verified`** ou `send-email` retorna 412 e marca queue como `failed`.
4. **Cota é por dia UTC** com janela que reseta às 24:00 UTC; quando estourada, jobs reagendam para 12:00 UTC do dia seguinte (~9 BRT).
5. **`force_send=true`** em `email_queue` ignora suppression. Use só em testes e reenvios manuais.
6. **Templates obrigam `{{ unsubscribe_url }}`** no HTML (compliance e exigência de provedores).
7. **Cancelamento em cascata**: ao descadastrar, todos jobs pendentes para aquele email/clinic são `cancelled` automaticamente (exceto `force_send`).
8. **Bounce hard ou Complaint** ⇒ supressão automática (sem intervenção do usuário).
9. **Slugs de template** seguem `/^[a-z][a-z0-9-]*$/` e são chave funcional (campaigns/automations referenciam por slug, não por id).
10. **Render usa `{{ var }}`** (sem `{% %}` ou helpers). Falta de variável vira string vazia.

---

## 9. Cheatsheet do dev

| Quero… | Vou em |
|---|---|
| Adicionar novo trigger de automação | `EmailAutomations.tsx` (TRIGGERS) + `email-automations-tick/index.ts` (query de candidatos) |
| Adicionar novo bloco no editor | `lib/email/types.ts` (tipo + `newBlock`) + `blocksToHtml.ts` (render) + `Inspector.tsx` (UI) + `Palette.tsx` (lista) |
| Aumentar cota de uma clínica | Função SQL `clinic_email_quota` (custom logic por clínica/plano) |
| Mudar throttle/batch size | `process-email-queue/index.ts` — constantes `BATCH_SIZE`, `MAX_ATTEMPTS` |
| Suportar novo filtro de segmento | `dispatch-campaign/index.ts` (resolução SQL) + UI `EmailSegments.tsx` |
| Customizar página de descadastro | `src/pages/Unsubscribe.tsx` |
| Variáveis novas disponíveis no template | `src/lib/email/variables.ts` + injetar no `send-email/index.ts` (`renderVars`) |
| Mudar SITE_URL | env `PUBLIC_SITE_URL` da edge function |
| Re-sincronizar status antigos | Edge `backfill-resend-events` (super admin) |

---

## 10. Roadmap / pontos abertos

- Domain creation está restrita a super admin via `/admin`; não há self-serve para clínicas (intencional para evitar custo de verificação).
- O contador de cota (via `claim_email_quota` + `email_send_state`) é por clínica; não há cota global de plataforma.
- Pause de campanha não cancela jobs já enfileirados — drena o que está em `email_queue`.
- Sem botão "reenviar para quem não abriu" como ação nativa (criar nova campanha + segmento com `custom_field`).
- UI de timeline por recipient (eventos) — hoje só `EmailLogs` com colunas de timestamp.

> **Status do roadmap de escala:** Tier 0/1/2/3 ✅ implementados (R-1 a R-21). Ver `docs/roadmap/EMAIL_SCALE.md` para detalhes e SLOs.

> **A/B test nativo** já existe (R-20): `email_campaign_variants` + `variant_strategy` + `pick_ab_winner`.

---

## 11. Performance & throughput (estado atual)

> Atualizado pós Tier 0/1/2/3. Limites/ajustes em `docs/roadmap/EMAIL_SCALE.md`.

| Item | Valor atual | Onde mexer |
|---|---|---|
| Cron `process-email-queue` | ~15s (cron + self-trigger R-3) | `pg_cron` job + final do handler |
| Batch size por execução | **400** | `BATCH_SIZE` em `process-email-queue/index.ts` |
| Concorrência (singular) | **2** (respeita 2 req/s do Resend) | `CONCURRENCY` em `process-email-queue/index.ts` |
| Resend Batch API | até **100** por chamada | `send-email-batch/index.ts` |
| Threshold de agrupamento batch | **≥3** jobs no mesmo `(clinic, slug, from_domain)` | `process-email-queue/index.ts` |
| Reaper de jobs travados | 10 min | `STALE_PROCESSING_MIN` |
| Max attempts antes de `failed` | 3 | `MAX_ATTEMPTS` |
| Backoff de retry | 1min → 5min → 30min | `process-email-queue/index.ts` |
| Reagendamento por cota | 12:00 UTC dia+1 (~9h BRT) | `send-email/index.ts` §7 |
| Reagendamento por warmup | +30min | `send-email/index.ts` §8 |
| Reagendamento por throttle dest | próxima janela horária | `send-email/index.ts` §9 |
| Chunk de enqueue em `dispatch-campaign` | INSERT em lote de 500 (R-4) | `dispatch-campaign/index.ts` |
| Paginação de leads por campanha | 1.000 por range, sem teto fixo | `dispatch-campaign/index.ts` |
| Cron `email-automations-tick` | 5 min, concorrência 10 (R-9) | `pg_cron` job |
| Cota diária default por clínica | 1.000 | RPC `claim_email_quota` / `clinic_email_quota` |
| Warmup default | 50→100→500→1k→5k→10k→25k→∞ (opt-in) | `claim_domain_warmup` + `email_domain_warmup` |
| Throttle default por domínio destino | 1.000 / hora | `claim_recipient_throttle` |
| Cache de template/domínio no isolate | TTL 60s | `send-email`/`send-email-batch` |

**Throughput observado:** com Batch API + cron 15s, campanhas de 10k destinatários enviam em <2h (SLO). Pico depende fortemente da reputação/plano Resend da clínica.

**Priorização da fila (R-7):** `priority ASC, scheduled_at ASC` com `auth=1, transacional=2, campaign=3, drip=4, batch=5`. Email transacional/auth não fica atrás de campanha massiva.
