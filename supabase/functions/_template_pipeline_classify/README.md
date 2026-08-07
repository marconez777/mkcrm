# Template — Agente de Pipeline por Tenant

Esqueleto clonável do **G1** do roadmap `docs/roadmap/PIPELINE_TENANT_ROADMAP.md`.

O prefixo `_` no nome do diretório faz o Supabase **pular o deploy** — este código nunca vira uma edge function em produção. Só entra no ar quando alguém clona.

## Como clonar para um tenant novo

```bash
# 1. Copiar
cp -r supabase/functions/_template_pipeline_classify \
      supabase/functions/pipeline-classify-<slug>

# 2. Trocar as duas constantes no topo de index.ts
#    TENANT_SLUG      = "<slug>"
#    TENANT_CLINIC_ID = "<uuid da clínica>"

# 3. Cadastrar no registry
psql -c "INSERT INTO pipeline_tenant_classifiers
         (slug, clinic_id, edge_function_name, cron_enabled)
         VALUES ('<slug>', '<uuid>', 'pipeline-classify-<slug>', false);"

# 4. Semear settings (namespace G2)
psql -c "INSERT INTO app_settings (key,value) VALUES
         ('automation.<slug>.enabled',      'false'),
         ('automation.<slug>.dry_run',      'true'),
         ('automation.<slug>.allowed_tags', '[]'::jsonb);"

# 5. Personalizar agent.ts (system prompt) e apply.ts (INTENT_TO_STAGE)

# 6. Deploy é automático via Lovable Cloud
```

## O que o esqueleto já entrega

- Drena a fila só do próprio tenant (`ai_review_reasons @> ['pipeline-classifier:<slug>']`).
- Lock por lead via `try_classify_lock` (RPC genérica, sem contenção entre tenants).
- Backoff escalonado por falhas: 2 min → 5 min → 30 min.
- Distingue erro transiente (retry) de terminal (drop) via `isTransientAgentError`.
- Suporta `dry_run` — quando `automation.<slug>.dry_run = true`, o pipeline roda LLM + telemetria mas **não** move o card, e avança um watermark separado (`last_processed_message_id_classifier_dry`) para não contaminar a produção quando o dry-run for desligado.
- Concorrência limitada a 5 leads por tick.
- Actions HTTP: `{"action":"tick"}` (cron) e `{"action":"lead","lead_id":"…","dry_run":true}` (smoke test).

## O que **você** precisa preencher

| Arquivo | O quê |
|---|---|
| `index.ts` | `TENANT_SLUG`, `TENANT_CLINIC_ID` |
| `schema.ts` | Enum de `intent` conforme o funil do cliente |
| `agent.ts` | System prompt do Tipificador — regras específicas do funil |
| `apply.ts` | Mapa `INTENT_TO_STAGE` — nomes exatos dos estágios do Kanban do cliente |

## O que **NÃO** fazer

- Não expor prompt, whitelist ou regras na UI.
- Não passar histórico inteiro do lead ao LLM (custo O(n)). O Resumidor mantém `ai_summary` incremental.
- Não fazer `UPDATE leads SET stage_id = ...` direto — sempre `pipelineMove()`.
- Não aninhar o classifier de um tenant dentro do de outro.
- Não hardcodar `TENANT_CLINIC_ID` em `_shared/*` — vive só neste diretório.

## Dependências

- `_shared/pipeline-move.ts` — helper único de move (aplica gates G1–G8).
- `_shared/clinic-openai.ts` — BYOK do tenant (chave em `clinic_secrets`).
- `_shared/lovable-ai.ts` — fallback quando o tenant não tem BYOK.
- `_shared/classifier-ai.ts` → `isTransientAgentError`.
- `_shared/app-settings.ts` → `getTenantToggle`, `getTenantSettingJSON` (G2 — a criar antes do primeiro tenant novo ir a produção).
- RPC `public.try_classify_lock(_lead_id)` — advisory lock.
