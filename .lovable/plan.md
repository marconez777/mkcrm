
# Email Marketing Multi-Tenant — Plano Final (v2)

Mudança vs. v1: **secrets gerenciados pelo painel Super Admin → Integrações**, sem pop-up do `add_secret`. Você configura depois quando quiser.

---

## 1. Segredos via UI (Super Admin → Integrações)

Nova aba `Admin → Integrações` mostra cards para cada secret global:

| Secret | Status | Ação |
|---|---|---|
| `RESEND_API_KEY` | ✅ Configurado | "Atualizar" |
| `RESEND_WEBHOOK_SECRET` | ⚠️ Não configurado | "Configurar" |

Botões "Atualizar"/"Configurar" disparam `update_secret`/`add_secret` no momento (não no início). Edge functions verificam presença antes de operar: `send-email` só roda se `RESEND_API_KEY` setado; `resend-webhook` valida assinatura só se `RESEND_WEBHOOK_SECRET` setado (caso contrário aceita sem verificar e loga warning — útil em dev).

Vantagem: você sobe toda a infra agora e configura o webhook secret quando cadastrar o endpoint no Resend.

---

## 2. Feature flag

`src/lib/features.ts` ganha `{ key: "email_marketing", label: "Email Marketing" }`. Funciona com o sistema atual (`hasFeature`, `current_clinic_has_feature`).

---

## 3. Schema multi-tenant

Migração `*_email_marketing.sql`. Tabelas (todas com `clinic_id uuid not null references clinics(id) on delete cascade`):

- **`email_domains`** — `domain, resend_domain_id, status, dns_records jsonb, region, last_checked_at`. Unique `(clinic_id, domain)`.
- **`email_template_folders`**
- **`email_templates`** — Unique `(clinic_id, slug)`.
- **`email_queue`** — índice único parcial `(clinic_id, template_slug, lower(recipient_email), related_lead_table) WHERE status='pending' AND related_lead_table IS NOT NULL AND related_lead_table <> 'leads_internal'`.
- **`email_logs`** — append-only. Unique parcial em `resend_id`.
- **`email_unsubscribes`** — `PK (clinic_id, email)`.
- **`email_segments`**, **`email_automations`**, **`email_campaigns`**.
- **`email_send_state`** — `clinic_id, sent_today int, quota_resets_at` (quota por clínica).
- **`app_settings`** global (HMAC + cron service role key, super admin only).

`clinics.settings.email = { quota_daily: 1000 }` — super admin edita no diálogo "Recursos".

### RLS
- Tabelas da clínica: `has_clinic_access(clinic_id) AND current_clinic_has_feature('email_marketing')`. Super admin bypass.
- `email_logs`/`email_unsubscribes`: insert só service-role.
- `email_domains`: write super admin; read clínica dona + super admin.

### Funções SQL
- `enqueue_email(_clinic_id, _template_slug, _recipient_email, ...)` com dedup por `(clinic, template, email, contexto)`.
- `generate/verify_unsubscribe_token(_clinic_id, _email)` — HMAC.
- `invoke_edge_function(_name, _body)` wrapper.
- `reset_email_send_state()` (cron diário 0h).

---

## 4. Edge functions

| Função | Auth | Função |
|---|---|---|
| `email-domain-manage` | super admin JWT | `create/verify/delete` via Resend API. |
| `send-email` | service-role OU admin JWT | Render + suppression + dedup + quota + envio + log. Bloqueia se feature off, domínio não verificado ou quota atingida. |
| `process-email-queue` | cron 1min | Lock otimista, backoff (quota → 9h BRT amanhã, rate-limit → respeita `Retry-After`). |
| `resend-webhook` | público (Svix se `RESEND_WEBHOOK_SECRET` setado) | Atualiza logs; hard bounce/complaint → upsert em `email_unsubscribes` da clínica do log. |
| `unsubscribe` | público + HMAC | Cancela jobs pendentes da clínica. |
| `dispatch-campaign` + `process-scheduled-campaigns` | service-role / cron 5min | Resolve segmento, enfileira `related_lead_table='campaign_<id>'`. |
| `backfill-resend-events` | super admin | Re-sincroniza histórico. |

---

## 5. UI — Super Admin (`src/pages/Admin.tsx`)

1. **Aba "Integrações"** (nova): cards de secrets globais (Resend API + webhook). Status verde/amarelo + botão.
2. **Diálogo "Recursos" da clínica**: toggle `email_marketing` + campo numérico **"Quota diária de emails"** (default 1000).
3. **Botão "Domínios"** por clínica: dialog lista `email_domains`, adicionar, tabela DNS copiável, botão "Verificar".

---

## 6. UI — Clínica

### Menu (`AppShell.tsx`)
Item **"Email Marketing"** com `featureKey: "email_marketing"`.

### Rotas (`src/pages/email/`)
`/email` (dashboard com alerta "configure domínio"), `/email/templates`, `/email/templates/:id` (editor blocos + DOMPurify), `/email/queue`, `/email/logs`, `/email/unsubscribes`, `/email/segments`, `/email/automations`, `/email/campaigns`. Todas em `<FeatureRoute feature="email_marketing">`.

### Configurações (`Settings.tsx`)
Card **"Domínio de email"** (visível se feature on + role owner/admin): adicionar domínio próprio (`mail.minhaclinica.com.br`), tabela de DNS copiável com tutorial passo-a-passo, botão "Verificar". **Zero menção a "Resend".**

### Página pública `/unsubscribe`
Sem auth. Recebe `?clinic=...&email=...&token=...`.

---

## 7. Automações — UX (resposta à pergunta c)

Tela `/email/automations` com duas seções:

### A. Receitas prontas (1-clique)
1. **Boas-vindas a novos leads** — trigger `lead_created`, 1 step.
2. **Sequência de aquecimento** — trigger `stage_enter` (clínica escolhe etapa), 3 steps (D+0, D+2, D+7).
3. **Reativação de inativos** — trigger `lead_inactive_days` (reaproveita `watch-stale-leads`), 1 step.

Ao ativar: cria `email_templates` (com texto default editável) + `email_automations`.

### B. Personalizado
CRUD com triggers limitados a dropdown: *Lead criado*, *Mudou para etapa X*, *Inativo há N dias*, *Tag adicionada*. Passos = `template + delay_days`.

Triggers SQL novos:
- `tg_on_new_lead_email_automation()` — itera `email_automations WHERE clinic_id=NEW.clinic_id AND active=true AND trigger_type='lead_created'` e chama `enqueue_email`.
- `tg_on_stage_change_email_automation()` — análogo.

Se nenhuma automação ativa → no-op. Integrações futuras (Lovable forms, WordPress) que inserem em `leads` disparam automaticamente.

---

## 8. Quota por clínica

`clinics.settings.email.quota_daily` (super admin). `email_send_state(clinic_id, sent_today, quota_resets_at)`. `send-email` incrementa e checa; se passou → reagenda. Dashboard mostra "Envios hoje: 342/1000". Cron diário zera contadores.

---

## 9. Bugs do blueprint antecipados

Todos os 18 itens da seção 6 do blueprint aplicados desde o início.

---

## 10. Ordem de execução (após aprovação)

1. Migração SQL.
2. 8 edge functions.
3. `src/lib/features.ts` + `Admin.tsx` (Integrações + Quota + Domínios).
4. UI clínica (menu + 9 páginas + card Settings).
5. Página pública `/unsubscribe`.
6. Você abre `Admin → Integrações` quando quiser configurar `RESEND_WEBHOOK_SECRET`. Sem ele a infra roda em modo "aceita webhook sem assinatura" + warning.

Posso prosseguir?
