---
title: "Métricas & Relatórios"
topic: general
kind: map
audience: agent
updated: 2026-07-01
summary: "Dashboards de métricas (AI usage, engagement, ops), relatórios agendados por WhatsApp e relatório mensal automático da ÓR."
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
  - docs/maps/EVOLUTION_EDGES.md
  - docs/maps/TRACKING.md
---

# Métricas & Relatórios — Mapa Runtime

Dois eixos: **métricas internas** (uso de IA, engagement, ops) exibidas
via `AiHub`; e **relatórios automáticos** entregues por WhatsApp/email.

## 1. Frontend

Todas as rotas caem em `AiHub` (`/ai`, `/metrics/*`) exceto
`ScheduledReports` — rota interna via AiHub também.

| Rota / componente | Arquivo | LOC | Dados |
|---|---|---|---|
| `/metrics` | `src/pages/Metrics.tsx` | 171 | `ai_usage` — resumo curto |
| `/metrics/ai-usage` | `src/pages/MetricsAiUsage.tsx` | 635 | Custos por agente/modelo, latência, error rate |
| `/metrics/engagement` `/ai/engagement` | `src/pages/MetricsEngagement.tsx` | 224 | Métricas de replies/leads/conversão do pipeline |
| Ops | `src/pages/MetricsOps.tsx` | 240 | Health das edges, filas, retries |
| Scheduled | `src/pages/ScheduledReports.tsx` | 356 | CRUD de `scheduled_reports` (grupo WA + horário) |

Hook interno: `src/hooks/useTrackFeature.ts` (41 LOC) — dispara
`track-event` para telemetria de uso do painel (não confundir com
tracking-event que é do pixel público).

## 2. Edge functions (3)

### 2.1 `track-event` (62 LOC) — POST autenticado

Uso: **feature events do painel** (não pixel público). Aceita
`{ events: [{ feature, action, entity_id?, metadata? }] }`. Valida JWT,
resolve `clinic_id` do usuário e insere em `feature_events` (append).

### 2.2 `scheduled-report-tick` (248 LOC) — cron 1min

Para cada `scheduled_reports` habilitada:

1. Compara hora local (`tz`) atual com `send_time` + `weekdays`.
2. Se match e `last_sent_at` não é hoje → constrói texto de métricas
   (leads novos, no-reply, agendados, finalizados) com base em
   `metrics` JSONB (flags por métrica).
3. Envia para `group_jid` via `evoFetch` (Evolution API) usando a
   `instance_id` da clínica.
4. Atualiza `last_sent_at` + insere `scheduled_report_runs`.

Suporta múltiplos relatórios por clínica.

### 2.3 `report-finalizados-mensal-or` (114 LOC) — cron dia 1, 06:00 UTC

**Hardcoded para clínica ÓR** (`cf038458-…`). Conta entradas em
`lead_stage_history` para 2 stages (Consulta finalizada + 1ª Sessão
Finalizada) no mês anterior. Insere/atualiza `clinic_monthly_reports` e
envia email via `send-email` (template `or-monthly-finalizados-report`).

## 3. Modelo de dados

- `ai_usage` (23 cols) — todo call de LLM (custo, tokens, latência).
- `feature_events` (8 cols) — telemetria do painel.
- `campaign_throughput` (5 cols) — throughput de campanhas.
- `email_metrics_daily` (11 cols) — agregado diário de email.
- `error_events` (11 cols) — erros persistidos.
- `pipeline_provider_health` (5 cols) — health por provider.
- `tag_usage_weekly` (7 cols) — tags mais usadas semanalmente.
- `scheduled_reports` (16 cols) + `scheduled_report_runs` (8 cols).
- `clinic_monthly_reports` (8 cols) — snapshot mensal por clínica.

## 4. Invariantes / gotchas

- `track-event` **exige** JWT; se cair, o painel só perde telemetria
  (nunca UI).
- `scheduled-report-tick` roda a cada minuto — proteção contra dupla
  entrega é `last_sent_at::date = today::date`. NÃO mude o comparador
  para timestamp (bug: reenvia se muda tz do servidor).
- `report-finalizados-mensal-or` é acoplado a UUIDs de stage
  específicos da ÓR. Se a clínica renomear/recriar stages, o cron para
  de contar silenciosamente.
- `ai_usage` cresce rapidamente (todo call de agente). Queries em UI
  devem usar `fetchAllPaged` + filtro por `created_at` (janela).
- `MetricsAiUsage` (635 LOC) é o consumidor mais pesado — evite full
  scan; agregue por dia quando o range > 7d.
