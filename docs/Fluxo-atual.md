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

---

# Automações de Lembrete (consultas, procedimentos e pesquisas)

## 1. Objetivo das automações de lembrete

- O sistema deverá enviar **lembretes automáticos** para consultas e procedimentos agendados, sempre respeitando as informações preenchidas no card do lead.
- **Nenhum lembrete deve ser enviado** se os dados obrigatórios do agendamento não estiverem preenchidos corretamente.
- A secretária será responsável por mover o card para a coluna correta e preencher os campos necessários. A automação só será disparada quando as condições estiverem completas.

## 2. Lembrete após mover para Consulta agendada

Quando a secretária mover o card para a coluna **Consulta agendada**, o sistema deverá verificar se o campo de **data e hora da consulta** está preenchido.

- Se o campo estiver vazio, nenhuma automação de lembrete deve ser programada.
- Se o campo estiver preenchido, o sistema deverá programar os lembretes com base no tipo de consulta.

### 2.1 Consulta online

Se o botão **Consulta online** estiver ativado no card do lead, programar o envio do template de lembrete para consulta online. Devem ser enviados dois lembretes:

- **Um dia antes da consulta** — template de lembrete de consulta online. Pode conter horário, link da consulta, orientações para acesso e instruções importantes.
- **Uma hora antes da consulta** — segundo lembrete de consulta online, reforçando horário e acesso.

### 2.2 Consulta presencial

Se o botão **Consulta online** não estiver ativado, o sistema deverá entender que a consulta é presencial. Devem ser enviados dois lembretes:

- **Um dia antes da consulta** — template de lembrete de consulta presencial. Pode conter horário, endereço, orientações de chegada e informações necessárias.
- **Uma hora antes da consulta** — segundo lembrete de consulta presencial, reforçando horário e presença no local.

## 3. Lembrete após mover para Tratamento ou Procedimento agendado

Quando a secretária mover o card para **Tratamento agendado** ou **Procedimento agendado**, o sistema deverá verificar se o campo de **data e hora do procedimento** está preenchido.

- Se o campo estiver vazio, nenhuma automação de lembrete deve ser programada.
- Se o campo estiver preenchido, o sistema deverá programar os lembretes do procedimento.

Procedimentos e tratamentos **nunca serão considerados online**. Portanto, não haverá verificação do botão de consulta online nesse caso. Devem ser enviados dois lembretes:

- **Um dia antes do procedimento** — template de lembrete de procedimento presencial. Pode conter horário, endereço, orientações de preparo e informações importantes.
- **Uma hora antes do procedimento** — segundo lembrete de procedimento presencial, reforçando horário, local e orientações finais.

## 4. Regras obrigatórias antes de enviar lembretes

**Para consulta**, validar antes do envio:

- O card está na coluna **Consulta agendada**.
- O campo data e hora da consulta está preenchido.
- O sistema identificou se a consulta é online ou presencial.
- Existe um template configurado para o tipo de lembrete.
- O lead ainda não foi movido para uma coluna posterior (ex.: Consulta finalizada).

**Para procedimento ou tratamento**, validar antes do envio:

- O card está em **Tratamento agendado** ou **Procedimento agendado**.
- O campo data e hora do procedimento está preenchido.
- Existe um template configurado para o lembrete de procedimento.
- O lead ainda não foi movido para uma coluna posterior (ex.: Tratamento finalizado ou 1ª Sessão Finalizada).

## 5. Cancelamento ou atualização de lembretes

- Se a secretária **alterar a data ou horário** da consulta, os lembretes antigos devem ser cancelados e novos lembretes devem ser programados com base na nova data. A mesma regra vale para procedimentos/tratamentos.
- Se o card for **removido** de Consulta agendada, Tratamento agendado ou Procedimento agendado, os lembretes pendentes relacionados a esse agendamento devem ser cancelados.
- Isso evita que o paciente receba mensagens de lembrete com horário antigo ou de um atendimento que foi cancelado.

## 6. Pesquisa após Consulta finalizada

- Quando a secretária mover o card para **Consulta finalizada**, o sistema deverá disparar uma automação específica com o **link da pesquisa de consulta**.
- Essa automação deve ser enviada apenas quando o card entrar nessa coluna.
- Objetivo: coletar a percepção do paciente após a realização da consulta.
- A mensagem deve ser configurável na área de automações da UI.

## 7. Pesquisa após Tratamento finalizado

- Quando a secretária mover o card para **Tratamento finalizado** ou **1ª Sessão Finalizada**, o sistema deverá disparar uma automação específica com o **link da pesquisa de tratamento/procedimento**.
- Essa automação deve ser **diferente** da pesquisa enviada após a consulta.
- Objetivo: coletar a percepção do paciente sobre o procedimento, tratamento ou primeira sessão realizada.
- A mensagem também deve ser configurável na área de automações da UI.

## 8. Automações necessárias na interface

A área de automações da UI deverá permitir configurar os seguintes templates:

**Lembretes de consulta:**

- Lembrete de consulta online — 1 dia antes
- Lembrete de consulta online — 1 hora antes
- Lembrete de consulta presencial — 1 dia antes
- Lembrete de consulta presencial — 1 hora antes

**Lembretes de procedimento ou tratamento:**

- Lembrete de procedimento presencial — 1 dia antes
- Lembrete de procedimento presencial — 1 hora antes

**Pesquisas:**

- Pesquisa após consulta finalizada
- Pesquisa após tratamento finalizado ou primeira sessão finalizada

## 9. Resumo das regras de disparo

**Consulta online**

- Condição: card em Consulta agendada + data/hora da consulta preenchida + botão Consulta online ativado.
- Ações: lembrete de consulta online 1 dia antes + lembrete de consulta online 1 hora antes.

**Consulta presencial**

- Condição: card em Consulta agendada + data/hora da consulta preenchida + botão Consulta online desativado.
- Ações: lembrete de consulta presencial 1 dia antes + lembrete de consulta presencial 1 hora antes.

**Procedimento ou tratamento presencial**

- Condição: card em Tratamento agendado ou Procedimento agendado + data/hora do procedimento preenchida.
- Ações: lembrete de procedimento 1 dia antes + lembrete de procedimento 1 hora antes.

**Pesquisa de consulta**

- Condição: card movido para Consulta finalizada.
- Ação: enviar mensagem com link da pesquisa de consulta.

**Pesquisa de tratamento**

- Condição: card movido para Tratamento finalizado ou 1ª Sessão Finalizada.
- Ação: enviar mensagem com link da pesquisa de tratamento ou procedimento.
