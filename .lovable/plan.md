
# Plano: máxima velocidade de envio — MCD

## Diagnóstico final

| # | Gargalo | Valor atual | Após mudança |
|---|---|---|---|
| 1 | Cota diária da MCD | **1.000/dia** (default) | **ilimitada** (50M) |
| 2 | `CONCURRENCY` (envios singulares paralelos) | 2 | **5** |
| 3 | `BATCH_PARALLELISM` (Resend Batch simultâneos) | 3 | **5** |
| 4 | Threshold para agrupar em Batch API | ≥3 jobs | **≥2 jobs** |
| 5 | `BATCH_SIZE` por execução do cron | 400 | **1.000** |
| 6 | Cron interval | 10s ✅ ok | mantém |
| 7 | Throttle por domínio destino (1.000/h Gmail etc.) | ligado | **desligado p/ MCD** |
| 8 | Warmup do domínio | já off (tabela vazia) | mantém off ✅ |

**Resend rate limit oficial: 5 req/s por team** (fonte: docs.resend.com/api-reference/rate-limit). Com Batch API (100 emails/req), teto = **30.000/min**. Já há retry com `Retry-After` em 429 — seguro encostar no limite.

## Mudanças

### 1. Cota ilimitada para a MCD (via insert tool)

```sql
UPDATE clinics
SET settings = jsonb_set(
  jsonb_set(coalesce(settings,'{}'::jsonb), '{email}', coalesce(settings->'email','{}'::jsonb)),
  '{email,quota_daily}', '50000000'::jsonb
)
WHERE id = '3c48b379-f084-478d-a51c-9daa41ad661a';
```

Mais um flag para desligar o throttle por destino só para a MCD:
```sql
UPDATE clinics
SET settings = jsonb_set(settings, '{email,throttle_recipient_enabled}', 'false'::jsonb)
WHERE id = '3c48b379-f084-478d-a51c-9daa41ad661a';
```

Nada de migration — função `clinic_email_quota` já lê esse caminho.

### 2. `supabase/functions/process-email-queue/index.ts`

```ts
const BATCH_SIZE = 1000;            // ↑ de 400
const CONCURRENCY = 5;              // ↑ de 2 (alinha com 5 req/s Resend)
const BATCH_PARALLELISM = 5;        // ↑ de 3
const SELF_TRIGGER_THRESHOLD = 100; // ↑ de 50 (evita re-trigger desnecessário)
```

E baixar o gate de batch:
```ts
if (group.length < 2) { singles.push(...group); continue; } // antes: < 3
```

### 3. `supabase/functions/send-email/index.ts` e `send-email-batch/index.ts`

Antes de chamar `claim_recipient_throttle`, ler o flag (já cacheado em `clinic_email_integrations`/`clinics` cache 60s) e pular se `throttle_recipient_enabled === false`. Isso elimina 1 round-trip Postgres por job para a MCD.

### 4. Documentação

Atualizar `docs/roadmap/EMAIL_SCALE.md` adicionando **Tier 4 — alto volume** com a baseline nova e a tabela de flags por clínica (`quota_daily`, `throttle_recipient_enabled`).

## Resultado esperado para a MCD

| Cenário | Hoje | Após mudanças |
|---|---|---|
| Campanha homogênea 10k (Batch API) | ~1h | **~2–4 min** |
| Tempo para 10.000 sem warmup nem throttle | ~1h+cota estoura em 1k | **~2–4 min** |
| 2× 10k/dia | impossível (cota 1k) | **trivial** |

## Riscos

- **Outras clínicas seguem em 1.000/dia e 2 req/s singular** ❌ — não, `CONCURRENCY/BATCH_PARALLELISM` são globais. Subir para 5 afeta todas, mas o teto Resend é 5 req/s mesmo, então é correto. Não há regressão para os outros clientes.
- **Burst momentâneo > 5 req/s**: com 5 batches paralelos podemos enviar 5 req em <1s. Se bater 429, retry com backoff já tratado. Sem perda.
- **Throttle off na MCD**: domínio já tem reputação na ferramenta anterior, você confirmou. Health check (R-16) continua ativo (pausa se bounce>5%).

## Arquivos afetados

- `supabase/functions/process-email-queue/index.ts` — 5 linhas (constantes + threshold)
- `supabase/functions/send-email/index.ts` — guard no `claim_recipient_throttle`
- `supabase/functions/send-email-batch/index.ts` — idem
- Insert tool: 1 UPDATE em `clinics` (cota + flag)
- `docs/roadmap/EMAIL_SCALE.md` — registrar Tier 4

## Próximo passo (fora do código, depois do go-live)

Abrir ticket no Resend pedindo aumento de rate limit (10–20 req/s) — "trusted sender, domain migrating with existing reputation". Quando aprovado, subir `CONCURRENCY` e `BATCH_PARALLELISM` proporcionalmente → teto vai para **~120k/min**.
