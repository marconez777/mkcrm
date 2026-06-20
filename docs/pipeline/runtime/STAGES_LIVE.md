---
title: "Stages do pipeline e Intents (Estado Real V6)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "11 colunas reais do pipeline com ID, ordem, flags e mapeamento canônico para o classifier V6. Inclui a lista oficial de Intents suportados pela arquitetura."
code_refs:
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/CLASSIFIER.md
---

# Stages e Intents (V6)

A arquitetura de 5 Agentes (V6) separa estritamente o "Desejo do Paciente" (Intent) e a "Posição no Funil" (Stage).

## 1. Intents Oficiais

Os agentes (Agendador e Movimentador) devem classificar a mensagem do paciente em UMA das intenções abaixo (definidas em `INTENT_VALUES` no `schema.ts`):

- `agendamento`: Paciente quer marcar uma primeira consulta ou novo procedimento.
- `reagendamento`: Paciente precisa mudar a data/hora de algo já marcado.
- `agendamento_retorno`: Paciente que já passou por atendimento quer marcar o retorno.
- `duvida_geral`: Dúvidas de preço, localização, convênio ou sobre os médicos.
- `nf_reembolso`: Pedidos burocráticos de Nota Fiscal ou recibos.
- `pagamento_alegado`: Paciente enviou comprovante ou diz que pagou (Aciona autoridade da secretária).
- `desistencia`: Paciente não quer mais ser atendido de forma explícita.
- `interesse_tratamento`: Demonstrou interesse avançado, mas ainda não marcou.
- `judicializacao`: Menção a processos judiciais, liminares ou advogados (Critical).
- `renovacao_receita`: Paciente antigo precisando apenas renovar prescrição.
- `objecao`: O paciente acha caro, ou tem medo, exigindo "quebra de objeção".
- `outro`: Fallback caso não se encaixe em nada acima.

## 2. Stages reais — pipeline Kanban

| # | Nome do Stage no Banco | Canonical Name (usado pela IA) | `is_terminal` |
|---|---|---|---|
| 0 | Leads de entrada | `Novo` | false |
| 1 | Paciente antigo | `Paciente antigo` | false |
| 2 | Qualificação | `Qualificação` | false |
| 3 | Consulta agendada | `Consulta agendada` | false |
| 4 | Consulta finalizada | `Consulta finalizada` | false |
| 5 | Tratamento agendado | `Tratamento agendado` | false |
| 6 | Em tratamento | `Em tratamento` | false |
| 7 | Sem resposta | `Sem resposta` | false |
| 8 | Nutrição inativa | `Nutrição inativa` | false |
| 9 | B2B / Stakeholders | `B2B / Stakeholders` | **true** |
| 10 | Desqualificado / Fora de escopo | `Desqualificado` | **true** |

> ⚠️ **Observação importante**: A ordem física no banco pode variar, mas o motor usa o **Canonical Name** (resolvido na tabela de aliases em tempo de execução).

## Aliases seedados no Banco

Para evitar erros caso a clínica mude o nome de "Consulta agendada" para "Reunião Agendada" na UI, o banco mantém aliases mapeados:

| Alias `name` detectado | Resolvido para `canonical_name` |
|---|---|
| `Novo` | Novo |
| `Qualificação`, `Qualificacao` | Qualificação |
| `Consulta agendada`, `Reunião Agendada` | Consulta agendada |
| `Tratamento agendado`, `Procedimento agendado` | Tratamento agendado |
| `Consulta finalizada` | Consulta finalizada |
| `Em tratamento` | Em tratamento |
| `Sem resposta`, `Parou de Responder` | Sem resposta |
| `Nutrição inativa` | Nutrição inativa |
| `Paciente antigo` | Paciente antigo |

Se o Maestro (Agente 5) sugerir um stage que não possui Alias configurado no banco, o move falha silenciosamente por `stage_alias_not_found` mas as tags continuam sendo processadas.

## Stages Excluídos da Auditoria
Os leads que pararem nas seguintes colunas NUNCA sofrerão alertas de atraso pelo Cron diário (Positon Auditor A1):
- `Paciente antigo`
- `Nutrição inativa`
- `B2B / Stakeholders`
- `Desqualificado`
