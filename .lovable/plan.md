## Contexto

O módulo de email já está completo e multi-tenant (`clinic_id` + RLS por clínica): tabelas, RPCs `enqueue_email` / `generate_unsubscribe_token`, edge functions `send-email` / `process-email-queue` / `process-scheduled-campaigns` / `resend-webhook` / `email-unsubscribe` / `dispatch-campaign` / `backfill-resend-events`, editor visual de blocos (dnd-kit + tiptap), páginas Dashboard/Templates/Editor/Queue/Logs/Unsubscribes/Segments/Campaigns/Automations, dedup, supressão, backoff de quota, cron jobs, realtime no dashboard.

Este plano **não recria nada**. Foca apenas nos 4 gaps confirmados:

1. Daily-summary (cron 8h BRT)
2. Test mode em campanhas
3. Relatórios detalhados por template e por campanha
4. Automation builder visual em modo fluxo

Editor fica como está. Webhook segue sem secret (`RESEND_WEBHOOK_SECRET` configurado depois).

---

## Passo 1 — Migration (apenas adições)

```text
- email_campaigns: ADD COLUMN test_email TEXT, test_sent_at TIMESTAMPTZ
- email_automations.steps: garantir shape { template_slug, delay_days, filters? }
- RPC report_template_stats(_clinic_id, _slug, _from, _to)
   → retorna { sent, delivered, opened, clicked, bounced, complained,
                open_rate, click_rate, best_hour }
- RPC report_campaign_stats(_clinic_id, _campaign_id)
   → mesma forma + funil
- Índice em email_logs(template_slug, sent_at) e (clinic_id, sent_at)
   se ainda não existir
```

Nada de DROP / RENAME. RLS continua via `has_clinic_access(clinic_id)`.

## Passo 2 — Edge function `daily-summary`

```text
supabase/functions/daily-summary/index.ts
- POST sem body, autoriza por service role
- Para cada clinic ativo com email_marketing on:
    - conta leads novos 24h
    - conta emails enviados / abertos / cliques / bounces 24h
    - top 3 templates por envio
    - quota usada
- Renderiza HTML inline (sem template — é interno)
- Lê emails dos admins via clinic_members.role IN ('owner','admin')
- Chama send-email com force=true (bypass de supressão)
- Logs próprios em console
```

Cron via `pg_cron` + `pg_net` (insert SQL, não migration):

```sql
SELECT cron.schedule('email-daily-summary', '0 11 * * *',  -- 08:00 BRT
  $$ SELECT public.invoke_edge_function('daily-summary', '{}'::jsonb) $$);
```

## Passo 3 — Test mode em campanhas

**Backend (`dispatch-campaign`)**:
- Aceita body `{ campaign_id, test_only?: true }`.
- Se `test_only`: enfileira 1 envio para `campaigns.test_email` com `force=true` + variáveis sample do primeiro lead do segmento; **não** marca campanha como sending/sent, só atualiza `test_sent_at`.

**UI (`EmailCampaigns.tsx`)**:
- Dialog ganha campo "Email de teste" (default = `user.email`).
- Botão "Enviar teste" ao lado de "Salvar" no dialog.
- Na tabela, novo botão `Beaker` em campanhas draft/scheduled → reabre dialog em modo teste.
- Toast com link "ver no log".

## Passo 4 — Relatórios detalhados

Nova página `src/pages/email/EmailReports.tsx` + aba em `EmailHub`.

Layout:

```text
┌─────────────────────────────────────────────────┐
│  Tabs: Por template │ Por campanha              │
├─────────────────────────────────────────────────┤
│  Filtros: período (7/30/90d) + template/camp.   │
├─────────────────────────────────────────────────┤
│  Cards: enviados, entregues %, abertura %,      │
│         clique %, bounces, descadastros         │
│  Funnel chart (recharts)                        │
│  Bar chart por hora do dia (melhor horário)     │
│  Tabela detalhada de envios recentes            │
└─────────────────────────────────────────────────┘
```

- Dados via RPCs `report_template_stats` / `report_campaign_stats`.
- "Melhor horário" = hora com maior `opened_count / sent_count`.
- Export CSV.

## Passo 5 — Automation builder visual

Reescrever `src/pages/email/EmailAutomations.tsx` em layout fluxo:

```text
[ Trigger ]      lead_created / stage_enter / test_completed
    │
    ▼
[ Filtros ]      tags, stage_id, score min/max  (opcional)
    │
    ▼
[ Step 1 ]       template + delay (Xd Xh)   ← drag-drop reordenar
    │
    ▼
[ Step 2 ]       template + delay
    │
    ▼
[ + Adicionar step ]
```

- Componente `AutomationFlow.tsx` usando `@dnd-kit/sortable`.
- Cada step = card com Select(template) + Input(dias) + Input(horas) + botão excluir.
- Painel lateral direito: settings da automação (nome, descrição, toggle active, trigger_type, trigger_config).
- Validação: pelo menos 1 step, template existe e ativo.
- Salva tudo em `email_automations` (mesma tabela atual, só shape do `steps` jsonb).
- Trigger novo `test_completed`: documentar como string livre; o usuário enfileira via RPC quando o teste é concluído. Sem código extra de trigger no banco neste passo.

## Passo 6 — Polimento

- `EmailHub` ganha aba **Relatórios**.
- `Dashboard` adiciona link "Ver relatório completo" → `/emails/reports`.
- Documentar endpoint do webhook Resend em `SettingsEmailDomain` com botão copiar (já existe? confirmar e adicionar se não).

## Passo 7 — Checklist de aceite

```text
[ ] daily-summary chega no inbox do owner às 08:00 BRT
[ ] campanha em draft permite enviar teste sem mudar status
[ ] relatório de template mostra abertura% e melhor hora
[ ] automation builder permite drag-drop, edição inline, salva
[ ] nada quebrou em queue/logs/unsubscribes/segments/templates
```

---

## Detalhes técnicos

- RPCs e migration aplicadas via `supabase--migration` em uma única call.
- Cron de daily-summary via `supabase--insert` (SQL com chave de serviço).
- Edge function `daily-summary` deployada com `supabase--deploy_edge_functions`.
- Tudo respeita `clinic_id` + RLS existente.
- Tailwind semantic tokens, shadcn, sem cores hardcoded.
