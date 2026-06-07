---
title: "Operações: Custos e Limites"
topic: operations
kind: reference
audience: agent
updated: 2026-06-07
summary: "Por 1M tokens (snapshot — atualizar conforme Lovable muda):"
---
# Operações: Custos e Limites

> **Quando ler:** antes de mexer em pricing de IA, budget de clínica, throttle de envio, ou quando aparecer alerta de gasto.
> **Última atualização:** 2026-06-03

---

## Custos por área

### 1. IA (Lovable AI Gateway)

Por 1M tokens (snapshot — atualizar conforme Lovable muda):

| Modelo | Input USD | Output USD |
|---|---|---|
| `google/gemini-2.5-flash` | 0.30 | 2.50 |
| `google/gemini-2.5-flash-lite` | 0.10 | 0.40 |
| `google/gemini-2.5-pro` | 1.25 | 10.00 |
| `openai/gpt-5-mini` | 0.25 | 2.00 |
| `openai/gpt-5` | 5.00 | 15.00 |

Fonte da verdade no código: `supabase/functions/_shared/ai-pricing.ts` (e espelho `src/lib/ai-pricing.ts`).

**Custo médio observado** (auto-reply típico, 8 turnos, com RAG leve): ~0.002 USD por conversa com `gemini-2.5-flash`.

### 2. WhatsApp (Evolution API)

- Custo de infra fixo por instância (varia conforme provedor do servidor Evolution). Sem custo por mensagem.
- Limite prático: ~1 msg/s por instância antes de risco de ban WhatsApp.

### 3. Email (Resend)

- Free tier: 100 emails/dia, 3000/mês.
- Pago: a partir de 20 USD/mês = 50k emails.
- Custo por email = total mensal / volume; sem cobrança por evento (open/click).

### 4. Supabase / Lovable Cloud

- Storage, DB, edge function invocations: ver `Connectors → Lovable Cloud → Billing`.
- Realtime: concurrent connections cobrados acima de quota.
- Edge function execution time soma rápido em ticks (60/h × workers).

---

## Budget por clínica (IA)

> ⚠️ Configurações de IA vivem em **`clinics.settings.ai`** (JSON) e em **`ai_spend_limits`** (tabela dedicada). Não existe tabela `clinic_settings`.

Campos relevantes:

| Campo | Onde | Função |
|---|---|---|
| `monthly_cap_usd` | `ai_spend_limits` (por clinic_id) | hard limit; spend-guard retorna **HTTP 402** ao atingir |
| `soft_warning_pct` | `ai_spend_limits` | dispara aviso (`ai_spend_notifications_sent` registra envio) |
| `clinics.settings.ai.model_primary` | clinics JSON | modelo default |
| `clinics.settings.ai.model_fallback` | clinics JSON | quando primary indisponível |
| `clinics.settings.ai.auto_reply_enabled` | clinics JSON | liga/desliga auto-reply |

Job `ai-spend-notify` (de hora em hora):
1. Soma custo do mês corrente por `clinic_id` lendo `ai_usage` / `ai_spend_events` (e cache em `ai_usage_daily`).
2. Se ≥ soft → grava em `ai_spend_notifications_sent` + email.
3. Se ≥ hard (`monthly_cap_usd`) → spend-guard passa a recusar runs com 402.

Reset por ciclo mensal definido em `ai_spend_limits`.

---

## Throttles do sistema

| Recurso | Limite | Onde configurar |
|---|---|---|
| WhatsApp por instância | configurável por clínica | `clinics.settings.whatsapp.*` |
| Broadcast por broadcast | `throttle_seconds` + jitter ±10% | coluna em `broadcasts` |
| Email por clínica | `CONCURRENCY=5` no caminho singular + batch (Resend Batch API) | constantes em `process-email-queue` |
| AI runs concorrentes por lead | 1 | `pg_advisory_xact_lock(lead_id)` |
| Sequence enrollments por lead | sem limite | TODO: anti-spam |

---

## Limites de email em escala

Para o módulo de email marketing, há quatro mecanismos sobrepostos. Detalhes e SLOs em [`roadmap/EMAIL_SCALE.md`](../roadmap/EMAIL_SCALE.md) (R-12, R-13, R-23).

| Mecanismo | Default | Onde | Override |
|---|---|---|---|
| **Cota diária por clínica** | 1000 emails/dia | `claim_email_quota` (RPC atômico) | `clinics.settings.email.quota_daily` |
| **Warm-up de domínio** (opt-in) | curva `50→100→500→1k→5k→10k→25k→ilimitado` por dia desde `started_at` | `email_domain_warmup` (1 linha por clínica+domain) + `claim_domain_warmup`/`release_domain_warmup` | sem linha = sem cap (cliente migrando com domínio já aquecido) |
| **Throttle por destinatário** | 1000/h por `dest_domain` (janela horária) | `email_recipient_throttle` + `claim_recipient_throttle` | `clinics.settings.email.throttle_recipient_enabled = false` desliga 1 round-trip Postgres/job |
| **Dispatcher** | `BATCH_SIZE=400`, `CONCURRENCY=2` (singular) + Batch API quando ≥3 jobs no grupo, cron ~15s | `process-email-queue` (respeita 2 req/s do Resend no caminho singular) | constantes da edge function |

Pausa automática por bounce/complaint não conta como cap: é proteção de reputação (>5% bounce ou >0.3% complaint nas últimas 1000 mensagens da clínica → todas as campanhas `running/sending/scheduled` viram `paused`, com registro em `email_health_alerts`). Ver [`operations/ERROR_HANDLING.md`](./ERROR_HANDLING.md#resend) e R-16.

---

## Estimativa rápida (clínica média)

- 100 leads/mês, 8 msgs por lead com IA = 800 turnos = ~1.6M tokens = **~1.50 USD/mês**.
- 2 broadcasts/mês para 500 leads = 1000 envios WhatsApp = custo zero direto.
- 4 campanhas email × 1000 destinatários = 4000 emails = dentro do Resend free.

Margem confortável com cap default de 10 USD.

---

## Onde inspecionar gastos

- Query agregada: `SELECT date, total_cost_usd FROM ai_usage_daily WHERE clinic_id=$1 ORDER BY date DESC` (já materializa diário).
- Linha-a-linha: `SELECT created_at, model, cost_usd FROM ai_usage WHERE clinic_id=$1 ORDER BY created_at DESC LIMIT 200`.
- Eventos de pico/spend-guard: `ai_spend_events`.
- Notificações já enviadas: `ai_spend_notifications_sent`.
- Dashboard: futura página em `/settings/billing` (TODO em `roadmap/IMPROVEMENTS.md`).

> ⚠️ Não existe view `vw_ai_spend_by_clinic_month` — `ai_usage_daily` já cobre o caso.

---

## Pegadinhas

- **Tokens contados pelo provedor**, não pela nossa estimativa. Confiar em `usage` da resposta.
- **Tool calls duplas**: cada iteração no loop conta tokens cheios. Loop de 6 = 6× custo. Hard cap em `agent-tools.ts` (não existe `ai-tools.ts`).
- **Embeddings**: hoje grátis (modelo gateway gratuito). Pode mudar.
- **Imagem/PDF input**: infla input tokens 10–100×. Limitar uso.
- **Reset de cap**: se mudar `ai_spend_limits.monthly_cap_usd` no meio do mês, recalcular se já estava pausado.

---

## Melhorias sugeridas

- Página de billing por clínica com gráfico diário (consumindo `ai_usage_daily`).
- Alerta no Slack/email quando >2 clínicas pausarem no mesmo dia.
- Cache semântico para perguntas repetidas (corta ~30% de custo IA).
- Cron mensal de cleanup arquivando `ai_usage` >90 dias (storage).

---

## Arquivos-chave

- `supabase/functions/_shared/ai-pricing.ts`
- `supabase/functions/_shared/spend-guard.ts`
- `supabase/functions/ai-spend-notify/index.ts`
- `docs/integrations/LOVABLE_AI.md`
- `docs/roadmap/IMPROVEMENTS.md`
