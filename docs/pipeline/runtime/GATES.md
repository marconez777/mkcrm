---
title: "Gates G1–G11 — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Onde cada um dos 11 gates de segurança do pipeline v4.2 é efetivamente aplicado no código. Inclui guard D3 e link arquivo:linha para verificação rápida."
code_refs:
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-allowlist.ts
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-position-auditor/index.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/AUTOMATION_PLAN.md
---

# Gates de segurança — onde estão no código

Todos os gates síncronos rodam em `_shared/pipeline-move.ts::pipelineMove()`. Gates lógicos extras (G6, G7, G9, G10, G11) vivem em componentes específicos.

| Gate | O que faz | Onde aplica | Reason string ao bloquear |
|---|---|---|---|
| **G1** | Lock manual: `auto:*` não move lead com `manual_lock_until > now()` | `pipeline-move.ts:144-149` | `gate_g1_manual_lock_until:<iso>` |
| **G2** | Stage destino com `lock_auto_move=true` rejeita moves `auto:*` | `pipeline-move.ts:172-174` | `gate_g2_destination_locked:<name>` |
| **G3** | Toggle off (`app_settings.<ruleKey>` ≠ `'true'`) bloqueia regra | `pipeline-move.ts:96-108` | `gate_g3_disabled:<ruleKey>` |
| **G4** | Idempotência: se `lead_events.type='pipeline_move_attempted'` com mesma `idempotency_key` já existe, no-op | `pipeline-move.ts:110-126` | `idempotent:<key>` |
| **G5** | Toda mudança de stage cria `lead_stage_history` com `source` preenchido | `pipeline-move.ts:199-211` (insert obrigatório, warning se falhar) | — |
| **G6** | Tags sempre MERGE, nunca SET | classifier `pipeline-classify.ts:439-445`, auditores `addTags()`, regras determinísticas `addTag()` | — |
| **G7** | `qualificacao='desqualificado'` exige `motivo_desqualificacao` | trigger PG `enforce_motivo_desqualificacao` (migration anterior) + frontend `customFieldsPatchForStage()` em `src/lib/manual-stage-move.ts:67-83` | rejeição no UPDATE |
| **G8** | `pipelineMove()` UPDATE só toca `stage_id + stage_changed_at` — nunca `pipeline_id` | `pipeline-move.ts:182-188`. `pipeline_id` é derivado por trigger `sync_lead_pipeline_id` | — |
| **G9** | Classifier usa string exata do enum dos custom_fields | controlado pelo prompt + Zod schema enum em `pipeline-classify.ts:78-90, 92-112` | rejeição via Zod (`generateText` retorna erro de schema) |
| **G10** | Humano > IA em conflitos recentes (<7d) em custom_fields | **IMPLEMENTADO** (2026-06-18, V2). Trigger PG `track_custom_fields_human_edits` em `leads` + coluna `custom_fields_last_human_edit jsonb` + RPC `apply_lead_automation_patch`. Classifier `apply.ts` descarta sugestão se chave foi editada por humano há <7d. | `blocked_by_g10:{key}` em `applied.custom_fields` |
| **G11** | Classifier/A1/A2 **nunca** criam/editam `appointments` | invariante manual; nenhuma das funções `pipeline-classify`, `pipeline-position-auditor`, `pipeline-post-move-verifier` importa a tabela `appointments` para escrita | — |
| **D3** | "Paciente antigo" não sai por automação | `pipeline-move.ts:177-179` | `guard_d3_paciente_antigo` |
| **Allowlist** | Clínica precisa estar em `pipeline_automation_allowlist` para qualquer `auto:*` | `pipeline-move.ts:138-141` (e cada edge function checa também) | `clinic_not_allowlisted` |

## Verificação rápida

```bash
# G1
rg -n "gate_g1_manual_lock_until" supabase/functions/_shared/pipeline-move.ts
# G2
rg -n "gate_g2_destination_locked" supabase/functions/_shared/pipeline-move.ts
# G3
rg -n "gate_g3_disabled" supabase/functions/_shared/pipeline-move.ts
# G4
rg -n "pipeline_move_attempted|idempotent:" supabase/functions/_shared/pipeline-move.ts
# G5
rg -n "lead_stage_history" supabase/functions/_shared/pipeline-move.ts
# D3
rg -n "guard_d3_paciente_antigo|PACIENTE_ANTIGO_NAME" supabase/functions/_shared/pipeline-move.ts
# Allowlist
rg -n "isClinicPipelineAllowed" supabase/functions/
```

## Gate G10 — status

Plano original: "para a mesma chave, valor humano <7d **não** é sobrescrito por automação".

**Estado real**: classifier escreve `custom_fields_patch` direto via shallow merge sem checar quem escreveu por último. Se humano editou hoje, próximo classifier pode sobrescrever em 1 minuto.

Mitigação parcial via prompt: "só inclua chaves se há evidência clara no texto". Mas a regra estrutural está ausente.

> **Recomendação**: para implementar G10 de fato, seria preciso ler `lead_events.type='custom_fields_changed'` (já existe!) e comparar `created_at` vs `updated_by` antes de aceitar cada chave do patch. Não é trivial — vale issue dedicada.

## G11 — verificação por busca

```bash
# Garante que nenhum auditor escreve em appointments
rg -n 'from\("appointments"\).update|insert.*appointments|.from\("appointments"\).delete' \
   supabase/functions/pipeline-classify/ \
   supabase/functions/pipeline-position-auditor/ \
   supabase/functions/pipeline-post-move-verifier/
```

Resultado esperado: **vazio**. As únicas escritas em `appointments` vêm da UI (`/automations`, `/appointments`) ou de `evolution-webhook` (não confirmado nesta auditoria).
