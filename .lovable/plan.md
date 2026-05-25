## Limite de gasto de IA por clínica

Adicionar controle de teto diário de gasto (USD) por clínica na área **Custos** do painel admin, com bloqueio automático de todas as chamadas de IA ao atingir 100%, reativação manual por admin e e-mails de aviso aos thresholds escolhidos.

## O que muda na interface (página Custos)

Nova seção no topo de **AI Hub → Custos** (`src/pages/MetricsAiUsage.tsx`), visível só para `is_clinic_admin`:

- **Card "Limite diário"** mostrando:
  - Barra de progresso `gasto hoje / limite` (verde < 50%, amarelo 50–90%, vermelho ≥ 90%, cinza-bloqueado em 100%)
  - Valor atual em USD + % consumido + horário em que reseta (00:00 America/Sao_Paulo)
  - Status: **Ativo** / **Bloqueado por limite** (badge)
  - Botão **Reativar agora** (aparece só quando bloqueado) — confirma e libera até o próximo reset ou até bater o limite de novo
- **Botão "Configurar limite"** abre dialog com:
  - Limite diário em USD (input numérico, ex.: `5.00`)
  - Toggle "Bloquear chamadas ao atingir 100%" (default ON)
  - Lista editável de **e-mails de aviso** (chips: adicionar/remover) — já pré-preenchidos: `contato@mkart.com.br` na ÓR; admin da MKart configura os dela
  - Switches dos thresholds que disparam e-mail: 50%, 90%, 100% (defaults marcados conforme escolha)
- **Histórico** (lista simples abaixo): últimas 10 ocorrências de bloqueio/reativação/aviso enviado, com data e quem reativou.

## O que muda no backend

### Tabelas novas

- `ai_spend_limits` (1 linha por clínica)
  - `clinic_id` (PK, FK→clinics)
  - `daily_limit_usd` numeric(10,4)
  - `block_on_limit` bool (default true)
  - `notify_emails` text[] (lista configurável)
  - `notify_thresholds` int[] (ex.: `{50,90,100}`)
  - `blocked` bool (default false)
  - `blocked_at` timestamptz
  - `blocked_reason` text
  - `manual_override_until` timestamptz (quando admin reativa antes do reset, ignora bloqueio até essa hora ou até atingir novo limite)
  - timestamps
- `ai_spend_events` (auditoria leve)
  - `clinic_id`, `kind` (`threshold_50`/`threshold_90`/`blocked`/`reactivated`/`auto_reset`), `spent_usd`, `limit_usd`, `actor_user_id`, `notes`, `created_at`
- `ai_spend_notifications_sent` (idempotência diária)
  - `clinic_id`, `date` (date), `threshold` (int) — PK composta — garante 1 e-mail por threshold por dia

RLS: `clinic_scoped` (admin lê/escreve), super admin tudo. Sem políticas para `authenticated` comum em escrita.

### Função SQL (security definer, schema public)

`public.check_ai_spend_status(p_clinic_id uuid)` retorna:
```
{ allowed: bool, blocked: bool, spent_today_usd, limit_usd, percent }
```
Calcula `SUM(cost_usd)` em `ai_usage` do dia (TZ America/Sao_Paulo) e compara com o limite. Permite chamada via RPC.

### Hook nos edge functions de IA (guard)

Em `supabase/functions/_shared/metrics.ts` adicionar `assertSpendAllowed(clinic_id)`:
- Chama `check_ai_spend_status`
- Se `allowed === false`, lança erro `SpendLimitExceeded` que cada função converte em HTTP 402 com mensagem `{"error":"daily_spend_limit_reached","limit_usd":X,"spent_usd":Y}`

Adicionar a chamada no início de:
- `ai-chat`, `ai-auto-reply`, `ai-assist`, `ai-analyst-run`, `ai-eval-run`
- `ai-embed`, `ai-ingest-pdf`, `ai-ingest-url`, `ai-ingest-urls`, `ai-ingest-document`

(Resolve clinic_id da mesma forma que `logUsage` já faz.)

### Trigger pós-insert em `ai_usage`

`AFTER INSERT ON ai_usage` chama função que:
1. Recalcula `spent_today` da clínica
2. Para cada threshold em `notify_thresholds` ainda não enviado hoje (consulta `ai_spend_notifications_sent`), enfileira chamada para edge function `ai-spend-notify` via `pg_net` e marca como enviado
3. Se atingiu 100% e `block_on_limit=true`, seta `blocked=true`, `blocked_at=now()`, insere event `blocked`

### Edge function nova: `ai-spend-notify`

- Recebe `{ clinic_id, threshold, spent_usd, limit_usd }`
- Busca `notify_emails` da clínica
- Reutiliza infra de e-mail existente do projeto (Resend via `supabase/functions/send-email`) para mandar um e-mail simples por destinatário com assunto:
  - `[CRM] Alerta de gasto IA — 50% atingido (Clínica X)` / `90%` / `Bloqueio ativado`
- Body curto em HTML mostrando gasto/limite/horário, link para a página Custos.

### Cron de reset diário

`pg_cron` job `ai-spend-daily-reset` às 00:05 America/Sao_Paulo:
- `UPDATE ai_spend_limits SET blocked=false, blocked_at=null, blocked_reason=null, manual_override_until=null`
- Insere event `auto_reset` por clínica que estava bloqueada

### Reativação manual

RPC `reactivate_ai_spend(p_clinic_id)`:
- Só `is_clinic_admin` ou `is_super_admin`
- Seta `blocked=false`, `manual_override_until = now() + interval '15 min'` (janela curta antes do próximo `check_ai_spend_status` reavaliar — se gasto continua acima do limite, bloqueia de novo na próxima chamada e dispara novo evento `blocked` mas sem reenvio de e-mail no mesmo dia)
- Registra event `reactivated` com `actor_user_id`

## Comportamento UX quando bloqueado

- Toda chamada IA do app (composer com sugestão, ai-chat etc.) que receber HTTP 402 mostra toast: **"Limite diário de IA atingido. Reative em AI Hub → Custos."** com link.

## Configuração inicial

Migração popula `ai_spend_limits` para as 3 clínicas existentes:
- ÓR: `daily_limit_usd=2.00`, `notify_emails=['contato@mkart.com.br']`
- MKart: `daily_limit_usd=2.00`, `notify_emails=['contato@mkart.com.br']` (você ajusta depois pela UI)
- Sanapta: igual, sem e-mails (admin da Sanapta configura quando quiser)

Thresholds default: `{50, 90, 100}` conforme escolhido.

## Resumo dos arquivos

**Migration**: cria 3 tabelas + RPCs + trigger + cron + RLS + seed.
**Backend**:
- `supabase/functions/_shared/spend-guard.ts` (novo)
- `supabase/functions/ai-spend-notify/index.ts` (novo)
- guard adicionado nas 10 edge functions de IA
**Frontend**:
- `src/pages/MetricsAiUsage.tsx` (seção topo + dialog)
- `src/components/admin/AiSpendLimitCard.tsx` (novo)
- `src/components/admin/AiSpendLimitDialog.tsx` (novo)
- Toast global em chamadas que retornam 402 (helper em `src/lib/ai-spend.ts`)

Pronto pra eu implementar?