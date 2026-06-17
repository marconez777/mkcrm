---
title: "Mapa: Contrato de Custom Fields do Lead"
topic: ai
kind: map
audience: agent
updated: 2026-06-17
summary: Catálogo canônico dos custom_fields que o pipeline IA escreve em `leads.custom_fields`. Define nome, tipo, enum, quem escreve, quem lê. Fonte única de verdade para extractor + field-rules + AIBadges.
code_refs:
  - supabase/functions/extractor-tick/
  - supabase/functions/vision-tick/
  - supabase/functions/field-rules-tick/
  - src/pages/Kanban.tsx
related_docs:
  - docs/maps/AI_RUNTIME.md
  - docs/maps/KANBAN_LEADS.md
  - docs/flows/PIPELINE_DERIVED.md
  - docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md
---
# Mapa: Contrato de Custom Fields do Lead

> **Para localizar edições.** Este é o contrato único entre o **extractor** (escreve), o **field-rules-tick** (lê e move) e o **AIBadges** (mostra no Kanban). Mudar nome de campo aqui sem espelhar nos 3 lados quebra o pipeline.
> **Última atualização:** 2026-06-17

---

## 1. Por que isso existe

O kanban da clínica é **derivado de campos**, não escolha manual. O extractor extrai dados estruturados de cada conversa → grava em `leads.custom_fields` (jsonb) → o `field-rules-tick` lê esses campos e move o card. Se os nomes/tipos divergem em qualquer ponto da cadeia, leads ficam parados.

Histórico real do problema: leads da Clínica ÓR ficavam presos em "Qualificação" porque o extractor escrevia `data_horario`, mas as field-rules procuravam `consulta_agendada_em`. Documento esse contrato evita repetir.

## 2. Catálogo canônico

> Campos vivem dentro de `leads.custom_fields` (jsonb). Nunca em colunas nativas.

### 2.1 Qualificação

| Campo | Tipo | Enum / formato | Quem escreve | Quem lê |
|---|---|---|---|---|
| `qualificacao` | enum string | `interessado` · `em_negociacao` · `desqualificado` · `sumiu` | extractor-tick | field-rules-tick, AIBadges |
| `motivo_desqualificacao` | string curta | livre (≤140 chars) | extractor-tick | humano (Kanban) |
| `demonstrou_interesse` | bool | — | extractor-tick | AIBadges |
| `interesse` | string | descrição livre do que o lead quer | extractor-tick | UI Lead Drawer |

### 2.2 Procedimento e atendimento

| Campo | Tipo | Enum / formato | Quem escreve | Quem lê |
|---|---|---|---|---|
| `tipo_atendimento` | enum string | `primeira_consulta` · `consulta_psiquiatria` · `seguimento` · `retorno` · `sessao_cetamina` · `sessao_emt` · `terapia` | extractor-tick | field-rules-tick |
| `procedimento_interesse` | enum string | mesmas opções de `tipo_atendimento` | extractor-tick | AIBadges |
| `procedimentos` | string[] | lista descritiva (compat legado) | extractor-tick | UI Lead Drawer |
| `profissional_preferencia` | string | "Dr. Ivan", "Dra. Maísa" etc. | extractor-tick | UI |
| `teleconsulta` | bool | — | extractor-tick | field-rules-tick |
| `tipo_atendimento_local` | enum | `presencial` · `online` · `indefinido` | extractor-tick | UI |

### 2.3 Agendamento

| Campo | Tipo | Enum / formato | Quem escreve | Quem lê |
|---|---|---|---|---|
| `consulta_agendada_em` | timestamptz | ISO `YYYY-MM-DDTHH:mm:ss-03:00` (sempre TZ explícito) | extractor-tick | field-rules-tick, AIBadges |
| `procedimento_agendado_em` | timestamptz | idem | extractor-tick | field-rules-tick |
| `status_consulta` | enum string | `agendada` · `confirmada` · `realizada` · `reagendada` · `no_show` · `cancelada` | extractor-tick | field-rules-tick |
| `tentou_agendar` | bool | — | extractor-tick | field-rules-tick |
| `acompanhante_confirmado` | bool | — | extractor-tick (Cetamina) | humano |

> ⚠️ **Não usar** `data_horario`, `enviar_dia`, `data_agendamento`. Foram aliases legados — proibidos no contrato atual. Se aparecem em leads antigos, o extractor migra para `consulta_agendada_em` no próximo ciclo.

### 2.4 Pagamento e reembolso

| Campo | Tipo | Enum / formato | Quem escreve | Quem lê |
|---|---|---|---|---|
| `tentou_pagamento` | bool | — | extractor-tick, vision-tick | field-rules-tick |
| `pagamento_confirmado` | bool | — | vision-tick (comprovante legível) | field-rules-tick |
| `ultimo_comprovante` | jsonb | `{ method, amount_brl, paid_at, transaction_id, message_id }` | vision-tick | UI |
| `status_nf_reembolso` | enum string | `pendente` · `enviada` · `nao_aplica` | extractor-tick | humano (financeiro) |
| `saldo_sessoes_pacote` | int | nº inteiro restante | extractor-tick | humano |

### 2.5 Triagem / segmentação

| Campo | Tipo | Enum / formato | Quem escreve | Quem lê |
|---|---|---|---|---|
| `is_b2b` | bool | — | `trg_lead_needs_extraction` (regex) + extractor-tick (confirmação) | field-rules-tick |
| `possui_liminar_judicial` | bool | — | extractor-tick | field-rules-tick (rota jurídico) |
| `origem` | string | "Indicação", "Google - Orgânico", "Site CTA"… | extractor-tick | métricas |
| `nome_preferido` | string | nome curto preferido pelo paciente | extractor-tick | composer/atendimento |

## 3. Regras de normalização

1. **Timezone**: tudo em `America/Sao_Paulo` (`-03:00`). Nunca `Z`/UTC. Nunca data sem hora.
2. **Hoje vs ontem**: o system prompt do extractor injeta `Hoje é {now()}`. Datas relativas ("sexta", "amanhã") devem ser resolvidas para o **futuro mais próximo a partir de hoje**, nunca para anos passados (bug histórico: extractor escrevia `2024-07-10` para uma conversa de junho/26).
3. **Enums**: o extractor recebe os valores válidos via tool schema (`extract_lead_fields.parameters`). Valor fora do enum é **rejeitado** e a run vira `kind=text, error=invalid_enum` em `lead_ai_extraction_runs`.
4. **Booleanos**: nunca `"true"`/`"false"` (string). Sempre `true`/`false` (jsonb bool).
5. **Idempotência**: o extractor só **acrescenta** campos. Não apaga. Para apagar, humano edita via Lead Drawer (que seta `manual_lock_until = now() + N min`).
6. **Sobrescrita**: só ocorre se `confidence ≥ classifier_config.confidence_threshold` E `clinics.classifier_config.allow_overwrite_filled = true`.

## 4. Como adicionar um campo novo

Checklist obrigatório — pular um passo é como não fazer:

1. **Documente aqui primeiro.** Adicione a linha na tabela §2 com tipo, enum, quem escreve, quem lê.
2. **Schema do extractor.** Em `supabase/functions/extractor-tick/index.ts`, adicione ao JSON Schema da tool `extract_lead_fields` (com `enum` quando aplicável).
3. **System prompt do extractor.** Adicione 1 frase descrevendo quando preencher o campo (com exemplo PT-BR).
4. **Field-rule (se for usado para mover).** Crie linha em `pipeline_field_rules` com a condição.
5. **AIBadges (opcional).** Em `src/components/kanban/AIBadges.tsx`, adicione chip se for útil ver no card.
6. **Smoke test.** Mande uma mensagem de teste com o gatilho do campo, espere 2 min, confirme em `leads.custom_fields`.
7. **Roda `docs-sync`**: `node scripts/docs-sync.mjs`.

## 5. Como descobrir o que cada campo significa hoje

```bash
# distribuição de valores reais para um campo
psql -c "SELECT custom_fields->>'qualificacao' AS v, count(*) FROM leads GROUP BY 1 ORDER BY 2 DESC LIMIT 20;"

# leads cujo campo X está preenchido mas Y não
psql -c "SELECT id, name, custom_fields FROM leads WHERE custom_fields ? 'consulta_agendada_em' AND NOT custom_fields ? 'status_consulta' LIMIT 10;"
```

## 6. Invariantes — "não toque sem ler"

1. **Nome dos campos é case-sensitive e snake_case.** `Qualificacao` ≠ `qualificacao`.
2. **Enum nunca evolui sem migration de dados.** Antes de remover um valor, rodar `UPDATE leads SET custom_fields = jsonb_set(...)` para normalizar leads antigos.
3. **Apenas extractor e vision escrevem.** Frontend NÃO escreve aqui — escreve em colunas nativas ou em campos definidos em `lead_custom_fields` (outra tabela, com schema próprio para o usuário).
4. **Field-rules é stateless.** Não armazena nada. Se uma regra deixa de casar, o card volta atrás na próxima varredura (a menos que `manual_lock_until` esteja ativo).
5. **`status_consulta=realizada` é terminal** — `consulta_agendada_em` no passado + `status_consulta` ainda `agendada` é bug do extractor, não estado válido.

## 7. Pegadinhas

- LLM gosta de inventar campo novo ("urgencia_nivel"). O JSON Schema com `additionalProperties: false` corta isso. Mantenha.
- `custom_fields ? 'campo'` (existência) ≠ `custom_fields->>'campo' IS NOT NULL` (existência + valor não-nulo). Em SQL, use o segundo em filtros de field-rules.
- Campo `interesse` (string livre) e `procedimento_interesse` (enum) coexistem por compatibilidade. Quem decide stage é o segundo.
- `procedimentos` (array) é legado das primeiras versões; só leitura, não use em nova field-rule.

## 8. Receitas

### Sanity-check de um lead específico
```bash
psql -c "SELECT name, stage_changed_at, custom_fields FROM leads WHERE id = '<uuid>';"
```

### Listar leads "presos" (campo de data preenchido mas stage parou em Qualificação)
```bash
psql -c "
  SELECT l.id, l.name, l.custom_fields->>'consulta_agendada_em' AS quando, ps.name AS coluna
  FROM leads l JOIN pipeline_stages ps ON ps.id = l.stage_id
  WHERE l.custom_fields ? 'consulta_agendada_em'
    AND ps.name = 'Qualificação'
  ORDER BY l.stage_changed_at DESC LIMIT 20;"
```

### Conferir se uma field-rule "casa" com um lead
Operadores reais suportados em `supabase/functions/field-rules-tick/index.ts`:
`equals`, `not_equals`, `is_true`, `is_false`, `is_empty`, `not_empty`, `in`, `contains`, `gte`, `lte`, `is_future`, `is_past`.

Condições são AND. Primeira regra (ordenada por `priority DESC`) que casar vence — o resto é ignorado naquela varredura.
