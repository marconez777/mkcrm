---
title: "Pipeline — Custom fields e tags (v4.1)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Catálogo v4.1 de custom_fields (existentes + 12 novos), enums atualizados (motivo_desqualificacao reescrito), whitelist de tags incluindo precisa_atencao_humana, e regras de escrita por writer."
related_docs:
  - docs/pipeline/DATABASE.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/SCENARIOS.md
---

# Custom fields e tags — referência completa (v4.1)

## Custom fields atuais (`lead_custom_fields`)

10 defs existem hoje na Clínica ÓR. Valores em `leads.custom_fields jsonb`. Trigger `trg_validate_lead_custom_fields_enums` valida 8 contra enum implícito.

| Chave | Tipo | Enum implícito | Writers |
|---|---|---|---|
| `modalidade` | text | `presencial \| online \| qualquer` | manual + form |
| `procedimento_interesse` | text | `cetamina \| emt \| consulta_psiquiatria \| outro` | manual (deprecado em v4.1 — usar `interesse_tratamento`) |
| `profissional_preferencia` | text | livre | manual (deprecado — usar `interesse_consulta`) |
| `status_nf_reembolso` | text | `nao_solicitado \| solicitado \| emitido` | manual |
| `qualificacao` | text | `em_qualificacao \| qualificado \| desqualificado` | manual |
| `motivo_desqualificacao` | text | **enum atualizado em v4.1** (ver abaixo) | manual (obrigatório se `qualificacao='desqualificado'`) |
| `tipo_atendimento` | text | `primeira_consulta \| retorno \| procedimento` | manual |
| `status_consulta` | text | **enum atualizado em v4.1** (ver "Grupo: Status operacional") | manual + reator humano (D7) |
| `convenio` | text | livre | manual |
| `valor_combinado` | number | livre | manual |

### Novo enum `motivo_desqualificacao` (v4.1)

Substitui o conjunto v3 conforme brief item 16:

```
servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro
```

Migration deve mapear valores antigos:
- `fora_de_escopo_geografico` → `fora_da_regiao`
- `sem_fit_clinico` → `demanda_incompativel`
- `sem_condicao_financeira` → `outro` (com nota em `internal_notes`)

## Campos a CRIAR na Fase 0.5 (v4.1 — 12 novos)

Organizados por grupo lógico.

### Grupo: Financeiro

| Chave | Tipo | Enum | Cenário |
|---|---|---|---|
| `status_financeiro` | text | `pendente \| parcial \| pago \| reembolsado \| cancelado \| isento \| nao_se_aplica` | **D1** — substitui coluna "Procedimento pago". Independente do stage. |
| `pagamento_alegado_em` | timestamptz | — | C4 sem webhook. Setado por `auto:payment-confirmed`. |

### Grupo: Status operacional

| Chave | Tipo | Enum | Cenário |
|---|---|---|---|
| `status_consulta` | text | `agendada \| realizada \| faltou \| cancelada \| reagendada` | **Brief item 7+D5**: campo independente que o reator humano lê. **Atualiza enum existente** (era `agendada \| realizada \| cancelada \| faltou` — adiciona `reagendada`). |
| `ciclo_concluido` | boolean | — | Humano marca true → `auto:ciclo-concluido` move Em tratamento → Paciente antigo. |
| `sessoes_realizadas` | number | — | Incrementado por `auto:procedure-realizado` em sessões subsequentes. |
| `motivo_cancelamento` | text | `paciente_cancelou \| clinica_cancelou \| outro` | Setado por `auto:appointment-cancelado` se vier no payload. |

### Grupo: Interesse (substitui `interesse_principal` da v3 — C16)

| Chave | Tipo | Enum | Cenário |
|---|---|---|---|
| `interesse_consulta` | text[] | multi: `ivan \| maisa` | **C16** — paciente pode querer ambos profissionais. Substitui o single-select. |
| `interesse_tratamento` | text[] | multi: `cetamina \| emt \| hipnose \| outro \| nenhum` | **C16** — paralelo ao `interesse_consulta`. |

### Grupo: Contexto do paciente

| Chave | Tipo | Enum | Cenário |
|---|---|---|---|
| `nome_responsavel_financeiro` | text | livre | **P2** — Classifier escreve aqui quando familiar fala pelo paciente. Nunca renomeia `leads.name`. |
| `possui_liminar_judicial` | boolean | — | C7. |
| `saldo_sessoes_pacote` | number | — | Em tratamento (pacotes). |
| `modalidade_preferida` | text | `presencial \| online \| qualquer` | Diferente de `modalidade` (consulta atual). |

### Grupo: Operacional NF

| Chave | Tipo | Enum | Cenário |
|---|---|---|---|
| `data_solicitacao_nf` | timestamptz | — | C3 — setado por `auto:nf-task`. |

### Migration esqueleto

```sql
INSERT INTO lead_custom_fields (clinic_id, key, label, type, ...) VALUES
  ('<clinic>', 'status_financeiro',            'Status financeiro',            'text',         ...),
  ('<clinic>', 'pagamento_alegado_em',         'Pagamento alegado em',         'timestamptz',  ...),
  ('<clinic>', 'ciclo_concluido',              'Ciclo concluído',              'boolean',      ...),
  ('<clinic>', 'sessoes_realizadas',           'Sessões realizadas',           'number',       ...),
  ('<clinic>', 'motivo_cancelamento',          'Motivo do cancelamento',       'text',         ...),
  ('<clinic>', 'interesse_consulta',           'Interesse em consulta',        'text[]',       ...),
  ('<clinic>', 'interesse_tratamento',         'Interesse em tratamento',      'text[]',       ...),
  ('<clinic>', 'nome_responsavel_financeiro',  'Responsável financeiro',       'text',         ...),
  ('<clinic>', 'possui_liminar_judicial',      'Possui liminar judicial',      'boolean',      ...),
  ('<clinic>', 'saldo_sessoes_pacote',         'Saldo de sessões do pacote',   'number',       ...),
  ('<clinic>', 'modalidade_preferida',         'Modalidade preferida',         'text',         ...),
  ('<clinic>', 'data_solicitacao_nf',          'Data da solicitação de NF',    'timestamptz',  ...);
```

E atualizar `trg_validate_lead_custom_fields_enums` para incluir todos os enums novos.

## Regras de escrita pela automação

- **G9**: Classifier usa string exata do enum (`'desqualificado'`, não `'Desqualificado'`).
- **R2/G7**: `qualificacao='desqualificado'` + `motivo_desqualificacao` no mesmo UPDATE.
- **R3/G8**: Nunca tocar em `leads.pipeline_id`.
- **G10**: Para a mesma chave, valor humano <7d **não** é sobrescrito. Vira sugestão na UI.
- **G11** (v4.1): Classifier nunca escreve em `appointments`. Só cria task + tag `agendamento_sugerido`.

---

## Tags — whitelist canônica (v4.1)

Hoje há ~9 tags em uso. A automação só pode escrever tags da whitelist abaixo (MERGE sempre — G6, R1).

### Já em uso pelo humano + triggers

- `risco_clinico` — escrita pelo trigger `tg_lead_risk_handler`. Classifier nunca sobrescreve.
- `b2b` — manual.
- `vip` — manual.
- `paciente_antigo` — manual.

### Whitelist nova (v4.1)

| Tag | Quem escreve | Quando |
|---|---|---|
| `welcome_sent` | `auto:novo-lead` | Primeira mensagem do sistema enviada. |
| `b2b_auto` | `auto:b2b-move` (Fase 2) | Classifier detectou B2B com confidence ≥0.85. |
| `urgencia_clinica` | `auto:urgency-flag` (Fase 2) | Classifier detectou urgência alta/crítica. |
| `reativacao` | `auto:reactivation` | Lead em Sem resposta/Nutrição reativou (default). |
| `reativacao_durante_lock` | `auto:reactivation` | Reativação durante `manual_lock_until` ativo. |
| `no_show` | `auto:appointment-faltou` | Appointment `faltou`. |
| `reagendamento_pendente` | `auto:appointment-cancelado` | Appointment cancelado. |
| `reagendamento_solicitado` | `auto:reactivation` | Lead com `no_show` voltou a falar. |
| `aguardando_nova_data` | Reator humano (D7) | Humano setou `status_consulta='reagendada'` sem informar nova data. |
| `pagamento_alegado` | `auto:payment-confirmed` (Fase 3) | Texto/comprovante sem webhook. |
| `consulta_agendada` | `auto:appointment-agendado` com guard D3 | Paciente antigo agendou consulta sem sair do stage. |
| `tratamento_em_andamento` | `auto:appointment-agendado` com guard D3 | Paciente antigo agendou tratamento sem sair do stage. |
| `agendamento_sugerido` | `auto:agendamento-sugerido` (Fase 2) | Classifier detectou intent `agendar`. Acompanha task. |
| `judicializacao` | `auto:judicializacao` (Fase 4) | Classifier detectou liminar/processo. |
| `auditor_sugere_<stage>` | A1 `pipeline-position-auditor` (Fase 2.5, v4.2) | Auditor diário discorda da posição atual com `confidence ≥ 0.75`. Acompanha task. |
| `post_move_warning` | A2 `pipeline-post-move-verifier` (Fase 2.5, v4.2) | Segunda opinião pós-move discordou com `confidence ≥ 0.8`. Não reverte. |
| **`precisa_atencao_humana`** | **Múltiplos** — ver seção abaixo | Lead travado, fallback universal (D8). Aplicada também por A1 e A2 quando discordam. |

### Tag de sistema: `precisa_atencao_humana` (D8)

**O que é**: tag universal de "lead travado / IA não tem certeza do próximo passo". Ponto único para a equipe encontrar casos que precisam de revisão.

**Quem aplica**:
1. **Classifier (Fase 2)** — quando `confidence < 0.6`.
2. **Reator humano (Fase 1.8)** — quando humano faz ação ambígua que a IA não consegue inferir (ver tabela completa em `AUTOMATION_PLAN.md`).
3. **Qualquer regra `auto:*`** — quando precondições parciais batem mas decisão final é incerta (ex.: cancelamento sem appointment vinculado).

**Quem remove**: sempre humano, ao revisar o caso. Nunca automação.

**Fluxo (C20)**:
1. Tag aplicada → lead aparece em view futura "Leads travados" no Kanban.
2. Humano abre, decide, remove tag.
3. Caso vira material de retreino: registrar em `agent_evals`.
4. Quando padrão for absorvido por regra nova, leads similares param de cair na fila.

**Métrica**: `lead_events.type='stuck_flagged'` registra cada aplicação com `payload.reason`. Painel mostra volume 7d. Saúde estável = <5% dos leads ativos com a tag.

### Regras gerais de tags

- **MERGE sempre**: `tags = (SELECT array(SELECT DISTINCT unnest(tags || ARRAY['<nova>'])))`.
- **Nunca remover** tag de humano automaticamente.
- **Whitelist fechada**: classifier só pode sugerir tags desta lista; outras são descartadas pelo Rule Engine.

## Writers atuais (mapa)

| Caminho | O que escreve |
|---|---|
| Frontend Kanban (`useManualStageMove`) | `stage_id`, `manual_lock_until`, `lead_stage_history(source='manual')` → dispara reator (D7) |
| Trigger `tg_lead_risk_handler` | `tags += 'risco_clinico'` |
| Trigger `trg_validate_lead_custom_fields_enums` | Rejeita updates inválidos |
| Trigger `sync_lead_pipeline_id` | `leads.pipeline_id` derivado |
| Trigger `trg_appointments_recompute` | Campos derivados de `appointments` |
| Form submission | `name`, `phone`, `email`, alguns `custom_fields` |
| `evolution-webhook` | `last_message_at`, `last_message_preview`, `unread_count` |
| `automations-tick` | Lembretes via UI `/automations` (D6) |

**Hoje nenhum writer toca em**: `ai_summary`, `needs_ai_review`, `ai_review_reasons`, `last_classified_at`. Livres para Classifier+Summarizer.
