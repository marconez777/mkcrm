# Operações: Custos e Limites

> **Quando ler:** antes de mexer em pricing de IA, budget de clínica, throttle de envio, ou quando aparecer alerta de gasto.
> **Última atualização:** 2026-05-30

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

Campos em `clinic_settings`:

| Campo | Default | Função |
|---|---|---|
| `ai_monthly_budget_usd` | 10 | hard limit; ao atingir, pausa runs |
| `ai_soft_warning_pct` | 0.8 | manda email aviso em 80% |
| `ai_model_primary` | gemini-2.5-flash | modelo default |
| `ai_model_fallback` | gemini-2.5-flash-lite | quando primary indisponível |
| `ai_auto_reply_enabled` | true | liga/desliga |
| `ai_max_runs_per_lead_per_day` | 50 | guarda contra loop |

Job `ai-spend-notify` (de hora em hora):
1. Soma `ai_runs.cost_usd` do mês corrente por `clinic_id`.
2. Se ≥ soft → email + flag `ai_soft_warned_at`.
3. Se ≥ hard → `clinic_settings.ai_paused_until_next_cycle=true` + email crítico.

Reset no dia 1 de cada mês via cron.

---

## Throttles do sistema

| Recurso | Limite | Onde configurar |
|---|---|---|
| WhatsApp por instância | 30 msg/min default, max 60 | `clinic_settings.wa_max_per_min` |
| Broadcast por broadcast | igual ao da instância | UI de broadcast |
| Email por clínica | 10 req/s Resend default | hardcoded em `dispatch-campaign` |
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
| **Dispatcher** | `BATCH_SIZE=1000`, `CONCURRENCY=5`, `BATCH_PARALLELISM=5`, cron ~15s | `process-email-queue` (sintoniza ao rate-limit do Resend, 5 req/s) | constantes da edge function |

Pausa automática por bounce/complaint não conta como cap: é proteção de reputação (>5% bounce ou >0.3% complaint nas últimas 1000 mensagens da clínica → todas as campanhas `running/sending/scheduled` viram `paused`, com registro em `email_health_alerts`). Ver [`operations/ERROR_HANDLING.md`](./ERROR_HANDLING.md#resend) e R-16.

---

## Estimativa rápida (clínica média)

- 100 leads/mês, 8 msgs por lead com IA = 800 turnos = ~1.6M tokens = **~1.50 USD/mês**.
- 2 broadcasts/mês para 500 leads = 1000 envios WhatsApp = custo zero direto.
- 4 campanhas email × 1000 destinatários = 4000 emails = dentro do Resend free.

Margem confortável com budget default de 10 USD.

---

## Onde inspecionar gastos

- Query: `SELECT date_trunc('day', created_at), sum(cost_usd) FROM ai_runs WHERE clinic_id=$1 GROUP BY 1`.
- View: `vw_ai_spend_by_clinic_month` (se existir; senão criar).
- Dashboard: futura página em `/settings/billing` (TODO em `roadmap/IMPROVEMENTS.md`).

---

## Pegadinhas

- **Tokens contados pelo provedor**, não pela nossa estimativa. Confiar em `usage` da resposta.
- **Tool calls duplas**: cada iteração no loop conta tokens cheios. Loop de 6 = 6× custo. Hard cap em `ai-tools.ts`.
- **Embeddings**: hoje grátis (modelo gateway gratuito). Pode mudar.
- **Imagem/PDF input**: infla input tokens 10–100×. Limitar uso.
- **Reset de budget**: se mudar `ai_monthly_budget_usd` no meio do mês, recalcular se já estava pausado.

---

## Melhorias sugeridas

- Página de billing por clínica com gráfico diário.
- Alerta no Slack/email quando >2 clínicas pausarem no mesmo dia.
- Cache semântico para perguntas repetidas (corta ~30% de custo IA).
- Cron mensal de `cleanup_ai_runs` arquivando >90 dias (storage).

---

## Arquivos-chave

- `supabase/functions/_shared/ai-pricing.ts`
- `supabase/functions/ai-spend-notify/index.ts`
- `integrations/LOVABLE_AI.md`
- `roadmap/IMPROVEMENTS.md`
