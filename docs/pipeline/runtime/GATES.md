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
| ~~**G1**~~ | ~~Lock manual: `auto:*` não move lead com `manual_lock_until > now()`~~ | **[DESCONTINUADO NA PR4]** — ⚠️ ver nota abaixo | — |
| **G2** | Stage destino com `lock_auto_move=true` rejeita moves `auto:*` | `pipeline-move.ts:172-174` | `gate_g2_destination_locked:<name>` |
| **G3** | Toggle off (`app_settings.<ruleKey>` ≠ `'true'`) bloqueia regra | `pipeline-move.ts:96-108` | `gate_g3_disabled:<ruleKey>` |
| **G4** | Idempotência: se `lead_events.type='pipeline_move_attempted'` com mesma `idempotency_key` já existe, no-op | `pipeline-move.ts:110-126` | `idempotent:<key>` |
| **G5** | Toda mudança de stage cria `lead_stage_history` com `source` preenchido | `pipeline-move.ts:199-211` (insert obrigatório, warning se falhar) | — |
| **G6** | ⚠️ **Merge apenas condicional.** Auditores (`addTags()`) e regras determinísticas (`addTag()`) fazem merge puro. **O classifier NÃO**: quando `automation.classifier.tag_replace.enabled=true`, o `apply.ts` remove toda tag atual ausente de `tags_suggested`, exceto as de `PROTECTED_TAGS`. Ou seja, a IA **substitui** o conjunto de tags. Ver nota "G6 na prática" abaixo. | `apply.ts::applyClassification` (`tagReplaceEnabled` → `removeComputed`) | — |
| **G7** | `qualificacao='desqualificado'` exige `motivo_desqualificacao` | trigger PG `enforce_motivo_desqualificacao` (migration anterior) + frontend `customFieldsPatchForStage()` em `src/lib/manual-stage-move.ts:67-83` | rejeição no UPDATE |
| **G8** | `pipelineMove()` UPDATE só toca `stage_id + stage_changed_at` — nunca `pipeline_id` | `pipeline-move.ts:182-188`. `pipeline_id` é derivado por trigger `sync_lead_pipeline_id` | — |
| **G9** | ⚠️ **Não rejeita — coage silenciosamente.** Os schemas usam `z.string()` relaxado de propósito (`gpt-5-mini` recusa enums profundos). `normalizeClassification` (`schema.ts`) converte stage desconhecido em `"Qualificação"` e intent desconhecido em `"outro"`, **sem registrar nada**. Uma alucinação vira valor plausível e indistinguível de um acerto. | `schema.ts::normalizeClassification` | nenhuma — falha silenciosa |
| **G10** | Humano > IA em conflitos recentes (<7d) em custom_fields. **V2**: Campos *STICKY_HUMAN_FIELDS* (ex: `origem`) recebem lock permanente. Campos *AI_FORBIDDEN_FIELDS* não podem ser escritos de forma alguma. | **IMPLEMENTADO** (2026-06-18, V2). Trigger PG `track_custom_fields_human_edits` em `leads` + coluna `custom_fields_last_human_edit jsonb` + RPC `apply_lead_automation_patch`. Classifier `apply.ts` descarta sugestão se chave foi editada por humano há <7d. | `blocked_by_g10:{key}` em `applied.custom_fields` |
| **G11** | Classifier (5 agentes V6) / A1 / A2 **nunca** criam/editam `appointments` | invariante manual; nenhuma das funções `pipeline-classify` (Resumidor, Agendador, Tipificador, Movimentador, Maestro), `pipeline-position-auditor`, `pipeline-post-move-verifier` importa a tabela `appointments` para escrita | — |
| **D3** | "Paciente antigo" não sai por automação, **exceto** para `"Nutrição inativa"` **ou** `"Nutrição Antigos"` (duas saídas, executadas pelo cron de inatividade). | `pipeline-move.ts` (comparação contra `PACIENTE_ANTIGO_NAME`) | `guard_d3_paciente_antigo` |
| **Allowlist** | Clínica precisa estar em `pipeline_automation_allowlist` para qualquer `auto:*` | `pipeline-move.ts:138-141` (e cada edge function checa também) | `clinic_not_allowlisted` |

## ⚠️ Notas de divergência (leia antes de confiar na tabela)

### G1 virou instrução de prompt, não gate
A PR4 removeu o enforcement de `manual_lock_until` do `pipelineMove()` **e** removeu o
`+90 dias` que o `auto:ciclo-concluido` setava. Mas o prompt do Maestro ainda instrui:
*"Se SIGNALS.manual_lock_until estiver no futuro → NÃO mover"*. O campo continua sendo lido
e passado ao modelo. Consequência: o lock deixou de ser uma garantia e virou uma sugestão que
o LLM pode ignorar. Se você precisa travar um lead de verdade hoje, use
`pipeline_stages.lock_auto_move` (G2) no destino, não `manual_lock_until`.

### G6 na prática
`PROTECTED_TAGS` = `risco_clinico`, `b2b`, `vip`, `paciente_antigo`, `precisa_atencao_humana`,
`Lock manual`, `lock_manual`. Tudo fora dessa lista **cai** se o Maestro não repetir a tag na
resposta e `tag_replace` estiver ligado. Isso é by design (foi assim que a tag `1ª consulta`
stale passou a ser removida), mas significa que uma tag operacional criada à mão pela
secretária some na próxima classificação. Antes de criar tags manuais duradouras, adicione-as
a `PROTECTED_TAGS` ou à whitelist `automation.v42.allowed_tags`.

### Conflito humano de 24h não existe
Nem no `general`, nem no `nurture`. Ver `CLASSIFIER.md`. Não é um gate.

## Verificação rápida

```bash
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

**Limitação — 5 dos 7 caminhos de escrita se disfarçam de humano.** Só a RPC
`apply_lead_automation_patch` seta `app.actor='system'`. Todo o resto carimba
`custom_fields_last_human_edit` e tranca a IA por 7 dias naquela chave:

| Caminho | Escreve via | Carimba G10? |
|---|---|---|
| Secretária na UI | RPC `merge_lead_custom_fields` (`SECURITY INVOKER`, merge atômico) | ✅ sim — correto |
| Classifier | RPC `apply_lead_automation_patch` | ❌ não — correto |
| `pipeline-deterministic::patchCustomFields` | `update` direto | ⚠️ sim |
| `pipeline-tasks::mergeCustomFields` | `update` direto | ⚠️ sim |
| `pipeline-fase4::mergeCustomFields` | `update` direto | ⚠️ sim |
| `pipeline-move` (wipe de chips) | `update` direto | ⚠️ sim |
| `ai-chat` | `update` direto | ⚠️ sim |

Na maior parte dos casos o efeito é desejável (o classifier passa a respeitar a regra
determinística). O caso que **não** é: o wipe de chips **apaga** `consulta_agendada_em` ao
entrar em "Consulta finalizada", e o delete carimba a chave — a IA fica 7 dias sem poder
repreenchê-la, salvo pelo override de data com `confidence >= 0.85`.


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
