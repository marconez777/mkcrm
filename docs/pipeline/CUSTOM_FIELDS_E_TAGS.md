---
title: "Pipeline — Custom fields e tags (referência completa)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Catálogo de custom_fields existentes (10), com enum implícito (8), faltantes a criar na Fase 0.5 (8), whitelist de tags e writers atuais."
related_docs:
  - docs/pipeline/DATABASE.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/SCENARIOS.md
---

# Custom fields e tags — referência completa

## Custom fields atuais (`lead_custom_fields`)

10 defs existem hoje na Clínica ÓR. **Valores moram em `leads.custom_fields jsonb`**, não em colunas. Trigger `trg_validate_lead_custom_fields_enums` valida 8 deles contra enum implícito.

| Chave | Tipo | Enum implícito (validado por trigger) | Writers atuais |
|---|---|---|---|
| `modalidade` | text | `presencial` \| `online` \| `qualquer` | manual + form |
| `procedimento_interesse` | text | `cetamina` \| `emt` \| `consulta_psiquiatria` \| `outro` | manual |
| `profissional_preferencia` | text | livre | manual |
| `status_nf_reembolso` | text | `nao_solicitado` \| `solicitado` \| `emitido` | manual |
| `qualificacao` | text | `em_qualificacao` \| `qualificado` \| `desqualificado` | manual |
| `motivo_desqualificacao` | text | `fora_de_escopo_geografico` \| `sem_fit_clinico` \| `sem_condicao_financeira` \| `outro` | manual (obrigatório quando `qualificacao='desqualificado'`) |
| `tipo_atendimento` | text | `primeira_consulta` \| `retorno` \| `procedimento` | manual |
| `status_consulta` | text | `agendada` \| `realizada` \| `cancelada` \| `faltou` | derivado de `appointments` |
| `convenio` | text | livre | manual |
| `valor_combinado` | number | livre | manual |

### Regras de escrita pela automação (Classifier Fase 2)

- **G9**: Classifier que sugere valor de campo enum-validado **deve usar a string exata do enum**, não variação ("desqualificado" não "Desqualificado").
- **R2/G7**: Setar `qualificacao='desqualificado'` exige `motivo_desqualificacao` no MESMO update — senão trigger rejeita.
- **R3/G8**: Nunca tocar em `leads.pipeline_id` — trigger `sync_lead_pipeline_id` deriva.
- **G10**: Para a mesma chave, valor escrito por humano nos últimos 7 dias **não** é sobrescrito pelo classifier. Vira sugestão na UI.

## Custom fields a CRIAR na Fase 0.5 (8 novos)

O estudo exige escrita nestas chaves, mas elas não existem em `lead_custom_fields`. Criar antes da Fase 1, ou o classifier escreve "no escuro" e a UI não exibe.

| Chave | Tipo | Enum | Cenário | Usado por |
|---|---|---|---|---|
| `nome_responsavel_financeiro` | text | livre | P2 (familiar) | Classifier; nunca renomear `leads.name` |
| `possui_liminar_judicial` | boolean | — | C7 | Classifier |
| `saldo_sessoes_pacote` | number | — | Em tratamento (pacotes) | Manual + futura regra |
| `sessoes_realizadas` | number | — | `auto:procedure-realizado` (subsequentes) | Rule Engine Fase 1 |
| `pagamento_alegado_em` | timestamptz | — | C4 sem webhook | `auto:payment-confirmed` Fase 3 |
| `data_solicitacao_nf` | timestamptz | — | C3 | `auto:nf-task` Fase 3 |
| `modalidade_preferida` | text | `presencial` \| `online` \| `qualquer` | P3 | Classifier (diferente de `modalidade` que é da consulta atual) |
| `motivo_cancelamento` | text | `paciente_cancelou` \| `clinica_cancelou` \| `outro` | `auto:appointment-cancelado` | Rule Engine Fase 1 |

Migration:
```sql
INSERT INTO lead_custom_fields (clinic_id, key, label, type, ...) VALUES
  ('<clinic>', 'nome_responsavel_financeiro', 'Responsável financeiro', 'text', ...),
  ('<clinic>', 'possui_liminar_judicial',     'Possui liminar judicial','boolean', ...),
  -- ...
```

## Tags — whitelist canônica

Hoje há **9 tags distintas** em uso na base, mas **>90% dos leads não têm tag**. A automação só pode escrever tags da whitelist abaixo (`MERGE` sempre — G6, R1):

### Já em uso pelo humano + triggers existentes
- `risco_clinico` — escrita pelo trigger `tg_lead_risk_handler`. Classifier **nunca** sobrescreve.
- `b2b` — manual, marca lead como B2B.
- `vip` — manual.
- `paciente_antigo` — manual.

### Whitelist nova da automação (v3)
| Tag | Quem escreve | Quando |
|---|---|---|
| `b2b_auto` | `auto:b2b-move` | Classifier detectou B2B com confidence ≥0.85 |
| `urgencia_clinica` | `auto:urgency-flag` | Classifier detectou urgência alta/crítica |
| `reativacao` | `auto:reactivation` | Lead em Sem resposta/Nutrição reativou (default) |
| `reativacao_durante_lock` | `auto:reactivation` | Reativação durante `manual_lock_until` ativo |
| `no_show` | `auto:appointment-faltou` | Appointment status=faltou |
| `reagendamento_pendente` | `auto:appointment-cancelado` | Appointment cancelado |
| `reagendamento_solicitado` | `auto:reactivation` | Lead com tag `no_show` voltou a falar |
| `pagamento_alegado` | `auto:payment-confirmed` | Texto "paguei" sem webhook |
| `judicializacao` | `auto:judicializacao` (Fase 4) | Classifier detectou liminar/processo |

### Regras
- **MERGE sempre**: `tags = (SELECT array(SELECT DISTINCT unnest(tags || ARRAY['<nova>'])))`.
- **Nunca remover** tag de humano automaticamente.
- **Whitelist fechada**: classifier só pode sugerir tags desta lista; tags fora são descartadas pelo Rule Engine.

## Writers atuais (mapa)

| Caminho | O que escreve |
|---|---|
| Frontend Kanban (`useManualStageMove`) | `stage_id`, `manual_lock_until`, `lead_stage_history(source='manual')` |
| Trigger `tg_lead_risk_handler` | `tags += 'risco_clinico'` |
| Trigger `trg_validate_lead_custom_fields_enums` | Rejeita updates inválidos (não escreve) |
| Trigger `sync_lead_pipeline_id` | `leads.pipeline_id` (derivado de `stage_id`) |
| Trigger `trg_appointments_recompute` | Campos derivados do lead vindos de `appointments` |
| Form submission | `name`, `phone`, `email`, alguns `custom_fields` iniciais |
| `evolution-webhook` | `last_message_at`, `last_message_preview`, `unread_count` |

**Hoje nenhum writer toca em**: `ai_summary`, `needs_ai_review`, `ai_review_reasons`, `last_classified_at`. Esses 4 campos estão **livres** para o Classifier+Summarizer (Fases 2/3) usarem sem conflito.
