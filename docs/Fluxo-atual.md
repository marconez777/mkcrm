---
title: "Fluxo Comercial e Operacional do Pipeline (versão alvo)"
topic: operations
kind: flow
audience: agent
updated: 2026-06-25
summary: "Descrição enviada pelo cliente do fluxo alvo do pipeline: responsabilidades da IA vs secretária, regras de movimentação de cards, follow-ups e relatórios mensais."
related_docs:
  - docs/pipeline/runtime/FLOW_MATRIX.md
  - docs/skill-datas.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/USER_AUTOMATIONS.md
---

# Fluxo Comercial e Operacional do Pipeline

> Documento de referência enviado pelo cliente em 25/06/2026. Reflete o **comportamento alvo** do pipeline (não necessariamente o estado atual implementado). Servirá de base para análise de gaps entre o fluxo desejado e o que está rodando hoje.

## 1. Entrada do lead

- Todo novo lead deve entrar inicialmente na coluna **Leads de entrada**.
- Enquanto ninguém da equipe responder o lead, ele deve permanecer nessa coluna.
- Ao entrar, o lead receberá uma **mensagem automática de saudação**. Essa primeira mensagem serve apenas como abertura do atendimento e **não deve ser usada pela IA como confirmação real de interesse**.

## 2. Resposta do lead e movimentação para Qualificação

- Quando o lead responder após a mensagem de saudação, ele deverá ser movido **automaticamente** para a coluna **Qualificação**.
- A partir desse momento, o lead começa a conversar com a secretária.
- Na coluna Qualificação, a IA deve acompanhar a conversa e continuar atribuindo os chips de interesse, como já acontece atualmente.

## 3. Identificação de interesse pela IA

- A IA deve identificar o interesse real do lead **somente com base nas mensagens enviadas após a primeira mensagem**.
- A primeira mensagem não deve ser considerada para definir interesse, pois muitas vezes ela é uma mensagem pré-fabricada da página de origem (ex.: "quero agendar uma consulta"). Essa mensagem serve mais para identificar de onde o lead veio do que para confirmar a intenção real dele.
- A IA deve preencher os campos personalizados do lead com base no conteúdo da conversa, incluindo:
  - Interesse do lead
  - Tipo de interesse (consulta ou procedimento)
  - Procedimento desejado, quando houver
  - Origem do lead, quando for possível identificar pelo rastreamento

## 4. Preenchimento do campo Origem

- A IA deve preencher o campo **Origem** quando houver rastreamento indicando que o lead veio do orgânico (por exemplo, Google).
- Se o rastreamento mostrar que o lead veio do Google, a IA deve marcar a origem correspondente.
- Caso a secretária altere manualmente o campo Origem, a IA **não deve sobrescrever** essa informação depois. A edição manual da secretária tem prioridade.

## 5. Agendamento de consulta ou procedimento

Quando o lead efetivamente agendar uma consulta ou um procedimento, a movimentação do card **não deve ser feita pela IA**. A responsabilidade de mover o card será da **secretária**.

Existem três cenários principais:

### 5.1 Lead agenda apenas uma consulta

- A secretária deve mover o card para a coluna **Consulta agendada**.
- Depois, preencher os campos relacionados:
  - Se a consulta será online ou presencial
  - Data e horário da consulta
  - Valor, quando aplicável
  - Status de confirmação, se houver

### 5.2 Lead agenda apenas um tratamento ou procedimento

- A secretária deve mover o card para a coluna **Tratamento agendado**.
- Depois, preencher os campos relacionados:
  - Tipo de procedimento
  - Data e horário do procedimento
  - Valor, quando aplicável
  - Status de confirmação, se houver

### 5.3 Lead agenda consulta e tratamento em curto espaço de tempo

- Pode existir o caso em que o lead agenda uma consulta e, logo depois, agenda também um tratamento ou procedimento.
- A movimentação entre as colunas deverá ser feita **manualmente pela secretária**, conforme o estágio mais correto do atendimento.
- A IA deve apenas apoiar no preenchimento dos dados e na identificação do interesse, mas **não deve decidir sozinha** a movimentação para consulta agendada ou tratamento agendado.

## 6. Finalização da consulta ou da primeira sessão

- Depois que o lead finalizar a consulta e a equipe confirmar o recebimento do valor, a secretária deverá mover o card para a coluna **Consulta finalizada**.
- No caso de procedimento ou tratamento, depois que a primeira sessão for realizada e o pagamento for confirmado, a secretária deverá mover o card para a coluna **1ª Sessão Finalizada**.
- Assim que o lead entrar em uma dessas colunas, o sistema deverá disparar uma **automação específica de pesquisa**, diferente para cada caso:
  - Lead em **Consulta finalizada** → pesquisa específica de consulta.
  - Lead em **1ª Sessão Finalizada** → pesquisa específica de procedimento/tratamento.

## 7. Regra mensal para pacientes efetivados

- Todos os leads que entrarem em **Consulta finalizada** ou **1ª Sessão Finalizada** entre o dia 2 e o último dia do mês devem permanecer nessas colunas até o **fechamento do mês**.
- No primeiro dia do mês seguinte, esses leads devem ser movidos automaticamente para a coluna **Paciente antigo**.
- Essa regra existe para permitir relatórios mensais mostrando quantos pacientes novos foram efetivados em cada mês.

**Exemplo:** lead que entrou em Consulta finalizada no dia 10 de julho permanece nessa coluna até o fim de julho. No dia 1º de agosto é movido automaticamente para Paciente antigo.

## 8. Regra para pacientes antigos sem interação

- Se um lead estiver em **Paciente antigo** por mais de **60 dias** sem enviar nenhuma mensagem e sem ter nenhum agendamento de consulta ou procedimento nesse período, ele deverá ser movido automaticamente para **Nutrição antigos**.
- Essa coluna será usada para pacientes antigos que precisam entrar em uma régua de relacionamento/reativação.

## 9. Follow-up para leads em Qualificação

- Se um lead permanecer em **Qualificação** por mais de **24 horas** sem responder e sem nenhum agendamento registrado, deverá receber uma **primeira mensagem automática de follow-up**.
- Se continuar sem responder e completar **48 horas** na coluna Qualificação, sem nenhum agendamento registrado, deverá receber uma **segunda mensagem de follow-up**, diferente da primeira.
- As mensagens devem ser **configuráveis pela UI**, dentro da área de automações, para que a equipe possa editar o texto quando necessário.

## 10. Regra para leads inativos em Qualificação

- Se um lead permanecer em **Qualificação** por mais de **7 dias** sem responder e sem nenhum agendamento registrado, deverá ser movido automaticamente para a coluna **Nutrição inativa**.
- Essa coluna será usada para leads que demonstraram algum contato inicial, mas não avançaram no atendimento.

## 11. Responsabilidades da IA

A IA **deve** ser responsável por:

- Analisar as mensagens após a primeira interação
- Identificar o interesse real do lead
- Atribuir chips de interesse
- Preencher campos personalizados do lead
- Preencher a origem quando houver rastreamento confiável
- Respeitar alterações manuais feitas pela secretária
- Apoiar a organização dos dados do atendimento

A IA **não deve** ser responsável por:

- Mover o card para Consulta agendada
- Mover o card para Tratamento agendado
- Confirmar agendamento sem validação da secretária
- Sobrescrever dados preenchidos manualmente pela equipe
- Considerar a primeira mensagem do lead como prova real de interesse

## 12. Responsabilidades da secretária

A secretária deve ser responsável por:

- Conversar diretamente com o lead na etapa de qualificação
- Confirmar se o lead agendou consulta ou procedimento
- Mover o card para **Consulta agendada** ou **Tratamento agendado**
- Preencher data e horário da consulta
- Preencher data e horário do procedimento
- Marcar se a consulta será online ou presencial
- Confirmar pagamento
- Mover o card para **Consulta finalizada** ou **1ª Sessão Finalizada**
- Ajustar manualmente informações quando necessário

## 13. Colunas do pipeline

O pipeline deverá conter, no mínimo, as seguintes colunas:

1. Leads de entrada
2. Qualificação
3. Consulta agendada
4. Tratamento agendado
5. Consulta finalizada
6. 1ª Sessão Finalizada
7. Paciente antigo
8. Nutrição antigos
9. Nutrição inativa

## 14. Objetivo principal do fluxo

O objetivo desse fluxo é:

- Organizar melhor a jornada do lead.
- Separar claramente o que deve ser feito pela IA e o que deve ser feito pela secretária.
- Evitar movimentações erradas no pipeline.
- Permitir relatórios mensais mais precisos sobre pacientes novos efetivados.

A IA deve funcionar como **apoio para leitura, classificação e preenchimento de dados**. A decisão operacional de agendamento, confirmação e movimentação final deve continuar sob responsabilidade da **equipe humana**.
