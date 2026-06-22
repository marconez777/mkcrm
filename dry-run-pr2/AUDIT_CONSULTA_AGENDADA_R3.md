# Auditoria R3 — Coluna "Consulta agendada" (Clínica ÓR)

**Data:** 22/jun/2026  
**Stage:** `e12f004a-6445-4815-8d6b-22f928507a9a` (Consulta agendada, pipeline `17c27f4d…`)  
**Total leads ativos:** 16  
**Critério de relógio:** `last_inbound_at` (PR5 já aplicado)

> Hoje = **2026-06-22**. Todos os horários convertidos para São Paulo.

---

## Tabela A — Campos personalizados

Campos esperados nessa coluna: `procedimento_agendado_em`, `interesse_consulta`, `interesse_tratamento`, `teleconsulta`, `procedimentos`, `pagamento`/`status_financeiro`, `origem`.

| Lead | Faltando | Causa provável |
|---|---|---|
| **William Miguel** | `procedimento_agendado_em`, `procedimentos`, `teleconsulta`, `origem`, `pagamento` | Classifier nunca rodou (`pipeline_run_items` = `<nil>`). Move veio só do "general move" (intent=`agendamento_retorno`). Falta tick do classifier nesse lead. |
| **Ronaldo Saraiva** | `procedimento_agendado_em`, `teleconsulta`, `pagamento`, `origem` | Idem — sem run do classifier. Tag `modalidade_online` veio do classifier-general apenas. |
| **Milene Picasso** | `procedimento_agendado_em` (só tem `data_horario` de 05/jun, passou) | Sem run do classifier; date-parser não pegou a nova data (lead "aguarda horários"). |
| **Laura** | `pagamento`, `origem` | Sem run do classifier; reagendamento confirmado mas typifier não preencheu finanças. |
| **Rosangela** | `pagamento`, `status_financeiro` | Cliente em negociação financeira pesada (5k); typifier não consegue ainda decidir status. OK por enquanto. |
| **Vitor** | `interesse_consulta`, `origem` | Consulta de seguimento já realizada (18/jun) — provavelmente já deveria ter saído da coluna (ver Tabela C). |
| **Camila Stanjek** | `procedimentos`, `teleconsulta`, `origem`, `pagamento` | Run OK em 19/jun; typifier não preencheu pq mensagem foi curta. |
| **Paula, Marlene, Mateo, Renata, Rodrigo, Laís, Yochi, Thalita, William De Lima** | OK — todos com `procedimento_agendado_em` + `procedimentos` + `teleconsulta`. | — |

**Padrão:** os 4 leads sem qualquer run de classifier (`William Miguel`, `Ronaldo`, `Milene`, `Laura`) estão com campos incompletos. Foram movidos para cá por **classifier-general** (índice próprio) sem passar pelo agente Preenchedor. Investigar por que `pipeline_run_items` está vazio para eles — provável que `pipeline-classify` não esteja enfileirando esses threads (são mais recentes que o último tick principal).

---

## Tabela B — Chips/tags

| Lead | Tag atual | Problema | Esperado |
|---|---|---|---|
| **Thalita Oliveira** | `agendamento_confirmado` | `status_consulta=realizada` + pediu receita de clonazepam **durante a sessão**. Já é renovação de receita pós-consulta. | Mover p/ **Paciente antigo** (regra nova do classifier — ver §4). Remover `agendamento_confirmado`. |
| **Rosangela** | `reagendamento_pendente` | Correta — pediu troca cetamina→EMT. | Manter. |
| **William Miguel** | `agendamento_confirmado`, `pagamento_pendente` | Sem `procedimento_agendado_em` mas tem `agendamento_confirmado`. Inconsistente. | Ou completa o campo, ou remove o chip. Reenfileirar classifier. |
| **William De Lima** | 7 tags incluindo `1ª_consulta`, `renovacao_receita`, `prefere_quintas_sabados`, `cpf_enviado`, `a_caminho` | Tags de Qualificação que deveriam ter sido limpas após `agendamento_confirmado`. `renovacao_receita` num lead de 1ª consulta é contraditório. | Limpar tags de fase anterior. PR5b do `apply.ts` não-destrutivo resolveria; por enquanto manual. |
| **Vitor** | sem tags | Consulta realizada em 18/jun, sem `agendamento_confirmado`, sem `consulta_realizada`. | Adicionar `consulta_realizada` e mover (Tabela C). |
| **Ronaldo Saraiva** | `modalidade_online`, `agendamento_confirmado` | Sem `procedimento_agendado_em` mas marcado confirmado. | Reenfileirar classifier. |
| **Yochi, Camila, Mateo, Renata, Paula, Marlene, Laís, Rodrigo, Milene, Laura, William Miguel** | — | Nenhum chip terminal antigo encontrado. | OK. |

**Achados gerais:**
- **Nenhum lead com `no_show`, `pagamento_alegado` ou outro chip terminal incompatível** — bom sinal.
- **William De Lima** é o caso mais crítico de "lixo de Qualificação" preservado no stage atual.

---

## Tabela C — Movimentos esperados que não aconteceram

| Lead | `procedimento_agendado_em` | Stage destino | Motivo | Por que não aconteceu |
|---|---|---|---|---|
| **Vitor** | 18/jun 12:00 (passou 4d) | **Consulta finalizada** | Consulta de seguimento realizada, lead pediu nova via de receita = pós-consulta. | **Não existe regra determinística** "data passou + sem no-show → Consulta finalizada". Classifier não tem trigger por tempo. |
| **William De Lima** | 18/jun 13:00 (passou 4d) | **Consulta finalizada** | 1ª consulta presencial já era. | Idem. |
| **Camila Stanjek** | 22/jun 10:00 (passou hoje) | **Consulta finalizada** *(depois das ~11h)* | Consulta hoje pela manhã. | Idem — nenhum tick re-classifica após o horário passar. |
| **Paula Quartim** | 17/jun 20:30 (passou 5d) | **Consulta finalizada** | Consulta + pediu NF da última = realizada. | Idem. |
| **Rodrigo Wainberg** | 18/jun 14:00 (passou 4d) | **Consulta finalizada** ou **Paciente antigo** | Pediu relatório das 11 consultas do 1º ciclo — claramente paciente antigo em seguimento. | Idem. |
| **Thalita Oliveira** | `status_consulta=realizada` (21/mai) | **Paciente antigo** | Pediu receita durante a sessão — ciclo realizado, renovação. Classifier moveu p/ Consulta agendada com intent `agendamento_retorno` — falso positivo. | Regra nova "renovação + tratado antes → Paciente antigo" foi adicionada ao prompt no PR5, mas Thalita já estava aqui. Precisa reenfileirar. |
| **Milene Picasso** | nenhum válido (só `data_horario`=05/jun, passou) | **Qualificação** | Lead "aguarda horários" — não há agendamento confirmado. Classifier-general moveu por intent=`reagendamento` (conf=0.96) mas faltou validar a presença de data futura. | **Bug do classifier-general**: move com base em intent sem checar se há `procedimento_agendado_em` futuro. |
| **Laura** | 16/jun (passou 6d) | **Consulta finalizada** ou **Tratamento agendado** | Infusão de cetamina; `reagendamento_confirmado=true` mas data registrada está no passado. Falta nova data. | Idem Milene. |
| **William Miguel** | sem data | **Qualificação** | "Continuidade de tratamento" + `pagamento_pendente`, sem data confirmada. | Move por intent `agendamento_retorno` sem validar data. |
| **Ronaldo Saraiva** | sem data | **Qualificação** | Tag `agendamento_confirmado` mas sem data. Provavelmente classifier confiou no texto sem confirmação dura. | Idem. |
| **Mateo Murillo** | 13/jul | OK — fica | Data futura confirmada. | — |
| **Renata Honorato** | 01/jul | OK | — | — |
| **Marlene Giglioli** | 30/jun | OK | — | — |
| **Laís Carrara** | 14/jul | OK | — | — |
| **Yochi Moritz** | 22/jun 17:30 | OK (consulta hoje à tarde) | — | — |
| **Rosangela** | 23/jun | Em reagendamento ativo. Manter como está com chip `reagendamento_pendente`. | — | — |

---

## Achados estruturais

1. **Falta regra determinística "consulta_passou → Consulta finalizada"** (`pipeline-deterministic`).  
   Critério proposto: `procedimento_agendado_em < now() - 2h` AND sem chip `no_show`/`reagendamento_pendente` AND `is_internal_contact=false` → mover para `Consulta finalizada` e adicionar chip `consulta_realizada`. Idempotência por `procedimento_agendado_em` + dia.

2. **Classifier-general move sem validar data futura.**  
   Hoje move para "Consulta agendada" apenas por `intent ∈ {agendamento, reagendamento, agendamento_retorno}` + confiança alta. Casos Milene, Laura, William Miguel, Ronaldo mostram que isso gera falsos positivos. **Guard sugerido:** só mover se `custom_fields.procedimento_agendado_em` existir e for futuro, OU intent for `reagendamento` com chip `reagendamento_pendente` + flag de aprovação de stakeholder.

3. **Tags de Qualificação não são limpas no move** (William De Lima). Já mapeado no PR5b (apply não-destrutivo → na verdade, o oposto: hoje o apply é destrutivo em custom_fields, mas conserva tags antigas). Vale um PR à parte para limpar tags incompatíveis com o novo stage.

4. **Leads movidos por classifier-general (`pipeline_run_items`=null)** não passam pelo Preenchedor — explica todos os custom_fields incompletos da Tabela A.

---

## Ações propostas (a aprovar)

**(a) PR6 — Regra determinística "consulta passou → Consulta finalizada"**  
`supabase/functions/pipeline-deterministic/index.ts`: nova função `ruleConsultaPassou()` que varre stage "Consulta agendada", aplica o critério acima, move e adiciona chip `consulta_realizada`. Toggle: `automation.consulta_passou_finaliza.enabled`.

**(b) PR7 — Guard no classifier-general para `agendamento`/`reagendamento`**  
Antes de aceitar move para "Consulta agendada", validar `procedimento_agendado_em` futuro. Se ausente, manter em Qualificação e adicionar chip `agendamento_pendente_data`.

**(c) Moves manuais imediatos**

| Lead | Ação |
|---|---|
| Vitor, William De Lima, Paula Quartim | Mover p/ **Consulta finalizada** |
| Rodrigo Wainberg | Mover p/ **Paciente antigo** |
| Thalita Oliveira | Mover p/ **Paciente antigo** + reenfileirar |
| Milene Picasso, Laura, William Miguel, Ronaldo Saraiva | Mover de volta p/ **Qualificação** + `needs_ai_review=true` |
| William De Lima (antes do move) | Limpar tags antigas (`1ª_consulta`, `renovacao_receita`, `prefere_quintas_sabados`, `cpf_enviado`, `a_caminho`) — se for movido p/ finalizada, menos crítico |
| Camila Stanjek | Esperar passar das 11h hoje (consulta agora) e então mover p/ finalizada — ou deixar p/ PR6 |

**(d) Reenfileirar no classifier (sem mover):** William Miguel, Ronaldo, Milene, Laura para o Preenchedor completar custom_fields antes de qualquer move.

---

## Me diz por onde seguir

1. PR6 (determinístico) — abre PR já?
2. PR7 (guard classifier-general) — abre PR já?
3. Aplicar moves manuais do bloco (c)?
4. Só reenfileirar (d) e esperar 1 ciclo antes de mover?
