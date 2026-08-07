---
title: "Registry — Custom fields"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por custom field: tipo declarado, tipo real gravado, quem escreve por qual caminho, se carimba G10, e quem lê. Inclui os 7 caminhos de escrita e os campos órfãos."
code_refs:
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/date-parser.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/_shared/pipeline-move.ts
  - src/components/inbox/CustomFieldsPanel.tsx
---

<!-- docs-verify:allow-stale-paths — cita o caminho errado de propósito, para avisar -->

# Registry — Custom fields

## Onde os dados moram

| Coisa | Onde |
|---|---|
| **Valores** | `leads.custom_fields` — JSONB livre, **sem constraint de tipo** |
| **Definições** (label, tipo, options) | `lead_custom_fields` — 23 linhas para a ÓR |
| **Carimbo de edição humana** | `leads.custom_fields_last_human_edit` — `{chave: timestamp}` |
| **Schema descritivo** | `app_settings.automation.v42.custom_fields_schema` — ⚠️ **ninguém lê** |

⚠️ **Nada força o JSONB a respeitar a definição.** Não há trigger de validação de tipo nem
constraint. A única validação real do sistema é o G7 (`qualificacao='desqualificado'` exige
`motivo_desqualificacao`). Um campo declarado `boolean` aceita array sem reclamar — e é
exatamente o que acontece (ver `interesse_tratamento`).

## Os 7 caminhos de escrita

Só quem seta `app.actor='system'` escapa do carimbo do G10:

| # | Caminho | Como escreve | Carimba G10? |
|---|---|---|---|
| 1 | Secretária na UI (`CustomFieldsPanel`) | RPC `merge_lead_custom_fields` — `SECURITY INVOKER`, merge atômico no Postgres, fila serial no cliente | ✅ sim — correto |
| 2 | Classifier (`apply.ts`) | RPC `apply_lead_automation_patch` — `SECURITY DEFINER`, seta `app.actor='system'` | ❌ não — correto |
| 3 | `pipeline-deterministic::patchCustomFields` | `update` direto | ⚠️ sim, como se fosse humano |
| 4 | `pipeline-tasks::mergeCustomFields` | `update` direto | ⚠️ sim |
| 5 | `pipeline-fase4::mergeCustomFields` | `update` direto | ⚠️ sim |
| 6 | `pipeline-move` (wipe de chips) | `update` direto | ⚠️ sim |
| 7 | `ai-chat` | `update` direto | ⚠️ sim |

O caso problemático é o **6**: o wipe **apaga** `consulta_agendada_em` ao entrar em
"Consulta finalizada", o delete carimba a chave, e a IA fica 7 dias sem poder repreenchê-la —
salvo pelo override de data (`isDateFromParser` + `conf ≥ 0.85`).

## Como a IA decide o que pode preencher

O prompt do Preenchedor é **construído em runtime** a partir de `lead_custom_fields`
(`describeFieldType` em `agent-core.ts`): cada campo entra com seu tipo e, para
`select`/`multiselect`, a lista literal de `options`. Só se a clínica não tiver nenhuma
definição é que entra a lista hardcoded `FALLBACK_TYPIFIER_KEYS`.

Bloqueios adicionais no `apply.ts`, avaliados antes do G10:

| Conjunto | Conteúdo | Efeito |
|---|---|---|
| `AI_FORBIDDEN_FIELDS` | `origem` | IA nunca escreve → `field_owned_by_tracking` |
| `STICKY_HUMAN_FIELDS` | `origem` | Lock **permanente** (sem janela de 7d) → `sticky_human_field_locked` |
| `DATE_FIELD_KEYS` | `consulta_agendada_em`, `procedimento_agendado_em` | Patch direto do LLM rejeitado → `use_mentioned_dates_instead`. Só entram pelo parser |

## Campos com definição

Legenda de escritores: **UI** · **CLS** (classifier) · **DET** (determinístico) · **FX** (tasks/fase4) · **MOV** (wipe) · **FORM** (captação)

| Campo | Tipo declarado | Escritores | O que acontece na interação |
|---|---|---|---|
| `interesse` | select | FORM, UI, **MOV** | Preenchido na captação. **Apagado** ao sair de `Qualificação`. Não está na lista do Preenchedor — a IA nunca repõe |
| `procedimentos` | multiselect | UI | Só manual |
| `data_horario` | datetime | UI | Só manual. ⚠️ Não sincroniza com `consulta_agendada_em` — são campos independentes |
| `teleconsulta` | boolean | UI | Só manual. ⚠️ Sobrepõe conceitualmente `modalidade_preferida`, sem regra ligando os dois |
| `link_consulta` | url | UI | Só manual |
| `pagamento` | currency | UI | Só manual. ⚠️ Não conversa com `status_financeiro` |
| `origem` | select | FORM | 🔒 `AI_FORBIDDEN` + `STICKY_HUMAN`. Migrou para campo nativo (`leads.origin_channel`/`origin_label`/`origin_detail`) |
| `mensagem` | textarea | FORM | Texto original do lead. O prompt proíbe a IA de escrever resumo aqui |
| `enviar_dia` | date | UI | Só manual |
| `consulta_agendada_em` | datetime | **CLS** (parser), MOV (delete) | Só via `mentioned_dates` → `date-parser.ts`. Definição cadastrada em 2026-06-23 (`KNOWN_ISSUES.md` #7) — só 1 clínica usa |
| `procedimento_agendado_em` | datetime | **CLS** (parser), MOV (delete) | Só via `mentioned_dates` → `date-parser.ts`, ancorado na mensagem que citou, janela de +90d. Aparece na UI |
| `status_financeiro` | select: `pago`\|`pendente`\|`parcial`\|`atrasado`\|`nao_aplicavel` | CLS, **FX** (`runPaymentConfirmed`) | **Autoridade da Secretária**: a IA não pode setar `pago` sem confirmação da clínica — usa a tag `pagamento_alegado`. O webhook de pagamento seta `pago` e remove a tag. ⚠️ Enum não validado |
| `status_consulta` | select: `agendada`\|`realizada`\|`faltou`\|`cancelada` | **DET** | Escrito pelo `appointment-sync` por update direto → carimba G10 → trava a IA nessa chave por 7d |
| `interesse_consulta` | ⚠️ **boolean** (def) / **array** (IA em fallback) | CLS | Ver "Conflito de tipo" abaixo |
| `interesse_tratamento` | ⚠️ **boolean** (def) / **array** (IA em fallback) | CLS; lido por `reactivation-tick` | Ver "Conflito de tipo" abaixo |
| `ciclo_concluido` | boolean | **UI apenas** | Gatilho mais forte do sistema: `false→true` move para `Paciente antigo`. ⚠️ O `manual_lock_until` de 90d que acompanhava foi **removido na PR4** — hoje o lead vai para lá sem congelamento |
| `sessoes_realizadas` | number | **DET** | `+1` a cada appointment `realizado`+`procedimento`. ⚠️ Lê-e-soma **sem transação** — dois appointments concorrentes perdem contagem |
| `nome_responsavel_financeiro` | text | CLS | Quando um familiar fala pelo paciente |
| `possui_liminar_judicial` | boolean | CLS | Distinto de `judicializacao_em`, que é escrito pelo efeito de intent |
| `saldo_sessoes_pacote` | number | CLS | ⚠️ Nenhuma regra decrementa. `sessoes_realizadas` sobe e este não desce |
| `pagamento_alegado_em` | datetime | **FX** (`runPaymentAlleged`) | Disparado por `intent='pagamento_alegado'`. Também cria task D+1 útil e tag |
| `data_solicitacao_nf` | datetime | **FX** (`runNfTask`) | Só com `intent='nf_reembolso'` **e** stage `Consulta finalizada`. Fora disso: `wrong_stage` |
| `modalidade_preferida` | select: `presencial`\|`online`\|`indiferente` | CLS, UI | `→ online` dispara `auto:modality-guard` (tag). ⚠️ A regra compara `oldCf`/`newCf` do body do trigger — escrita da IA via RPC pode não notificar |
| `motivo_cancelamento` | text | CLS, UI | Enum documentado em prosa, mas o campo é `text` livre |

## Campos sem definição (JSONB órfão)

Escritos por código mas ausentes de `lead_custom_fields` — **não aparecem na UI**:

| Campo | Escrito por | Situação |
|---|---|---|
| `qualificacao` | trigger I6, UI | Alimenta o G7 |
| `motivo_desqualificacao` | trigger I6 | Exigido pelo G7 quando `qualificacao='desqualificado'`. Enum em `app_settings`, não enforçado |
| `judicializacao_em` | **FX** (`runJudicializacao`) | Junto com tags + task de 2h |
| `aguardando` | **MOV** | Setado `true` ao entrar em `Consulta finalizada`. ⚠️ Ninguém lê |
| `consulta_confirmada`, `procedimento_confirmado` | **MOV** (delete) | ⚠️ Só existem para serem apagados — nenhum escritor |
| `eh_paciente_antigo` | CLS (fallback) | Sugerido pelo Preenchedor; sem definição |
| `sessions_requested` | — | ⚠️ Resíduo. Proibido no prompt, mas ninguém escreve nem lê |

## ❌ Conflito de tipo — `interesse_tratamento` / `interesse_consulta`

Três fontes, duas respostas:

| Fonte | Tipo |
|---|---|
| `lead_custom_fields` (definição) | `boolean` |
| `app_settings.automation.v42.custom_fields_schema` | `boolean` |
| `FALLBACK_TYPIFIER_KEYS` no prompt | `array de string` |

Quando a clínica tem definições cadastradas, o prompt dinâmico usa o tipo real e o conflito não
aparece. **No caminho de fallback, a IA grava array num campo boolean.** Cadeia:

1. A UI renderiza pelo `field_type` da definição → `boolean` → `<Switch>`. Array não-vazio é
   truthy → **switch aparece ligado**, sem mostrar o conteúdo. A secretária vê um toggle, não
   "cetamina, EMT".
2. Se ela mexer no toggle, grava `true`/`false` literal — o conteúdo semântico da IA some.
3. `ruleReactivationTick` faz `if (cf.interesse_tratamento !== true) continue`. Array nunca é
   `=== true` → **a regra de reativação nunca marca ninguém**, e essa é sua única condição.

**Decisão pendente**: alinhar a definição para `multiselect` (e ajustar `reactivation-tick`
para testar `Array.isArray(v) && v.length > 0`), ou alinhar o fallback para boolean. A primeira
opção preserva a informação; a segunda é menor.

## Wipe de chips (`pipelineMove`)

Executado **antes** do UPDATE de stage. Chaves afetadas aparecem em
`lead_stage_history.metadata.wiped_keys`. Falha de wipe não bloqueia o move.

| Condição | Efeito |
|---|---|
| Saindo de `Qualificação` | remove `interesse` |
| Entrando em `Consulta finalizada` | remove `consulta_agendada_em`, `procedimento_agendado_em`, `consulta_confirmada`, `procedimento_confirmado`; seta `aguardando=true` |

⚠️ `1ª Sessão Finalizada` é o outro stage de finalização e **não** dispara wipe. Leads que
finalizam procedimento ficam com as datas de agendamento antigas.

## Auditar um lead

```sql
SELECT custom_fields, custom_fields_last_human_edit FROM leads WHERE id = '<uuid>';

-- o que a IA tentou e o que foi bloqueado
SELECT created_at,
       payload->'applied'->'custom_fields'->'set'            AS aplicados,
       payload->'applied'->'custom_fields'->'blocked_by_g10' AS bloqueados_g10,
       payload->'applied'->'custom_fields'->'rejected'       AS rejeitados
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 10;
```

⚠️ O caminho é `applied.custom_fields.rejected` — docs antigos citavam
`applied.custom_fields_rejected` (sem o nível intermediário), que retorna vazio.
