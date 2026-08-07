---
title: "Registry — Toggles de app_settings"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por chave de app_settings: quem lê, o que faz, e se está seedada em migration. Chave não seedada = regra morta (G3 é fail-closed)."
code_refs:
  - supabase/functions/_shared/pipeline-move.ts
---

# Registry — Toggles

## A regra que faz este arquivo importar

O gate **G3** em `pipelineMove()` é **fail-closed**:

```ts
if (!setting || String(setting.value).toLowerCase() !== "true") {
  return { moved: false, reason: `gate_g3_disabled:${ruleKey}` };
}
```

**Chave ausente em `app_settings` = regra silenciosamente morta.** Não há erro, não há log de
aviso — só um `gate_g3_disabled` no payload que ninguém lê. Foi assim que várias automações
ficaram paradas por semanas.

Corolário: **criar uma regra nova exige seedar o toggle na mesma migration.** Ver
[`playbooks/add-trigger.md`](../playbooks/add-trigger.md).

## ❌ Usados em código, nunca seedados

Estes `ruleKey` aparecem em chamadas a `pipelineMove()` mas não têm `INSERT` em nenhuma
migration. Se não foram criados à mão no painel de `app_settings`, as regras estão mortas:

| Chave | Consumidor |
|---|---|
| `automation.classifier.stage_move.enabled` | classifier — caminho de move |
| `automation.monthly_sweep_paciente_antigo.enabled` | `monthly-sweep-tick` (varredura mensal → Paciente antigo) |
| `automation.or_monthly_cycle.enabled` | ciclo mensal ÓR |
| `automation.paciente_antigo_canonical.enabled` | canonicalização de Paciente antigo |

**Confirme antes de agir:**

```sql
SELECT key, value FROM app_settings WHERE key IN (
  'automation.classifier.stage_move.enabled',
  'automation.monthly_sweep_paciente_antigo.enabled',
  'automation.or_monthly_cycle.enabled',
  'automation.paciente_antigo_canonical.enabled'
);
```

Linha faltando → regra morta. Seede com uma migration.

## ⚠️ Caminho sem toggle nenhum

| Caminho | Situação |
|---|---|
| classifier `general` move | `ruleKey` **omitido de propósito** na chamada a `pipelineMove` ("forçando 100% automação"). G3 é pulado. Não existe kill-switch por regra — só `automation.classifier.enabled`, que derruba o classifier inteiro |

## ✅ Seedados e em uso

| Chave | Consumidor | Efeito |
|---|---|---|
| `automation.classifier.enabled` | `tickQueueV2` | Liga/desliga o classifier inteiro. **Único kill-switch do general move** |
| `automation.classifier.version` | dispatcher `index.ts` | `v1` (monólito) ou `v2` (5 agentes) |
| `automation.classifier.history_tool_enabled` | `runAgent` | Ferramenta de histórico |
| `automation.classifier.tag_replace.enabled` | `apply.ts` | ⚠️ Quando `true`, a IA **remove** toda tag ausente de `tags_suggested` (exceto `PROTECTED_TAGS`). Ver [`tags.md`](./tags.md) |
| `automation.novo_lead.enabled` | `ruleNovoLead` | Lead novo → `Novo` |
| `automation.secretary_replied.enabled` | `ruleSecretaryReplied` | `Novo` → `Qualificação`. ⚠️ Inoperante por falta do alias `Novo` |
| `automation.appointment_agendado.enabled` | `ruleAppointmentSync` | status `agendado` |
| `automation.appointment_realizado.enabled` | `ruleAppointmentSync` | status `realizado` |
| `automation.appointment_faltou.enabled` | `ruleAppointmentSync` | status `faltou` |
| `automation.appointment_cancelado.enabled` | `ruleAppointmentSync` | status `cancelado` |
| `automation.appointment_sync.enabled` | `ruleAppointmentSync` | toggle agregado |
| `automation.ciclo_concluido.enabled` | `ruleFieldChanged` | `ciclo_concluido=true` → `Paciente antigo` |
| `automation.modality_guard.enabled` | `ruleFieldChanged` | `modalidade_preferida=online` → tag |
| `automation.followup_24h.enabled` | `ruleInactivityTick` | tier 24h (só evento) |
| `automation.followup_3d.enabled` | `ruleInactivityTick` | tier 3d (só evento) |
| `automation.followup_7d_nutricao.enabled` | `ruleInactivityTick` | tier 7d → `Nutrição inativa` |
| `automation.inactivity_paciente_antigo.enabled` | `ruleInactivityTick` | SLA 60d → `Nutrição Antigos` |
| `automation.reactivation.enabled` | `ruleReactivationTick` | ⚠️ regra inoperante — ver [`fields.md`](./fields.md), `interesse_tratamento` |
| `automation.reactivation_inbound.enabled` | `reactivation-inbound` | lead inativo volta a falar |
| `automation.human_reactor.enabled` | `ruleHumanReactorTick` | task D7 de lead travado |
| `automation.b2b_move.enabled` | `apply.ts` caminho `b2b` | |
| `automation.nurture_move.enabled` | `apply.ts` caminho `nurture` | |
| `automation.consulta_passou_finaliza.enabled` | `auto:consulta-passou` | |
| `automation.ai_chat_move.enabled` | tool MCP `move_lead_stage` | |
| `automation.ui_rule_move.enabled` | action `move_stage` das automações da UI | |
| `automation.nf_task.enabled` | `runNfTask` | |
| `automation.payment_confirmed.enabled` | `runPaymentAlleged` + `runPaymentConfirmed` | |
| `automation.judicializacao.enabled` | `runJudicializacao` | |
| `automation.renovacao_receita.enabled` | `runRenovacaoReceita` | |
| `automation.objection_suggest.enabled` | `runObjectionSuggest` | |
| `automation.post_move_verifier.enabled` | verificador pós-move (A2) | |
| `automation.post_move_verifier.rules_enabled` | verificador pós-move | whitelist de regras |
| `automation.position_auditor.enabled` | auditor diário (A1) | |
| `automation.position_auditor.batch_size` | auditor diário | não-booleano |
| `automation.stage_bindings.enabled` | `applyStageBindings` | |
| `automation.summarizer.enabled` | `runSummarize` | |
| `automation.field_patch.enabled` | patch de campos | |
| `automation.tags_merge.enabled` | merge de tags | |
| `automation.urgency_flag.enabled` | flag de urgência | |
| `automation.agendamento_sugerido.enabled` | tag de sugestão de agendamento | |
| `automation.v42.allowed_tags` | `apply.ts::getAllowedTags` | array JSON, não booleano |
| `automation.v42.custom_fields_schema` | ⚠️ **ninguém lê** | JSON descritivo, nunca enforçado |
| `automation.v42.motivo_desqualificacao_enum` | ⚠️ **ninguém lê** no backend | array JSON |

## Nota sobre não-booleanos

`allowed_tags`, `custom_fields_schema`, `motivo_desqualificacao_enum` e `position_auditor.batch_size`
não são toggles — são configuração. Não passe nenhum deles como `ruleKey`: o G3 compara com a
string `'true'` e vai bloquear tudo.
