# Email Marketing — Documentação Detalhada

> Referência completa do módulo de Email Marketing do CRM mkart.
> Cobre: telas, edge functions, tabelas, fluxos, integrações (Resend), helpers e regras de negócio.
> Última atualização: 2026-05-26.

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
- Selecionar template (ativo) + segmento (opcional) + agendamento.
- **Enviar agora**: invoca `dispatch-campaign` com o `campaign_id`.
- **Enviar teste** (Beaker): `dispatch-campaign` com `test_only: true` e `test_email_override` — usa amostra de 1 lead do segmento para preencher variáveis.
- Mostra status: `draft | scheduled | sending | sent | failed`.
- Totais: `total_recipients`, `sent_count`, `failed_count`.

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
**Entrada principal de envio.** Auth: service-role **ou** JWT de admin/super-admin.

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
  "queue_id": "uuid?"
}
```

Pipeline:
1. **Feature gate** `clinic_has_feature(clinic_id, 'email_marketing')`. Se off → marca queue como `cancelled` e retorna `{ skipped: true, reason: "feature_disabled" }`.
2. **Carrega template** ativo por `(clinic_id, slug)`.
3. **Verifica domínio**: `from_email`'s domain deve existir em `email_domains` com `status = 'verified'`. Senão → `412`.
4. **Suppression**: se não `force`, checa `email_unsubscribes`. Match → marca queue `cancelled`.
5. **Idempotência**: se há contexto externo (`related_lead_table` não-interno via `isInternalContext`), bloqueia reenvio se já existe `email_logs` com status `sent|delivered|opened|clicked` para o mesmo `(clinic, slug, email, table)`.
6. **Cota diária**: `clinic_email_quota(clinic_id)` (RPC, default 1000). Lê/atualiza `email_send_state.sent_today`. Se excedida → reagenda job para 12:00 UTC do dia seguinte (~9h BRT).
7. **Unsubscribe URL**: `generate_unsubscribe_token(clinic_id, email)` (HMAC) → monta `${SITE_URL}/unsubscribe?clinic=...&email=...&token=...`.
8. **Render**: `renderTemplate` substitui `{{ var }}` em `subject`, `html_body`, `text_body`. Vars auto-injetadas: `recipient_email`, `recipient_name`, `unsubscribe_url`, `site_url`, `year`.
9. **Envio Resend** — `POST https://api.resend.com/emails` **direto** (não usa o connector gateway Lovable), autenticando com `Bearer ${RESEND_API_KEY}`. Inclui headers `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` e tags `template`, `category`, `clinic` (sanitizadas).
10. **Loga** em `email_logs` (`status: sent`, `resend_id`) e incrementa `email_send_state`.
11. Em erro → loga com `status: failed` + retorna `502`.

### 3.2 `process-email-queue`
Dispatcher da fila (cron a cada 1 min):
- Pega até **50** jobs `pending` com `scheduled_at <= now()`.
- Marca como `processing`.
- Para cada job, chama `send-email` via HTTP.
- Trata erros classificando:
  - **Permanentes** (`not found or inactive`, `invalid to field`, `not verified`) → `failed` sem retry.
  - **Quota** → reagenda para 12 UTC amanhã.
  - **Rate limit** (`retry after Xs|ms`) → reagenda com delay parseado + 1s.
  - **Outros**: até **3 tentativas** com backoff `1min → 5min → 30min`.
- Atualiza queue com status final (`sent | failed | pending`).

### 3.3 `dispatch-campaign`
Resolve uma campanha em recipients e enfileira:
- Auth: service-role ou admin/super-admin.
- Body: `{ campaign_id, test_only?, test_email_override? }`.
- **Teste**: pega 1 lead amostral do segmento, enfileira 1 job com `force: true`, marca `test_sent_at`, dispara `process-email-queue` imediatamente.
- **Real**:
  - Se `test_email` no campaign → 1 recipient.
  - Senão, carrega leads da clínica com `email IS NOT NULL` filtrados por `segment.filters` (`stage_ids` IN, `tags` overlaps), limit 10k.
  - Para cada, chama RPC `enqueue_email` (que insere em `email_queue`).
  - Atualiza `email_campaigns` com `status`, `total_recipients`, `enqueued_count`, `sent_at`.

### 3.4 `resend-webhook`
Receptor de eventos do Resend.
- **Valida assinatura Svix** se `RESEND_WEBHOOK_SECRET` setado (sem secret aceita unsigned — só dev).
- Eventos tratados: `email.delivered | email.opened | email.clicked | email.bounced | email.complained`.
- Encontra `email_logs` por `resend_id`, faz `events.push(...)` e atualiza colunas `*_at` + `status`.
- **Bounce hard ou Permanent** → upsert em `email_unsubscribes(reason: 'bounce')`.
- **Complaint** → upsert em `email_unsubscribes(reason: 'complaint')`.

### 3.5 `email-unsubscribe` (público, sem JWT)
- Actions: `validate | unsubscribe | reactivate`.
- Sempre exige `clinic_id + email + token` válidos via RPC `verify_unsubscribe_token` (HMAC).
- `unsubscribe`: upsert em `email_unsubscribes` + **cascade**: cancela todos jobs pendentes (`status=pending`, `force_send=false`) daquela combinação clinic+email.
- `reactivate`: `DELETE FROM email_unsubscribes WHERE clinic_id=? AND email=?`.
- Reasons aceitos: `too-many | not-interested | never-signed | other | user-request`.

### 3.6 `email-domain-manage` (super admin only)
Gerencia domínios via Resend:
- `action: create` → `POST /domains` no Resend, upsert em `email_domains` com `status`, `dns_records`, `region`.
- `action: verify` → `POST /domains/{id}/verify`, depois `GET /domains/{id}` para refresh do status; atualiza linha.
- `action: delete` → `DELETE /domains/{id}` no Resend + `DELETE` local.

### 3.7 `backfill-resend-events` (super admin only)
Sincroniza histórico:
- Pega até 200 `email_logs` com `resend_id NOT NULL` e `delivered_at IS NULL`.
- Para cada, `GET /emails/{id}` no Resend e atualiza status/timestamps.
- Bounces/complaints viram entries em `email_unsubscribes`.

### 3.8 `process-scheduled-campaigns`
Cron a cada 5 min. Busca `email_campaigns` com `status='scheduled'` e `scheduled_for <= now()` (limit 20) e dispara `dispatch-campaign` para cada uma. É o que faz "Agendar campanha" funcionar.

### 3.9 `scheduled-dispatcher` (referência cruzada)
**Não pertence ao módulo de email** — processa `scheduled_messages` (WhatsApp) e `pending_replies` (auto-reply IA). Listado aqui só para evitar confusão com o `process-scheduled-campaigns`.

### 3.10 `email-automations-tick`
Cron a cada 5 min. Motor de drip para `email_automations`:
- Lê todas as automações com `active = true`.
- Detecta leads candidatos desde `last_run_at` (cursor por automação):
  - `lead_created` → `leads.created_at > since` (com `email IS NOT NULL`).
  - `lead_stage_changed` → `lead_stage_history.moved_at > since`; respeita `trigger_config.to_stage_id` (ou `stage_id`).
  - `lead_tag_added` → `lead_events` com `type='tag_added'` e filtro opcional `payload.tag`.
- Para cada lead novo, tenta INSERT em `email_automation_enrollments` (`UNIQUE(automation_id, lead_id)`). Unique violation = já enrolado, ignorado silenciosamente.
- Enfileira **todos os steps** da automação via RPC `enqueue_email` com `scheduled_at = now() + delay_minutes`.
- `related_lead_table = "automation_<id>"` → idempotência/deduplicação delegada ao `send-email`.
- Atualiza `steps_enqueued` no enrollment e avança `last_run_at` da automação.

Suppression, idempotência, cota e verificação de domínio ficam por conta do `send-email` no momento do envio.

---

## 4. Tabelas (Postgres + RLS por `clinic_id`)

Todas (exceto domínios e logs) usam RLS `clinic_id = current_clinic_id() AND clinic_has_feature(clinic_id, 'email_marketing')`.

| Tabela | Função |
|---|---|
| `email_domains` | Domínios verificados (1+ por clínica). Read: clínica; Write: super admin. |
| `email_templates` | Templates (HTML + blocks JSON). |
| `email_template_folders` | Pastas para organizar templates. |
| `email_segments` | Filtros JSON salvos sobre `leads`. |
| `email_campaigns` | Campanhas (template + segment + agendamento + totais). |
| `email_automations` | Drip por trigger (steps JSON). |
| `email_automation_enrollments` | Leads enrolados numa automação (`UNIQUE(automation_id, lead_id)`). Conta `steps_enqueued`. |
| `email_queue` | Fila de envio. Colunas-chave: `status` (`pending\|processing\|sent\|failed\|cancelled`), `attempts`, `scheduled_at`, `error`, `force_send` (ignora suppression/idempotência), `variables`, `related_lead_id`, `related_lead_table`. |
| `email_logs` | Histórico de envios + timestamps de delivery/open/click/bounce/complaint. **Read-only** para o app. |
| `email_unsubscribes` | Lista de supressão por clinic+email. Admin pode deletar (reativar). |
| `email_send_state` | Contador diário de envios (`sent_today`, `quota_resets_at`). Read-only. |

Funções SQL relevantes:
- `clinic_email_quota(_clinic_id uuid) → integer` — cota diária da clínica.
- `enqueue_email(...) → uuid` — insert em `email_queue`.
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
         ├── carrega campaign + segment filters
         ├── query leads (clinic, email NOT NULL, filtros)
         ├── for each: RPC enqueue_email() → email_queue.status='pending'
         └── update email_campaigns (status='sent', totals)

CRON (1min) → process-email-queue
   ├── pega 50 jobs pending
   ├── for each → HTTP send-email (service-role auth)
   │     ├── feature gate, template, domain verified
   │     ├── suppression check
   │     ├── idempotency check (email_logs)
   │     ├── quota check (email_send_state)
   │     ├── render + Resend POST /emails
   │     └── insert email_logs (status='sent', resend_id)
   └── update email_queue (sent | failed | reschedule)

Resend → POST /functions/v1/resend-webhook
   └── update email_logs status/timestamps
        └── on bounce/complaint: upsert email_unsubscribes
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
- Não há A/B test nativo de subject (campo `subject` é único por template).
- O contador `email_send_state` é por clínica; não há cota global de plataforma.

> **Roadmap de escala/performance:** ver `docs/roadmap/EMAIL_SCALE.md` para o plano detalhado (R-1 a R-21 em 4 tiers) antes de subir clientes de alto volume.

---

## 11. Performance & throughput (estado atual)

> Estes são os **limites observados hoje**. Plano para superá-los em `docs/roadmap/EMAIL_SCALE.md`.

| Item | Valor atual | Onde mexer |
|---|---|---|
| Cron `process-email-queue` | 1 min | `pg_cron` job |
| Batch size por execução | 50 | `BATCH_SIZE` em `process-email-queue/index.ts` |
| Concorrência por batch | 5 | `CONCURRENCY` em `process-email-queue/index.ts` |
| Reaper de jobs travados | 10 min | `STALE_PROCESSING_MIN` |
| Max attempts antes de `failed` | 3 | `MAX_ATTEMPTS` |
| Backoff de retry | 1min → 5min → 30min | `process-email-queue/index.ts` |
| Reagendamento por cota | 12:00 UTC dia+1 (~9h BRT) | `send-email/index.ts` §4 |
| Chunk de enqueue em `dispatch-campaign` | 20 RPCs paralelos | `dispatch-campaign/index.ts` |
| Limit de leads carregados por campanha | 10.000 | `dispatch-campaign/index.ts` |
| Cron `email-automations-tick` | 5 min | `pg_cron` job |
| Cota diária default por clínica | 1.000 | RPC `clinic_email_quota` |

**Teto prático hoje:** ~50 emails/min ≈ **3.000/h** por instância. Suficiente para clínicas pequenas/médias; **insuficiente** para cliente de alto volume — ver roadmap de escala.

**Sem priorização:** campanha massiva, drip e transacional competem na mesma fila ordenada apenas por `scheduled_at`. Email transacional pode esperar atrás de uma campanha de 50k. Endereçado por R-7.
