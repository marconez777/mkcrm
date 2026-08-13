---
title: "F2 — Mapa do código do pipeline (fonte de verdade)"
topic: kanban
kind: audit
audience: both
status: vigente
updated: 2026-08-11
summary: "Referência verificada do pipeline, organizada por comportamento e não por arquivo: gatilhos, crons, origens de movimentação, campos, chips, inventário da contaminação de negócio no código, e configuração lida vs. existente. Toda afirmação carrega arquivo:linha ou query de origem. Entregável da Fase 2 do ROADMAP_ATUALIZACAO_DOCUMENTACAO."
related_docs:
  - docs/roadmap/ROADMAP_ATUALIZACAO_DOCUMENTACAO.md
  - docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
  - docs/_audit/INVENTARIO_DOCS.md
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/app-settings.ts
---

# F2 — Mapa do código do pipeline

**Esta é a fonte de verdade contra a qual a documentação será corrigida.**

Toda afirmação abaixo tem `arquivo:linha` **ou** a query que a comprova. Onde não
foi possível verificar, está marcado **⚠️ NÃO VERIFICADO** — e nesses pontos a
informação vale tanto quanto documentação, ou seja, pouco.

**Verificações de banco:** 11/08/2026, tenant `cf038458-…` (Clínica ÓR).

---

## 1. Gatilhos Postgres

**Fonte:** `pg_trigger`, consultado em 11/08. Nenhum trigger está desabilitado
(`tgenabled = 'D'` em zero linhas).

### 1.1 Em `messages`

| Trigger | O que faz | Escopo |
|---|---|---|
| `messages_lead_needs_extraction` | **Motor de chips.** Regex → `ai_review_reasons` + 11 campos | Gateado por tenant desde [20260811170000](../../supabase/migrations/20260811170000_scope_lead_extraction_per_tenant.sql) |
| `trg_messages_enqueue_classifier` | Enfileira para a IA. Exige `pipeline_tenant_classifiers.enabled` | por tenant ✅ |
| `trg_messages_auto_secretary` | → `pipeline-deterministic {secretary-replied}` | global |
| `trg_messages_auto_reactivation_inbound` | → `pipeline-deterministic {reactivation-inbound}` | global |
| **`trg_clinica_or_wakeup_inbound`** | Geladeira → Qualificação + tag `reativacao` | **UUID hardcoded** ❌ |
| `trg_messages_update_lead_last_inbound` | Atualiza `last_inbound_at` | global |
| `trg_bump_human_activity_from_msg` | Atualiza `last_human_activity_at` | global |
| `trg_stop_sequences_on_reply` | Cancela enrollments | global |

### 1.2 Em `leads`

| Trigger | O que faz | Escopo |
|---|---|---|
| `trg_lead_stage_history` | Grava histórico — **concorre com `pipelineMove`** (§3.3) | global |
| `log_lead_changes_trg` | Emite `stage_changed`, `pipeline_changed`, `attendant_changed`, `custom_fields_changed` | global |
| `leads_stage_changed` | Eventos de mudança de etapa | global |
| **`on_b2b_stage_move`** | Carimba `is_b2b=true` ao entrar em B2B/Desqualificado | **UUID hardcoded** ❌ |
| `trg_leads_auto_novo_lead` | → `pipeline-deterministic {novo-lead}` | global |
| `trg_leads_auto_field_changed` | → `pipeline-deterministic {field-changed}` | global |
| `trg_leads_sync_pipeline` | Deriva `pipeline_id` de `stage_id` | global |
| `trg_validate_lead_custom_fields_enums` | Valida enums — **aborta a transação inteira** se inválido | global |
| `trg_track_custom_fields_human_edits` | Alimenta o G10 (janela de 7 dias) | global |
| `trg_lead_risk_handler` | Tags de risco | global |
| `trg_enroll_on_stage_change` | `stage_sequence_bindings` (tabela vazia) | global |
| `trg_sync_lead_ai_settings_stage` | Sincroniza `lead_ai_settings` | global |
| `trg_leads_enforce_coherence` | Defesa cross-clinic | global |

### 1.3 Em `appointments`

`trg_appointments_auto_sync` · `trg_appointments_recompute` ·
`trg_appointments_validate_kind` · `trg_appointments_set_updated_at`

---

## 2. Crons

> ⚠️ **NÃO VERIFICADO.** Não foi possível consultar `cron.job`. A lista abaixo vem
> de `TRIGGERS_AUDIT.md` (22/06) e **pode estar desatualizada**. Reverificar com:
> `SELECT jobname, schedule FROM cron.job ORDER BY jobname;`

| Job | Schedule | Endpoint |
|---|---|---|
| `pipeline-classify-tick` | `* * * * *` | `pipeline-classify {tick}` |
| `pipeline-inactivity-tick` | `*/15 * * * *` | `pipeline-deterministic {inactivity-tick}` |
| `pipeline-reactivation-tick` | `0 7 * * *` | `pipeline-deterministic {reactivation-tick}` |
| `pipeline-human-reactor-tick` | `0 8 * * *` | `pipeline-deterministic {human-reactor-tick}` |
| `automations-tick-every-5-min` | `*/5 * * * *` | `automations-tick` |
| `report-finalizados-mensal-or` | `0 6 1 * *` | relatório da ÓR |

> ⚠️ O nome do job `pipeline-inactivity-tick` **não corresponde a uma edge function**.
> A função `supabase/functions/pipeline-inactivity-tick/` **não existe** — é uma
> *action* do `pipeline-deterministic`. Esse nome aparece em `code_refs` de 6 docs
> e no corpo de outros 8 (ver [F1](INVENTARIO_DOCS.md)).

---

## 3. Movimentação de cards

### 3.1 Origens reais — verificado

**Query:** `SELECT source, count(*), max(moved_at) FROM lead_stage_history WHERE clinic_id='cf038458-…' AND moved_at > now() - interval '30 days' GROUP BY source;`

| `source` | Moves 30d | Último | Quem emite | Gate |
|---|---|---|---|---|
| `system` | 1124 | 11/08 16:00 | trigger `record_lead_stage_history` (`auth.uid()` nulo) | — |
| `auto:followup-7d` | 157 | 11/08 16:00 | `pipeline-deterministic` | `followup_7d_nutricao.enabled` |
| `manual` | 141 | 11/08 15:25 | trigger (com `auth.uid()`) | — |
| `auto:novo-lead` | 82 | 11/08 | `pipeline-deterministic` | `novo_lead.enabled` |
| `auto:secretary-replied` | 81 | 07/08 | `pipeline-deterministic` | `secretary_replied.enabled` |
| `auto:automation-rule` | 70 | 28/07 | `automations-tick` | `ui_rule_move.enabled` |
| **`auto:classifier-general`** | **64** | **11/08 14:42** | `apply.ts:476` | **nenhum até 11/08** |
| `auto:inactivity-tick` | 37 | 08/08 | `pipeline-deterministic` | `inactivity_paciente_antigo.enabled` |
| `auto:reactivation-inbound` | 25 | 16/07 | `pipeline-deterministic` | `reactivation_inbound.enabled` |
| `auto:field-changed-consulta` | 18 | 11/08 | `pipeline-deterministic:499` | `appointment_sync.enabled` |
| `auto:field-changed-procedimento` | 11 | 06/08 | `pipeline-deterministic:500` | idem |
| `auto:monthly-sweep` | 5 | 01/08 | `pipeline-deterministic` | `monthly_sweep_paciente_antigo.enabled` |
| `auto:classifier-nurture` | 2 | 23/07 | `apply.ts:399` | `nurture_move.enabled` |

**`auto:wakeup-trigger` tem ZERO ocorrências** apesar da regra rodar: o trigger SQL
faz `UPDATE` + `INSERT` na mesma transação, `now()` é idêntico, o
`ON CONFLICT (lead_id, to_stage_id, moved_at)` descarta o insert explícito e sobra
só a linha do trigger, rotulada `system`.

### 3.2 Gates do `pipelineMove`

| Gate | O que faz | Estado |
|---|---|---|
| G3 | Toggle em `app_settings` (default `false`) | ativo |
| G4 | Idempotência via `lead_events` | ativo |
| G2 | `lock_auto_move` no destino | **inerte** — nenhuma coluna tem a flag |
| D3 | Paciente antigo não sai por automação | ativo (exceções por nome — §6) |
| G8 | UPDATE só toca `stage_id` + `stage_changed_at` | ativo |
| G5 | Grava `lead_stage_history` | ativo — **duplica** |
| G1 | `manual_lock_until` | **removido** (PR4) |

### 3.3 Duplicação — verificado

1079 grupos duplicados · 1094 linhas extras · pior caso 6 — sobre **6132 registros**.
**18% do histórico é duplicata.** Trigger e `pipelineMove` gravam em transações
distintas; o índice único em `moved_at` não pega a diferença de microssegundos.

### 3.4 Referências órfãs — verificado

**2895 de 6132 (47%)** com origem apontando para etapa inexistente; 1495 (24%) com
destino. Causa: `lead_stage_history.from_stage_id`/`to_stage_id` são `uuid`
**sem foreign key**, enquanto `pipeline_stages.pipeline_id` tem `ON DELETE CASCADE`.
A [migração 20260617224941](../../supabase/migrations/20260617224941_29057720-1b59-4b54-b574-aa0d42fa011b.sql)
deletou um pipeline e o cascade levou as etapas.

---

## 4. Campos (`leads.custom_fields`)

### 4.1 Quem escreve cada chave

| Chave | Escrita por | Definição em `lead_custom_fields`? |
|---|---|---|
| `procedimento_interesse` | regex trigger — **só se `NULL`** | ❌ fantasma |
| `demonstrou_interesse` | regex trigger | ❌ fantasma |
| `tentou_pagamento` | regex trigger | ❌ fantasma |
| `tentou_agendar` | regex trigger (com confirmação) | ❌ fantasma |
| `qualificacao` + `desqualificacao_motivo` + `desqualificacao_em` | regex trigger (EMDR) | ❌ fantasma |
| `risco_clinico` + `risco_clinico_detectado_em` | regex trigger | ❌ fantasma |
| `is_b2b` + `tipo_contato` | regex trigger **e** `on_b2b_stage_move` | ❌ fantasma |
| `interesse` | apagado pelo wipe ao sair de Qualificação | ❌ fantasma |
| `aguardando` | `pipeline-move.ts:222` ao entrar em Consulta finalizada | ❌ fantasma |
| `status_consulta` | `ruleAppointmentSync` | ✅ |
| `sessoes_realizadas` | `ruleAppointmentSync` (`+1`) | ✅ |
| `eh_paciente_antigo` | `ruleMonthlySweep` + regra `field-changed` | ✅ (só ÓR) |
| `consulta_agendada_em` | secretária / `trg_appointments_recompute` | ⚠️ **virtual** |
| `procedimento_agendado_em` | secretária / `trg_appointments_recompute` | ✅ *e também virtual* |
| `ciclo_concluido` · `status_financeiro` · `interesse_consulta` · `interesse_tratamento` · `saldo_sessoes_pacote` · `pagamento_alegado_em` · `data_solicitacao_nf` · `nome_responsavel_financeiro` · `possui_liminar_judicial` · `motivo_cancelamento` | UI / classifier | ✅ (seed global) |
| `modalidade_preferida` | — | **deletado** no PR4, ainda no schema da IA |

**13 chaves-fantasma** — escritas pelo trigger, sem definição, invisíveis no painel
de campos e exibidas cruas na linha do tempo.

### 4.2 Campos virtuais de agendamento

`consulta_agendada_em` **não existe** em `lead_custom_fields` por design. É
derivado em runtime de `clinic_appointment_types` em
[`ContextRail.tsx:97`](../../src/components/inbox/ContextRail.tsx), pela convenção
`${kind_name}_agendado_em` com caso especial hardcoded para `consulta`
(concordância de gênero: *agenda**da*** vs *agenda**do***).

`ContextRail.tsx:107` **descarta** a linha real de `lead_custom_fields` quando a
chave colide com uma virtual. Ou seja: `procedimento_agendado_em` tem definição
cadastrada **e** é sombreada pela virtual.

⚠️ A convenção está duplicada e **divergente**: o frontend gera
`${kind_name}_agendado_em` para qualquer tipo; o backend
([`date-parser.ts:44`](../../supabase/functions/pipeline-classify/date-parser.ts))
só conhece dois casos e joga o resto em `procedimento_agendado_em`.

### 4.3 Proteções contra a IA

| Mecanismo | Regra |
|---|---|
| G10 | Campo editado por humano nos últimos 7 dias não é sobrescrito |
| Exceção G10 | Datas do parser furam a janela com `confidence ≥ 0.85` |
| `STICKY_HUMAN_FIELDS` | `origem` — lock **permanente** |
| `AI_FORBIDDEN_FIELDS` | `origem` — a IA nunca escreve |
| `HUMAN_SCHEDULING_FIELDS` | as 2 datas de agendamento — 100% manuais |

---

## 5. Chips (`ai_review_reasons`)

**Não são colocados pela IA.** São gerados por regex em SQL no
`trg_lead_needs_extraction`.

| Chip | Regex | Campo que grava |
|---|---|---|
| `procedimento:cetamina` | `cetamina\|ketamina\|infusão` | `procedimento_interesse` |
| `procedimento:emt` | `emt` \| `estimulação magnética transcraniana` | idem |
| `procedimento:primeira_consulta` | `primeira consulta\|avaliação inicial` | idem |
| `procedimento:retorno` | `retorno\|reavaliação` | idem |
| `procedimento:seguimento` | `seguimento\|acompanhamento` | idem |
| `procedimento:terapia` | `psicoterapia\|terapia\|sessão de terapia` | idem |
| `interesse` | `quero\|gostaria\|preciso\|quanto custa\|…` | `demonstrou_interesse` |
| `pagamento` | `pix\|comprovante\|pagar\|boleto\|cartão\|…` | `tentou_pagamento` |
| `agendamento` | dias da semana, `agendar\|marcar\|horário`, `12/05`, `14h` | `tentou_agendar` (só com confirmação) |
| `risco_clinico` | ideação suicida / automutilação | `risco_clinico` |
| `proc_nao_atendido:emdr` | `emdr\|dessensibilização e reprocessamento` | `qualificacao='desqualificado'` |
| `b2b_pitch` | pitch comercial forte, ou termo + URL | `is_b2b`, `tipo_contato` |
| `media:image` / `media:audio` | anexo | `needs_audio_transcription` |
| `nova_mensagem` | **fallback** — nenhuma regra bateu | — |

### 5.1 Nunca são limpos — verificado

```sql
ai_review_reasons = (SELECT array_agg(DISTINCT r)
                     FROM unnest(COALESCE(ai_review_reasons,'{}') || v_reasons) r)
```

União acumulativa. `updateWatermark()`
([`apply.ts:658`](../../supabase/functions/pipeline-classify/apply.ts)) remove
apenas `pipeline-classifier`.

**Medido:** 1962 leads · média 0,5 chips · máx 8 · **209 com `nova_mensagem`** ·
70 com 5+ · **16 com procedimento divergente** do campo.

### 5.2 Chip ≠ tag ≠ reason

Três coisas distintas, tratadas como sinônimo na documentação:

- **reason** (`ai_review_reasons`) — array de texto, gerado por regex, acumulativo
- **tag** (`leads.tags`) — array, whitelist de 44 valores em `app_settings`, aplicado pela IA
- **chip** — o *elemento visual* do card, que renderiza **reason ou tag ou campo**

---

## 6. Inventário da contaminação de negócio no código

> **Este é o backlog da separação.** Critério de aceite (regra R4): buscar nome de
> coluna, palavra clínica ou UUID dentro de `supabase/functions/` deve retornar zero.

### 6.1 Nomes de coluna em TypeScript

| Local | Ocorrência |
|---|---|
| `pipeline-classify/schema.ts:9-19` | `Canon` — as 11 colunas possíveis como tipo TS |
| `pipeline-classify/schema.ts:50` | `TREATED_STAGES` |
| **`pipeline-classify/rules/first-consult.ts:6`** | **SEGUNDA cópia de `TREATED_STAGES`, divergente** — sem `"1ª Sessão Finalizada"` |
| `pipeline-classify/apply.ts:31-36` | `HUMAN_SCHEDULING_STAGES` |
| `pipeline-classify/apply.ts:311,336` | `ctx.stageName === "Paciente antigo"` |
| `pipeline-classify/apply.ts:354` | `"B2B / Stakeholders"` |
| `pipeline-classify/apply.ts:394,401,420` | `"Nutrição inativa"`, `"Novo"`, `"Qualificação"` |
| `pipeline-classify/agent-core.ts:540-649` | Prompts descrevendo as colunas da ÓR |
| `_shared/pipeline-move.ts:66` | `PACIENTE_ANTIGO_NAME` |
| `_shared/pipeline-move.ts:186-188` | Exceções do D3 por nome |
| `_shared/pipeline-move.ts:197,210` | Wipe: `"Qualificação"`, `"Consulta finalizada"` |
| `pipeline-deterministic/index.ts:50-60` | `Canon` de novo |
| **`outreach-recovery-tick/index.ts:68`** | `["Paciente antigo", "Nutrição de Leads Inativos"]` — **o segundo nome não corresponde a coluna nenhuma hoje** |

### 6.2 Vocabulário clínico

`pipeline-classify/agent-core.ts` · `pipeline-deterministic/index.ts` ·
`ai-chat/index.ts` · `outreach-recovery-tick/index.ts` ·
`_shared/builder-system-prompt.ts` · `_shared/wa-redirect-templates.ts` +
6 migrações.

O caso mais grave — a bateria de regex do `trg_lead_needs_extraction` — foi
**contido em 11/08** por gate de tenant, mas o vocabulário segue embutido.

### 6.3 UUIDs em SQL

| Migração | UUIDs |
|---|---|
| `20260717175732` / `20260718012724` (wake-up) | `clinic_id` + 4 colunas |
| `20260717194846` (b2b) | 2 colunas |

### 6.4 Regras de negócio dentro do motor

| Regra | Onde | Por que é contaminação |
|---|---|---|
| Sair de "Qualificação" apaga `interesse` | `pipeline-move.ts:206` | Helper genérico de movimentação com regra da ÓR |
| Entrar em "Consulta finalizada" apaga 4 datas e liga `aguardando` | `pipeline-move.ts:210-224` | idem |
| Guard D3 | `pipeline-move.ts:183` | Conceito de "paciente antigo" no motor |
| Transição Agendamento Humano | `apply.ts:27-37` | Decisão da ÓR aplicada a todos |

---

## 7. Configuração: lida vs. existente

`app_settings` é **`key TEXT PRIMARY KEY` — sem `clinic_id`**. Toda configuração é
global. Os helpers `getTenantToggle` / `getTenantSetting`
([`_shared/app-settings.ts`](../../supabase/functions/_shared/app-settings.ts))
existem para contornar isso e **só o `_template_pipeline_classify` os usa**.

**48 chaves no banco · 35 lidas por código ativo.**

### 7.1 No banco e nunca lidas — 7

| Chave | Valor | Nota |
|---|---|---|
| `automation.agendamento_sugerido.enabled` | true | — |
| `automation.field_patch.enabled` | true | — |
| `automation.modality_guard.enabled` | true | regra removida no PR4 |
| `automation.procedure_realizado.enabled` | true | — |
| `automation.tags_merge.enabled` | true | — |
| `automation.urgency_flag.enabled` | true | — |
| `automation.v42.custom_fields_schema` | JSON | schema real vem de `lead_custom_fields` |
| `automation.v42.motivo_desqualificacao_enum` | JSON | — |

### 7.2 Lidas só por código legado — 1

`automation.classifier.stage_move_min_confidence` = `0.75` — lido apenas por
`index.v1.ts`. O caminho ativo usa **0.8 hardcoded**.

### 7.3 Lidas pelo código e ausentes do banco — 1

`automation.or_monthly_cycle.enabled` — ausente ⇒ default `false` ⇒ regra desligada
sem que ninguém tenha decidido isso.

### 7.4 Registry `pipeline_tenant_classifiers`

| Campo | Valor (ÓR) | Lido? |
|---|---|---|
| `enabled` | `true` | ✅ |
| `classifier_version` | — | ✅ (só namespace de tag) |
| `override_prompts` | — | ✅ |
| `allowed_intents` | — | ✅ |
| **`active_agents`** | os 5 | ❌ **nunca** |
| **`locked_stages`** | 4 colunas | ❌ **nunca** |

**Total de configurações preenchidas e ignoradas: 11.**

---

## 8. Mecanismos de regra coexistindo

| # | Mecanismo | Estado |
|---|---|---|
| 1 | `automations` + `automations-tick` | vivo — 6 regras na ÓR, todas de comunicação |
| 2 | `pipeline-deterministic` (9 regras em TS) | vivo |
| 3 | `pipeline_field_rules` | **tabela órfã — zero leitores** |
| 4 | `stage_sequence_bindings` | código vivo, tabela vazia |
| 5 | Triggers SQL com UUID hardcoded | vivo |

---

## 9. Código morto identificado

| Item | Situação |
|---|---|
| `ruleConsultaPassou` | Retorna na 1ª linha; ~90 linhas inalcançáveis |
| `pipeline-classify/index.v1.ts` | Legado; único leitor de 1 chave viva |
| `_template_pipeline_classify/` | Completo, nunca clonado |
| `pipeline_field_rules` | Tabela sem leitores |
| Telemetria `pa40` | `index.ts:1035` lê `pa40`, função retorna `pa60` ⇒ stats sempre zeradas |

---

## 10. O que continua NÃO verificado

| Item | Por quê |
|---|---|
| Crons ativos | Sem acesso a `cron.job` |
| Código deployado nas Edge Functions | Roda na infra da Supabase; o repositório pode estar atrás |
| Entrega dos `pg_net` | Sem acesso a `net._http_response` |
| Conteúdo real de `override_prompts` / `allowed_intents` | Não consultado |

**Estas quatro lacunas são as únicas coisas neste documento que valem tanto quanto
documentação — ou seja, pouco.**
