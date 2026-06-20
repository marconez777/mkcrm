---
title: "Gates G1–G11 — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-19
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
| **G6** | Tags sempre MERGE, nunca SET | classifier `pipeline-classify/apply.ts` (whitelist + protected merge), auditores `addTags()`, regras determinísticas `addTag()` | — |
| **G7** | `qualificacao='desqualificado'` exige `motivo_desqualificacao` | trigger PG `enforce_motivo_desqualificacao` (migration anterior) + frontend `customFieldsPatchForStage()` em `src/lib/manual-stage-move.ts:67-83` | rejeição no UPDATE |
| **G8** | `pipelineMove()` UPDATE só toca `stage_id + stage_changed_at` — nunca `pipeline_id` | `pipeline-move.ts:182-188`. `pipeline_id` é derivado por trigger `sync_lead_pipeline_id` | — |
| **G9** | Classifier usa string exata do enum dos custom_fields | controlado pelo prompt + Zod schema enum em `pipeline-classify.ts:78-90, 92-112` | rejeição via Zod (`generateText` retorna erro de schema) |
| **G10** | Humano > IA em conflitos recentes (<7d) em custom_fields | **IMPLEMENTADO** (2026-06-18, V2). Trigger PG `track_custom_fields_human_edits` em `leads` + coluna `custom_fields_last_human_edit jsonb` + RPC `apply_lead_automation_patch`. Classifier `apply.ts` descarta sugestão se chave foi editada por humano há <7d. | `blocked_by_g10:{key}` em `applied.custom_fields` |
| **G11** | Classifier (5 agentes V6) / A1 / A2 **nunca** criam/editam `appointments` | invariante manual; nenhuma das funções `pipeline-classify` (Resumidor, Agendador, Tipificador, Movimentador, Maestro), `pipeline-position-auditor`, `pipeline-post-move-verifier` importa a tabela `appointments` para escrita | — |
| **D3** | "Paciente antigo" não sai por automação, **exceto** quando `toStage.name === "Nutrição inativa"` (única saída permitida, executada pelo cron de inatividade 60d). Estreitado em V5 (2026-06-19). | `pipeline-move.ts:173-181` | `guard_d3_paciente_antigo` |
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

## Gate G10 — implementação V2

1. Migration `20260618_100000_g10_human_edits.sql` adiciona a coluna `leads.custom_fields_last_human_edit jsonb DEFAULT '{}'`.
2. Trigger do PostgreSQL `track_custom_fields_human_edits` dispara `BEFORE UPDATE OF custom_fields`. Para cada chave alterada no JSON, ele grava `{ key: now_iso }`, **exceto** quando a transação declara `SET LOCAL app.actor = 'system'`.
3. Edge function (ex: `apply.ts`) ou qualquer automação que queira escrever em custom_fields **deve** usar a RPC `apply_lead_automation_patch(p_lead_id, p_custom_fields, p_tags)` se não quiser ser marcada como ação humana. A RPC seta o actor=system e faz o UPDATE.
4. `pipeline-classify/apply.ts` lê `lead.custom_fields_last_human_edit[key]` antes de aplicar cada chave; se < 7d, descarta e grava em `applied.custom_fields.blocked_by_g10`.
   - **Exceção (Override de Data)**: Se o parser identificar uma data confirmada (`isDateFromParser = true`) e a confiança da IA for `>= 0.85`, o G10 é ignorado, sobrepondo a data da secretária.

**Verificação:**

```bash
rg -n "blocked_by_g10|apply_lead_automation_patch" supabase/functions/pipeline-classify/
psql -c "SELECT id, custom_fields_last_human_edit FROM leads WHERE custom_fields_last_human_edit != '{}' LIMIT 5"
```

**Limitação**: outras edge functions automáticas (`pipeline-deterministic`, `pipeline-fase4`, `pipeline-move`) escrevem direto em `custom_fields` sem usar a RPC → seus writes são marcados como "humanos". Comportamento desejável na maior parte dos casos (classifier respeita regras determinísticas), mas pode causar auto-bloqueio entre execuções consecutivas dessas mesmas funções. Migrar para a RPC se observado.


## G11 — verificação por busca

```bash
# Garante que nenhum auditor escreve em appointments
rg -n 'from\("appointments"\).update|insert.*appointments|.from\("appointments"\).delete' \
   supabase/functions/pipeline-classify/ \
   supabase/functions/pipeline-position-auditor/ \
   supabase/functions/pipeline-post-move-verifier/
```

Resultado esperado: **vazio**. As únicas escritas em `appointments` vêm da UI (`/automations`, `/appointments`) ou de `evolution-webhook` (não confirmado nesta auditoria).

## V5 (2026-06-19) — Mudanças nos gates

### Guard D3 estreitado
"Paciente antigo" agora **pode** ser movido por automação se e somente se `toStage.name === "Nutrição inativa"`. Qualquer outro destino continua bloqueado com `guard_d3_paciente_antigo`. Quem usa a exceção: o branch novo `tier60pa` em `pipeline-deterministic/index.ts::ruleInactivityTick` (cron de SLA 60d).

### Wipe centralizado de chips (`pipeline-move.ts:183-226`)
Antes do UPDATE de stage, o helper manipula `leads.custom_fields` (coluna JSONB — **nunca** `lead_custom_fields`, que guarda definições):

- Saindo de `"Qualificação"`: remove a chave `interesse`.
- Entrando em `"Consulta finalizada"`: remove `consulta_agendada_em`, `procedimento_agendado_em`, `consulta_confirmada`, `procedimento_confirmado`, e seta `aguardando=true`.

Chaves removidas/adicionadas aparecem em `lead_stage_history.metadata.wiped_keys`. Falha de wipe não bloqueia o move (warning).

### Lock de Classifier por "Paciente antigo" (`pipeline-classify/apply.ts:245-255`)
Defesa em profundidade junto com D3: se `ctx.stageName === "Paciente antigo"`, o Classifier nem tenta sugerir movimentação. `stageOutcome.path = "guard_d3"`, `reason = "locked_in_paciente_antigo"`. Tipificador segue livre para editar chips/campos.

### Refator MCP/Automations → pipelineMove
- `ai-chat/index.ts` (tool `move_lead_stage`): substitui `update({stage_id})` direto por `pipelineMove({ source: "auto:ai-chat-tool", ruleKey: "automation.ai_chat_move.enabled" })`.
- `automations-tick/index.ts` (action `move_stage`): mesmo refator, `source: "auto:automation-rule"`, `ruleKey: "automation.ui_rule_move.enabled"`.

### Toggles novos em `app_settings`
| Key | Default | Quem consome |
|---|---|---|
| `automation.ai_chat_move.enabled` | `true` | tool MCP `move_lead_stage` |
| `automation.ui_rule_move.enabled` | `true` | action `move_stage` em automações da UI |
| `automation.inactivity_paciente_antigo.enabled` | `true` | branch `tier60pa` do cron de inatividade |
