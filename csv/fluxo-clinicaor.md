# Especificação funcional do fluxo do CRM para o agente de IA

## 1. Objetivo geral

O CRM organiza toda a jornada de contatos recebidos pelo WhatsApp, desde a primeira mensagem até o agendamento de consulta, contratação de procedimento, realização da primeira sessão, fidelização e recuperação de pacientes antigos.

O agente de IA deve atuar como um controlador do funil. Suas responsabilidades são:

* Analisar cada nova mensagem recebida.
* Identificar se o contato é um possível paciente, vendedor, parceiro ou curioso.
* Mover o contato para a etapa correta.
* Detectar agendamentos, cancelamentos, comparecimentos e contratação de procedimentos.
* Controlar períodos sem resposta.
* Reativar contatos que voltarem a conversar.
* Criar alertas visuais para a secretária.
* Registrar o motivo de cada movimentação.
* Evitar movimentações duplicadas ou baseadas em informações incertas.

As linhas contínuas do fluxo representam movimentações provocadas por eventos confirmados. As linhas pontilhadas representam automações de tempo, reativação ou retorno ao funil.

---

# 2. Etapas do funil

## Etapa 1: Leads de Entrada

**Nome da etapa:**

`Leads de Entrada`

**Descrição:**

`Novo contato do WhatsApp`

Todo número que entrar em contato pela primeira vez deve criar ou atualizar um lead nesta etapa.

Antes de criar um novo card, o sistema deve procurar outro contato com o mesmo telefone. Caso o número já exista, a nova mensagem deve ser adicionada ao histórico existente, evitando duplicidade.

### Possíveis movimentações

#### Para Qualificação

Mover para `Qualificação` quando:

* A secretária responder ao contato.
* A IA iniciar o atendimento.
* O contato demonstrar interesse em consulta, avaliação ou procedimento.
* A mensagem indicar que a pessoa busca atendimento para si ou para outra pessoa.

#### Para Desqualificado / B2B

Mover para `Desqualificado / B2B` quando a IA identificar que o contato é:

* Vendedor.
* Representante comercial.
* Prestador de serviço.
* Agência.
* Fornecedor.
* Interessado em parceria.
* Pessoa oferecendo produtos.
* Curioso sem intenção de atendimento.

A classificação deve considerar o conteúdo completo da conversa. Uma simples pergunta genérica não deve provocar desqualificação automática.

---

## Etapa 2: Qualificação

**Nome da etapa:**

`Qualificação`

**Descrição:**

`Conversa em andamento`

Esta é a principal etapa de atendimento. O lead permanece aqui enquanto a IA ou a secretária:

* Entende o que ele procura.
* Identifica o serviço de interesse.
* Responde dúvidas.
* Verifica disponibilidade.
* Coleta dados.
* Tenta realizar o agendamento.

### Informações que podem ser coletadas

* Nome do paciente.
* Nome do responsável, quando aplicável.
* Tipo de atendimento desejado.
* Consulta, terapia ou procedimento de interesse.
* Preferência por atendimento presencial ou teleconsulta.
* Data desejada.
* Horário desejado.
* Se é paciente novo ou antigo.
* Como conheceu a clínica.
* Observações relevantes para a secretária.

O agente não deve realizar diagnóstico, prometer resultados médicos ou interpretar sintomas como confirmação de uma doença.

### Movimentações possíveis

#### Para Consulta Agendada

Mover para `Consulta Agendada` quando houver confirmação real de uma avaliação ou consulta.

A confirmação pode acontecer por:

* Integração com a agenda.
* Registro manual da secretária.
* Detecção de data e horário confirmados na conversa.
* Mensagem explícita como: “Pode marcar para terça às 14h”.
* Confirmação enviada pela clínica e aceita pelo paciente.

Não mover apenas porque o paciente perguntou sobre disponibilidade.

O sistema deve salvar:

* Data da consulta.
* Horário.
* Profissional.
* Tipo de consulta.
* Presencial ou teleconsulta.
* Origem da confirmação.
* Pessoa que realizou o agendamento.

#### Para Tratamento Agendado

Mover diretamente para `Tratamento Agendado` quando o paciente não precisar passar por uma nova avaliação e marcar diretamente um procedimento ou tratamento.

Exemplos:

* Paciente antigo marcando uma nova sessão.
* Paciente com indicação já realizada.
* Procedimento confirmado diretamente pela secretária.
* Data da primeira sessão já definida.

A IA só pode fazer essa movimentação quando houver confirmação do procedimento e do agendamento.

#### Para Sem Resposta

Mover para `Sem Resposta` quando o paciente deixar de responder durante a qualificação.

O prazo indicado no fluxo é de `24 ou 48 horas`. Esse prazo deve ser configurável no CRM.

A contagem deve começar a partir da última mensagem da clínica que exige uma resposta do paciente.

Exemplo:

1. A clínica pergunta qual data o paciente prefere.
2. O paciente não responde.
3. Após o período configurado, o card vai para `Sem Resposta`.

Mensagens automáticas que não exigem resposta não devem iniciar esse contador.

---

## Etapa 3: Desqualificado / B2B

**Nome da etapa:**

`Desqualificado / B2B`

**Descrição:**

`Curiosos ou Vendedores`

Esta etapa deve receber contatos que não fazem parte do funil de pacientes.

O agente deve registrar o motivo da desqualificação, como:

* Vendedor.
* Parceria.
* Fornecedor.
* Proposta comercial.
* Mensagem sem relação com atendimento.
* Spam.
* Contato duplicado.
* Curioso sem intenção real.

O contato não deve receber campanhas destinadas a pacientes, salvo quando houver reclassificação manual.

Caso uma pessoa anteriormente classificada como B2B envie uma mensagem claramente relacionada a atendimento médico, a IA deve sinalizar a possível reclassificação. A mudança automática só deve ocorrer quando o novo interesse como paciente for evidente.

---

## Etapa 4: Consulta Agendada

**Nome da etapa:**

`Consulta Agendada`

**Descrição:**

`Marcou avaliação`

Esta etapa representa pacientes com consulta ou avaliação confirmada.

O card deve mostrar:

* Data e horário.
* Profissional responsável.
* Modalidade da consulta.
* Tipo de atendimento.
* Status da confirmação.
* Observações.
* Link da agenda, quando disponível.

### Movimentações possíveis

#### Para Consulta Finalizada

Mover para `Consulta Finalizada` quando o paciente comparecer e a avaliação for concluída.

A confirmação pode vir de:

* Integração com a agenda.
* Atualização da secretária.
* Atualização do profissional.
* Status manual de comparecimento.

A IA não deve concluir que houve comparecimento apenas porque o horário da consulta passou.

#### Para Sem Resposta

Mover para `Sem Resposta` quando:

* O paciente faltar.
* O paciente cancelar.
* O paciente desmarcar sem escolher uma nova data.
* A clínica tentar remarcar e o paciente parar de responder.

Se o paciente desmarcar e escolher uma nova data na mesma conversa, o card deve continuar em `Consulta Agendada`, apenas com a atualização da data.

---

## Etapa 5: Sem Resposta

**Nome da etapa:**

`Sem Resposta`

**Descrição:**

`Paciente parou de falar`

Esta etapa reúne contatos que interromperam a conversa antes da conversão ou que faltaram e não remarcaram.

O CRM deve registrar:

* Data da última mensagem recebida.
* Data da última mensagem enviada.
* Motivo da entrada na etapa.
* Quantidade de tentativas de contato.
* Origem do lead.
* Serviço de interesse.

### Movimentação para Nutrição Inativa

Se o paciente permanecer por `7 dias de silêncio`, mover para:

`Nutrição Inativa`

A contagem deve ser cancelada imediatamente caso o paciente envie qualquer mensagem.

---

## Etapa 6: Nutrição Inativa

**Nome da etapa:**

`Nutrição Inativa`

**Descrição:**

`Geladeira de Leads`

Esta etapa recebe pessoas que demonstraram interesse, mas não avançaram e permaneceram pelo menos sete dias sem conversar.

Esses contatos podem participar de campanhas de recuperação, conteúdos, lembretes ou novas ofertas de atendimento.

### Regra de reativação

Mover imediatamente para `Qualificação` quando o contato:

* Enviar qualquer nova mensagem.
* Responder a uma campanha.
* Clicar em uma campanha e iniciar conversa.
* Solicitar informações novamente.
* Perguntar sobre consulta, valor, data ou procedimento.

Ao reativar, o agente deve:

1. Cancelar automações pendentes da nutrição.
2. Registrar a campanha que provocou o retorno, quando houver.
3. Atualizar a data do último contato.
4. Mover o card para `Qualificação`.
5. Criar um resumo da conversa anterior para a secretária.

O contato não deve ser tratado como um novo lead. Todo o histórico precisa ser preservado.

---

## Etapa 7: Consulta Finalizada

**Nome da etapa:**

`Consulta Finalizada`

**Descrição:**

`Avaliação concluída`

O paciente entra nesta etapa após comparecer à consulta ou avaliação.

O sistema deve registrar:

* Data da avaliação.
* Profissional.
* Serviço avaliado.
* Status do orçamento.
* Procedimento indicado, quando informado.
* Próximo passo comercial.
* Necessidade de retorno.

### Para Tratamento Agendado

Mover para `Tratamento Agendado` quando o paciente fechar o orçamento e marcar o procedimento.

É necessário haver confirmação de contratação ou agendamento. A simples apresentação de um orçamento não significa fechamento.

### Para Paciente Antigo

Caso o paciente não seja direcionado para `Tratamento Agendado`, ele deve permanecer em `Consulta Finalizada` até a virada do mês.

No dia 1 do mês seguinte, mover automaticamente para:

`Paciente Antigo`

Essa automação representa a finalização do ciclo de consulta.

A movimentação não deve acontecer se o paciente já tiver agendado um tratamento.

---

## Etapa 8: Tratamento Agendado

**Nome da etapa:**

`Tratamento Agendado`

**Descrição:**

`Marcou procedimento`

Esta etapa reúne pacientes com procedimento ou tratamento confirmado.

O card deve apresentar:

* Procedimento contratado.
* Data da primeira sessão.
* Horário.
* Profissional responsável.
* Valor ou status financeiro, quando permitido.
* Quantidade prevista de sessões.
* Forma de atendimento.
* Origem do agendamento.

O contato pode chegar aqui de duas formas:

1. Marcou diretamente o procedimento durante a qualificação.
2. Realizou a avaliação, fechou o orçamento e marcou o tratamento.

### Para 1ª Sessão Finalizada

Mover para `1ª Sessão Finalizada` quando houver confirmação de que o paciente realizou a primeira sessão.

Essa confirmação deve vir da agenda, da equipe ou de uma atualização manual. O horário ter passado não é confirmação suficiente.

---

## Etapa 9: 1ª Sessão Finalizada

**Nome da etapa:**

`1ª Sessão Finalizada`

**Descrição:**

`Permanece até virar o mês`

Após realizar a primeira sessão, o paciente deve permanecer nesta etapa durante o restante do mês.

No dia 1 do mês seguinte, mover automaticamente para:

`Paciente Antigo`

A regra deve usar o fuso horário configurado para a clínica.

Caso o paciente faça novas sessões dentro do mesmo mês, o histórico deve ser atualizado, mas o card pode permanecer nesta etapa até a virada mensal.

---

## Etapa 10: Paciente Antigo

**Nome da etapa:**

`Paciente Antigo`

**Descrição:**

`Ciclo concluído/Fidelizado`

Esta etapa reúne pacientes que já concluíram pelo menos uma parte relevante da jornada, como:

* Consulta finalizada.
* Primeira sessão realizada.
* Tratamento iniciado.
* Ciclo anterior concluído.

Esta etapa não deve receber leads que nunca compareceram à consulta. Leads sem conversão pertencem à `Nutrição Inativa`.

### Solicitação de nova consulta

Quando um paciente antigo enviar uma mensagem solicitando nova consulta, a IA deve criar um lembrete visual para a secretária.

O lembrete deve conter:

* Identificação do paciente.
* Trecho da mensagem.
* Data e horário do pedido.
* Serviço solicitado.
* Indicação de que é paciente antigo.
* Botão ou ação para iniciar o reagendamento.

Sugestão de alerta:

`Paciente antigo solicitou nova consulta`

Enquanto o novo horário não estiver confirmado, o card pode permanecer em `Paciente Antigo` com o alerta visível.

Quando a data for confirmada, mover para `Consulta Agendada`. Caso seja marcado diretamente um procedimento, mover para `Tratamento Agendado`.

### Para Nutrição Antigos

Se o paciente permanecer `60 dias sem enviar mensagens`, mover para:

`Nutrição Antigos`

A contagem deve considerar a data da última mensagem recebida do paciente, e não apenas mensagens enviadas pela clínica.

---

## Etapa 11: Nutrição Antigos

**Nome da etapa:**

`Nutrição Antigos`

**Descrição:**

`Pacientes ausentes há mais de 60 dias`

Esta etapa é diferente da Nutrição Inativa.

* `Nutrição Inativa`: lead que não concluiu a jornada.
* `Nutrição Antigos`: pessoa que já foi paciente, mas está ausente há mais de 60 dias.

Esses pacientes podem receber campanhas de retorno, acompanhamento ou renovação de consulta.

### Resposta genérica ou resposta de campanha

Quando o paciente enviar qualquer mensagem ou responder a uma campanha, ele deve ser reativado.

O fluxo indicado é:

`Nutrição Antigos → Qualificação`

A IA deve manter a identificação de que se trata de um paciente antigo.

### Pedido explícito de nova consulta

Quando a mensagem contiver um pedido claro de nova consulta, a IA deve:

1. Retirar o paciente da nutrição.
2. Reclassificá-lo como paciente antigo reativado.
3. Criar o lembrete visual de nova consulta.
4. Notificar a secretária.
5. Preservar todo o histórico anterior.
6. Mover para `Consulta Agendada` assim que a data for confirmada.

O pedido explícito de agendamento deve ter prioridade sobre a regra genérica de resposta de campanha.

---

# 3. Tabela resumida de transições

| Etapa atual             | Gatilho                                      | Próxima etapa                        |
| ----------------------- | -------------------------------------------- | ------------------------------------ |
| Leads de Entrada        | Secretária responde ou IA inicia atendimento | Qualificação                         |
| Leads de Entrada        | IA identifica vendedor ou parceria           | Desqualificado / B2B                 |
| Qualificação            | Consulta confirmada                          | Consulta Agendada                    |
| Qualificação            | Procedimento confirmado diretamente          | Tratamento Agendado                  |
| Qualificação            | 24h ou 48h sem resposta                      | Sem Resposta                         |
| Consulta Agendada       | Paciente compareceu                          | Consulta Finalizada                  |
| Consulta Agendada       | Faltou ou desmarcou sem remarcar             | Sem Resposta                         |
| Sem Resposta            | 7 dias de silêncio                           | Nutrição Inativa                     |
| Nutrição Inativa        | Enviou mensagem ou respondeu campanha        | Qualificação                         |
| Consulta Finalizada     | Fechou orçamento e marcou procedimento       | Tratamento Agendado                  |
| Consulta Finalizada     | Chegou o dia 1 do próximo mês                | Paciente Antigo                      |
| Tratamento Agendado     | Realizou a primeira sessão                   | 1ª Sessão Finalizada                 |
| 1ª Sessão Finalizada    | Chegou o dia 1 do próximo mês                | Paciente Antigo                      |
| Paciente Antigo         | 60 dias sem mensagem recebida                | Nutrição Antigos                     |
| Nutrição Antigos        | Enviou mensagem ou respondeu campanha        | Qualificação                         |
| Paciente antigo/inativo | Pediu nova consulta                          | Criar alerta e iniciar reagendamento |

---

# 4. Campos necessários no CRM

Cada lead deve possuir, no mínimo:

```text
id
clinic_id
nome
telefone
origem_do_lead
etapa_atual
tipo_de_contato
paciente_novo_ou_antigo
servico_de_interesse
data_da_ultima_mensagem_recebida
data_da_ultima_mensagem_enviada
data_de_entrada_na_etapa
aguardando_resposta
data_da_consulta
status_da_consulta
modalidade_da_consulta
profissional
procedimento
data_da_primeira_sessao
status_do_orcamento
campanha_de_origem
lembrete_visual
motivo_da_movimentacao
movido_por
data_da_movimentacao
```

O campo `movido_por` deve indicar:

* IA.
* Secretária.
* Integração de agenda.
* Automação de tempo.
* Administrador.

---

# 5. Ordem de análise de cada mensagem

Sempre que uma mensagem chegar, o agente deve executar esta sequência:

1. Localizar o contato pelo telefone.
2. Carregar o histórico e a etapa atual.
3. Registrar a nova mensagem.
4. Identificar se é paciente, B2B, vendedor ou mensagem sem relação.
5. Identificar a intenção da mensagem.
6. Verificar se existe pedido de consulta ou procedimento.
7. Verificar se existe data e horário confirmados.
8. Verificar se é uma resposta de campanha.
9. Cancelar contadores de silêncio aplicáveis.
10. Aplicar a movimentação correta.
11. Criar lembrete visual quando necessário.
12. Registrar o motivo da decisão.
13. Notificar a secretária quando a ação humana for necessária.

---

# 6. Regras para evitar erros

## Não considerar pergunta como agendamento

Mensagens como estas não confirmam agendamento:

* “Tem horário?”
* “Quanto custa?”
* “Atende amanhã?”
* “Queria saber mais.”
* “Como funciona?”

O agendamento exige data e horário confirmados ou um registro válido na agenda.

## Não considerar orçamento enviado como tratamento fechado

O paciente só deve entrar em `Tratamento Agendado` quando houver confirmação de contratação e marcação do procedimento.

## Não considerar horário passado como comparecimento

A IA não pode mover automaticamente para `Consulta Finalizada` ou `1ª Sessão Finalizada` apenas porque o horário agendado passou.

## Movimentação manual tem prioridade

Quando a secretária mover o lead manualmente, a IA deve respeitar a decisão e registrar a alteração.

A automação não deve desfazer imediatamente uma movimentação humana.

## Cancelar automações antigas

Sempre que um card mudar de etapa, o sistema deve cancelar os temporizadores pertencentes à etapa anterior.

Exemplo: ao sair de `Sem Resposta`, o contador de sete dias deve ser cancelado.

## Registrar todas as movimentações

Cada alteração deve gerar um registro contendo:

* Etapa anterior.
* Nova etapa.
* Data e horário.
* Regra aplicada.
* Mensagem que provocou a ação.
* Responsável pela movimentação.

---

# 7. Camada de segurança para atendimento psiquiátrico

Caso a IA identifique mensagem relacionada a risco imediato, ideação suicida, tentativa de autoagressão, violência ou emergência médica, ela não deve conduzir o contato como uma conversa comercial comum.

O agente deve:

* Marcar o contato como urgente.
* Notificar imediatamente a equipe humana.
* Criar alerta visual prioritário.
* Interromper mensagens automáticas de vendas ou nutrição.
* Não diagnosticar ou indicar tratamento por conta própria.

---

# 8. Regra central do agente

O agente deve tratar o funil como uma máquina de estados. Nenhum card pode ser movido sem um gatilho identificável.

Toda decisão precisa responder a três perguntas:

1. **Em qual etapa o contato está?**
2. **Qual evento realmente aconteceu?**
3. **Qual regra autoriza a próxima movimentação?**

Quando não houver evidência suficiente, o agente deve manter o card na etapa atual, registrar a dúvida e criar uma solicitação de revisão para a secretária.
