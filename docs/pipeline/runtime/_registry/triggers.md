---
title: "Registry — Gatilhos de movimentação"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por gatilho: o que dispara, de onde para onde move, source, toggle e chave de idempotência. Cobre as 9 actions determinísticas e os 3 caminhos do classifier."
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/_shared/pipeline-move.ts
---

# Registry — Gatilhos

**Todo** move de card passa por `_shared/pipeline-move.ts::pipelineMove()`. Nada escreve
`leads.stage_id` direto. Se você encontrar código que escreve, é bug — abra item no
`KNOWN_ISSUES.md`.

Ordem dos gates dentro do `pipelineMove`: G3 (toggle) → G4 (idempotência) → allowlist da
clínica → destino no mesmo pipeline → G2 (`lock_auto_move`) → D3 → wipe de chips → G8 (update)
→ G5 (history) → hooks assíncronos (verifier A2, stage-bindings).

## Determinísticos — `pipeline-deterministic`

Roteador único; cada `action` é uma regra. Disparados por triggers pg_net e por cron.

| Action | Dispara quando | De → Para | `source` | Toggle | Idempotência |
|---|---|---|---|---|---|
| `novo-lead` | INSERT em `leads` | * → `Novo` | `auto:novo-lead` | `automation.novo_lead.enabled` | `novo-lead:{lead}` |
| `secretary-replied` | INSERT `messages` com `from_me=true` | `Novo` → `Qualificação` | `auto:secretary-replied` | `automation.secretary_replied.enabled` | `secretary:{msg}` |
| `reactivation-inbound` | INSERT `messages` com `from_me=false` | `Nutrição inativa` → `Qualificação` · `Nutrição Antigos` → `Paciente antigo` | `auto:reactivation-inbound` | `automation.reactivation_inbound.enabled` | por mensagem |
| `appointment-sync` | INSERT/UPDATE `appointments` | ver matriz abaixo | `auto:appointment-sync` | 4 toggles por status | `appt:{id}:{status}` |
| `field-changed` (ciclo) | UPDATE `leads.custom_fields` com `ciclo_concluido` `false→true` | * → `Paciente antigo` | `auto:ciclo-concluido` | `automation.ciclo_concluido.enabled` | `ciclo:{lead}` |
| `field-changed` (modalidade) | `modalidade_preferida` → `online` | não move — só tag `modalidade_online` | `auto:modality-guard` | `automation.modality_guard.enabled` | — |
| `inactivity-tick` (7d) | cron · `last_message_at` < −7d, em stage ativo | * → `Nutrição inativa` + tag `precisa_atencao_humana` | `auto:followup-7d` | `automation.followup_7d_nutricao.enabled` | `inactivity:{lead}:7d:{YYYY-MM-DD}` |
| `inactivity-tick` (3d) | cron · < −3d | **não move** — só `lead_events` | — | `automation.followup_3d.enabled` | evento do dia |
| `inactivity-tick` (24h) | cron · `last_human_activity_at` < −24h | **não move** — só `lead_events` | — | `automation.followup_24h.enabled` | evento do dia |
| `inactivity-tick` (60d PA) | cron · em `Paciente antigo`, `last_message_at` < −60d | `Paciente antigo` → `Nutrição Antigos` | `auto:inactivity-tick` | `automation.inactivity_paciente_antigo.enabled` | `inactivity:paciente_antigo:{lead}:{YYYY-MM}` |
| `monthly-sweep-tick` | cron mensal | `Consulta finalizada` / `1ª Sessão Finalizada` → `Paciente antigo` | `auto:monthly-sweep` | ❌ `automation.monthly_sweep_paciente_antigo.enabled` — **não seedado** | `monthly-sweep:{lead}:{YYYY-MM}` |
| `reactivation-tick` | cron | **não move** — só tag `reativacao` | — | `automation.reactivation.enabled` | ⚠️ regra inoperante, ver nota |
| `human-reactor-tick` | cron | **não move** — cria `lead_task` "Revisar lead travado (D7)" | — | `automation.human_reactor.enabled` | task aberta com mesmo título |
| `auto:consulta-passou` | data da consulta passou | `Consulta agendada` → `Consulta finalizada` + tag `consulta_realizada` | `auto:consulta-passou` | `automation.consulta_passou_finaliza.enabled` | — |
| `auto:procedimento-passou` | data do procedimento passou | `Tratamento agendado` → `1ª Sessão Finalizada` + tag `procedimento_realizado` | `auto:procedimento-passou` | `automation.consulta_passou_finaliza.enabled` | — |
| `auto:paciente-antigo-canonical` | canonicalização | → `Paciente antigo` | `auto:paciente-antigo-canonical` | ❌ `automation.paciente_antigo_canonical.enabled` — **não seedado** | — |

### Matriz do `appointment-sync`

| `status` | `kind` | Stage destino | Efeito colateral |
|---|---|---|---|
| `agendado` | `consulta` | Consulta agendada | — |
| `agendado` | `retorno` | Consulta agendada | — |
| `agendado` | `procedimento` | Tratamento agendado | — |
| `realizado` | `consulta` | Consulta finalizada | `status_consulta='realizada'` |
| `realizado` | `procedimento` | 1ª Sessão Finalizada | `sessoes_realizadas++` |
| `faltou` | qualquer | Sem resposta | `status_consulta='faltou'` + tag `reagendamento_pendente` |
| `cancelado` | qualquer | Qualificação | `status_consulta='cancelada'` + tag `reagendamento_pendente` |

⚠️ Patch de campos e tag são aplicados **antes** do move. Se o D3 bloquear (lead em
`Paciente antigo`), o card não anda mas o campo e a tag são gravados. Isso é intencional.

## IA — `pipeline-classify/apply.ts`

Avaliados nesta ordem; o primeiro que move encerra os demais.

| Caminho | Condições | `source` | Toggle |
|---|---|---|---|
| **Lock D3** | `ctx.stageName === "Paciente antigo"` → nem tenta. `reason: locked_in_paciente_antigo` | — | — |
| **b2b** | `is_b2b` + `conf ≥ 0.95` + tag `b2b` sugerida + sem histórico em `TREATED_STAGES` | `auto:classifier-b2b` | `automation.b2b_move.enabled` |
| **nurture** | sugestão `Nutrição inativa` + intent `objecao`\|`desistencia` + saindo de `Novo`\|`Qualificação` + `conf ≥ 0.8` + sem tratamento | `auto:classifier-nurture` | `automation.nurture_move.enabled` |
| **general** | `conf ≥ 0.8` + destino ∉ `HUMAN_SCHEDULING_STAGES` | `auto:classifier-general` | ⚠️ **nenhum** — `ruleKey` omitido |

Idempotência dos três: `{caminho}:{lead}:{lastMessageId}` — uma tentativa por mensagem nova.

### ❌ Guard que não existe

`nurture` e `general` consultam `lead_stage_history` procurando move humano nas últimas 24h e
**descartam o resultado** (`const noRecentHumanMove = true`). A proteção nunca existiu e
`recent_human_move_24h` é motivo inalcançável. `KNOWN_ISSUES.md` #-12.

## Notas de regras inoperantes

| Regra | Por quê |
|---|---|
| `secretary-replied` | canônico `Novo` sem alias → `novoId=null` → `not_in_novo` sempre. Ver [`stages.md`](./stages.md) |
| `reactivation-tick` | testa `cf.interesse_tratamento !== true`, mas o campo recebe **array** da IA. Ver [`fields.md`](./fields.md) |
| `monthly-sweep-tick`, `paciente-antigo-canonical` | toggle não seedado → G3 fail-closed. Ver [`toggles.md`](./toggles.md) |

## Cron

⚠️ **Nenhuma migration agenda `inactivity-tick`, `reactivation-tick`, `human-reactor-tick`,
`monthly-sweep-tick` ou `pipeline-classify-tick`.** Esses jobs foram criados fora do
repositório (painel/pg_cron manual) — horários não versionados e não verificáveis aqui.
Listar com:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```
