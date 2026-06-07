---
title: "Feature: Email Campaigns (envio em massa por email)"
topic: email
kind: feature
audience: agent
updated: 2026-06-07
summary: Email Campaigns permite à clínica enviar um template ativo para uma audiência derivada de **um ou mais segmentos** (ou a base inteira). O envio é assíncrono via `email_queue` + Resend, com proteções de cota, warmup, throttle por destinatári
---
# Feature: Email Campaigns (envio em massa por email)

> **Quando ler:** antes de criar/editar telas de campanhas, ajustar segmentação, A/B, rotação de domínio, warmup ou throttle.
> **Última atualização:** 2026-05-30
> **Veja também:** `flows/EMAIL_CAMPAIGN.md` (passo a passo runtime), `database/SCHEMA.md` (Email Marketing), `edge-functions/EMAIL.md`.

---

## Visão geral

Email Campaigns permite à clínica enviar um template ativo para uma audiência derivada de **um ou mais segmentos** (ou a base inteira). O envio é assíncrono via `email_queue` + Resend, com proteções de cota, warmup, throttle por destinatário, supressão por bounce e A/B testing.

UI: `src/pages/email/EmailCampaigns.tsx` (lista, criação, agendamento, pause/resume, duplicar, enviar teste, preview de destinatários).

---

## Multi-segmento

- Coluna nova: `email_campaigns.segment_ids uuid[]` (preferencial).
- Coluna legada: `email_campaigns.segment_id uuid` mantida para retro-compatibilidade — o backfill copiou cada valor existente para `segment_ids = ARRAY[segment_id]`.
- Regra do frontend (`EmailCampaigns.tsx`):
  - Se o usuário escolhe **1** segmento → `segment_id` é mantido sincronizado.
  - Se escolhe **0** ou **>1** segmentos → `segment_id = NULL`; `segment_ids` é a fonte da verdade.
- `dispatch-campaign` resolve a audiência iterando `segment_ids[]`, chamando `resolve_email_segment(_segment_id)` paginado (1000/page, safety cap 200k) para cada um e **deduplicando por email** (mantém a primeira ocorrência: `name`, `lead_id`).
- Sem segmentos → fallback "todos os leads com email + `email_segment_contacts`" (também paginado).
- `CampaignRecipientsPreview` (`src/components/email/CampaignRecipientsPreview.tsx`) faz a mesma união para mostrar a contagem **antes** de despachar; usa `segKey = segment_ids.sort().join(',')` como cache key.

> **Pitfall**: ao mudar de 1 para vários segmentos, a UI zera `segment_id`. Reports/dashboards antigos que filtravam só por `segment_id` precisam migrar para `segment_ids @> ARRAY[...]`.

---

## A/B Testing (R-20)

- `email_campaigns.variant_strategy ∈ ('none','ab','multi')`.
- Tabela `email_campaign_variants(label, weight, subject_override, template_slug_override, from_name_override, sent_count, opened_count, clicked_count, is_winner)`.
- `dispatch-campaign` aplica **round-robin ponderado determinístico** (hash do email) → re-disparos atribuem a mesma variante ao mesmo destinatário.
- Métricas materializadas via RPC `pick_ab_winner(_campaign_id)` (sent/opened/clicked por variante) e marcam `is_winner=true` por melhor taxa de abertura; `winner_picked_at` registra o momento.
- `email_queue.variant_id` e `email_logs.variant_id` carregam a atribuição para reporting.

---

## Rotação de domínio + Warmup (R-21 / R-12)

- `email_domains` tem `rotation_pool` (string) e `weight` (int).
- `email_campaigns.from_domain_pool` define qual pool usar; `dispatch-campaign` chama `pick_rotation_domain(_clinic_id, _pool)` por destinatário.
- `from_domain_override` é persistido em `email_queue` e `email_logs`.
- Warmup: `email_domain_warmup` mantém limite diário por domínio com curva (50 → 100 → 500 → 1k → …). `claim_domain_warmup` é atômico; estouro reagenda o job +30 min e libera o `email_send_dedup`.

---

## Throttle, cota e supressão

- **Cota diária por clínica**: `claim_email_quota` (UPSERT atômico). Estouro reagenda para 12:00 UTC do dia seguinte.
- **Throttle por domínio destinatário**: `claim_recipient_throttle` (1000/h). Estouro reagenda para a próxima janela.
- **Supressão**: `email_unsubscribes` (manual ou auto via webhook); `force=true` ignora (uso interno em testes).
- **Health auto-pause** (R-16): bounce > 5% ou complaint > 0.3% via `check_clinic_bounce_health` → pausa campanhas ativas + insere `email_health_alerts`.

---

## Agendamento

- `scheduled_for timestamptz` + `status='scheduled'`.
- `process-scheduled-campaigns` (cron 5min) move scheduled→dispatching no momento certo.
- `send_rate_per_minute` espalha os jobs em janelas de 1 min para evitar burst (R-18).

---

## Pause / Resume / Duplicar / Teste

- **Pause**: muda `status='paused'`; trava novo dispatch, mas **não cancela** jobs já enfileirados.
- **Resume**: status volta a `scheduled` ou `sending`.
- **Duplicar**: copia `template_slug`, `segment_ids`, variants e configurações; cria nova em `draft`.
- **Teste**: `dispatch-campaign { test_only: true, test_email_override }` pega 1 lead amostral do(s) segmento(s) para popular variáveis.

---

## Arquivos-chave

- Frontend: `src/pages/email/EmailCampaigns.tsx`, `src/components/email/CampaignRecipientsPreview.tsx`, `CampaignLiveDialog`.
- Edge: `supabase/functions/dispatch-campaign/index.ts`, `process-scheduled-campaigns`, `process-email-queue`, `send-email-batch`, `send-email`, `resend-webhook`.
- DB: `email_campaigns`, `email_campaign_variants`, `email_queue`, `email_logs`, `email_send_dedup`, `email_domain_warmup`, `email_recipient_throttle`, `email_health_alerts`, `email_operational_alerts`, views `email_throughput_stats`/`email_system_health`.
- RPCs: `resolve_email_segment`, `resolve_email_segment_preview`, `claim_email_quota`, `claim_domain_warmup`/`release_domain_warmup`, `claim_recipient_throttle`, `pick_ab_winner`, `pick_rotation_domain`, `check_clinic_bounce_health`, `check_email_operational_health`, `report_campaign_stats`.
