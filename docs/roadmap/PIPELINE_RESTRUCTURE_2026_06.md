---
title: "Reestruturação do Pipeline Clínica ÓR (2026-06)"
topic: roadmap
kind: roadmap
audience: agent
updated: 2026-06-17
status: planejado
summary: "Fonte única de verdade da reestruturação do pipeline da Clínica ÓR: 15 colunas → 9 colunas, novos custom_fields, novas field-rules, tabela appointments, e estratégia pipeline-sombra para fazer tudo sem interromper a operação. Sucede CLINIC_PIPELINE.md."
code_refs:
  - supabase/functions/extractor-tick/
  - supabase/functions/field-rules-tick/
  - src/components/kanban/
  - src/components/settings/FieldRulesCard.tsx
  - src/components/settings/ExtractorHistoryCard.tsx
related_docs:
  - docs/roadmap/CLINIC_PIPELINE.md
  - docs/maps/AI_RUNTIME.md
  - docs/maps/CUSTOM_FIELDS_CONTRACT.md
  - docs/flows/PIPELINE_DERIVED.md
  - docs/estudo/README.md
  - docs/estudo-geral.md
  - docs/support/journeys/usar-pipeline-ia.md
---

# Reestruturação do Pipeline Clínica ÓR — 2026-06

> Documento vivo. Atualizar a seção §11 "Diário de execução" a cada fase concluída. Quando todas as fases estiverem entregues, mover para `docs/roadmap/_done/` e atualizar `docs/flows/PIPELINE_DERIVED.md` com o estado final.

---

## 1. Contexto e objetivo

A Clínica ÓR opera hoje com **1 pipeline ativo, 15 colunas e 1.625 leads**. O estudo em `docs/estudo/` (103 leads analisados, 306 áudios transcritos, 14 cenários mapeados) identificou problemas estruturais:

- **Coluna "Administrativo" (265 leads) mistura B2B real com pacientes** — distorce métricas e atrapalha o time comercial.
- **Não há coluna para "Fora de escopo"** (AVC, internação, fora de SP) — esses leads ficam parados em qualificação.
- **Risco clínico (ideação suicida, crise aguda) não tem sinalização** no card — risco operacional sério.
- **"Em tratamento" mistura primeira consulta agendada com pacientes em pacote ativo de EMT/Cetamina** — impossível medir aderência ao protocolo.
- **Cenários `admin_parceria` e `fora_escopo_clinica` aparecem no estudo mas não disparam regra automática** — só caem em "Desqualificado" se o extractor manualmente setar `qualificacao=desqualificado`.
- **Campos sugeridos pelo estudo não existem**: `saldo_sessoes_pacote`, `possui_liminar_judicial`, `status_nf_reembolso`, `nome_responsavel_financeiro`.

**Objetivo:** reduzir de 15 para 9 colunas com semântica única e não-ambígua, criar campos novos para suportar regras automáticas, e reposicionar todos os 1.625 leads sem perda histórica nem interrupção da operação.

---

## 2. Decisões aprovadas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | **Orçamento de IA: até US$ 3** para reclassificação em lote | Permite rodar `extractor-tick` sobre os ~1.300 leads não-óbvios e extrair campos novos. Estimativa real: ~US$ 2 com gpt-5-nano. |
| 2 | **Administrativo = 100% B2B/Stakeholders** | Auditoria confirmou que não há paciente lá. Vira `is_b2b=true` e migra direto. Exceção manual: fornecedor identificado pelo time. |
| 3 | **"Fechamento pendente consulta/procedimento" → Qualificação** | É o estado real: lead qualificado que ainda não confirmou. Não é "em tratamento". |
| 4 | **"Em tratamento" exige `sessao_total` preenchido (pacote)** | Sem pacote, lead vai para **Paciente antigo** (estado seguro, não atrapalha métricas de aderência). |
| 5 | **Estratégia pipeline-sombra** dentro da própria Clínica ÓR | Permite testar e validar lado a lado, sem risco para a operação. Detalhes na §6. |

---

## 3. Mapeamento de colunas (atual → novo)

> Contagens snapshot 2026-06-17. Atualizar antes do cutover.

| # | Coluna atual | Leads | Coluna nova | Observação |
|---|---|---:|---|---|
| 1 | Leads de entrada | ? | **Leads de entrada** | Sem mudança semântica. |
| 2 | Paciente antigo | ? | **Paciente antigo** | Sem mudança. |
| 3 | Qualificação | ? | **Qualificação** | Recebe também "Fechamento pendente". |
| 4 | Consulta agendada | ? | **Consulta agendada** | Backfill cria `appointment` se `consulta_agendada_em` é futuro. |
| 5 | Fechamento pendente consulta | ? | **Qualificação** | Decisão #3. |
| 6 | Fechamento pendente procedimento | 26 | **Qualificação** | Decisão #3. |
| 7 | Procedimento agendado | ? | **Procedimento agendado** | Sem mudança. |
| 8 | Procedimento pago | ? | **Procedimento pago** | Sem mudança. |
| 9 | Em tratamento | ? | **Em tratamento** ou **Paciente antigo** | Decisão #4 — só fica em tratamento se `sessao_total` preenchido. |
| 10 | Lead parou de responder | ? | **Sem resposta** | Renomeada. |
| 11 | Lead não qualificado | ? | **Desqualificado / Fora de escopo** | Splitting por motivo (B2B, fora de SP, internação, sem perfil). |
| 12 | Retorno tratamento finalizado | ? | **Paciente antigo** | Consolidação. |
| 13 | Antigo consulta/procedimento agendado | ? | **Consulta agendada** ou **Procedimento agendado** | Pelo campo correspondente. |
| 14 | Nutrição de leads inativos | ? | **Nutrição inativa** | Sem mudança. |
| 15 | Administrativo | 265 | **B2B / Stakeholders** | Decisão #2. |

**Stages novos (9 colunas finais):**

```text
0. Leads de entrada
1. Qualificação
2. Consulta agendada
3. Procedimento agendado
4. Procedimento pago
5. Em tratamento
6. Paciente antigo
7. Sem resposta
8. Nutrição inativa
9. B2B / Stakeholders        ← coluna lateral, não conta em funil
10. Desqualificado / Fora de escopo  ← coluna lateral
```

(O Kanban deve marcar 9 e 10 como `is_archive=true` para não entrar em métricas de conversão.)

---

## 4. Novos custom_fields contratados

Adicionar ao schema do `extractor-tick` e ao `docs/maps/CUSTOM_FIELDS_CONTRACT.md`.

| Campo | Tipo | Enum / Formato | Escrito por | Lido por |
|---|---|---|---|---|
| `interesse_inicial` | enum | `psiquiatria`, `psicologia`, `emt`, `cetamina`, `avaliacao`, `indefinido` | extractor | field-rules, UI |
| `servicos_ativos` | text[] | subset de `[emt, cetamina, psiquiatria, psicologia]` | extractor | field-rules |
| `tipo_contato` | enum | `paciente`, `terceiro_familiar`, `b2b`, `fornecedor`, `imprensa`, `outro` | extractor | field-rules |
| `contato_eh_terceiro` | bool | — | extractor | UI (alerta no card) |
| `responsavel` | text | nome do responsável quando `contato_eh_terceiro=true` | extractor | UI |
| `risco_clinico` | bool | — | extractor + trigger SQL (regex) | handler (trava IA + tarefa) |
| `is_b2b` | bool | — | extractor + trigger SQL (regex) | field-rules |
| `saldo_sessoes_pacote` | int | 0–20 | extractor (visão de comprovantes) | UI |
| `status_nf_reembolso` | enum | `pendente`, `enviada`, `nao_aplica` | extractor + humano | UI |
| `resumo_proxima_acao` | text | gerado a partir de outros campos | trigger | UI no card |
| `resumo_ultima_movimentacao` | text | gerado | trigger | UI no card |

Campos já existentes preservados: `qualificacao`, `tipo_atendimento`, `consulta_agendada_em`, `procedimento_agendado_em`, `pagamento_confirmado`, `tentou_agendar`, `tentou_pagamento`, `status_consulta`, `sessao_emt`, `sessao_cetamina`, `sessao_total`.

---

## 5. Novas field-rules e automações

### 5.1 Field-rules (avaliadas por `priority DESC`)

| Prio | Nome | Condição | Stage destino |
|---:|---|---|---|
| 250 | Risco clínico → trava | `risco_clinico = true` | (não move; dispara handler) |
| 200 | B2B / Fornecedor | `is_b2b = true OR tipo_contato in (b2b, fornecedor, imprensa)` | B2B / Stakeholders |
| 180 | Fora de escopo | `tipo_contato = paciente AND qualificacao = desqualificado` AND motivo ∈ (fora_sp, internacao, avc_agudo) | Desqualificado / Fora de escopo |
| 170 | Procedimento pago | `pagamento_confirmado = true AND (sessao_emt OR sessao_cetamina)` | Procedimento pago |
| 160 | Procedimento agendado | `procedimento_agendado_em is_future` | Procedimento agendado |
| 150 | Em tratamento (pacote ativo) | `sessao_total > 0 AND saldo_sessoes_pacote > 0` | Em tratamento |
| 130 | Consulta agendada | `consulta_agendada_em is_future` | Consulta agendada |
| 100 | Qualificação | `qualificacao in (interessado, em_negociacao) OR tentou_agendar OR tentou_pagamento` | Qualificação |
| 80 | Paciente antigo | `sessao_total > 0 AND saldo_sessoes_pacote = 0` | Paciente antigo |

### 5.2 Automações temporais (`automations`)

| Trigger | Janela | Ação |
|---|---|---|
| `no_reply_after` em Qualificação | 48 h | mover para "Sem resposta" + enrol em sequência |
| `no_reply_after` em Consulta agendada (sem confirmação) | 24 h antes | enviar lembrete |
| `stage_idle` em "Sem resposta" | 7 d | mover para "Nutrição inativa" |
| `stage_idle` em "Nutrição inativa" | 30 d | tarefa de revisão para humano |
| Risco clínico detectado | imediato | `ai_paused=true`, `manual_lock_until=+7d`, tag `risco_clinico`, INSERT em `lead_tasks` |

> Verificar na Fase 0 se a engine de `automations` suporta `trigger_type='no_reply_after'` e `'stage_idle'`. Se não suportar, esses ficam em backlog separado — não bloqueiam o cutover.

---

## 6. Estratégia pipeline-sombra

**Princípio:** criar um pipeline novo paralelo dentro da própria Clínica ÓR e duplicar cada lead como "shadow" apontando para o original. Time continua trabalhando no antigo; nós validamos o novo. No cutover, o `stage_id`/`pipeline_id` do lead original é atualizado em UMA transação atômica e os shadows são deletados.

```text
Hoje:                          Durante teste (1-2 semanas):       Após cutover:

[Pipeline ÓR atual]    →       [Pipeline ÓR atual] ← time usa    [ARQUIVADO ÓR antigo]
                               [Pipeline ÓR novo]  ← agente IA   [Pipeline ÓR]  ← time usa
                                  (cópia dos leads)                  (renomeado, ex-novo)
```

**Como funciona:**

1. Migration cria pipeline novo + 11 stages + field-rules + tabela `appointments` + coluna `leads.shadow_of_lead_id uuid references leads(id) on delete cascade`.
2. Edge function `pipeline-shadow-build` itera os 1.625 leads e cria 1 shadow por lead (mesmo `clinic_id` e `phone`, novo `id`, `shadow_of_lead_id = original.id`, `pipeline_id = novo`).
3. Para shadows não-óbvios (não B2B, não nutrição), chama extractor sobre o histórico do lead original e preenche `custom_fields`. Depois roda field-rules.
4. Mensagens, tarefas e notas **permanecem só no lead original** — não duplicamos. Para inspeção lado a lado, a UI matcheia via `phone`.
5. Você aprova → cutover em 1 migration:

```sql
BEGIN;
UPDATE leads o
   SET stage_id    = s.stage_id,
       pipeline_id = s.pipeline_id,
       custom_fields = o.custom_fields || s.custom_fields
  FROM leads s
 WHERE s.shadow_of_lead_id = o.id;
UPDATE appointments a
   SET lead_id = s.shadow_of_lead_id
  FROM leads s
 WHERE s.id = a.lead_id AND s.shadow_of_lead_id IS NOT NULL;
DELETE FROM leads WHERE shadow_of_lead_id IS NOT NULL;
UPDATE pipelines SET name='[ARQUIVADO] '||name, is_default=false WHERE id = :antigo;
UPDATE pipelines SET name='Clínica ÓR', is_default=true     WHERE id = :novo;
COMMIT;
```

`lead_stage_history` recebe `reason='pipeline_restructure_2026_06'` em todas as transições.

**Por que é seguro:**

- O time não percebe a operação durante o teste (continua no pipeline antigo).
- Rollback = `DROP pipeline novo CASCADE` → some tudo, original intacto.
- Cutover dura segundos (UPDATE em ~1.625 linhas).
- `lead_stage_history` permite auditoria reversa.

**Cuidados:**

- Queries de produção precisam filtrar `WHERE shadow_of_lead_id IS NULL` durante a janela de teste. Hooks afetados: `useCrm`, `useLeadsPaginated`, métricas. Verificar na Fase 0.
- Risco clínico no shadow **não dispara handler durante o teste** — só lista para revisão. Handler ativa após cutover.

---

## 7. Plano de execução (8 fases)

| Fase | Entrega | Critério de aceite | Risco principal |
|---|---|---|---|
| **F0** | Relatório de verificação: padrão de RLS, contagens exatas por coluna atual, suporte da engine a triggers novos, lista de queries que precisam de filtro `shadow_of_lead_id IS NULL` | Sem migrations. Apenas texto + queries de leitura. | Engine não suportar trigger novo |
| **F1** | Migration: `appointments` + RLS + GRANTs + trigger; `leads.shadow_of_lead_id`; pipeline novo + 11 stages; 9 field-rules; trigger `trg_lead_risk_handler` | Pipeline novo aparece no switcher mas vazio | Erro de RLS em `appointments` |
| **F2** | Edits no `extractor-tick` (schema novo), `FIELD_LABELS` em `ExtractorHistoryCard.tsx`, `CUSTOM_FIELDS_CONTRACT.md`, regex de B2B/risco em `trg_lead_needs_extraction`, prompt com `Hoje é {now -03:00}` | Extractor preenche campos novos em lead-teste | Prompt mal calibrado |
| **F3** | Edge function `pipeline-shadow-build` + execução do lote completo | 1.625 shadows criados, custos < US$ 2.80, todos com stage atribuído | Custo estourar / extractor errar muito |
| **F4** | Avaliação humana lado a lado, ajuste de field-rules se preciso, lista de risco clínico revisada com equipe clínica | Você aprova explicitamente | Reclassificação ruim → rebuild shadows |
| **F5** | Migration de cutover atômico | UPDATE em ~1.625 linhas, 0 shadows restantes, pipeline novo é default | Cutover em horário de baixa atividade |
| **F6** | Limpeza: DROP pipeline antigo + stages + field-rules antigas, DROP `shadow_of_lead_id`, ativar handler de risco | DRIFT.md limpo | — |
| **F7** | Atualizar `KANBAN_LEADS.md`, `PIPELINE_DERIVED.md`, `usar-pipeline-ia.md`, `criar-field-rule.md`, marcar `CLINIC_PIPELINE.md` como sucedido. `node scripts/docs-sync.mjs`. Mover este doc para `_done/` | INDEX.json regenerado | — |

---

## 8. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Custo de IA estourar US$ 3 | Média | Halt automático em US$ 2.80 dentro da edge function; progresso a cada 100 leads |
| Shadows aparecerem em métricas durante teste | Alta | Filtro `shadow_of_lead_id IS NULL` em todas queries de produção (F0 mapeia, F1 aplica) |
| Risco clínico sinalizado por engano (regex frouxa) | Média | Handler só dispara após cutover; durante teste é só lista de revisão |
| Cutover deletar shadow enquanto alguém edita | Baixa | Cutover em horário combinado; banner "manutenção 1 min" na UI |
| Engine `automations` não suportar triggers novos | Média | Pipeline novo funciona sem as automações temporais; vão para backlog |
| 265 leads "Administrativo" terem paciente real escondido | Baixa | Antes da F3, extractor revalida `tipo_contato` por mensagem; quem não casar B2B vira lead normal |
| VIP repositionado errado | Baixa | F4 lista top-50 leads por valor para revisão manual |

---

## 9. Custo de IA estimado

| Etapa | Volume | Modelo | Custo unitário | Total |
|---|---:|---|---:|---:|
| Extractor sobre shadows não-óbvios | ~1.300 leads × 3k tokens | gpt-5-nano | ~$0.0015/lead | **~US$ 2,00** |
| Margem para reprocessamento | — | — | — | ~US$ 0,50 |
| **Total estimado** | | | | **~US$ 2,50** |

**Limite hard:** US$ 2,80. Halt automático na edge function.

---

## 10. Checklist de cutover (dia D)

- [ ] Time avisado 24 h antes
- [ ] Backup do estado atual (snapshot `leads` + `pipelines` + `pipeline_stages` + `pipeline_field_rules`)
- [ ] Janela de baixa atividade confirmada (consultar `messages` por hora)
- [ ] Banner na UI: "Atualização de pipeline em andamento — 1 min"
- [ ] Executar migration de cutover
- [ ] Validar: `SELECT count(*) FROM leads WHERE shadow_of_lead_id IS NOT NULL` = 0
- [ ] Validar: contagem por stage no novo bate com a esperada
- [ ] Validar: 5 leads-chave (VIP, B2B real, risco clínico, em tratamento, sem resposta) estão no lugar certo
- [ ] Ativar handler de risco clínico
- [ ] Remover banner
- [ ] Comunicar time: "pipeline novo no ar, qualquer estranheza me chamem"
- [ ] Monitorar por 48 h

---

## 11. Diário de execução

> Anotar aqui cada fase concluída com data, link do PR/migration, e observações.

| Data | Fase | Status | PR / Migration | Observação |
|---|---|---|---|---|
| 2026-06-17 | — | Documento criado | — | Plano aprovado pelo usuário. Aguardando início da F0. |

---

## 12. Critérios de "entregue"

- [ ] 0 leads no pipeline antigo (`SELECT count(*) FROM leads WHERE pipeline_id = :antigo` = 0)
- [ ] Pipeline antigo deletado
- [ ] Coluna `shadow_of_lead_id` deletada
- [ ] `docs/flows/PIPELINE_DERIVED.md` atualizado com o novo modelo
- [ ] `docs/maps/CUSTOM_FIELDS_CONTRACT.md` atualizado com campos novos
- [ ] `docs/roadmap/CLINIC_PIPELINE.md` marcado como sucedido por este
- [ ] `DRIFT.md` limpo
- [ ] Este arquivo movido para `docs/roadmap/_done/PIPELINE_RESTRUCTURE_2026_06.md`
