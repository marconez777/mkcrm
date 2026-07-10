---
title: "Limpeza do classificador de pipeline Febracis"
topic: general
kind: reference
audience: agent
updated: 2026-07-10
summary: "Relatório único da varredura em 8 fases que confirma a remoção completa do classificador de pipeline Febracis do código, docs, edges, cron, RPCs e tabelas de configuração."
code_refs:
  - supabase/functions/pipeline-classify/
related_docs:
  - docs/tenants/README.md
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
  - .lovable/plan.md
---

# Limpeza do classificador de pipeline Febracis (2026-07-10)

## Escopo

Apenas o **classificador de pipeline** Febracis (edge `pipeline-classify-febracis`, dispatch inline, config, cron, DB, docs).

**Fora do escopo — permanece intocado**:

- Clínica `FEBRACIS-PRI` (`ab2f4484-886c-48f2-bfc6-0651d062c575`).
- Agentes de atendimento `Atendimento Febracis` (`907eb5e2-…`) e `Agente SDR 3.0` (`a75fcb1a-…`).
- Instância WhatsApp `Lucia`.
- 198 leads e 310 linhas de `ai_usage` (todas do agente de atendimento).

## Onde estava × ação × status

| Superfície | Ação | Status |
|---|---|---|
| Edge `supabase/functions/pipeline-classify-febracis/` | Deletada localmente | ✅ |
| Edge aninhada `supabase/functions/pipeline-classify/febracis/` | Deletada localmente | ✅ |
| Dispatch inline em `pipeline-classify/index.ts` (linhas 116–155) | Removido; comentário genérico | ✅ |
| Hack `allowedClinicIds.push(...)` em `tickQueueV2` | Removido | ✅ |
| Cron `pipeline-classify-febracis-tick` | Desagendado (`cron.unschedule`) | ✅ |
| Docs `docs/agents/FEBRACIS_*.md` (3 arquivos) | Deletadas | ✅ |
| Docs `docs/tenants/febracis/**` (5 arquivos) | Deletadas | ✅ |
| Menções em `docs/tenants/README.md`, `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`, `docs/maps/AI_AGENTS.md`, `docs/agents/TRAINING_FRAMEWORK.md`, `docs/_audit/INVENTORY.md` | Reescritas | ✅ |
| Edge deployada `pipeline-classify-febracis` na Cloud | `delete_edge_functions` falhou; função órfã sem cron e inerte | ⚠️ aguardando purge manual |

## Varreduras (esta rodada)

### Fase 1 — Código

```
rg -n -i "febracis|pipeline-classify-febracis|ab2f4484-886c-48f2-bfc6-0651d062c575" src/ supabase/functions/
→ 0 hits
```

### Fase 3 — Cron / triggers / RPC

- `cron.job`: 0 jobs contendo `febracis` ou o `clinic_id`.
- `pg_proc` (schemas não-sistema): 0 funções com `febracis` ou o `clinic_id` no `prosrc`.

### Fase 4 — DB config residual (contagens Febracis)

| Tabela | Filtro | Linhas |
|---|---|---|
| `pipeline_automation_allowlist` | `clinic_id = ab2f4484…` | 0 |
| `app_settings` | `key ILIKE '%febracis%'` OR `value ILIKE '%ab2f4484…%'` | 0 |
| `pipeline_runs` | `clinic_id = ab2f4484…` | 0 |
| `pipeline_run_items` | `clinic_id = ab2f4484…` | 0 |
| `lead_events` (type `auto:classifier`) | leads da clínica | 0 |
| `stage_sequence_bindings` | stages da clínica | 0 |
| `stage_canonical_aliases` | `clinic_id = ab2f4484…` | 0 |
| `whatsapp_intents` | `clinic_id = ab2f4484…` | 0 |
| `ai_usage` | `clinic_id = ab2f4484…` | 310 — **100% `operation=chat`** (atendimento SDR), zero de classifier |
| `lead_ai_settings` | leads da clínica | 1 (atendimento; fora do escopo) |

### Fase 6 — Scripts / .env

`fetch_leads.py`, `test_query.py`, `check_ai.py`, `trigger_ai.py`, `generate_pdf.py`, `mermaid_pdf.ts`, `scratch.*`, `check-logs.ts`, `scripts/pipeline-replay.ts`, `dry-run-pr2/**`, `.env`, `.env.development` — **0 hits**.

## Migrations históricas (não removidas — imutáveis)

Todas as 12 migrations que ainda mencionam Febracis são do **agente de atendimento SDR** ou do setup inicial da clínica — nenhuma cria linhas relacionadas ao classificador de pipeline.

**Grupo A — SDR 2.0/3.0 (atendimento)** — mantidas sem tocar:

- `20260709161813_create_sdr_2_0.sql`
- `20260709163124_add_sdr_2_0_stages.sql`
- `20260709164105_update_sdr_2_0_copy.sql`
- `20260709164614_update_sdr_3_0.sql`
- `20260709164856_fix_sdr_3_0_prompt.sql`

**Grupo B — Setup inicial da clínica / agente de atendimento** — mantidas sem tocar:

- `20260630004105_…` — seed `clinic_secrets` (Gemini) para clínica ÓR (contém apenas menção lateral).
- `20260630004312_…` — placeholder de `INSERT INTO ai_agents` (noop `WHERE false`).
- `20260630004405_…` — insere `ai_agents` "Atendimento Febracis" (Paulo Vieira).
- `20260630011024_…` / `20260630011131_…` — atualizam copy do agente de atendimento.
- `20260630014034_…` — cria `agent_stages` do agente de atendimento.
- `20260630023437_…` — `DELETE FROM leads WHERE clinic_id = ab2f4484…` (limpeza de teste).

## Rearranque

Quando o roadmap de individualização (`pipeline_tenant_classifiers`, `.lovable/plan.md`) estiver nas Fases 5–6, o classificador Febracis será recriado do zero como um tenant do registry — sem reaproveitar código, config ou stages remanescentes desta versão anterior.
