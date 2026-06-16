---
title: "Estudo: Fechamento pendente consulta"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Fechamento pendente consulta' do funil Agendamentos Novo (Clínica ÓR): 17 leads."
---

# Estudo: Fechamento pendente consulta

**Coluna:** `Fechamento pendente consulta` (posição 6) — **17 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é diverso, mas majoritariamente composto por familiares de pacientes com transtornos severos (alcoolismo, depressão refratária) e pacientes recorrentes de Cetamina. Geralmente, estão cientes da autoridade do Dr. Ivan (pioneirismo no Método Sinclair), o que gera um interesse qualificado, porém enfrentam barreiras financeiras ou logísticas (moram fora de SP ou dependem de acompanhantes). São leads que valorizam a nota fiscal para reembolso e buscam flexibilidade de pagamento, como o parcelamento. Há também a presença de fornecedores de insumos e serviços que aguardam pagamentos ou retorno de cotações, indicando que a coluna atua como um 'purgatório' de pendências administrativas e clínicas.


### Procedimentos mais mencionados

- Infusão de Cetamina (Manutenção e Protocolos)
- Consulta Psiquiátrica (Método Sinclair/Alcoolismo)
- EMT (Estimulação Magnética Transcraniana)
- Avaliação Psicológica (TST/EMDR)

### Profissionais mais mencionados

- Dr. Ivan Barenboim
- Dra. Maísa (Psicologia)
- Edilene (Administrativo)

### Objeções mais comuns

- Valor da consulta (R$ 750,00) considerado alto.
- Logística: pacientes de outros estados (MS, MG) ou com dificuldade de acompanhante.
- Resistência do paciente real (familiares tentando agendar para terceiros).
- Conflitos de horário com trabalho/escola.

### Gatilhos de entrada na coluna

- Interesse específico no Método Sinclair e Dr. Ivan.
- Necessidade de manutenção recorrente de Cetamina.
- Busca por reembolso de convênio (Nota Fiscal).
- Encaminhamento interno de psiquiatria para psicologia (Dra. Maísa).

## 2. Padrões observados (Top 10)

1. Aceitação de teleconsulta como solução para barreira geográfica.
2. Uso recorrente do argumento de reembolso para justificar o preço.
3. Interesse em pacotes de tratamento (Cetamina/EMT) com isenção de consulta.
4. Solicitação frequente de notas fiscais logo após o pagamento.
5. Pacientes recorrentes solicitando agendamentos de última hora por falta de medicação.
6. Uso de familiares (mães/esposas) como intermediários na negociação de tratamento.
7. Sensibilidade ao toque humano e empático em casos de ideação suicida ou alcoolismo.
8. Negociação de parcelamento (cartão/boleto) para fechar pacotes de infusão.
9. Atraso no fechamento por necessidade de 'verificar a agenda' após receber preços.
10. Reagendamentos frequentes por questões de saúde (gripe) ou logística.

## 3. Erros recorrentes do agente IA atual

- Confusão entre o endereço da clínica e a modalidade de teleconsulta nas mensagens de confirmação.
- Dificuldade em separar leads administrativos (fornecedores) de leads de pacientes em tratamento.

## 4. Recomendações para o agente de **pipeline**

- Criar tags de 'Fornecedor' e 'Administrativo' para limpar o funil de vendas.
- Implementar automação de follow-up de 48h para leads que 'precisam confirmar a agenda'.
- Mover leads que já concluíram o procedimento administrativo (NF enviada) para a etapa de Pós-venda ou Concluído.
- Monitorar leads com a tag 'Reagendamento Pendente' para garantir que não fiquem sem nova data por mais de 24h.

## 5. Recomendações para o agente de **atendimento**

- Sempre confirmar a modalidade (presencial vs. online) antes de enviar o template de confirmação de endereço.
- Para familiares de pacientes resistentes, oferecer proativamente a 'consulta de orientação familiar'.
- Ao lidar com objeção de preço, enfatizar imediatamente o fornecimento de NF para reembolso e a isenção da consulta em casos de fechamento de pacote (EMT/Cetamina).
- Evitar o envio em massa de imagens de depoimentos; priorizar links de vídeos ou PDFs informativos para não ser invasivo.

## 6. Alertas

- ⚠️ Presença de fornecedores e parceiros comerciais (MEDCOM, Calibração, Representantes) misturados no funil de assistência ao paciente.
- ⚠️ Envio de templates contraditórios (endereço físico para teleconsulta e horários divergentes).
- ⚠️ Resistência de leads ao recebimento de imagens de depoimentos via WhatsApp sem autorização prévia.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Paula Quartim de Moraes Carrara Lopes | 5511999317336 | 11 | 0 | pos_venda_administrativo |
| 2 | Deixe Seu Recado | 5512991423515 | 68 | 3 | agendou_apos_negociacao_valor |
| 3 | Isabelli Alves | 5511986108697 | 86 | 1 | reagendamento_procedimento_recorrente |
| 4 | 5511954800888 | 5511954800888 | 54 | 0 | admin_parceria |
| 5 | Andressa Martins | 5511942047737 | 10 | 0 | cancelamento_por_falta_de_acompanhante |
| 6 | 5511981218171 | 5511981218171 | 23 | 0 | cotacao_paciente_em_tratamento |
| 7 | Marcia Lunas | 5518996746510 | 34 | 5 | aguardando_retorno_logistica_paciente |
| 8 | Cadu | 5511986038490 | 36 | 0 | sumiu_apos_cotacao |
| 9 | EDUARDO | 5511993765319 | 48 | 1 | admin_parceria |
| 10 | Mari | 556799812131 | 73 | 16 | resistencia_paciente_familiar_intermediario |
| 11 | Rosemary De Andrade | 5519983023277 | 57 | 2 | reagendamento_procedimento |
| 12 | ROSSANA | 554399953830 | 25 | 7 | agendou_apos_objecao_preco |
| 13 | Kamila Nunes 🦋 | 5511975527998 | 6 | 1 | representante_comercial_ou_parceria |
| 14 | Ateliê Patrícia Machado | 556598209954 | 21 | 7 | sumiu_apos_cotacao_e_duvida_medicacao |
| 15 | Ronaldo Saraiva | 5513997003456 | 2 | 0 |  |
| 16 | … | 5511948588800 | 21 | 0 | perda_por_preco_objetivo |
| 17 | Ps | 5521999861403 | 61 | 0 | agendou_apos_atendimento_medico |

## 8. Conversas analisadas (transcrição + síntese)

_16 leads com conversa analisada._


### Paula Quartim de Moraes Carrara Lopes — `5511999317336`

**Custom fields:** `{"mensagem": "Solicita NF da última consulta em 08/06.", "interesse": "Consulta com psiquiatria", "observacoes": "Solicita NF da última consulta em 08/06.", "data_horario": "2026-03-05T17:30:00-03:00", "teleconsulta": "Não", "nome_preferido": "Paula", "tentou_agendar": true, "status_consulta": "realizada", "tipo_atendimento": "consulta_psiquiatria", "consulta_agendada_em": "2026-06-15T20:30:00.000`

**Cenário:** `pos_venda_administrativo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Paula confirmou e compareceu à consulta com o Dr. Ivan no dia 08/06. Uma semana após o atendimento, entrou em contato solicitando a Nota Fiscal da consulta. O atendimento foi puramente administrativo e resolutivo, com o envio do documento PDF pelo atendente logo em seguida. Não houve novas solicitações de agendamento nesta interação.


**Gatilhos:** solicitação de NF, reembolso convênio

<details><summary>Transcrição completa</summary>

- `2026-06-08 12:23` 🤖 Disponha
- `2026-06-08 17:23` 🤖 Boa tarde, Paula!
- `2026-06-08 17:24` 👤 Boa tarde
- `2026-06-08 17:24` 🤖 Podemos confirmar sua consulta hoje as 17:30 hs com o Dr. Ivan?
- `2026-06-08 17:24` 👤 Pode sim
- `2026-06-08 17:24` 🤖 Muito obrigada!
- `2026-06-08 20:22` 👤 5 minutos e chego
- `2026-06-15 15:02` 👤 Boa tarde, tudo bem?
- `2026-06-15 15:03` 👤 Por favor, pode encaminhar a NF da última consulta em 08/06?
- `2026-06-15 15:06` 🤖 Bom dia, Paula. Segue a nota fiscal.
- `2026-06-15 15:07` 🤖 Paula.pdf

</details>


### Deixe Seu Recado — `5512991423515`

**Custom fields:** `{"origem": "Google - Orgânico", "interesse": "Infusão de Cetamina", "observacoes": "Lead interessado em cetamina; horários: seg/qua/qui 07:30-15:30, sex 07:30-14:30; não atende sábados. Enviará mensagem amanhã para confirmar a última consulta. Tentou_agendar: true. Origem Google Orgânico; data_horario 2023-11-13T11:00:00-03:00.", "data_horario": "2023-11-13T11:00:00-03:00", "qualificacao": "intere`

**Cenário:** `agendou_apos_negociacao_valor` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead (Yuri, médico) buscou tratamento com cetamina. Inicialmente realizou uma consulta e uma infusão avulsa para testar a resposta. Após resultado positivo, negociou e fechou um pacote de R$ 4.750,00 parcelado em 8x (autorização especial do Dr. Ivan). Houve dois reagendamentos por motivos externos (problema mecânico e gripe), mas o lead mantém alto interesse e engajamento.


**Objeções:** Logística (problema no carro), Saúde (gripe), Preço/Parcelamento

**Gatilhos:** Isenção de consulta no pacote, Parcelamento estendido, Flexibilidade de horários

<details><summary>Transcrição completa</summary>

- `2026-05-06 20:18` 👤 Se eu for passar com o Dr. Ivan, eu conseguiria encaixe nessa segunda para consulta com ele e infusão?   E queria saber em quantas vezes vocês conseguem parcelar o valor de uma consulta e mais uma infusão?   Obrigado!
- `2026-05-06 20:25` 🤖 **[ÁUDIO]** Olá Yuri, tudo bem? Yuri, se você fizer o protocolo, você não precisa pagar a consulta. Aí a consulta será uma cortesia. Caso você não faça o protocolo, aí será necessário pagar a consulta, que é o valor de setecentos e cinquenta reais, pode parcelar no cartão em até três vezes.
- `2026-05-06 20:26` 🤖 **[ÁUDIO]** Segunda-feira eu tenho horário com ele às dez horas. Você tem disponibilidade?
- `2026-05-06 20:26` 🤖 **[ÁUDIO]** Aí você faria a infusão às onze.
- `2026-05-06 20:34` 🤖 Parcelamos em 3 vezes sem juros.
- `2026-05-07 12:19` 👤 Bom dia
- `2026-05-07 12:20` 👤 Tudo certo?
- `2026-05-07 12:20` 👤 Posso te ligar?
- `2026-05-07 12:20` 👤 Sim. Consigo nesse horário.
- `2026-05-07 12:21` 👤 Prefiro inicialmente fazer uma infusão. Até para saber minha resposta a cetamina. E se tudo der certo, depois fecho o pacote.
- `2026-05-07 12:22` 🤖 Bom dia Yuri.
- `2026-05-07 12:22` 🤖 Pode ligar sim.
- `2026-05-07 12:23` 🤖 Combinado, por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-07 12:28` 🤖 As recomendações para as infusões com cetamina são as seguintes:   1. Jejum não é necessário, mas não aconselhamos estar com o estômago excessivamente cheio antes da aplicação.  2. Acompanhantes são bem-vindos e poderão ficar com o paciente durante o procedimento. Entretanto, NÃO é necessário que o paciente venha acompanhado.   3. No entanto, você NÃO pode dirigir após a aplicação de cetamina.  4. Evite o consumo de bebidas alcoólicas 24h antes e depois da aplicação.  5. Psicoestimulantes como V
- `2026-05-07 12:35` 👤 Combinado, por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: George Yuri de Oliveira Data de nascimento: 28/12/1988 CPF: 369191728-36 RG: 44895582-9 Endereço completo com CEP: Av. John Kennedy, 1080, Taubaté - SP, CEP 12030-200 Tel/Cel: (12) 99142-3515 E-mail: dryurioliveira1@gmail.com Profissão: Médico  Estado civil: solteiro  Nacionalidade: Brasileiro  Contato de emergência: Fernanda (irmã) 12997087789 Através de qual can
- `2026-05-07 12:56` 🤖 Muito obrigada pelas informações!
- `2026-05-07 12:56` 👤 Eu que agradeço
- `2026-05-07 12:56` 🤖 Consulta presencial agendada para o dia 11/05 as 10:00 hs.
- `2026-05-07 13:10` 👤 Muito obrigado!
- `2026-05-07 13:11` 🤖 Disponha!
- `2026-05-11 11:53` 🤖 Bom dia Yuri! Obrigada por sinalizar.
- `2026-05-11 13:07` 👤 Quase chegando
- `2026-05-11 13:12` 🤖 ok
- `2026-05-11 20:45` 👤 Boa tarde!
- `2026-05-11 20:46` 👤 Posso agendar a próxima sessão para a próxima segunda?
- `2026-05-11 20:52` 🤖 Boa tarde, Yuri.
- `2026-05-11 20:52` 🤖 Qual horário você prefere?
- `2026-05-11 20:59` 👤 Pode ser 10:30?
- `2026-05-11 21:13` 🤖 Pode ser as 11:00 hs?
- `2026-05-11 21:14` 🤖 O horário das 10:30 hs, já está preenchido.
- `2026-05-11 22:38` 👤 Pode ser
- `2026-05-11 22:38` 👤 Obrigado! 🙏
- `2026-05-11 22:38` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-12 13:08` 🤖 Bom dia! Agendado!
- `2026-05-15 16:56` 👤 Boa tarde! Tudo certo?   Peço desculpas, mas tive um problema com o freio do meu carro, e não conseguirei arrumar a tempo para ir na segunda.   Na próxima semana eu mando mensagem para reagendar.   Obrigado! E peço desculpas pelo imprevisto.
- `2026-05-15 17:09` 🤖 Olá boa tarde, como vai?  Agradecemos por sinalizar e estamos a disposição para reagendar.
- `2026-05-21 18:28` 👤 Boa tarde! Tudo certo?
- `2026-05-21 18:29` 🤖 Boa tade! Você deseja agendar uma nova infusão?
- `2026-05-21 18:29` 👤 Sim. Posso ligar?
- `2026-05-21 18:30` 👤 Falo com Marisa?
- `2026-05-21 18:31` 🤖 Estou te ligando!
- `2026-05-21 18:54` 🤖 Oi Yuri! O Dr. Ivan autorizou o pagamento de R$ 4750,00 em 8 vezes.
- `2026-05-21 18:55` 🤖 Infusão agendada para o dia 29/05 as 11:00 hs.
- `2026-05-21 19:03` 👤 Muito obrigado!
- `2026-05-21 19:03` 👤 🙏
- `2026-05-21 19:47` 🤖 Disponha
- `2026-05-29 15:44` 👤 *[imagem]*
- `2026-06-02 19:01` 👤 Boa tarde! Tudo certo?
- `2026-06-02 19:01` 👤 A clínica abrirá nessa sexta?
- `2026-06-02 19:01` 🤖 Boa tarde, Yuri. Tudo bem?
- `2026-06-02 19:01` 🤖 Sim, vamos abrir normalmente.
- `2026-06-02 19:04` 👤 Tudo sim
- `2026-06-02 19:07` 👤 Consigo agendar a próxima infusão às 11:00 nessa sexta?
- `2026-06-02 19:07` 🤖 Sim!
- `2026-06-02 19:07` 🤖 Agendado!
- `2026-06-02 19:09` 👤 Posso confirmar amanhã cedo? Preciso ver se meu pai vai conseguir ir comigo.
- `2026-06-02 19:09` 🤖 Sim! Sem problemas!
- `2026-06-11 19:27` 👤 Boa tarde
- `2026-06-11 19:27` 👤 Tudo certo?
- `2026-06-11 19:27` 👤 A clínica funciona aos sábados?
- `2026-06-11 19:28` 🤖 Boa tarde, Yuri!
- `2026-06-11 19:28` 🤖 Não atendemos aos sábados!
- `2026-06-11 19:34` 👤 Amanhã funciona até que horas?
- `2026-06-11 19:36` 🤖 De segunda a quinta das 07:30 as 15:30 As sextas feiras das 07:30 as 14:30 hs.
- `2026-06-11 19:57` 👤 Ok. Amanhã mando mensagem. Não mandei antes para confirmar a última pois fiquei muito gripado. Peço desculpas.
- `2026-06-11 20:03` 🤖 Fique tranquilo!
- `2026-06-11 20:03` 🤖 Abraços!

</details>


### Isabelli Alves — `5511986108697`

**Custom fields:** `{"mensagem": "Interesse em cetamina; tentativa de reagendamento para quarta-feira às 11h; data exata não confirmada.", "interesse": "Infusão de Cetamina", "observacoes": "Interesse em cetamina; tentativa de reagendamento para quarta-feira às 11h; data exata não confirmada.", "data_horario": "2026-06-10T13:41:17-03:00", "qualificacao": "em_negociacao", "procedimentos": "Infusão de cetamina", "tento`

**Cenário:** `reagendamento_procedimento_recorrente` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente iniciou protocolo de manutenção de 10 infusões de cetamina. Após realizar consulta de retorno online, enfrentou dificuldades com o convênio (reembolso), cancelando uma sessão inicial, mas reagendando e realizando logo em seguida. Solicitou suporte para receitas e para o aplicativo da clínica. Ao final, solicitou o reagendamento da sessão de sexta-feira para a próxima quarta-feira, às 11h.


**Objeções:** aguardando reembolso do convênio, problemas técnicos com aplicativo da clínica

**Gatilhos:** manutenção de protocolo, conveniência de horário, resolução de pendência de reembolso

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:50` 👤 Obrigada
- `2026-05-21 15:46` 🤖 Boa tarde!
- `2026-05-21 15:46` 🤖 Confirmado retorno online para o dia 25/05 as 12:00 hs.
- `2026-05-21 15:47` 👤 Obrigada
- `2026-05-21 15:48` 👤 Boa tarde
- `2026-05-25 10:56` 🤖 Olá bom dia Isabelli, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-25 10:56` 🤖 Isabelli Alves Batista Pereira da Silva - Dr Ivan Barenboim - 25/05/2026 Segunda-feira, 25 de maio · 12:00 – 12:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/qtf-jwio-gdn
- `2026-05-25 10:59` 👤 Ola bom dia
- `2026-05-25 10:59` 👤 Ok pode deixar
- `2026-05-25 10:59` 👤 Tudo bem e com voce?
- `2026-05-25 15:04` 👤 Ola bom dia
- `2026-05-25 15:04` 👤 Tentei entrar na consulta mas o dr nao me aceitou
- `2026-05-25 15:14` 🤖 Desculpe Isabelli!
- `2026-05-25 15:14` 🤖 Deu certo?
- `2026-05-25 15:23` 🤖 Olá boa tarde Isabelli, como vai? Fomos informadas de sua recomendação ao protocolo de manutenção, que são 10 infusões. Vamos agendar sua primeira infusão desse novo protocolo?
- `2026-05-25 15:25` 👤 Tudo bem e vc?
- `2026-05-25 15:25` 👤 Serao 10 infusoes de 1x por semana?
- `2026-05-25 15:27` 🤖 As 4 primeira são semanais e após reavaliação do Dr, as outras 6 serão quinzenais caso seja recomendado dessa forma.
- `2026-05-25 15:27` 👤 Ta bom
- `2026-05-25 15:28` 👤 Deixa eu só ver com a minha vó qnd ela pode essa semana e eu ja te informo
- `2026-05-25 15:28` 👤 Um momento
- `2026-05-25 16:28` 👤 Quero agendar pra quarta feira por gentileza
- `2026-05-25 16:29` 👤 No horario das 11:30 por gentileza
- `2026-05-25 17:33` 🤖 Olá boa tarde Isabelli, agendado para quarta feira dia 27/05 as 11h30. Seguimos disposição.
- `2026-05-26 14:09` 👤 Ola bom dia
- `2026-05-26 14:09` 👤 Td bem?
- `2026-05-26 14:09` 👤 Eu vou precisar desmarcar a cetamina dessa semana
- `2026-05-26 14:09` 👤 A gente ta resolvendo com o convenio a questao do reembolso
- `2026-05-26 14:10` 👤 Voce pode desagendar por enquanto, por gentileza
- `2026-05-26 14:12` 🤖 Bom dia!
- `2026-05-26 14:12` 🤖 Tudo bem!
- `2026-05-26 14:13` 👤 Eu te informo assim que der pra agendar
- `2026-05-26 14:13` 👤 Talvez sexta ja da mas eu te informo certinho
- `2026-05-26 14:13` 👤 Pode ser?
- `2026-05-26 14:13` 🤖 Sem problemas!
- `2026-05-26 14:13` 👤 Eu agradeço
- `2026-05-26 14:13` 🤖 Disponha!
- `2026-05-29 02:47` 👤 Ola boa noite, td bem?  Vcs poderiam me enviar a receita nova queno dr passou, por gentileza? Nao consigo ainda acessar o app  Obrigada
- `2026-05-29 02:48` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-29 10:17` 🤖 Bom dia, Isabelli!
- `2026-05-29 10:17` 🤖 Segue a receita
- `2026-05-29 10:17` 🤖 Isabelli.pdf
- `2026-05-29 14:21` 👤 Ola td bem
- `2026-05-29 14:21` 👤 Eu consigo marcar a cetamina pra hoje ainda?
- `2026-05-29 14:21` 👤 Por gentileza
- `2026-05-29 14:22` 👤 Obrigada pelo envio
- `2026-05-29 14:23` 🤖 Olá, Isabelli.
- `2026-05-29 14:23` 🤖 Temos horário as 13:00 hs. Você tem disponibilidade?
- `2026-05-29 14:24` 🤖 Será infusão avulsa ou você fará o protocolo?
- `2026-05-29 14:24` 👤 Tenho sim
- `2026-05-29 14:24` 👤 Eu vou fazer o protocolo
- `2026-05-29 14:24` 👤 Dar sequencia
- `2026-05-29 14:24` 👤 Essa semana seria 1x ne
- `2026-05-29 14:24` 👤 Ai vou fazer
- `2026-05-29 14:24` 👤 Um pouco mais tarde vc tem?
- `2026-05-29 14:25` 🤖 Os horários já estão preenchidos
- `2026-05-29 14:25` 👤 Ta bom
- `2026-05-29 14:25` 👤 Pode ser nesse horario entao
- `2026-05-29 14:25` 👤 Obrigada
- `2026-05-29 14:25` 🤖 Disponha!
- `2026-06-10 10:47` 👤 Olá bom dia
- `2026-06-10 10:47` 👤 Tudo bem?
- `2026-06-10 10:47` 👤 O meu remedio aristab esta acabando, preciso de outra receita dele, por gentileza
- `2026-06-10 10:58` 🤖 Olá bom dia Isabelli, como vai? Iremos solicitar a pessoa responsável e assim que possível te retornamos. Seguimos a disposição.
- `2026-06-10 11:26` 👤 Td bem sim
- `2026-06-10 11:26` 👤 Obrigada 🙏🏻
- `2026-06-10 11:26` 🤖 Disponha 🙏🏽
- `2026-06-10 22:15` 👤 Oii, eu nao consigo entrar no meu app pra pegar a receita, nao sei oq acontece
- `2026-06-10 22:15` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-11 10:55` 🤖 **[ÁUDIO]** Olá, bom dia, Isabelle, tudo bem? Edilene aqui da Clínica Or. É, a gente tinha em PDF, então. Tá bom? Só aguardar um segundinho que eu vou abrir aqui o sistema e já te envio.
- `2026-06-11 11:28` 👤 Bom dia Edi
- `2026-06-11 11:28` 👤 Ta bom muito obrigada
- `2026-06-11 11:28` 👤 Dps gostaria de ver col vc a questão do app
- `2026-06-11 11:30` 🤖 Podemos ver sim a questão do App, quando vier para fazer sua infusão.
- `2026-06-11 11:36` 👤 Ta joia, obrigada
- `2026-06-11 12:41` 🤖 Segue receita médica conforme solicitado.
- `2026-06-11 12:41` 🤖 Receita 10_06_2026 134117.pdf
- `2026-06-12 00:07` 👤 Obrigada 🙏🏻
- `2026-06-12 00:07` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-12 06:56` 👤 Ola bom dia, eu gostaria de resgendar a minha sessao de hoje por gentileza pra semana que vem
- `2026-06-12 11:06` 🤖 Olá bom dia Isabelli, como vai? seria no mesmo dia e horário?
- `2026-06-12 14:58` 👤 Eu vou ver o dia q vai ficar bom
- `2026-06-12 15:10` 🤖 Agradecemos o retorno.
- `2026-06-12 16:04` 👤 Quarta as 11h
- `2026-06-12 16:04` 👤 Por gentileza

</details>


### 5511954800888 — `5511954800888`

**Custom fields:** `{"observacoes": "Lead questionou condições de pagamento e opções de boleto. Disse que aguardava/confirmou possibilidade de pagamento; informou estoque de seringa 60ml.", "tentou_agendar": true, "tentou_pagamento": true}`

**Cenário:** `admin_parceria` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** A conversa trata da negociação de insumos médicos entre a Clínica ÓR e a fornecedora Selma (MEDCOM). Houve o fechamento bem-sucedido de um pedido em 29/05 (cateteres, luvas, extensores) com condição de boleto para 28 dias, após ajustes no orçamento. Houve também uma verificação de pagamento de boleto vencido. Em junho, a clínica tentou cotar epinefrina e seringas de 60ml, mas barrou na quantidade mínima e falta de estoque, respectivamente.


**Objeções:** falta de estoque de itens específicos (Amiodarona, seringa 60ml), quantidade mínima de venda (Epinefrina somente cx com 100)

**Gatilhos:** faturamento via boleto, disponibilidade de estoque, orçamento de insumos médicos

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:50` 👤 *Selma MEDCOM*: Obrigada e ótimo feriado prolongado
- `2026-05-12 14:42` 🤖 Olá bom dia Selma como vai? Vocês trabalham com Amidarona 3 mg/ml?
- `2026-05-12 14:57` 👤 *Selma MEDCOM*: oi Edilene
- `2026-05-12 14:57` 👤 *Selma MEDCOM*: bom dia
- `2026-05-12 14:57` 👤 *Selma MEDCOM*: estou bem e vc?
- `2026-05-12 14:57` 👤 *Selma MEDCOM*: amiodarona está em falta
- `2026-05-12 15:09` 🤖 Obrigada pelo retorno
- `2026-05-12 16:13` 👤 *Selma MEDCOM*: imagina
- `2026-05-29 13:25` 🤖 Olá bom dia, como vai? Por gentileza poderia me enviar o orçamento desses itens.
- `2026-05-29 13:25` 🤖 10 caixas com 25 unidades de seringa de 60ml  3 caixas de cloridrato de ondacentrona 2mg/ml 4 caixas de luvas de procedimento sem pó Tam P 4 pacotes de algodão bola 5 cx com 50 unidades de cateter 22 safelet 5 cx de cateter 24 safelet 300 extensor 40 cm 300 extensor multivias com clamp ( médix) 1cx de seringa de 1ml com agulha 08 fita micropore 10cmx10m
- `2026-05-29 13:34` 👤 *Selma MEDCOM*: prontinho
- `2026-05-29 13:35` 👤 *Selma MEDCOM*: seringa 60ml não temos
- `2026-05-29 13:35` 👤 *Selma MEDCOM*: algodao bola não temos
- `2026-05-29 13:35` 👤 Orçamento_29-05-2026CLINICA OHR PSIQUIATRIA - 40.pdf
- `2026-05-29 17:46` 🤖 Boa tarde Selma, como vai? No orçamento ficou faltando cateter 24 safet.
- `2026-05-29 17:51` 👤 *Selma MEDCOM*: oie
- `2026-05-29 17:51` 👤 *Selma MEDCOM*: me desculpa
- `2026-05-29 17:51` 👤 *Selma MEDCOM*: vou te enviar atualizado
- `2026-05-29 17:51` 👤 Orçamento_29-05-2026CLINICA OHR PSIQUIATRIA - 40 (1).pdf
- `2026-05-29 17:58` 🤖 Imagina. Selma poderia tirar a seringa de insulina do orçamento por gentileza?
- `2026-05-29 17:59` 👤 *Selma MEDCOM*: claro
- `2026-05-29 17:59` 👤 Orçamento_29-05-2026CLINICA OHR PSIQUIATRIA.pdf
- `2026-05-29 18:11` 🤖 Selma pode fechar o pedido.
- `2026-05-29 18:12` 👤 *Selma MEDCOM*: voce quer BOLETO 21/28/35/42 BOLETO 28/35/42/49 BOLETO 28 DIAS?
- `2026-05-29 18:13` 🤖 28 dias
- `2026-05-29 18:13` 👤 *Selma MEDCOM*: OK
- `2026-05-29 18:13` 👤 *Selma MEDCOM*: Edilene, tem um boleto que venceu
- `2026-05-29 18:13` 👤 *Selma MEDCOM*: você sabe se ja foi pago?
- `2026-05-29 18:13` 👤 PV-55557-1.pdf
- `2026-05-29 18:13` 🤖 Selma vou verificar
- `2026-05-29 18:14` 👤 *Selma MEDCOM*: venceu ontem
- `2026-05-29 19:12` 🤖 Selma verifiquei com o financeiro e o pagamento foi efetuado hoje.
- `2026-05-29 19:20` 👤 *Selma MEDCOM*: Perfeito, obrigada!
- `2026-05-29 19:21` 🤖 Disponha
- `2026-06-08 17:32` 🤖 Olá boa tarde Selma, como vai? Você teriam ampolas de epinefrina 1mg/ml?
- `2026-06-08 17:39` 👤 *Selma MEDCOM*: Ola
- `2026-06-08 17:39` 👤 *Selma MEDCOM*: boa tarde
- `2026-06-08 17:39` 👤 *Selma MEDCOM*: estou bem e vc?
- `2026-06-08 17:40` 👤 *[imagem]*
- `2026-06-08 17:40` 🤖 Vocês não vendem com 50 unidades?
- `2026-06-08 17:42` 👤 *Selma MEDCOM*: não, somente com 100 unidades
- `2026-06-08 17:44` 🤖 Certo, vou verificar se encontro por unidade.
- `2026-06-08 17:45` 👤 *Selma MEDCOM*: Esta bem Edilene qualquer coisa estamos a disposição
- `2026-06-08 17:45` 🤖 Obrigada
- `2026-06-08 17:47` 👤 *Selma MEDCOM*: imgina
- `2026-06-12 15:36` 🤖 28 dias.
- `2026-06-12 15:36` 👤 *Selma MEDCOM*: qual condição de pagamento?
- `2026-06-12 15:36` 🤖 Pode sim
- `2026-06-12 15:36` 👤 *Selma MEDCOM*: posso seguir sem?
- `2026-06-12 15:36` 👤 *Selma MEDCOM*: seringa 60ml acabou 😥
- `2026-06-12 15:36` 👤 *Selma MEDCOM*: boleto 21/28/35/42 boleto 28/35/42/49 boleto 21/42?
- `2026-06-12 15:36` 👤 *Selma MEDCOM*: ok

</details>


### Andressa Martins — `5511942047737`

**Custom fields:** `{"observacoes": "Lead marcou cetamina, mas não pode ir hoje por não ter acompanhante; manter contato para reagendar.", "qualificacao": "interessado", "tentou_agendar": true, "demonstrou_interesse": true, "procedimento_interesse": "cetamina"}`

**Cenário:** `cancelamento_por_falta_de_acompanhante` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Andressa Martins entrou em contato para avisar que não conseguiria comparecer à sessão de cetamina agendada para o dia por falta de acompanhante. O bot confirmou o recebimento do aviso de forma cordial, mas não propôs imediatamente uma nova data. A paciente demonstrou compromisso ao avisar sobre o imprevisto, mantendo o interesse no tratamento.


**Objeções:** Falta de acompanhante para o dia do procedimento

**Gatilhos:** Tratamento com Cetamina, Responsabilidade com agendamento (avisou antecedência)

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:51` 🤖 Agendado!
- `2026-06-12 11:37` 👤 Olá, bom dia!
- `2026-06-12 11:37` 👤 Tudo bem ?
- `2026-06-12 11:37` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 11:43` 👤 Ok
- `2026-06-12 12:35` 👤 Olá ? Hoje vocês estão em atendimento ?
- `2026-06-12 12:56` 👤 Oii, me perdoa
- `2026-06-12 12:56` 👤 Eu marquei a cetamina, mas como hoje não vou conseguir ter acompanhante, não vou conseguir ir
- `2026-06-12 13:02` 🤖 Certo, sem problemas, agradecemos por sinalizar, seguimos a disposição.
- `2026-06-12 13:31` 👤 Muito obrigada!

</details>


### 5511981218171 — `5511981218171`

**Custom fields:** `{"mensagem": "Lead Daniel já realiza infusão de cetamina em outra clínica e está na fase de manutenção; está buscando novas clínicas para conhecer condições. Demonstrou interesse em agendar uma consulta; tentou agendar.", "observacoes": "Lead Daniel já realiza infusão de cetamina em outra clínica e está na fase de manutenção; está buscando novas clínicas para conhecer condições. Demonstrou interes`

**Cenário:** `cotacao_paciente_em_tratamento` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead Daniel, que já realiza manutenção com infusão de cetamina em outra clínica, entrou em contato buscando conhecer as condições da Clínica Ór. Ele confirmou preferência pela via endovenosa e demonstrou forte interesse inicial em agendar, mas após a troca de informações técnicas, informou que precisaria verificar a agenda e retornaria. O agendamento ainda não foi concretizado.


**Objeções:** Verificar agenda

**Gatilhos:** Experiência prévia com cetamina, Busca por condições melhores, Uso endovenoso

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:51` 🤖 Combinado! Muito obrigada!
- `2026-05-15 16:06` 🤖 Boa tarde. Tudo bem?
- `2026-05-15 16:07` 🤖 Você ainda tem interesse em fazer o tratamento de cetamina?
- `2026-06-12 15:35` 👤 Vou verificar minha agenda e te retorno
- `2026-06-12 15:35` 👤 Entendi
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 👤 [Áudio]
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 🤖 Endovenosa!
- `2026-06-12 15:35` 👤 A infusao é endovenosa, ou subcutanea ?
- `2026-06-12 15:35` 👤 Entendido.
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 🤖 [Áudio]
- `2026-06-12 15:35` 👤 Daniel
- `2026-06-12 15:35` 🤖 Qual é o seu nome?
- `2026-06-12 15:35` 👤 Eu faco infusao de cetamina em outra clinica, e ja estou na fase de manutencao, entao tenho procurado novas clinicas para ver as condicoes.
- `2026-06-12 15:35` 👤 Olá, ainda nao conheco
- `2026-06-12 15:35` 🤖 Você já conhece a Clínica ou o Dr. Ivan?
- `2026-06-12 15:35` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa consultora da Clínica Ór Psiquiatria.
- `2026-06-12 15:35` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 15:35` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór

</details>


### Marcia Lunas — `5518996746510`

**Custom fields:** `{"origem": "Redes Sociais", "interesse": "Consulta com psiquiatria", "procedimentos": ["Primeira Consulta"]}`

**Cenário:** `aguardando_retorno_logistica_paciente` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Márcia buscou atendimento para o esposo, que enfrenta problemas graves com álcool e depressão há 7 anos. Ela demonstrou alto interesse devido aos conteúdos do Dr. Ivan e ao Método Sinclair. O principal entrave é a profissão do esposo (caminhoneiro), que está em viagem, impedindo a confirmação imediata da data. O preço foi aceito, a teleconsulta é viável, e a lead prometeu retornar assim que ele chegar.


**Objeções:** Logística (paciente viajando a trabalho), Necessidade de alinhar com o esposo (paciente real)

**Gatilhos:** Pioneirismo no Método Sinclair, Experiência do Dr. Ivan em alcoolismo, Possibilidade de teleconsulta, Reembolso de plano de saúde

<details><summary>Transcrição completa</summary>

- `2026-05-21 14:37` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=463770e30a)
- `2026-05-21 14:37` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-21 14:38` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-05-21 14:38` 🤖 Márcia, você já é paciente ou seria a primeira vez?
- `2026-05-21 14:39` 👤 Olá Marisa, bom dia. É pro meu esposo, e será a primeira vez.
- `2026-05-21 14:40` 👤 Estou fazendo esse primeiro contato para saber sobre o valor da consulta, uma previsão do agendamento? Pq meu esposo é caminhoneiro e moramos no MS, a consulta pode ser online?
- `2026-05-21 14:45` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-05-21 14:48` 👤 Ok. O Marcos já está sofrendo com os efeitos de beber sem limites há uns 7 anos mas, depois que veio a Depressão por perdas familiares, ficou pior. Nosso casamento praticamente chegou ao fim e só estou aqui hoje pq foi uma condição que ele procurasse ajuda. Pelos 25 anos que estamos juntos estou disposta a ajudá-lo enfrentar essa doença definitivamente.
- `2026-05-21 14:50` 👤 Ele até hoje só fez promessas vazias, de 3 a 4 semanas voltava a beber novamente, sempre foi assim
- `2026-05-21 14:50` 👤 tentamos o adesivo e abstinência algumas vezes mas não funcionou
- `2026-05-21 14:51` 👤 Agora ele está a ponto de perder o emprego tbm, se continuar, pq esta perdendo viagens por causa do alcool
- `2026-05-21 14:52` 👤 Ele precisa de ajuda emocional mas não toma nenhum medicamento pq tem medo
- `2026-05-21 14:53` 👤 e beber só piora
- `2026-05-21 14:53` 👤 é isso
- `2026-05-21 14:59` 🤖 **[ÁUDIO]** Olá, Márcia, aqui quem fala é Marisa, tudo bem? 
Márcia, imagino que não deve ser nada fácil passar por isso. Realmente este problema atrapalha muito a vida da pessoa e de toda a família.
- `2026-05-21 14:59` 🤖 **[ÁUDIO]** Eu acredito realmente que você está buscando ajuda no lugar certo, porque o Dr. Ivan, ele tem vasta experiência com este tipo de problema e ele tem sido pioneiro no Brasil ao utilizar o método Sinclair.
- `2026-05-21 14:59` 🤖 **[ÁUDIO]** Ele já ajudou centenas de pessoas na mesma situação que seu esposo a voltarem a ter controle sobre o consumo do álcool e também a retomar o controle da vida, de forma geral. Se você quiser, eu posso mandar para você os depoimentos de alguns pacientes para que você tenha informação.
- `2026-05-21 14:59` 🤖 **[ÁUDIO]** Ele também vai explicar como funciona o método Sinclair e da forma correta, né, para aumentar a chance do paciente voltar realmente a ter qualidade de vida.
- `2026-05-21 14:59` 🤖 **[ÁUDIO]** E como é que funciona o tratamento? Na primeira consulta, que pode ser teleconsulta sem problemas, tá bom? O doutor vai avaliar o caso de maneira abrangente e vai indicar o melhor tratamento, tanto para o problema do álcool e também se tiver problemas de saúde mental.
- `2026-05-21 15:00` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-21 15:02` 🤖 Temos horário dia 25/05 as 11:30 hs. Vocês tem disponibilidade?
- `2026-05-21 15:04` 👤 Eu ja tinha visto bastante material do Dr. Ivan nas redes sociais, por isso procurei por vcs. Só não vou confirmar essa consulta hoje pq ele esta fora, em viagem, mas qdo chegar, vamos conversar e te dou retorno.
- `2026-05-21 15:04` 👤 Fiquei feliz pela data, achei que ia demorar mais pra conseguir.
- `2026-05-21 15:05` 👤 Deus abençoe pela atenção, volto a falar com vc na segunda ou terça feira ok, vou esperar ele chegar
- `2026-05-21 15:05` 👤 Obrigada Marisa
- `2026-05-21 15:05` 🤖 Disponha Marcia! Estamos a disposição!
- `2026-05-21 15:06` 🤖 Ótimo final de semana!
- `2026-05-21 15:06` 👤 igualmente
- `2026-05-27 17:55` 🤖 Olá Marcia. Como vai?
- `2026-05-27 17:56` 🤖 Estou entrando em contato para verificar se podemos dar continuidade ao agendamento da consulta do seu esposo?
- `2026-05-27 17:56` 👤 olá, boa tarde. Vou bem, obrigada e vc?
- `2026-05-27 17:57` 👤 ele está em Camapuã, puxando uma transferencia de gado lá. Assim que terminar e voltar eu te falo.
- `2026-05-27 17:59` 🤖 Ótimo! Muito obrigada!
- `2026-05-27 17:59` 🤖 Abraços!

</details>


### Cadu — `5511986038490`

**Cenário:** `sumiu_apos_cotacao` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead (Cadu) buscou informações sobre EMT para depressão e ansiedade refratárias, mencionando também interesse em cetamina. A atendente explicou o protocolo de 40 sessões (20 dias), preço (R$ 250/sessão) e ofereceu isenção da consulta caso o tratamento seja fechado. O lead demonstrou interesse, mas não agendou por estar em Minas Gerais, prometendo retornar o contato após o dia 11 quando planeja ir a SP.


**Objeções:** Logística/Distância (está em Minas Gerais)

**Gatilhos:** Preço acessível, Protocolo acelerado (20 dias), Reembolso via nota fiscal, Abatimento do valor da consulta no tratamento

<details><summary>Transcrição completa</summary>

- `2026-06-01 16:59` 👤 Ola, td bem?
- `2026-06-01 16:59` 👤 Gostaria de saber quanto ficam as sessões de emt
- `2026-06-01 17:00` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-01 17:06` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-01 17:06` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-01 17:08` 👤 Eu tenho depressao/ansiedade refratária e to investigando TAB e TDAH. Tb mta insônia
- `2026-06-01 17:08` 👤 Já tive indicação de emt
- `2026-06-01 17:08` 👤 E cetamina tb
- `2026-06-01 17:10` 🤖 Entendi. Deve ser bem difícil passar por isso.
- `2026-06-01 17:10` 🤖 É a primeira vez que você busca ajuda ou você já fez algum  tratamento para depressão anteriormente?
- `2026-06-01 17:17` 👤 Já tentei várias medicações
- `2026-06-01 17:17` 👤 Desde 2020
- `2026-06-01 17:17` 👤 Nada resolve
- `2026-06-01 17:20` 🤖 Certamente, você está precisando de algum tratamento mais eficaz que possa realmente te ajudar a sair dessa situação.
- `2026-06-01 17:20` 🤖 Já conseguimos ajudar muitas pessoas em situações semelhantes a sua.
- `2026-06-01 17:21` 🤖 Apesar de utilizarmos equipamento de última geração e protocolos inovadores extremamente eficazes, nosso preço é o mais baixo da cidade, pois acreditamos que esse avanço no tratamento da depressão tem que ser cada vez mais acessível aos que dele necessitam.
- `2026-06-01 17:21` 🤖 O preço por sessão para tratamentos de depressão fica R$250,00. Normalmente, o doutor indica 40 sessões.
- `2026-06-01 17:21` 🤖 Parcelamos no cartão em até 6x e emitimos nota para reembolso.
- `2026-06-01 17:21` 🤖 Este pacote ainda inclui uma consulta de reavaliação com o Dr. ao final dele.
- `2026-06-01 17:21` 🤖 Mas, não precisa decidir nada agora sobre o tratamento. Recomendo que marque uma consulta com o Dr. Ivan.
- `2026-06-01 17:21` 🤖 O Dr. Ivan reserva 1 hora para entender tudo, tirar suas dúvidas, definir a conduta em conjunto com você e fazer a prescrição do tratamento indicado.
- `2026-06-01 17:21` 🤖 Pode ser?
- `2026-06-01 17:22` 🤖 Caso você feche o tratamento logo após a consulta, a mesma nem será cobrada.
- `2026-06-01 17:23` 🤖 Temos horário disponível amanhã as 11:00 hs. Você tem disponibilidade?
- `2026-06-01 17:46` 👤 Entendi
- `2026-06-01 17:47` 👤 E em quanto tempo eh feita as 40 sessões?
- `2026-06-01 17:48` 🤖 20 dias! Duas sessões por dia. Cada sessão dura 15 minutos e é preciso um intervalo de uma hora entre as sessões.
- `2026-06-01 18:25` 👤 E da pra fazer todos os dias, segunda a sexta?
- `2026-06-01 18:27` 🤖 Sim!
- `2026-06-01 18:28` 🤖 Nosso horário de atendimento é das 07:30 as 15:30 hs de segunda a quinta e as 07:30 as 14:30 hs as sextas feiras.
- `2026-06-01 18:29` 🤖 Vamos agendar uma consulta? Você passa com o Dr. Ivan e verifica se este realmente é o melhor tratamento para você.
- `2026-06-01 18:30` 👤 Vou dar uma pensada
- `2026-06-01 18:30` 🤖 O que você achou de tudo que lhe falei?
- `2026-06-01 19:07` 👤 Eu gostei… eu tô em Minas, talvez eu vá pra sp após o dia 11
- `2026-06-01 19:08` 👤 Te chamo aqui pra agendar
- `2026-06-01 19:08` 🤖 Estamos a disposição!

</details>


### EDUARDO — `5511993765319`

**Custom fields:** `{"tentou_agendar": true, "tentou_pagamento": true, "demonstrou_interesse": true}`

**Cenário:** `admin_parceria` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=True


**Síntese:** Nesta interação, a Clínica ÓR atuou como tomadora de serviço (cliente) e o Lead (Eduardo) como prestador de serviços de calibração. A clínica buscou o agendamento de um orçamento solicitado anteriormente. Após o envio da cotação e alinhamento de agenda, o serviço foi agendado para o dia 15/06 às 13h. O lead executou a calibração, enviou a nota fiscal e confirmou a conclusão do trabalho.


**Objeções:** Disponibilidade de agenda do prestador, Dúvida sobre pagamento antecipado

**Gatilhos:** Solicitação de serviço de calibração, Urgência no serviço

<details><summary>Transcrição completa</summary>

- `2026-06-01 18:27` 🤖 Olá boa tarde, como vai?
- `2026-06-01 18:28` 🤖 É da Raek calibração?
- `2026-06-01 18:28` 👤 Boa tarde
- `2026-06-01 18:29` 👤 Bem e vc ?
- `2026-06-01 18:29` 👤 Correto
- `2026-06-01 18:29` 🤖 Solicitei um orçamento no dia 27/05 e ainda não tive retorno.
- `2026-06-01 18:30` 👤 Solicitou para qual email ?
- `2026-06-01 18:30` 🤖 Vendas@raekcalibracao.com.br
- `2026-06-01 18:31` 👤 Sabe o horário para eu puxar aqui
- `2026-06-01 18:31` 🤖 27 de mai. de 2026, 15:16
- `2026-06-01 18:32` 🤖 clinicaohr@gmail.com
- `2026-06-01 18:35` 👤 Não chegou para nós...pode encaminhar novamente por favor
- `2026-06-01 18:36` 👤 Que estou no email e já confirmo
- `2026-06-01 18:41` 🤖 Acabei de enviar
- `2026-06-01 18:48` 🤖 Recebeu?
- `2026-06-01 18:58` 👤 Respondi para vc
- `2026-06-01 18:59` 👤 Chegou a ver ?
- `2026-06-01 19:00` 🤖 Sim me pediu os dados cadastrais
- `2026-06-01 19:00` 🤖 Já enviei o CNPJ e endereço, precisa de mais alguma informação.
- `2026-06-01 19:04` 👤 Não...só isso
- `2026-06-12 15:42` 🤖 Olá boa tarde, falei com Eduardo pelo telefone e me solicitou o endereço da Clínica para me enviar um orçamento, segue nosso endereço e CNPJ. Tenho uma certa urgência no serviço.
- `2026-06-12 15:43` 👤 Boa tarde
- `2026-06-12 15:43` 👤 O orçamento foi enviado
- `2026-06-12 15:43` 👤 Segue o mesmo
- `2026-06-12 15:43` 👤 0525-2026-00.pdf
- `2026-06-12 15:43` 👤 Acredito que seja esse
- `2026-06-12 15:44` 👤 Se for. .já foi enviado no mesmo dia
- `2026-06-12 15:44` 👤 01/06
- `2026-06-12 15:44` 🤖 Orçamento aprovado, teria disponibilidade para segunda feira?
- `2026-06-12 15:44` 👤 Preciso ver na agenda....mas acredito que não...está muito em cima...todos os técnicos já estão na rua
- `2026-06-12 15:45` 👤 Tenho para semana que vem. ..mas preciso ver o dia certinho
- `2026-06-12 15:49` 👤 Pode ser na parte da tarde ?
- `2026-06-12 15:49` 👤 Umas 13 horas ?
- `2026-06-12 15:50` 🤖 Sim pode ser.
- `2026-06-12 15:50` 👤 Ok..agendado então
- `2026-06-12 15:51` 👤 Para segunda feira a tarde
- `2026-06-12 15:51` 👤 Chegou a ver a forma de pagamento...? Tudo certo Neh ?!
- `2026-06-12 16:01` 🤖 **[ÁUDIO]** Oi, tudo bem? Eu vi sim a forma de pagamento, o valor do orçamento, porém, tem que pagar antes? Ali eu não consegui localizar se eu tenho que fazer o pagamento antecipado ou ele é feito após a execução do serviço.
- `2026-06-12 16:04` 👤 Após a execução do serviço...
- `2026-06-12 16:05` 👤 Assim que realizar o pagamento já enviamos por email o certificado
- `2026-06-12 16:05` 🤖 Certo, então fica agendado para segunda feira as 13h
- `2026-06-12 16:06` 👤 Entre 13 e 14 horas devemos chegar por aí ...  Até mais   Bom final de semana
- `2026-06-12 16:08` 🤖 Obrigada.
- `2026-06-15 18:09` 👤 Boa tarde
- `2026-06-15 18:09` 👤 NFe-4115 CLINICA OHR.pdf
- `2026-06-15 18:09` 👤 Serviço efetuado com experiência tô
- `2026-06-15 18:09` 👤 Segue a nota fiscal

</details>


### Mari — `556799812131`

**Cenário:** `resistencia_paciente_familiar_intermediario` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Mari Inês busca tratamento para o filho de 31 anos, diagnosticado com transtorno bipolar e ideação suicida em Campo Grande-MS. Demonstrou forte interesse em Cetamina após explicação de preços e protocolos. No entanto, o paciente está resistindo à consulta. A atendente sugeriu habilmente uma consulta de orientação para a mãe e a nora, o que foi bem aceito pelo lead, mas o agendamento ainda não foi concretizado devido a conflitos de horário.


**Objeções:** Resistência do paciente ao tratamento/consulta, Distância geográfica (mora em MS)

**Gatilhos:** Tratamento de depressão resistente, Uso de Cetamina/Escetamina, Especialidade em Bipolaridade, Teleconsulta, Urgência/Ideação Suicida

<details><summary>Transcrição completa</summary>

- `2026-06-03 00:39` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=97c0b4699a)
- `2026-06-03 00:39` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-03 12:09` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa consultora da Clínica Ór Psiquiatria.
- `2026-06-03 12:09` 🤖 Você já é paciente ou seria a primeira vez?
- `2026-06-03 12:10` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=0776018a7c)
- `2026-06-03 12:13` 👤 Bom dia .
- `2026-06-03 12:13` 🤖 Olá Mari!
- `2026-06-03 12:14` 👤 Moro em campo grande ms .
- `2026-06-03 12:14` 👤 Tenho meu filho ele tem 31 anos é bipolar ..ainda não acertaram a medição..
- `2026-06-03 12:15` 👤 Tem como me falar mais sobre o tratamento com o dr .
- `2026-06-03 12:16` 🤖 **[ÁUDIO]** Olá, Mara, tudo bem? Bom dia, Marisa que está falando. Imagino que não deve ser nada fácil passar por isso.
- `2026-06-03 12:17` 👤 Sim é muito triste pois ele é filho unico ja perdeu familia dois filhos  .
- `2026-06-03 12:17` 🤖 **[ÁUDIO]** Mari, eu acredito que você esteja no lugar certo. O Dr. Ivan, que é o responsável pela clínica, tem mais de 15 anos de experiência. Ele é formado pela Universidade Federal do Rio de Janeiro, uma das melhores do Brasil, e ele é especialista em problemas relacionados ao transtorno bipolar, depressão, ansiedade. Então eu creio realmente que ele pode te ajudar. É, nós todos os dias verificamos pessoas que estavam com bastante dificuldade, né, debilitadas e na segunda consulta a gente já percebe que já obteve resultados. Então eu posso te afirmar que você está no lugar certo!
- `2026-06-03 12:18` 🤖 **[ÁUDIO]** O Dr. Ivan, ele... O Dr. Ivan, ele reserva uma hora pra falar com o paciente, entender as necessidades e juntos verificarem quais os procedimentos que seriam melhores no tratamento dele. Então ele é bem atencioso, acompanha o paciente, o que é muito importante. Se você depois precisar falar com ele, entrar em contato, tirar dúvida, ele é super disponível. Então é um atendimento muito maravilhoso mesmo. Eu posso te tranquilizar em relação a isso.
- `2026-06-03 12:19` 🤖 **[ÁUDIO]** O Dr. Ivan faz tratamento tradicional e também faz tratamentos modernos como a escetamina e a estimulação magnética transcraniana, né? 

Eu sei que vocês estão distantes, mas também existe essa possibilidade. E ele faz atendimento online no caso de vocês, né? Sem problema nenhum, eu creio que poderia ajudar bastante no caso do seu filho e… é isso.
- `2026-06-03 12:19` 🤖 **[ÁUDIO]** Nossa, já perdeu dois filhos. Meu Deus. Não, não é nada fácil não. Realmente ele precisa de um cuidado, né? É especializado, algo que realmente possa ajudá-la a sair dessa situação.
- `2026-06-03 12:20` 🤖 **[ÁUDIO]** Nós temos horário com o Dr. Ivan às 10:30 no dia 05, sexta-feira. Vocês têm disponibilidade?
- `2026-06-03 12:20` 🤖 **[ÁUDIO]** Você tem mais alguma dúvida? Algo que eu possa esclarecer, te ajudar?
- `2026-06-03 12:23` 👤 Entendi estava lendo sobre uma vacina
- `2026-06-03 12:29` 🤖 Vacina? Não seria infusão de cetamina?
- `2026-06-03 12:35` 👤 Desculpas seria isso mesmo .
- `2026-06-03 12:36` 👤 Como faz o tratamento
- `2026-06-03 12:37` 🤖 **[ÁUDIO]** Olá, Mari. A princípio, seria interessante ele passar com o Dr. Ivan em consulta para verificar se realmente seria o caso, né, de fazer o tratamento da cetamina. Mas eu vou te explicar direitinho como é que funciona.
- `2026-06-03 12:38` 🤖 **[ÁUDIO]** Normalmente o protocolo inicial do doutor Ivan inicia com oito sessões de cetamina e essas infusões são duas vezes por semana durante quatro semanas.
- `2026-06-03 12:39` 🤖 **[ÁUDIO]** O tratamento, né, da cetamina, ele realmente não é um tratamento comum. É uma novidade, né, no tratamento de depressão das últimas décadas e ele realmente faz bastante diferença, né, na recuperação das pessoas. Nós vemos aqui centenas de pessoas que tiveram retorno efetivo sobre o tratamento. Então, acredito realmente que ele pode ajudar bastante.
- `2026-06-03 12:40` 🤖 **[ÁUDIO]** Quanto aos valores, o tratamento, se você fizer o pacote das oito infusões, o valor da infusão é de R$ 800. Caso você faça a sessão avulsa, aí o valor seria R$ 900. Esse valor pode ser parcelado, o valor do pacote em até seis vezes sem juros, e ainda nós emitimos nota para reembolso. Está incluso também nesse valor do pacote uma consulta de reavaliação com o Doutor Ivan. Então ao final do tratamento haverá uma consulta para poder fazer acompanhamento e ver como é que o paciente se encontra.
- `2026-06-03 12:40` 🤖 **[ÁUDIO]** Eu vou encaminhar para você mais alguns dados sobre o tratamento, né, efetivamente, para que você entenda um pouquinho mais como funciona a cetamina. E se você tiver alguma dúvida também, eu estou à disposição para retirar, tá bom?
- `2026-06-03 12:41` 🤖 Como funciona a Cetamina   O Protocolo Avançado de Infusões de Escetamina consiste em 8 infusões lentas de escetamina com bomba infusora e monitoramento dos sinais vitais. Cada infusão dura 40 minutos.  Em geral, são feitas duas aplicações por semana por quatro semanas.
- `2026-06-03 12:42` 🤖 Como funciona a consulta   O Dr. Ivan reserva uma hora para esta consulta inicial. Assim, ele pode avaliar o seu caso de maneira completa, definir um diagnóstico e decidir, em conjunto com você, a melhor conduta.
- `2026-06-03 12:42` 🤖 Mecanismo de ação da cetamina
- `2026-06-03 12:43` 🤖 A cetamina modula o funcionamento do cérebro de maneira distinta dos outros antidepressivos, pois regula um neurotransmissor diferente dos outros remédios.
- `2026-06-03 12:43` 🤖 Dessa maneira, ela promove a restauração das conexões entre os neurônios e das redes neurais de maneira rápida e eficiente em cerca de 70% dos casos
- `2026-06-03 12:43` 🤖 O que é o tratamento com cetamina?
- `2026-06-03 12:43` 🤖 O Protocolo de Infusões de Escetamina consiste em 8 infusões lentas de escetamina com bomba infusora e monitoramento dos sinais vitais. Cada infusão dura 40 minutos.
- `2026-06-03 12:43` 🤖 O tratamento com cetamina para depressão consiste na aplicação endovenosa de baixas doses deste medicamento sob supervisão e monitoramento hemodinâmico. Este tratamento ajuda rapidamente cerca de 70% das pessoas que sofrem de depressão resistente.
- `2026-06-03 12:43` 🤖 Quais os benefícios do tratamento com cetamina?
- `2026-06-03 12:44` 🤖 Estudos apontam que a taxa de resposta é bem alta( 70%) mesmo para quem não responde ao tratamento convencional. Além disso, ele costuma funcionar mais rápido do que os antidepressivos tradicionais. Alguns já melhoram nos primeiros dias de tratamento.
- `2026-06-03 12:44` 🤖 Outro benefício é a conhecida eficácia da cetamina em reduzir ou eliminar a ideação suicida.
- `2026-06-03 12:44` 🤖 O tratamento é indicado para quem?
- `2026-06-03 12:44` 🤖 Pacientes com Depressão Maior ou Depressão Bipolar que não respondem ao tratamento convencional com medicamentos.
- `2026-06-03 12:44` 🤖 Pacientes com ideação suicida.
- `2026-06-03 12:44` 🤖 Indivíduos que não toleram ou têm receio dos efeitos adversos dos psicotrópicos utilizados no tratamento da depressão.
- `2026-06-03 12:45` 🤖 *[imagem]*
- `2026-06-03 12:45` 🤖 *[imagem]*
- `2026-06-03 12:45` 🤖 *[imagem]*
- `2026-06-03 12:58` 👤 **[ÁUDIO]** Bom dia. Deixa eu passar um áudiozinho que é mais rápido, tudo bem? Prazer, eu sou a Maria Inês, o meu filho se chama Leonardo, esse que é bipolar. Então, ele tem 31 anos e aqui em Campo Grande ele tá, sabe, assim, no antidepressivo, daí não dá certo um, daí vai no psiquiatra de novo, daí troca antidepressivo até fazer efeito, e ele já tá assim numa fase assim de querer morrer, entendeu? Assim... Aí não é vida, né? Digo assim... Aí deles perde tudo, né? Perde família, já separou, tem os dois filhos lindos, já não... Mas tudo bem. Então, eu fico... Só que a gente mora aqui... O que que você me sugere fazer, daí no caso? Aí teria onde ele ficar aí? Lógico, se tivesse um... Não sei como... O que que você me indica, daí, pra fazer esse tratamento? Porque é importante, né? Eu digo assim, hoje em dia tem que buscar tudo isso antes... que vá no fundo do poço, né? E ele está muito assim depressivo, muito... Aí engorda, daí já não toma o remédio, faz três dias, ele deixou de tomar três dias o remédio, ontem já estava, nossa, horrível, sabe? Com a ideia de querer morrer, de não sei o quê, de suicídio, de isso e aquilo. Aí eu vou pedir uma orientação pra você, de como... por onde devemos começar, daí, tá bom? Muito obrigada e agradeço, tá? Aguardo seu retorno.
- `2026-06-03 13:05` 🤖 **[ÁUDIO]** Olá, tudo bem?
- `2026-06-03 13:06` 🤖 **[ÁUDIO]** "Olá! Entendo. Realmente, eu imagino que não deve ser nada fácil passar por isso. Olha, a primeira coisa que eu lhe indico é você realmente passar em consulta, né, seu filho, com o doutor Ivan, porque ele vai verificar qual seria o melhor tratamento para ele e assim ver se seria cetamina, se seria estimulação magnética transcraniana ou se o tratamento tradicional. Então, eu posso lhe dizer que ele é um ótimo especialista, então você pode ficar tranquila em relação a isso. Seu filho vai ser atendido por um especialista que possa realmente ajudá-lo, tá bom? Agora, em relação a ficar aqui em São Paulo, muitas pessoas vêm de outros estados e acabam ficando em hotéis, né, próximos. Eu não posso te dizer qual seria o melhor porque eu realmente não tenho esse conhecimento, mas as pessoas costumam ficar em hotéis próximos. Vamos agendar a consulta? É o primeiro caminho."
- `2026-06-03 13:07` 🤖 **[ÁUDIO]** Como o seu caso é emergencial, nós conseguimos agendar a consulta para hoje, às 17 horas, tá bom? Aí você verifica se vocês têm disponibilidade.
- `2026-06-03 14:55` 🤖 Olá! Ficou com alguma dúvida? Vocês tem disponibilidade para a consulta?
- `2026-06-10 11:38` 👤 Bom dia .
- `2026-06-10 11:39` 👤 Não consegui fazer a consulta pro meu filho . Ele está resistindo de consultar.
- `2026-06-10 11:40` 👤 Acho que devagarinho minha nora vai conseguir ele fazer a consulta junto com ela ..
- `2026-06-10 11:41` 👤 Assim que ele aceitar eu entro em contato novamente ..obrigada bjs 💞
- `2026-06-10 12:03` 🤖 Bom dia, Mari! Como vai?
- `2026-06-10 12:03` 🤖 Entendo! Não tem problemas
- `2026-06-10 12:04` 🤖 Você não acha interessante passar em consulta com o Dr. você e sua nora?
- `2026-06-10 12:05` 🤖 Se você achar interessante, também podemos entrar em contato com seu filho para explicar todo o tratamento!
- `2026-06-10 12:06` 🤖 Estamos interessados no bem estar de nossos pacientes!
- `2026-06-10 12:06` 🤖 Estou a disposição!
- `2026-06-10 12:06` 👤 Sabe que seria interessante não tinha pensado nisso antes .
- `2026-06-10 12:07` 👤 Vou ver com ela um horário
- `2026-06-10 12:07` 👤 Que fique bom ..quantos dias antes pra marcar online
- `2026-06-10 12:08` 👤 Muito obrigada por teu carinho ❤️
- `2026-06-10 12:12` 🤖 Consigo encaixe hoje as 17:00 hs. Vocês tem disponibilidade?
- `2026-06-10 12:12` 👤 Vou ver com ela mais tarde ...
- `2026-06-10 12:13` 🤖 Sem problemas. Aguardo seu retorno até as 14:00 hs ok?
- `2026-06-10 12:15` 👤 👏🏻👏🏻
- `2026-06-10 12:17` 👤 Lembrei as 17 hr eles pegam a filha dela na escola .
- `2026-06-10 12:18` 👤 Vou falar com ela antes aviso ...bjs
- `2026-06-10 12:19` 🤖 ok bjs
- `2026-06-10 12:21` 🤖 Também pode ser as 12:00 hs. Hoje são os únicos horários que consigo fazer encaixe.

</details>


### Rosemary De Andrade — `5519983023277`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "qualificacao": "interessado", "tentou_agendar": true, "demonstrou_interesse": true, "procedimento_interesse": "cetamina"}`

**Cenário:** `reagendamento_procedimento` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Lead solicitou infusão de cetamina, sendo cliente recorrente. Questionou sobre preço e parcelamento (3x), o que foi aceito. Após envio do encaminhamento médico e validação interna, agendou para sexta-feira, mas solicitou reagendamento por não estar se sentindo bem. Após algumas tentativas de ajuste de horário por conta do trabalho, confirmou o procedimento para terça-feira (16/06) às 13h30.


**Objeções:** conflito de horário trabalho

**Gatilhos:** facilidade de parcelamento, cliente recorrente

<details><summary>Transcrição completa</summary>

- `2026-06-10 00:26` 👤 Boa noite. Tudo bem?
- `2026-06-10 00:26` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-10 00:26` 👤 Eu gostaria de marcar uma infusão de cetamina por gentileza?
- `2026-06-10 10:53` 🤖 Olá bom dia Rosemary, como vai?  Gostaria de agendar ou foi engano?
- `2026-06-10 15:04` 👤 Eu  quero marcar uma infusão de cetamina
- `2026-06-10 15:04` 👤 Qual o valor?
- `2026-06-10 15:06` 🤖 O preço por infusão fica R$800,00 caso você feche um pacote de 4 infusões Senão, cada infusão avulsa fica R$900,00.
- `2026-06-10 15:12` 🤖 Você teria encaminhamento atualizado solicitando novas infusões?
- `2026-06-10 15:12` 👤 A psiquiatra vai enviar
- `2026-06-10 15:15` 🤖 **[ÁUDIO]** Oi, Rosimeire, tudo bem? Edilene aqui da Clínica Or. Então, referente a isso, a gente solicita que você nos envie um encaminhamento atualizado. A gente envia para o Dr. Ivan para que ele avalie e nos indique se você pode dar continuidade ou agendar suas infusões, tá bom? A gente fica no aguardo, então, do encaminhamento.
- `2026-06-10 15:15` 👤 Como eu já sou cliente vcs parcelam 1 infusão em 3x
- `2026-06-10 15:16` 🤖 Sim parcelamos.
- `2026-06-10 15:21` 👤 ok, veja como faço,, eles mandam um link para este parcelamento, ou eu gero um cartão virtual e faço o parcelamento, ou outra forma que eles tenham, veja pra gente, como devo proceder este parcelamento
- `2026-06-10 15:21` 👤 Como meu irmão deve proceder?
- `2026-06-10 15:22` 🤖 Podemos gerar o link para o pagamento no cartão de crédito, no valor de 900,00 e parcelamos em até 3x sem juros.
- `2026-06-10 15:28` 👤 Manda o link pro meu irmão PF. Quais os dados que vc precisa? Ou vc já tem?
- `2026-06-10 15:32` 🤖 **[ÁUDIO]** Oi, Rosemeire, tudo bem? A gente pode sim enviar o link para o seu irmão, mas a gente primeiro precisa que o doutor sinalize que você pode retomar as infusões depois que ele verificar o seu encaminhamento atualizado, tá bom? Porque se ele solicitar outra consulta ou algo do tipo, né, a gente precisa da autorização do doutor, mas só por essa questão mesmo. Mas assim que você enviar o encaminhamento atualizado, a gente já tem um retorno do doutor, tá bom?
- `2026-06-11 00:28` 👤 Olá *Rosemary*,  Segue abaixo o link com *Relatório médico* 📃: https://app.tribemd.com/api/documentos/pdf/4447542?uuid=b4991402-88c6-4772-9140-d41b1b44be49  🔐 A autenticidade deste documento pode ser verificada seguindo instruções no PDF.
- `2026-06-11 00:28` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-11 00:29` 👤 Boa noite segue acima o pedido medico pra infusão de cetamina
- `2026-06-11 00:29` 👤 Vc tem na sexta ou no sábado?
- `2026-06-11 00:29` 👤 Ou mesmo na quinta de tarde?
- `2026-06-11 14:26` 🤖 Bom dia, Rosemary!
- `2026-06-11 14:26` 🤖 Pode ser hoje as 14:00 hs?
- `2026-06-11 14:29` 👤 Quais os seus horários de amanhã de manhã?
- `2026-06-11 14:29` 👤 Teria hj mais tarde?
- `2026-06-11 14:39` 🤖 Pode ser hoje as 14:30 hs?
- `2026-06-11 14:54` 👤 Teria mais tarde?
- `2026-06-11 14:54` 🤖 Não!
- `2026-06-11 14:54` 👤 E amanhã de manhã?
- `2026-06-11 14:54` 🤖 Pode ser as 11:00 hs?
- `2026-06-11 14:57` 👤 Perfeito
- `2026-06-11 15:02` 🤖 Agendado!
- `2026-06-12 12:09` 👤 Bom dia. Tudo bem?
- `2026-06-12 12:10` 👤 Vcs poderiam me passar o endereço da clínica por gentileza?
- `2026-06-12 12:12` 👤 Obrigada
- `2026-06-12 12:20` 👤 Eu não amanheci bem
- `2026-06-12 12:21` 👤 Vc tem horário amanhã ou na segunda?
- `2026-06-12 12:33` 👤 Oiê
- `2026-06-12 12:38` 🤖 Rosemary não fazemos atendimento aos sabados.
- `2026-06-12 12:39` 👤 Na segunda vc tem as 11 HS?
- `2026-06-12 12:39` 🤖 Na segunda feira temos horário às 13h30, funciona para você?
- `2026-06-12 12:40` 👤 Tem que ser mais cedo. Esse horário eu entro no trabalho
- `2026-06-12 12:47` 🤖 Temos horário as 10h30 na segunda, funciona para você?
- `2026-06-12 12:49` 👤 Posso chegar 15 min atrasada?
- `2026-06-12 12:49` 👤 Ou Terça de tarde tem algum horário?
- `2026-06-12 12:51` 🤖 Na terça feira temos horário as 13h30, seria melhor para você?
- `2026-06-12 12:55` 👤 Pode ser sim na terça
- `2026-06-12 13:04` 🤖 Certo, reagendado para terça feira dia 16/06 as 13h30. Seguimos a disposição.
- `2026-06-12 16:58` 👤 Obrigada
- `2026-06-16 15:47` 👤 PF passa o endereço pra mim por gentileza
- `2026-06-16 15:48` 👤 Oiê

</details>


### ROSSANA — `554399953830`

**Custom fields:** `{"mensagem": "Lead disponível para agendar primeira_consulta com Dr. Ivan; confirmou agendamento para 01/07; dados cadastrais solicitados (nome, cpf, etc.).", "interesse": "Consulta com psiquiatria", "observacoes": "Lead disponível para agendar primeira_consulta com Dr. Ivan; confirmou agendamento para 01/07; dados cadastrais solicitados (nome, cpf, etc.).", "qualificacao": "interessado", "procedi`

**Cenário:** `agendou_apos_objecao_preco` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A lead Rossana buscou atendimento psiquiátrico para tratar depressão e ansiedade. Inicialmente apresentou objeções relacionadas ao valor da consulta (R$ 750,00), tentou negociar desconto para pagamento à vista e questionou a frequência dos retornos por preocupação financeira. Após esclarecimentos da consultora, a lead optou por agendar para o início de suas férias, confirmando a consulta para 01/07.


**Objeções:** Preço alto, Disponibilidade de horário (trabalho), Frequência das consultas (custo recorrente)

**Gatilhos:** Doutor renomado, Necessidade de ajuda especializada, Emissão de nota para reembolso, Especialista em depressão resistente

<details><summary>Transcrição completa</summary>

- `2026-06-11 13:48` 👤 Bom dia
- `2026-06-11 13:48` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-11 14:06` 👤 Olá, Por gentileza,  qual o valor da consulta com Doutor Ivan?
- `2026-06-11 14:06` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa consultora da Clínica Ór Psiquiatria.
- `2026-06-11 14:07` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-11 14:10` 👤 Tenho depressão,  com sentimentos de culpa; incapacidade de me organizar com o trabalho e com a casa, principalmente. Estou com muita ansiedade.
- `2026-06-11 14:10` 👤 Enfim, está difícil.
- `2026-06-11 14:18` 🤖 **[ÁUDIO]** Bom dia, Rossana, Marisa que está falando. Imagino que não deve ser nada fácil passar por tudo isso, realmente. Você está precisando de uma ajuda especializada, né, que possa te ajudar a sair dessa situação.
- `2026-06-11 14:19` 🤖 **[ÁUDIO]** O doutor Ivan tem mais de 15 anos de experiência e ele é especialista em depressão resistente. Então, ele realmente vai poder te ajudar bastante nesse caso. E ele reserva uma hora para fazer uma consulta, explicar para você os procedimentos, verificar as suas queixas e junto com você, verificar qual seria o melhor procedimento, né? Ele faz tratamento tradicional e também faz tratamento inovadores, como a cetamina e a estimulação magnética transcraniana.
- `2026-06-11 14:19` 🤖 **[ÁUDIO]** Nós temos horário com o Dr. Ivan agora, no dia 15? Você tem disponibilidade?
- `2026-06-11 14:19` 🤖 **[ÁUDIO]** Quanto ao valor, o valor da consulta do doutor é de R$ 750,00 e você pode parcelar em três vezes no cartão sem juros e nós emitimos nota para reembolso.
- `2026-06-11 14:19` 🤖 **[ÁUDIO]** Você tem disponibilidade para consulta?
- `2026-06-11 14:23` 👤 Olá Marisa,   Primeiramente,  agradeço pelo retorno.  Ouvi falar muito bem do Doutor Ivan.  Dia 15 agora eu não posso.
- `2026-06-11 14:28` 👤 A consulta é mensal? Ou é possível, depois do primeiro atendimento,  retornar à consulta em 60 dias? O Doutor prescreveria medicação desta forma?
- `2026-06-11 14:29` 👤 Consulta à vista, sem necessidade de recibo, é possível desconto?
- `2026-06-11 14:30` 👤 Consulta "on line" é o mesmo valor?
- `2026-06-11 14:37` 🤖 **[ÁUDIO]** Olá, vamos responder aqui à sua pergunta. Normalmente, o doutor vai verificar com você qual vai ser o procedimento de voltar às consultas, tá? Em alguns casos ele coloca mensal, em alguns casos 60 dias, então depende muito de como você está. É só passar em consulta mesmo para ter certeza.
- `2026-06-11 14:38` 🤖 **[ÁUDIO]** A consulta à vista não tem desconto, tá? É o mesmo valor. Não tem desconto. E a consulta online também é o mesmo valor do que a consulta presencial.
- `2026-06-11 14:39` 👤 Sim, perfeito.
- `2026-06-11 14:39` 👤 Está certo.
- `2026-06-11 14:41` 🤖 Você tem disponibilidade dia 16/06?
- `2026-06-11 14:57` 👤 Como eu trabalho,  tenho que conversar com minha chefe, para me liberar.  Entro em férias a partir do dia 30 de junho. Aí fica mais tranquilo.
- `2026-06-11 15:05` 🤖 Podemos marcar para o dia 01/07? O Dr. Ivan tem a agenda bem requisitada, então não seria exagero já fazer o agendamento.
- `2026-06-11 15:07` 👤 Sim, pode agendar.
- `2026-06-11 15:10` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: CPF: Data de nascimento: RG: Profissão: E-mail: Tel/Cel: CEP: Endereço completo : Profissão: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):

</details>


### Kamila Nunes 🦋 — `5511975527998`

**Custom fields:** `{"observacoes": "Lead deseja agendar primeira consulta com Dr. Ivan; forneceu email ivanbaren@gmail.com durante a troca.", "qualificacao": "interessado", "tentou_agendar": true, "demonstrou_interesse": true, "procedimento_interesse": "primeira_consulta"}`

**Cenário:** `representante_comercial_ou_parceria` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=True


**Síntese:** O lead entrou em contato solicitando agendamento com o Dr. Ivan. O atendimento identificou o perfil como representante comercial (não como paciente). Foi informado que o médico não recebe representantes presencialmente e o lead aceitou realizar a apresentação por e-mail. O endereço de e-mail foi fornecido e a interação finalizada.


**Objeções:** bloqueio_agenda_para_representantes

**Gatilhos:** contato_direto_com_medico

<details><summary>Transcrição completa</summary>

- `2026-06-12 13:10` 👤 Olá! Gostaria de agendar uma consulta com o Dr. Ivan.
- `2026-06-12 13:14` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 13:15` 🤖 **[ÁUDIO]** Bom dia, tudo bem? O Dr. Ivan não recebe representantes. Ele não recebe. Se você quiser fazer uma apresentação, você pode fazer através do e-mail. Te interessa?
- `2026-06-12 13:16` 👤 Ah tudo bem, posso encaminhar um e-mail para ele também.  Vc pode me passar o e-mail dele por gentileza ?
- `2026-06-12 13:30` 🤖 Sim segue o e-mail, ivanbaren@gmail.com

</details>


### Ateliê Patrícia Machado — `556598209954`

**Custom fields:** `{"mensagem": "Lead interessado em cetamina; perguntou sobre medicação/valor além da consulta; respondeu que vai falar com e retornar.", "interesse": "Infusão de Cetamina", "observacoes": "Lead interessado em retorno; perguntou se a consulta já passa medicação; respondeu que vai falar com e retorna.", "qualificacao": "interessado", "procedimentos": ["Infusão de cetamina"], "demonstrou_interesse": t`

**Cenário:** `sumiu_apos_cotacao_e_duvida_medicacao` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A lead buscou tratamento de alcoolismo para o marido, demonstrando interesse específico no atendimento online e no Método Sinclair. Questionou o valor da consulta (R$ 750) e se haveria custos adicionais ou prescrição imediata de medicação. Após as respostas, informou que conversaria com o marido e retornaria, mas não efetivou o agendamento da data oferecida (16/06).


**Objeções:** Preço da consulta (implícito pelo questionamento de custos extras), Necessidade de medicação imediata

**Gatilhos:** Tratamento para alcoolismo, Método Sinclair, Teleconsulta, Pioneirismo do profissional

<details><summary>Transcrição completa</summary>

- `2026-06-12 14:38` 👤 Bom dia Gostaria de saber sobre o tratamento de alcoolismo. Ele atende on line?
- `2026-06-12 14:38` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 14:54` 🤖 **[ÁUDIO]** Olá, bom dia, tudo bem? Meu nome é Marisa.
- `2026-06-12 14:55` 🤖 **[ÁUDIO]** Claro, já passo toda a nossa, como funciona o tratamento, preço, tudo certinho. Mas antes, por gentileza, me conte um pouco sobre o seu problema para eu entender no que nós realmente podemos te ajudar.
- `2026-06-12 14:56` 👤 É para o meu marido
- `2026-06-12 14:57` 👤 Está com problemas com bebida
- `2026-06-12 15:12` 🤖 **[ÁUDIO]** Olá, tudo bem? Eu entendo, entendo. Realmente é uma doença que gera muito sofrimento, né, prejuízo em todas as áreas da vida, tanto para a pessoa quanto para a família, né? Então é preciso realmente cuidar.
- `2026-06-12 15:13` 🤖 **[ÁUDIO]** "Eu acredito sinceramente que você esteja buscando ajuda no lugar certo, porque o doutor Ivan tem uma vasta experiência com este tipo de problema e ele é pioneiro no Brasil a utilizar o método Sinclair. Ele já ajudou centenas de pessoas na mesma situação, né, a voltar a ter controle sobre o consumo do álcool e também retomar o controle da própria vida, né, de forma geral."
- `2026-06-12 15:14` 🤖 **[ÁUDIO]** Na primeira consulta ou teleconsulta, né, porque ele atende das duas formas, ele vai avaliar o caso de maneira abrangente e vai indicar o melhor tratamento para o problema, né. Se tiver outros problemas de saúde mental também, né, ele verifica. Ele vai explicar como é que funciona o método Sinclair e também explica como é que funciona, qual vai ser o procedimento e vai tirar todas as dúvidas que vocês têm, o que é bastante importante.
- `2026-06-12 15:14` 🤖 **[ÁUDIO]** Nós temos agenda para o doutor na terça-feira às 10 horas, dia 16. Vocês têm disponibilidade?
- `2026-06-12 15:14` 🤖 **[ÁUDIO]** Você tem alguma dúvida, algo que eu possa esclarecer? Estou à sua disposição.
- `2026-06-12 15:15` 👤 Valores
- `2026-06-12 15:16` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-06-12 15:20` 👤 Ok
- `2026-06-12 15:20` 👤 Nessa consulta ele ja passa medicação?
- `2026-06-12 15:21` 🤖 Sim!
- `2026-06-12 15:22` 👤 Tem mais algum valor além desse da consulta?
- `2026-06-12 15:28` 🤖 Não! Conosco não!
- `2026-06-12 15:28` 👤 Vou falar com e retorno.
- `2026-06-12 15:28` 👤 Por enquanto agradeço imensamente a atenção
- `2026-06-12 16:08` 🤖 Estamos a disposição!

</details>


### … — `5511948588800`

**Custom fields:** `{"mensagem": "Lead perguntou valor da consulta; preço informado: 750 reais. Lead disse que não precisava mandar imagens.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead perguntou valor da consulta; preço informado: 750 reais. Lead disse que não precisava mandar imagens.", "qualificacao": "interessado", "procedimentos": ["Primeira Consulta"], "demonstrou_interesse": true, "procedime`

**Cenário:** `perda_por_preco_objetivo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead buscou atendimento especializado em alcoolismo (Método Sinclair) para o Dr. Ivan. Demonstrou interesse imediato, mas apresentou forte resistência ao valor da consulta (R$ 750), além de se incomodar com o envio de imagens de depoimentos. Apesar da tentativa de conversão da consultora, o lead encerrou a conversa afirmando que o preço está alto, sem agendar.


**Objeções:** preço alto

**Gatilhos:** especialista em alcoolismo, Método Sinclair

<details><summary>Transcrição completa</summary>

- `2026-06-15 13:35` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-15 13:35` 👤 Bom dia
- `2026-06-15 13:35` 👤 Tudo Bem ?
- `2026-06-15 13:35` 👤 Vocês tem Psiquiatra especialista em alcoolismo?
- `2026-06-15 13:38` 🤖 Olá, obrigado pelo contato! Aqui é  a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-15 13:39` 👤 Olá
- `2026-06-15 13:39` 👤 Vocês tem Psiquiatra especialista em alcoolismo?
- `2026-06-15 13:40` 🤖 Acredito que você  esteja buscando ajuda no lugar certo, pois o Dr. Ivan tem vasta experiência com esse tipo de problema, tendo sido o pioneiro no Brasil a utilizar o Método Sinclair.
- `2026-06-15 13:40` 🤖 Ele já ajudou centenas de pessoas na mesma situação a voltar a ter controle sobre o consumo de álcool e, com isso, a retomar o controle sobre a vida de modo geral.
- `2026-06-15 13:40` 🤖 Veja depoimentos dos nossos pacientes que já transformaram suas vidas com este tratamento.
- `2026-06-15 13:40` 👤 Qual é o valor da consulta ?
- `2026-06-15 13:41` 🤖 *[imagem]*
- `2026-06-15 13:41` 🤖 *[imagem]*
- `2026-06-15 13:41` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-06-15 13:41` 👤 Não precisa mandar essas coisas
- `2026-06-15 13:42` 👤 Ta bom obrigado.
- `2026-06-15 13:42` 🤖 Temos horário para consulta hoje! Você tem disponibilidade?
- `2026-06-15 13:50` 👤 750 reais está alto
- `2026-06-15 13:54` 🤖 Entendo. Posso te assegurar que o tratamento funciona, vale o investimento.
- `2026-06-15 14:15` 👤 Não tenho duvida
- `2026-06-15 14:16` 🤖 Estamos a disposição.

</details>


### Ps — `5521999861403`

**Custom fields:** `{"mensagem": "Lead quer marcar consulta com Dr Ivan; mencionou 'Mais uma vez' e que os remédios acabaram.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead quer marcar consulta com Dr Ivan; mencionou 'Mais uma vez' e que os remédios acabaram.", "data_horario": "2026-06-15T21:00:00.000Z", "qualificacao": "interessado", "teleconsulta": true, "procedimentos": ["Primeira Consulta"], "ten`

**Cenário:** `agendou_apos_atendimento_medico` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente recorrente do Dr. Ivan buscou agendamento urgente por falta de medicação. Realizou teleconsulta após alinhar pagamento via link (cartão) e sanar dúvidas sobre nota fiscal para reembolso. Pós-consulta, foi encaminhada para avaliação psicológica com a Dra. Maísa (TST/EMDR). A lead aceitou a recomendação e aguarda disponibilidade de horários para a nova sessão.


**Objeções:** Solicitação de fracionamento de nota fiscal (negada pela clínica), Dúvida sobre duração da sessão de psicologia

**Gatilhos:** Urgência (remédios acabaram), Familiaridade com o médico (Dr. Ivan), Possibilidade de reembolso (Nota Fiscal), Parcelamento no cartão, Indicação médica interna

**Erros do bot:** Envio de template de endereço físico para consulta confirmada como online; Confusão de horário (citou 15h em vez de 18h) na mensagem de confirmação

<details><summary>Transcrição completa</summary>

- `2026-06-15 13:43` 👤 OI Td bem ?
- `2026-06-15 13:43` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-15 13:43` 👤 Queria marcar minha consulta com dr Ivan
- `2026-06-15 13:43` 👤 Mais uma vez
- `2026-06-15 13:43` 👤 Os remédios acabaram e é bom alinharmos algumas coisas
- `2026-06-15 13:44` 👤 Qual o horário mais próximo que tem?
- `2026-06-15 13:44` 🤖 Bom dia!
- `2026-06-15 13:45` 🤖 Temos horário hoje as 18:00 hs. Você tem disponibilidade?
- `2026-06-15 13:47` 👤 Quero sim
- `2026-06-15 13:48` 🤖 A consulta será online?
- `2026-06-15 13:48` 👤 Isso por favor
- `2026-06-15 13:49` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-06-15 13:49` 👤 Pode ser cartão mas por acaso vc poderia emitir 2 notas de consulta uma hoje outra na próxima semana ? Aí consigo o reembolso integral
- `2026-06-15 13:50` 🤖 Olá, Ps 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 15/06/2026 15:00  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene/Marisa
- `2026-06-15 13:50` 👤 E as 18 ou as 15?
- `2026-06-15 13:51` 🤖 Desculpe, as 18:00 hs
- `2026-06-15 13:52` 🤖 Estamos fazendo testes no novo sistema, a mensagem foi enviada por engano
- `2026-06-15 13:52` 👤 Sem problemas
- `2026-06-15 13:53` 🤖 Não conseguimos fazer notas em datas alternadas da consulta
- `2026-06-15 13:54` 🤖 Você prefere pagamento a vista ou parcelado. Parcelamos em até 3 vezes sem juros.
- `2026-06-15 13:54` 👤 Pode ser parcelado então cartão
- `2026-06-15 13:54` 👤 Mas vc consegue emitir nota ? Qual valor da consulta mesmo?
- `2026-06-15 13:55` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-06-15 13:55` 👤 Ok
- `2026-06-15 13:56` 🤖 https://pay.sumup.com/b2c/XZAAFQN4P8
- `2026-06-15 13:57` 🤖 Por gentileza, nos envie o comprovante de pagamento assim que possível, para finalizarmos o agendamento.
- `2026-06-15 13:57` 🤖 Por favor, nos informe o número do cpf para localizarmos o seu cadastro.
- `2026-06-15 15:38` 🤖 Olá! Vamos confirmar a consulta?
- `2026-06-15 15:40` 👤 Sim já vou fazer
- `2026-06-15 15:41` 🤖 Fique tranquila!
- `2026-06-15 18:12` 👤 *[imagem]*
- `2026-06-15 18:12` 👤 Se puder já emitir a nota já dou entrada obrigada
- `2026-06-15 18:15` 🤖 Por favor, me informe o cpf.
- `2026-06-15 18:15` 👤 10299156796
- `2026-06-15 18:18` 🤖 Muito obrigada Patricia!
- `2026-06-15 18:18` 🤖 Segue o link da consulta.
- `2026-06-15 18:18` 🤖 Patrícia Saada  - Dr. Ivan Barenboim - 15/06/2026 Segunda-feira, 15 de junho · 6:00 – 6:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/sab-ftbq-zmo
- `2026-06-15 20:13` 👤 Obrigada
- `2026-06-15 21:55` 🤖 Olá Patricia. Como vai?
- `2026-06-15 21:56` 🤖 O Dr. Ivan recomendo você passar em uma sessão de avaliação com a Dra. Maisa psicologa.
- `2026-06-15 21:56` 🤖 Algumas informações:
- `2026-06-15 21:56` 🤖 Hipnoterapia/EMDR/TST
- `2026-06-15 21:57` 🤖 O que é a hipnoterapia/TST( terapia de superação de traumas)?
- `2026-06-15 21:57` 🤖 A terapia de superação de traumas( TST) consiste em utilizar técnicas como hipnose e EMDR que são comprovadamente eficazes para a neutralização do efeito dos traumas psicológicos no subconsciente do indivíduo.
- `2026-06-15 21:57` 🤖 Dessa forma, muitas vezes,  é possível quebrar padrões emocionais, cognitivos e comportamentais arraigados rapidamente.
- `2026-06-15 21:57` 🤖 Como funciona a hipnoterapia/TST?
- `2026-06-15 21:57` 🤖 A TST ou Terapia de Superação de Traumas é um processo terapêutico que envolve hipnoterapia, EMDR e outras técnicas que visam a diminuir ou neutralizar o efeito dos traumas sobre o funcionamento do indivíduo.
- `2026-06-15 21:58` 🤖 Primeiro, você faz uma sessão inicial de avaliação com a nossa psicóloga. Ao final da mesma, ela vai propor um protocolo de tratamento com o número mínimo de sessões estimado para obtenção de bons resultados. Normalmente, entre 6 e 12 sessões.
- `2026-06-15 21:59` 🤖 O custo da sessão de avaliação é 600,00. Vamos agendar uma avaliação?
- `2026-06-16 14:23` 👤 Olá tudo bem
- `2026-06-16 14:23` 👤 Vamos sim
- `2026-06-16 14:23` 👤 Deixa só eu ver um horário
- `2026-06-16 14:23` 👤 Quanto tempo a sessão dura ?
- `2026-06-16 14:24` 🤖 Bom dia, Patricia!
- `2026-06-16 14:25` 🤖 A sessão tem a duração de uma hora.
- `2026-06-16 14:25` 🤖 Precisamos verificar com a Dra.Maísa os horários disponíveis. Você prefere de manhã ou a tarde?

</details>
