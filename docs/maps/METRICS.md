---
title: "MÃ©tricas & RelatÃ³rios"
topic: general
kind: map
audience: agent
updated: 2026-07-01
summary: "Dashboards de mÃ©tricas (AI usage, engagement, ops), relatÃ³rios agendados por WhatsApp e relatÃ³rio mensal automÃ¡tico da Ã“R."
code_refs:
  - src/pages/Metrics.tsx
  - src/pages/MetricsAiUsage.tsx
  - src/pages/MetricsEngagement.tsx
  - src/pages/MetricsOps.tsx
  - src/pages/ScheduledReports.tsx
  - src/hooks/useTrackFeature.ts
  - supabase/functions/track-event/
  - supabase/functions/scheduled-report-tick/
  - supabase/functions/report-finalizados-mensal-or/
related_docs:
  - docs/maps/AI_AGENTS.md
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/maps/TRACKING.md
---

# MÃ©tricas & RelatÃ³rios â€” Mapa Runtime

Dois eixos: **mÃ©tricas internas** (uso de IA, engagement, ops) exibidas
via `AiHub`; e **relatÃ³rios automÃ¡ticos** entregues por WhatsApp/email.

## 1. Frontend

Todas as rotas caem em `AiHub` (`/ai`, `/metrics/*`) exceto
`ScheduledReports` â€” rota interna via AiHub tambÃ©m.

| Rota / componente | Arquivo | LOC | Dados |
|---|---|---|---|
| `/metrics` | `src/pages/Metrics.tsx` | 171 | `ai_usage` â€” resumo curto |
| `/metrics/ai-usage` | `src/pages/MetricsAiUsage.tsx` | 635 | Custos por agente/modelo, latÃªncia, error rate |
| `/metrics/engagement` `/ai/engagement` | `src/pages/MetricsEngagement.tsx` | 224 | MÃ©tricas de replies/leads/conversÃ£o do pipeline |
| Ops | `src/pages/MetricsOps.tsx` | 240 | Health das edges, filas, retries |
| Scheduled | `src/pages/ScheduledReports.tsx` | 356 | CRUD de `scheduled_reports` (grupo WA + horÃ¡rio) |

Hook interno: `src/hooks/useTrackFeature.ts` (41 LOC) â€” dispara
`track-event` para telemetria de uso do painel (nÃ£o confundir com
tracking-event que Ã© do pixel pÃºblico).

## 2. Edge functions (3)

### 2.1 `track-event` (62 LOC) â€” POST autenticado

Uso: **feature events do painel** (nÃ£o pixel pÃºblico). Aceita
`{ events: [{ feature, action, entity_id?, metadata? }] }`. Valida JWT,
resolve `clinic_id` do usuÃ¡rio e insere em `feature_events` (append).

### 2.2 `scheduled-report-tick` (248 LOC) â€” cron 1min

Para cada `scheduled_reports` habilitada:

1. Compara hora local (`tz`) atual com `send_time` + `weekdays`.
2. Se match e `last_sent_at` nÃ£o Ã© hoje â†’ constrÃ³i texto de mÃ©tricas
   (leads novos, no-reply, agendados, finalizados) com base em
   `metrics` JSONB (flags por mÃ©trica).
3. Envia para `group_jid` via `evoFetch` (Evolution API) usando a
   `instance_id` da clÃ­nica.
4. Atualiza `last_sent_at` + insere `scheduled_report_runs`.

Suporta mÃºltiplos relatÃ³rios por clÃ­nica.

### 2.3 `report-finalizados-mensal-or` (114 LOC) â€” cron dia 1, 06:00 UTC

**Hardcoded para clÃ­nica Ã“R** (`cf038458-â€¦`). Conta entradas em
`lead_stage_history` para 2 stages (Consulta finalizada + 1Âª SessÃ£o
Finalizada) no mÃªs anterior. Insere/atualiza `clinic_monthly_reports` e
envia email via `send-email` (template `or-monthly-finalizados-report`).

## 3. Modelo de dados

- `ai_usage` (23 cols) â€” todo call de LLM (custo, tokens, latÃªncia).
- `feature_events` (8 cols) â€” telemetria do painel.
- `campaign_throughput` (5 cols) â€” throughput de campanhas.
- `email_metrics_daily` (11 cols) â€” agregado diÃ¡rio de email.
- `error_events` (11 cols) â€” erros persistidos.
- `pipeline_provider_health` (5 cols) â€” health por provider.
- `tag_usage_weekly` (7 cols) â€” tags mais usadas semanalmente.
- `scheduled_reports` (16 cols) + `scheduled_report_runs` (8 cols).
- `clinic_monthly_reports` (8 cols) â€” snapshot mensal por clÃ­nica.

## 4. Invariantes / gotchas

- `track-event` **exige** JWT; se cair, o painel sÃ³ perde telemetria
  (nunca UI).
- `scheduled-report-tick` roda a cada minuto â€” proteÃ§Ã£o contra dupla
  entrega Ã© `last_sent_at::date = today::date`. NÃƒO mude o comparador
  para timestamp (bug: reenvia se muda tz do servidor).
- `report-finalizados-mensal-or` Ã© acoplado a UUIDs de stage
  especÃ­ficos da Ã“R. Se a clÃ­nica renomear/recriar stages, o cron para
  de contar silenciosamente.
- `ai_usage` cresce rapidamente (todo call de agente). Queries em UI
  devem usar `fetchAllPaged` + filtro por `created_at` (janela).
- `MetricsAiUsage` (635 LOC) Ã© o consumidor mais pesado â€” evite full
  scan; agregue por dia quando o range > 7d.
