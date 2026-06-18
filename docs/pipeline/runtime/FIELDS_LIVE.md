---
title: "Custom fields reais — Clínica ÓR"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "23 custom_fields cadastrados em lead_custom_fields para a Clínica ÓR. Lista exata com field_key, label, field_type, options/enum, writers automáticos."
code_refs:
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/pipeline-deterministic/index.ts
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Custom fields — estado real (clinic `cf038458-…`)

Consulta:

```sql
SELECT field_key, label, field_type, options
FROM lead_custom_fields
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
ORDER BY position, field_key;
```

## Tabela completa (23 fields)

| `field_key` | Label | `field_type` | options (enum) | Writers automáticos |
|---|---|---|---|---|
| `interesse` | Interesse | select | Infusão de Cetamina, EMT, Tratamento Alcoolismo, Hipnoterapia, EMDR, Tratamento para Depressão, Psicoterapia, Consulta com psiquiatria, Outro | form submission, manual |
| `procedimentos` | Procedimentos | multiselect | Infusão de cetamina, EMT, Primeira Consulta, Consulta de seguimento, Retorno, Sessão de terapia | manual |
| `data_horario` | Data e horário | datetime | — | manual |
| `teleconsulta` | Teleconsulta? | boolean | — | manual |
| `link_consulta` | Link de Consulta | url | — | manual |
| `pagamento` | Pagamento | currency | — | manual |
| `origem` | Origem | select | Google - Orgânico, Google - Ads, Youtube, Redes Sociais, Indicação de paciente, Indicação de Médico, Indicação de Psicóloga, Indeterminado | form submission, manual |
| `mensagem` | Mensagem | textarea | — | form submission |
| `enviar_dia` | Enviar Dia | date | — | manual |
| `procedimento_agendado_em` | Data do procedimento | datetime | — | **classifier** (via `custom_fields_patch`, validado por `sanitizeDateField`) |
| `status_financeiro` | Status Financeiro | select | pago, pendente, parcial, atrasado, nao_aplicavel | webhook `pipeline-payment-webhook` → `runPaymentConfirmed` (seta `pago`); migration D1 setou `pago` em 9 leads vindos da extinta "Procedimento pago" |
| `status_consulta` | Status da Consulta | select | agendada, realizada, faltou, cancelada | `auto:appointment-sync` (mapeia status do appointment) |
| `interesse_consulta` | Interesse em Consulta | boolean | — | classifier (intent='interesse_tratamento' em alguns casos) |
| `interesse_tratamento` | Interesse em Tratamento | boolean | — | classifier; lido por `auto:reactivation` |
| `ciclo_concluido` | Ciclo Concluído | boolean | — | **manual** → dispara `auto:ciclo-concluido` |
| `sessoes_realizadas` | Sessões Realizadas | number | — | `auto:appointment-sync` (incrementa quando `realizado`+`procedimento`) |
| `nome_responsavel_financeiro` | Responsável Financeiro | text | — | classifier (quando familiar fala pelo paciente) |
| `possui_liminar_judicial` | Possui Liminar Judicial | boolean | — | manual |
| `saldo_sessoes_pacote` | Saldo de Sessões (Pacote) | number | — | manual |
| `pagamento_alegado_em` | Pagamento Alegado em | datetime | — | `runPaymentAlleged` (intent='pagamento_alegado') |
| `data_solicitacao_nf` | Data Solicitação NF | datetime | — | `runNfTask` (intent='nf_reembolso' + stage='Consulta finalizada') |
| `modalidade_preferida` | Modalidade Preferida | select | presencial, online, indiferente | manual; mudar para `online` dispara `auto:modality-guard` (tag) |
| `motivo_cancelamento` | Motivo de Cancelamento | text | — | manual (preenchido no fluxo de cancelamento de appointment) |

## Custom fields citados por código mas **não cadastrados** como definição

Encontrados em `pipeline-classify`, `pipeline-tasks`, `pipeline-fase4`:

| Key escrita por código | Onde | Status |
|---|---|---|
| `consulta_agendada_em` | classifier `DATE_FIELD_KEYS` | **NÃO existe** em `lead_custom_fields` da clínica. Patch ainda é gravado no JSONB de `leads.custom_fields`, mas não aparece na UI de campos. Provável esquecimento — só `procedimento_agendado_em` foi cadastrado. |
| `qualificacao` | trigger I6 + `customFieldsPatchForStage` | sem def — JSONB livre |
| `motivo_desqualificacao` | trigger I6 (`enforce_motivo_desqualificacao`) | sem def — JSONB livre. Enum gerenciado por `automation.v42.motivo_desqualificacao_enum` em `app_settings` |
| `judicializacao_em` | `runJudicializacao` | sem def |
| `tentou_pagamento`, `pagamento_confirmado`, `tentou_agendar` | `reset_ai_classifications()` apaga essas chaves | resíduos de versão anterior |

## Validação server-side

### Datas (classifier `sanitizeDateField`)

Para as chaves `consulta_agendada_em` e `procedimento_agendado_em`:

- Rejeita `t < anchor - 2h` → `reason: 'in_past'`
- Rejeita `t > anchor + 90d` → `reason: 'too_far_future'`
- `anchor` = última mensagem lida (não `now()`)
- Rejeições registradas em `lead_events.payload.applied.custom_fields_rejected[]`

### Outros enums

Não há validação server-side para `status_financeiro`, `status_consulta`, `modalidade_preferida`. Definições em `app_settings`:

- `automation.v42.custom_fields_schema` — JSON com tipos esperados (informativo, não enforced no backend hoje).
- `automation.v42.motivo_desqualificacao_enum` — array de valores válidos (não enforced no backend hoje).

Triggers de validação (`trg_validate_lead_custom_fields_enums`) podem estar definidos em migrations anteriores mas não foram revisados nesta auditoria.

## Custom fields que merecem atenção

- **`consulta_agendada_em` sem def**: chave usada pelo classifier e pelo prompt mas inexistente como def → patches gravam silenciosamente em `leads.custom_fields` JSONB. UI provavelmente não mostra.
- **Drift v3→v4.2**: chaves antigas `procedimento_interesse`, `profissional_preferencia` citadas em `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` foram **substituídas** mas a doc de planejamento ainda referencia.
- **`status_financeiro`**: independente do stage (decisão D1). 4 leads hoje têm tag `pagamento_alegado` e provavelmente `status_financeiro != 'pago'`.
