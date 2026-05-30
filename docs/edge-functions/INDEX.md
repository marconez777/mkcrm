# Edge Functions — Índice

> Última atualização: 2026-05-30
> Total: **67 edge functions** em `supabase/functions/` + 13 módulos compartilhados em `_shared/`.
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
| IA / Agentes / RAG | `ai-*` (10), `agent-run-bulk`, `ai-spend-notify`, `classifier-daily-batch`, `daily-summary` | [`AI.md`](./AI.md) |
| Email Marketing (Resend) | `send-email`, `send-email-batch`, `process-email-queue`, `email-automations-tick`, `dispatch-campaign`, `process-scheduled-campaigns`, `resend-webhook`, `backfill-resend-events`, `email-domain-manage`, `email-unsubscribe` | [`EMAIL.md`](./EMAIL.md) |
| Tracking (Pixel) | `tracking-pixel`, `tracking-event`, `tracking-identify`, `tracking-config` | [`TRACKING.md`](./TRACKING.md) |
| Broadcasts | `broadcast-tick`, `broadcast-control` | [`BROADCASTS.md`](./BROADCASTS.md) |
| Sequências / Automações | `sequence-tick`, `sequence-enroll`, `sequence-trigger`, `automations-tick`, `scheduled-dispatcher`, `watch-stale-leads` | [`SEQUENCES_AUTOMATIONS.md`](./SEQUENCES_AUTOMATIONS.md) |
| Relatórios agendados (WhatsApp) | `scheduled-report-tick` (cron 1 min — envia métricas para grupos WA) | — (ver `features/` futuro) |
| Formulários públicos | `forms-ingest`, `forms-admin`, `forms-snippet`, `forms-plugin-zip`, `external-lead-capture` | [`FORMS.md`](./FORMS.md) |
| Autenticação / Clínicas | `auth-login`, `clinic-create-user`, `clinic-invite`, `integrations-status` | [`AUTH.md`](./AUTH.md) (em `architecture/`) |
| Helpers compartilhados | `_shared/*.ts` (13 arquivos, inclui `template-vars.ts`) | [`SHARED_HELPERS.md`](./SHARED_HELPERS.md) |

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
