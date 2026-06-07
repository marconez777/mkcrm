---
title: Edge Functions — Índice
topic: general
kind: reference
audience: agent
updated: 2026-06-07
summary: Todas verificam `is_super_admin()` **em código** — não confiar só em `verify_jwt`.
---
# Edge Functions — Índice

> Última atualização: 2026-06-03
> Total: **71 edge functions** em `supabase/functions/` + 14 módulos compartilhados (`_shared/*.ts`) + 1 diretório de KB (`_shared/builder-knowledge/`).
> Runtime: Deno (Supabase Edge Runtime). Imports preferenciais via `npm:` / `https://esm.sh/`.

## Convenções

- Cada função fica em `supabase/functions/<nome>/index.ts`. **Sem subpastas.**
- CORS sempre presente; tratar `OPTIONS` no topo. Importar `corsHeaders` de `_shared/evolution.ts` ou `_shared/email.ts` (não duplicar).
- Validar JWT via `requireUser(req)` ou `service_role` (function-to-function / cron). Cron usa `cron_service_role_key` de `public.app_settings`.
- Resposta padrão: `json(body, status)`.
- Logs: `console.log("[func] msg", ctx)` — visíveis via `supabase--edge_function_logs`.
- Secrets em `Deno.env.get(...)`. Nunca hardcode.
- Erros DEVEM responder com `corsHeaders`.

## Mapa por domínio

| Domínio | Funções | Doc |
|---|---|---|
| WhatsApp (Evolution API) | `evolution-*` (16, incl. `evolution-fetch-groups`), `fetch-wa-avatar`, `transcribe-audio`, `wa-redirect` | [`WHATSAPP.md`](./WHATSAPP.md) |
| IA / Agentes / RAG | `ai-chat`, `ai-auto-reply`, `ai-assist`, `ai-eval-run`, `ai-embed`, `ai-ingest-pdf`, `ai-ingest-url`, `ai-ingest-urls`, `ai-ingest-document`, `ai-reingest-document`, `ai-builder`, `ai-analyst-run`, `ai-spend-notify`, `agent-run-bulk`, `agent-followups-tick`, `agent-learn-from-thread`, `classifier-daily-batch`, `daily-summary` | [`AI.md`](./AI.md) |
| Email Marketing (Resend) | `send-email`, `send-email-batch`, `process-email-queue`, `email-automations-tick`, `dispatch-campaign`, `process-scheduled-campaigns`, `resend-webhook`, `backfill-resend-events`, `email-domain-manage`, `email-unsubscribe` | [`EMAIL.md`](./EMAIL.md) |
| Tracking (Pixel) | `tracking-pixel`, `tracking-event`, `tracking-identify`, `tracking-config` | [`TRACKING.md`](./TRACKING.md) |
| Broadcasts | `broadcast-tick`, `broadcast-control` | (sem doc dedicada — ver código + `flows/`) |
| Sequências / Automações | `sequence-tick`, `sequence-enroll`, `sequence-trigger`, `automations-tick`, `scheduled-dispatcher`, `watch-stale-leads` | (sem doc dedicada — ver `flows/`) |
| Relatórios agendados (WhatsApp) | `scheduled-report-tick` (cron 1 min — envia métricas para grupos WA) | (sem doc dedicada) |
| Formulários públicos | `forms-ingest`, `forms-admin`, `forms-snippet`, `forms-plugin-zip`, `external-lead-capture` | (sem doc dedicada — ver `flows/FORMS_TO_LEAD.md`) |
| Clínicas / Multi-tenant | `clinic-create-user`, `clinic-invite`, `integrations-status` | [`AUTH.md`](../architecture/AUTH.md) |
| Admin (super admin only) | `admin-users-list`, `admin-user-action`, `admin-apply-plan` | [`PLANS_LIMITS.md`](../architecture/PLANS_LIMITS.md) |
| Helpers compartilhados | `_shared/*.ts` (14 arquivos) + `_shared/builder-knowledge/` (KB do Builder em markdown) | [`SHARED_HELPERS.md`](./SHARED_HELPERS.md) |

## Como chamar uma função

**Do frontend (autenticado):**
```ts
const { data, error } = await supabase.functions.invoke("evolution-send", {
  body: { lead_id, text },
});
```

**De outra edge function (service-role):**
```ts
await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/<func>`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
  },
  body: JSON.stringify({ ... }),
});
```

**De `pg_cron`:** via `public.invoke_edge_function('<func>', body)` (ver `database/FUNCTIONS_TRIGGERS.md`).

## Pegadinhas globais

- Edge functions **não** importam de `src/integrations/supabase` — usar `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` direto.
- `deno.lock` desatualizado pode quebrar deploy (500). Remover e re-deployar.
- `verify_jwt = false` é padrão (gerenciado pelo Lovable). Validação SEMPRE em código.
- Quando service_role chama RPC `SECURITY DEFINER`, `auth.uid()` = NULL. Confirme que a função funciona nesse caso (ex.: `record_lead_stage_history`).
- Timeouts da plataforma: ~150s. Para tarefas longas, dispare em fila + retorne 202.

## Configurações relevantes (`app_settings`)

- `cron_service_role_key` — usado pelo `invoke_edge_function` (cron → edge). Sem isso, jobs ficam silenciosos.
- `supabase_url` — fallback se `app.supabase_url` setting não está no postgres.
- `unsubscribe_hmac_secret` — segredo HMAC para tokens de unsubscribe.

---

## Funções de admin (super admin only)

Todas verificam `is_super_admin()` **em código** — não confiar só em `verify_jwt`.

### `admin-users-list`
`POST` paginado. Retorna lista cross-tenant de usuários a partir de `auth.users` + join com `profiles`, `clinic_members`, `user_roles`. Body: `{ search?, clinic_id?, role?, status?, page?, page_size? }`. Consumido pela aba **Usuários** do `/admin`.

> **Nota técnica:** o código ainda referencia a tabela `auth_lockouts` (campos `locked_until`, `failed_attempts`) — como ela **não existe** no schema (ver `database/SCHEMA.md`), a query retorna `null` e os campos `locked`/`locked_until`/`failed_attempts` vêm sempre vazios/zerados. Reativar lockout exige criar a tabela + edge function wrapper. Registrado em `known-issues/DEBT.md`.

### `admin-user-action`
`POST` com `{ user_id, action, payload? }`. Ações suportadas:
- `set_password` — gera senha ou aceita uma fornecida.
- `unlock` — **no-op efetivo hoje** (tenta `DELETE FROM auth_lockouts WHERE email = ...` mas a tabela não existe).
- `sign_out` — revoga refresh tokens.
- `toggle_super_admin` — insere/remove em `user_roles`.

Toda chamada grava em `audit_log`.

### `admin-apply-plan`
`POST { plan_code, clinic_ids: uuid[] }`. Lê `plans` pelo código e propaga `features` + `limits` para `clinics.settings` das clínicas selecionadas. **Sobrescreve** overrides existentes. Ver `architecture/PLANS_LIMITS.md` §2.
