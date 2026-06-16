---
title: "Estudo: Procedimento Agendado"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Procedimento Agendado' do funil Agendamentos Novo (Clínica ÓR): 15 leads."
---

# Estudo: Procedimento Agendado

**Coluna:** `Procedimento Agendado` (posição 10) — **15 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é predominantemente um paciente recorrente ou recém-convertido que já superou a barreira do preço inicial. Trata-se de indivíduos com condições crônicas (Depressão Resistente, Transtorno Bipolar ou Dor Crônica) que buscam na cetamina uma alternativa de última linha. Valorizam a agilidade operacional (receitas via app e rapidez no WhatsApp) e a flexibilidade financeira (parcelamentos longos e auxílio com reembolso). Apresentam um comportamento de 'ajuste constante' de agenda devido à própria condição de saúde ou escalas profissionais rígidas, exigindo um atendimento humanizado, paciente e muito organizado no controle de saldos de sessões.


### Procedimentos mais mencionados

- Infusão de Cetamina (Venosa)
- Protocolos de Manutenção de Cetamina (10 sessões)
- Eletroestimulação Magnética Transcraniana (EMT)
- Psicoterapia (frequentemente combinada)
- Prescrição de Cannabis Medicinal

### Profissionais mais mencionados

- Dr. Ivan Barenboim
- Dra. Maísa
- Edilene (Enfermagem)

### Objeções mais comuns

- Limite de cartão de crédito para pacotes de alto valor.
- Divergência entre protocolo da clínica (inicialmente intenso) vs. protocolo de médicos externos.
- Conflito de agenda com horários comerciais.
- Preferência por Spravato (esketamina nasal) vs. Cetamina venosa (explicado custo-benefício).

### Gatilhos de entrada na coluna

- Encaminhamento médico externo para Cetamina.
- Finalização de consulta de avaliação com Dr. Ivan ou Dra. Maísa.
- Necessidade de manutenção em protocolos de longa duração (depressão resistente/dor crônica).
- Busca por praticidade de 'agenda casada' (Terapia + Infusão).

## 2. Padrões observados (Top 10)

1. Uso intenso do aplicativo da clínica para solicitação de receitas.
2. Valorização do 'abatimento' do valor da consulta no pacote de tratamento.
3. Pedido recorrente de notas fiscais detalhadas para reembolso de convênio.
4. Pacientes chamando atendentes por termos afetuosos ('doce', 'flor'), indicando forte vínculo.
5. Negociação de parcelamento em até 12x como condição sine qua non para fechamento.
6. Demanda por horários em 'período de exceção' (muito cedo ou final do dia).
7. Confusão frequente sobre agendamento em semanas com feriados.
8. Uso de dois ou mais cartões (próprio e de terceiros) para viabilizar o tratamento.
9. Atrasos frequentes de 15-30 minutos comunicados em cima da hora.
10. Preferência por comunicação via áudio/vídeo por pacientes idosos ou confusos com datas.

## 3. Erros recorrentes do agente IA atual

- Confusão na contagem de sessões realizadas vs. pagas em protocolos longos.
- Erro na emissão de receitas digitais (ex: dosagem de Rivotril) relatado por pacientes recorrentes.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Saldo de Sessões' no card do lead para evitar confusão financeira.
- Implementar regra de 'Pós-Operatório': mover leads com cirurgias marcadas para coluna de espera com data de retorno automática.
- Sinalizar leads 'Altamente Flexíveis' vs 'Rígidos de Horário' para facilitar encaixes de última hora.
- Notificar o faturamento imediatamente quando houver falha no link de pagamento para contato manual.

## 5. Recomendações para o agente de **atendimento**

- Sempre confirmar se o paciente recebeu o guia de preparo (jejum/acomhante) após o agendamento da 1ª sessão.
- Ser proativo no envio de notas fiscais e guias de terapia para reembolso, sem esperar o paciente pedir.
- Validar visualmente receitas de psicotrópicos antes do envio digital para evitar erros de dosagem citados.
- Adotar tom afetuoso e acolhedor com pacientes de longo prazo, mantendo o vínculo criado.
- Perguntar se o paciente deseja manter 'sessões fixas' semanais/quinzenais para evitar conflitos de agenda recorrentes.

## 6. Alertas

- ⚠️ Pacientes novos com receio de efeitos dissociativos optando por pagar a 1ª sessão avulsa antes de fechar pacotes.
- ⚠️ Divergência entre horários acordados no WhatsApp e e-mails automáticos do sistema.
- ⚠️ Altos índices de reagendamento por escalas de trabalho (médicos/veterinários) e crises de dor física.
- ⚠️ Dificuldades técnicas recorrentes com links de pagamento antifraude para valores altos (acima de R$ 8.000).

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Silmara Funi Gonzalez | 5511971000802 | 29 | 0 | agendamento_recorrente |
| 2 | Achilles | 5511971269194 | 13 | 0 | reagendamento_e_novo_agendamento |
| 3 | Lead #7171022 | 5511996885221 | 59 | 7 | agendou_apos_excecao_horario |
| 4 | Mirela Cardoso | 5511986060004 | 17 | 0 | agendou_procedimento_recorrente |
| 5 | Rosa Maria | 5511981744064 | 27 | 7 | agendou_procedimento_pos_consulta |
| 6 | Juliana Alves | 5511993480942 | 85 | 10 | reagendamento_e_extensao_protocolo |
| 7 | Juliana Alves | 5517997768453 | 45 | 0 | agendamento_recorrente_paciente_ativo |
| 8 | Rosangela | 5511982071521 | 61 | 0 | agendou_procedimento_pos_consulta |
| 9 | Oliver | 5511945011592 | 65 | 1 | reagendamento_recorrente |
| 10 | Juca (Sérgio) Palacios | 5519971111975 | 120 | 24 | lead_recorrente_fechamento_pacote |
| 11 | Isabela Terlizzi | 5521979559740 | 17 | 0 | reagendamento_ajuste_fluxo |
| 12 | Ivan | 5511997477000 | 239 | 22 | agendou_procedimento_pos_consulta |
| 13 | Michelle Kartychak | 19293133624 | 82 | 3 | reagendamento_recorrente_e_ajuste_receitas |
| 14 | Laura. | 5511996004166 | 127 | 15 | agendou_apos_cotacao_e_visita |
| 15 | Laís Carrara | 5511940569963 | 58 | 10 | reagendamento_longo_prazo |

## 8. Conversas analisadas (transcrição + síntese)

_15 leads com conversa analisada._


### Silmara Funi Gonzalez — `5511971000802`

**Custom fields:** `{"mensagem": "Interesse em cetamina; agendou 08/06 11:30; solicitou nova infusão para 25/06 11:30", "interesse": "Infusão de Cetamina", "observacoes": "Interesse em cetamina; agendou 08/06 11:30; solicitou nova infusão para 25/06 11:30", "data_horario": "2026-06-25T11:30:00.000Z", "qualificacao": "interessado", "procedimentos": ["Retorno", "Infusão de cetamina"], "nome_preferido": "Silmara", "tent`

**Cenário:** `agendamento_recorrente` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Silmara é uma paciente recorrente da clínica em tratamento com infusões de cetamina. Durante a conversa, solicitou a renovação de receita de Donaren (atendida via App) e realizou diversos agendamentos e reagendamentos de suas sessões. O fluxo foi eficiente, com a paciente confirmando datas para 21/05, 05/06 (reagendado para 08/06) e, por fim, 25/06 às 11:30.


**Gatilhos:** Continuidade de tratamento, Praticidade no agendamento

<details><summary>Transcrição completa</summary>

- `2026-05-12 12:50` 👤 Bom dia. Poderia por favor enviar receita do donarem 50 ml ? Obrigada .
- `2026-05-12 12:50` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-12 12:56` 🤖 Olá bom dia Silmara, como vai? Iremos solicitar a pessoa responsável e assim que possível te retornamos.Seguimos a disposição.
- `2026-05-12 18:19` 🤖 Olá boa tarde Silmara, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-05-12 18:20` 👤 Muito obrigada.
- `2026-05-15 15:39` 👤 Olá, boa tarde. Poderia agendar minha próxima infusão para 21/05 as 11:50h, por favor ?
- `2026-05-15 16:24` 🤖 Boa tarde, Silmara. Tudo bem?
- `2026-05-15 16:24` 🤖 Pode ser as 12:00 hs?
- `2026-05-15 16:24` 👤 Pode sim. Obrigada .
- `2026-05-15 16:25` 🤖 Agendado! Bom final de semana!
- `2026-05-29 03:06` 👤 Bom dia. Por favor. É possível marcar minha próxima infusão para 05/06 as 11:50 h?
- `2026-05-29 03:06` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-29 10:14` 🤖 Bom dia, Silmara. Tudo bem?
- `2026-05-29 10:14` 🤖 Agendado para o dia 05/06 as 11:30 hs.
- `2026-05-29 10:15` 🤖 Ótimo final de semana
- `2026-06-01 21:19` 👤 Bom dia .
- `2026-06-01 21:20` 👤 É possível trocar minha infusão para o dia 08/06 as 11:50 por favor.
- `2026-06-01 21:49` 🤖 Boa tarde, Silmara!
- `2026-06-01 21:50` 🤖 Reagendado para dia 08/06 as 11:30 hs. ok?
- `2026-06-01 21:51` 🤖 Agora nossos horários são de 30 em 30 minutos, por isso coloquei as 11:30 hs, ou você prefere as 12:00 hs?
- `2026-06-01 22:19` 👤 Não, 11:30 está ótimo. Obrigada. Boa noite.
- `2026-06-01 22:19` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-02 10:00` 🤖 Bom dia Silmara, como vai? Reagendado para dia 08/06 as 11h30. Seguimos a disposição.
- `2026-06-02 11:55` 👤 Muito obrigada. Bom dia.
- `2026-06-08 13:30` 🤖 Silmara, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-12 15:20` 👤 Bom dia, por favor, seria possível agendar a próxima infusão para o dia 25/06 , as 11:30h ?
- `2026-06-12 15:33` 🤖 Olá boa tarde Silmara, como vai?
- `2026-06-12 15:36` 🤖 Agendado, seguimos a disposição.

</details>


### Achilles — `5511971269194`

**Custom fields:** `{"mensagem": "lead atual: cetamina; agendamento pendente após oferta de horário amanhã às 13h/14h", "interesse": "Infusão de Cetamina", "observacoes": "lead atual: cetamina; agendamento pendente após oferta de horário amanhã às 13h/14h", "data_horario": "2026-04-26T12:00:00-03:00", "qualificacao": "interessado", "teleconsulta": "Sim", "procedimentos": "[\"Infusão de cetamina\"]", "status_consulta"`

**Cenário:** `reagendamento_e_novo_agendamento` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Achilles, já paciente de infusão de cetamina, solicitou inicialmente o adiantamento de uma sessão, que foi concluído com sucesso. Em um segundo momento, buscou agendar uma nova sessão para o dia seguinte às 13h. A clínica ofereceu às 14h e o lead ficou de confirmar sua disponibilidade após verificar sua agenda. O atendimento foi assertivo e rápido.


**Objeções:** conflito de agenda (horário das 14h em análise)

**Gatilhos:** agilidade no atendimento, disponibilidade de horários próximos

<details><summary>Transcrição completa</summary>

- `2026-05-19 13:21` 👤 Bom dia! Tudo bem?
- `2026-05-19 13:21` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-19 13:21` 👤 Tem como adiantar a sessão de cetamina de amanhã para hoje?
- `2026-05-19 13:25` 🤖 Bom dia! Tudo bem?
- `2026-05-19 13:25` 🤖 Temos horário hoje as 12:00 hs. Você tem disponibilidade?
- `2026-05-19 13:27` 👤 Pode ser!
- `2026-05-19 13:28` 🤖 Agendado!
- `2026-06-16 20:10` 👤 Boa tarde! Tudo bem?
- `2026-06-16 20:10` 👤 Eu acabei não marcando minha próxima sessão de cetamina
- `2026-06-16 20:10` 👤 Queria agendar
- `2026-06-16 20:10` 👤 Se possível, para amanhã às 13h
- `2026-06-16 20:50` 🤖 Olá! Tudo bem? Temos horário amanhã as 14:00 hs. Você tem disponibilidade?
- `2026-06-16 20:52` 👤 Pera, vou ver uma coisa, já retorno

</details>


### Lead #7171022 — `5511996885221`

**Custom fields:** `{"mensagem": "Lead interessado em consulta com Dr. Ivan; horários propostos: amanhã 10:00; hoje disponível.", "interesse": "Infusão de Cetamina", "observacoes": "Lead quer agendar primeira_consulta com Dr Ivan; prefere online na próxima semana; hoje Dr Ivan não atende; não atende aos sábados.", "data_horario": "2026-06-16T20:00:00.000Z", "qualificacao": "interessado", "procedimentos": ["Infusão de`

**Cenário:** `agendou_apos_excecao_horario` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A paciente buscou agendamento urgente com Dr. Ivan para tratar de infusões de cetamina. Após ajustes de horários por exceção, ela realizou a consulta online (R$ 750,00 pagos via PIX). Houve uma discussão sobre pacotes de tratamento, onde a paciente explicou que seu protocolo é mensal, diferindo do padrão da clínica. O médico recomendou 6 sessões (uma a cada dois meses). A paciente ficou de confirmar as datas após sua viagem e solicitou guias para reembolso de psicoterapia.


**Objeções:** Divergência no protocolo de aplicação (lead faz mensal, clínica propôs semanal), Conflito de agenda (reunião de urgência)

**Gatilhos:** Cortesia na consulta ao fechar pacote de cetamina, Reembolso via nota fiscal, Atendimento online com Dr. Ivan

<details><summary>Transcrição completa</summary>

- `2026-06-12 11:47` 👤 Olá
- `2026-06-12 11:47` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 11:47` 👤 Bom dia
- `2026-06-12 11:48` 👤 Gostaria de ver se tem como agendar uma sessão com o Dr. entre hj ou amanhã, pq viajo.
- `2026-06-12 11:57` 🤖 Bom dia, Daniella. Tudo bem?
- `2026-06-12 11:58` 🤖 Hoje o Dr. Ivan não fará atendimento e não realizamos atendimento de sábado.
- `2026-06-12 12:15` 👤 Ele pode atender on-line na semana que vem?
- `2026-06-12 12:15` 👤 Ou melhor, volto de viagem e vou. Já te falo o dia.
- `2026-06-12 13:13` 🤖 Sim! O Dr. Ivan atende consulta presencial ou online.
- `2026-06-15 18:21` 👤 Olá
- `2026-06-15 18:21` 👤 Teria qual data para consulta?
- `2026-06-15 18:24` 🤖 Boa tade!
- `2026-06-15 18:24` 🤖 Temos horário amanhã as 10:00 hs. Você tem disponibilidade?
- `2026-06-15 18:25` 👤 Hj teria algum horário?
- `2026-06-15 18:26` 👤 Ou amanhã à tarde?
- `2026-06-15 18:29` 🤖 Hoje não temos horário.
- `2026-06-15 18:29` 🤖 Pode ser amanhã as 17:00 hs?
- `2026-06-15 18:37` 👤 Pode
- `2026-06-15 18:38` 👤 Teria cetamina pra marcar após o atendimento?
- `2026-06-15 18:38` 👤 Ou até antes se tiver
- `2026-06-15 18:39` 🤖 **[ÁUDIO]** Oi Daniel, tudo bem? O nosso último horário para cetamina de segunda à quinta é às 15:30. E você não pode fazer a cetamina antes de passar com o doutor. Então, você poderia passar no consultório ao meio dia? Aí eu creio que daria certo.
- `2026-06-15 19:42` 👤 Mas ele tem as 12?
- `2026-06-15 19:43` 🤖 Seria exceção.
- `2026-06-15 19:43` 👤 Ok
- `2026-06-15 19:44` 🤖 ok agendado para amanhã as 12:00 hs.
- `2026-06-15 19:44` 🤖 Já vou deixar a cetamina agendada para as 12:30 hs.
- `2026-06-15 19:46` 👤 Obrigada
- `2026-06-15 19:46` 👤 Valor da consulta e da cetamina?
- `2026-06-15 19:48` 🤖 **[ÁUDIO]** "Oi, Daniela, tudo bem? É a Marisa.
Daniela, a consulta doteriva é R$ 750, que você pode parcelar em três vezes sem juros. Mas se você fizer o pacote amanhã, aí você não precisa fazer o pagamento da consulta, ela vira uma cortesia, tá?
E o pacote são oito sessões de cetamina, duas vezes por semana durante quatro semanas. O valor de cada infusão é R$ 800, se você fizer no pacote. Se você fizer avulsa, é R$ 900.
Então o pacote seria R$ 6.400, que você pode parcelar em seis vezes sem juros, e nós ainda emitimos nota para reembolso, e também fica inclusa uma consulta no final do tratamento, tá, de avaliação."
- `2026-06-15 19:50` 👤 **[ÁUDIO]** "Ah, legal! A única coisa é que eu faço uma vez a cada mês, sabe? Não... Ah, a forma como a gente faz é diferente. Então, tem que ver com ele como que a gente pode fazer. Se ele aceita fazer o pacote e fazer no transcorrer desse meses, né? Que daí são seis meses, não sei."
- `2026-06-15 19:51` 🤖 **[ÁUDIO]** Entendido, Daniel. É, realmente aí seria necessário você passar em consulta com ele e ele vai te informar direitinho qual seria o melhor procedimento, né? Posso manter a consulta?
- `2026-06-15 19:52` 👤 Pode
- `2026-06-15 19:52` 🤖 ok Agendado.
- `2026-06-15 19:57` 👤 Consigo estacionar aí às 12?  Estou com carro grande, quando vou, coloco numa vaga que tem externa. É possível?
- `2026-06-15 19:57` 🤖 Não tenho como te assegurar.
- `2026-06-16 14:49` 🤖 Olá Daniela! Você está a caminho?
- `2026-06-16 14:54` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-06-16 14:56` 👤 Qual valor mesmo?
- `2026-06-16 14:56` 👤 Ah vi agora
- `2026-06-16 14:56` 🤖 ok
- `2026-06-16 14:57` 👤 ComprovanteSantander-1781621851.252102.pdf
- `2026-06-16 14:58` 🤖 Muito obrigada! Já vou te enviar o linl
- `2026-06-16 15:00` 🤖 Segue link para a consulta
- `2026-06-16 15:00` 🤖 Daniella Stella - Dr. Ivan Barenboim - 16/06/2026 Terça-feira, 16 de junho · 12:00 – 12:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/nqr-apjo-roh
- `2026-06-16 15:02` 👤 Ok, já entrei
- `2026-06-16 15:04` 👤 Será que demora pra sessão?
- `2026-06-16 15:05` 🤖 Vamos avisar o dr que já esta aguardando.
- `2026-06-16 15:07` 👤 Se achar melhor podemos fazer as 17:00
- `2026-06-16 15:07` 👤 Pq tenho que sair às 12:30 pra uma reunião de  urgência.
- `2026-06-16 15:22` 🤖 Olá Daniela. Tudo bem?
- `2026-06-16 15:22` 🤖 O Dr. Ivan recomendou 6 infusões de cetamina para você, uma a cada dois meses.
- `2026-06-16 15:23` 🤖 Vamos agendar?
- `2026-06-16 17:07` 👤 **[ÁUDIO]** Oi, boa tarde. Tá, eu vou ver aqui os dias que agora eu estou indo viajar e aí me passa os valores. Outra coisa que eu vou precisar, que eu esqueci de falar para o Dr. Ivan: como eu tenho atendimento psicológico, eles a cada três meses, o convênio, né, me pede um pedido do psiquiatra para o psicólogo, né, pra eu fazer o psicólogo. Então, imagina que eu já preciso de janeiro e a cada três meses. Então, janeiro, fevereiro não, março não, aí abril. Então, a cada três meses eu preciso disso, se você puder me mandar pra eu poder pegar reembolso das minhas sessões, tá bom?
- `2026-06-16 17:08` 👤 **[ÁUDIO]** Bem, eu preciso de janeiro, abril, né? Início de janeiro, abril e junho. Aí acho que dá certinho. Quer dizer, julho, né? Começo de julho. A gente ainda não está em julho, mas aí você já fica sobreavisada que julho eu preciso. Tá bom? E se me pedirem alguma coisa do convênio, te passo.
- `2026-06-16 17:09` 🤖 Oi Daniela.
- `2026-06-16 17:10` 🤖 O Dr. não pode te enviar uma solicitação com 40 sessões de terapia? Normalmente ele faz este procedimento.
- `2026-06-16 17:11` 👤 **[ÁUDIO]** "Ó, pode me enviar e eu tento ver se esse, porque eu mudei de convênio também, né? O outro pedia desse jeito. Agora esse SulAmérica eu não sei. Mas eu posso tentar. Se der algum erro... Mas aí você pede para o comecinho de janeiro, né? Aí eu mando para ver o que que eles vão me falar."
- `2026-06-16 17:11` 🤖 ok

</details>


### Mirela Cardoso — `5511986060004`

**Custom fields:** `{"mensagem": "Lead solicitando infusão de cetamina; início da primeira sessão em 22/06/2026 às 07:30, a cada 15 dias. Procedimento com Dr. Ivan / acompanhamento de retorno anterior.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead questiona validade da receita de cetamina de 18/05; enviou Mirela.pdf; informou dosagem atual de 1,76 mg/kg; solicitou agendamento/liberação para infusão;`

**Cenário:** `agendou_procedimento_recorrente` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Mirela Cardoso solicitou a retomada do tratamento de infusão de cetamina com o Dr. Ivan. Ela questionou a validade de uma receita de maio, que foi validada pela equipe clínica após envio do PDF. O agendamento foi definido para ciclos quinzenais (pacote de 6 sessões), iniciando em 22/06 às 07:30, conforme solicitado pela lead. Procedimento confirmado com sucesso.


**Objeções:** Validade da receita anterior

**Gatilhos:** Praticidade no agendamento recorrente, Continuidade do tratamento, Confiança no Dr. Ivan

<details><summary>Transcrição completa</summary>

- `2026-06-08 12:23` 🤖 Mirela, conforme solicitado, a dosagem segundo as enfermeiras está atualmente em 1,76mg/kg.
- `2026-06-11 22:05` 👤 bom dia tudo bem? meu medico mandou receita para cetamina dia 18 de maio…. ainda é válida ou precisa de outra?
- `2026-06-11 22:05` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 11:56` 🤖 Bom dia, Mirela. Tudo bem?
- `2026-06-12 11:56` 🤖 Sim. Pode nos enviar para o Dr. Ivan liberar o procedimento.
- `2026-06-12 12:05` 👤 Mirela.pdf
- `2026-06-12 13:53` 🤖 Olá Mirela. Já podemos agendar a sua infusão
- `2026-06-15 15:25` 👤 Quero marcar a infusão a partir da semana que vem
- `2026-06-15 15:25` 👤 Segunda 7:30 de 15 em 15 dias
- `2026-06-15 15:51` 🤖 Oi Mirela!
- `2026-06-15 15:51` 🤖 Agendado para dia 22/06 as 07:30 hs.
- `2026-06-15 15:55` 👤 Aí vocês já marca de 15 em 15?
- `2026-06-15 16:11` 🤖 Certo, quantas infusões irá fazer no modo quinzenal?
- `2026-06-15 16:22` 👤 Um pacote igual da outra vez
- `2026-06-15 16:22` 👤 Acho que são 6
- `2026-06-15 16:23` 🤖 Certo, agradecemos o retorno.
- `2026-06-15 16:23` 👤 Obrigada vocês

</details>


### Rosa Maria — `5511981744064`

**Custom fields:** `{"mensagem": "Lead mencionou infusão cetamina marcada para 17/06; existência de consulta anterior para 02/06/2026 10:30 (passada).", "interesse": "Consulta com psiquiatria", "enviar_dia": "2026-06-01T03:00:00.000Z", "observacoes": "Lead mencionou infusão cetamina marcada para 17/06; existência de consulta anterior para 02/06/2026 10:30 (passada).", "data_horario": "2026-06-02T13:30:00.000Z", "qual`

**Cenário:** `agendou_procedimento_pos_consulta` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Lead (Rosa Maria) já é paciente da clínica. Realizou consulta de retorno com Dr. Ivan em 02/06 para liberação de procedimento. Demonstrando confusão com a agenda, confirmou o horário da infusão de cetamina para o dia 17/06 às 10h30 após breve mal-entendido sobre a data atual. Paciente possui forte vínculo afetivo com a equipe de atendimento.


**Objeções:** confusao com data e horario

**Gatilhos:** continuidade do tratamento, disponibilidade de agenda casada, atendimento humanizado

<details><summary>Transcrição completa</summary>

- `2026-05-14 19:37` 🤖 Olá dona Rosa. Seguem as receitas!
- `2026-05-14 19:38` 🤖 rosa2.pdf
- `2026-05-14 19:38` 🤖 Rosa.pdf
- `2026-05-14 19:38` 🤖 Rosa3.pdf
- `2026-05-14 19:39` 👤 Muitíssimo obrigada . Ótimo final de semana . Bj
- `2026-05-14 19:39` 🤖 Obrigada! Para senhora também.
- `2026-05-25 18:25` 👤 **[ÁUDIO]** "Oi, minha flor, você está boa? Espero que sim. Eu tenho consulta amanhã, né? Só que eu não sei que horas. Se eu fizer a consulta, eu vou fazer a infusão junto? Beijo, me explique, tchau."
- `2026-05-25 18:30` 🤖 **[ÁUDIO]** Oi, Dona Rosa, tudo bem? É a Marisa. O seu retorno está agendado para o dia 02/06, às 10:30. Não é amanhã, não. Mas depois o doutor liberando, a senhora pode fazer esse exame assim.
- `2026-05-28 15:12` 👤 **[ÁUDIO]** Oi, lindinha! Ótima quinta, ótimo final de semana. Mas antes, me conta... se eu tenho retorno 10h30, dia 2, será que eu vou fazer infusão depois? Eu só queria ter essa ideia. Se você não... ou você não sabe de jeito nenhum. Bem que você podia saber. Um beijo para am... entramos. Não, o que fala quatro, são quatro. Quatrambas. Tchau, beijo!
- `2026-05-28 15:13` 🤖 **[ÁUDIO]** Oi, dona Rosa, tudo bem? Boa tarde, é a Marisa. Aí, dona Rosa, a senhora é um barato. Eu já até coloquei na agenda. Caso o doutor prescreva, a senhora já tá na agenda assim que sair da consulta, tá bom? Beijo, bom final de semana.
- `2026-05-28 17:17` 👤 Brigadissimo . Vc é um doce mas com açúcar o diet não .
- `2026-05-28 17:18` 🤖 kkk bjs
- `2026-06-01 19:00` 🤖 Olá, Rosa 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 02/06/2026 10:30  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene.
- `2026-06-01 19:39` 👤 Oi Edilene boa tarde . Sim estarei aí se Deus quiser. Bjsssssss
- `2026-06-01 19:39` 🤖 Bjs
- `2026-06-02 13:00` 🤖 Rosa, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-02 13:10` 👤 🌹🌹🌹🌹🌹🌹🌹🌹
- `2026-06-08 12:23` 🤖 Olá Rosa Maria. Para podermos aprimorar o nosso atendimento, precisamos muito do seu feedback! Agradecemos desde já! https://forms.gle/Jn1RnyEmc17whxeSA
- `2026-06-13 22:33` 👤 Oi Edilene/ Marisa tudo bem com vcs ? Sei que minha infusão será dia 17/06 porém não lembro o horário . Bj
- `2026-06-13 22:33` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-15 10:53` 🤖 Olá bom dia Sra Rosa Maria, como vai? Sua infusão esta agendada as 10h30, podemos manter ou gostaria de reagendar?
- `2026-06-15 12:01` 👤 **[ÁUDIO]** Oi Marisa, Edilene, tudo bem? Não está marcado para o dia 17? Sem querer aqui dia 17 eu marquei um monte de coisa para hoje. Será que eu posso marcar para outra hora? Assim, porque essa semana, de manhã, se tiver alguma coisa, ou amanhã cedo pode ser. Agora tá meio em cima da hora, agora que eu vi, me desculpe. Vocês estão bem? Eu espero que sim. Essa chuva dá um soninho né? Não é o meu caso mas, um beijo, me responde, tchau.
- `2026-06-15 12:04` 🤖 **[ÁUDIO]** Então, meu amor, dia 17 às 10:30, só confirmei pra você.
- `2026-06-15 12:06` 👤 **[ÁUDIO]** Oi, meu amor. Desculpa, a culpa foi minha. Não vou falar culpa, é a confusão mesmo. Você tem toda razão, eu havia falado dia 17 e você confirmou dia 17, às 10:30. Eu entendi, eu só li a sua, eu esqueci da anterior que eu mandei. Eu vou pôr a culpa em alguém, espera um pouquinho, tá bom? Um beijo, até dia 17. Beijo.
- `2026-06-15 12:07` 🤖 Beijos até dia 17/06 as 10h30
- `2026-06-15 12:12` 👤 *[imagem]*
- `2026-06-15 12:12` 👤 *[imagem]*

</details>


### Juliana Alves — `5511993480942`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2026-06-15T07:30:00-03:00", "teleconsulta": "false", "procedimentos": "Infusão de cetamina"}`

**Cenário:** `reagendamento_e_extensao_protocolo` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Juliana é uma paciente recorrente de infusão de cetamina que solicitou diversos reagendamentos por motivos pessoais. Após encerrar o protocolo inicial de 10 sessões, houve uma confusão sobre o saldo devedor e sessões restantes. Ficou acordado a realização de mais 6 sessões (extensão do protocolo via médico externo) mantendo o valor de R$ 750,00 por sessão. A clínica forneceu um relatório completo de datas e dosagens para a paciente alinhar com seu médico assistente.


**Objeções:** Confusão com contagem de sessões pagas vs. realizadas

**Gatilhos:** Continuidade do tratamento, Parcelamento do pacote, Manutenção do valor promocional (R$ 750)

<details><summary>Transcrição completa</summary>

- `2026-05-15 16:50` 👤 Bom dia. Tudo bem?
- `2026-05-15 16:50` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-15 16:50` 👤 Você pode cancelar meu agendamento de segunda? Tivemos um problema familiar e não sei se conseguirei chegar na segunda.
- `2026-05-15 16:55` 🤖 Boa tarde, Ju. Tudo bem?
- `2026-05-15 16:55` 🤖 Cancelada a infusão!
- `2026-05-15 16:55` 🤖 Obrigada por sinalizar. Tenha um ótimo final de semana.
- `2026-05-15 17:02` 👤 Obrigada.
- `2026-05-15 17:02` 👤 Beijos
- `2026-05-15 17:02` 👤 Igualmente
- `2026-05-18 13:48` 👤 Bom dia!
- `2026-05-18 13:48` 👤 Podemos marcar minha próxima infusão para quarta, último horário da manhã?
- `2026-05-18 14:05` 🤖 Bom dia, Juliana!
- `2026-05-18 14:05` 🤖 Pode ser quarta as 11:30 hs?
- `2026-05-18 14:05` 👤 Pode.
- `2026-05-18 14:05` 👤 Perfeito.
- `2026-05-18 14:05` 👤 Muito obrigada.
- `2026-05-18 14:06` 🤖 Disponha!
- `2026-05-20 11:21` 👤 Bom dia, tudo bem? Não conseguirei comparecer hoje. A irmã do meu marido sofreu um acidente de carro, estávamos com ela em Tatuí e agora ela veio para Marília, o estado dela é delicado. Conseguimos marcar amanhã, primeiro horário.
- `2026-05-20 11:28` 🤖 Olá bom dia, como vai? Esperamos que sua cunhada fique bem. Sobre reagendar, sim estamos reagendando para amanhã as 07h30. Seguimos a disposição.
- `2026-05-20 11:28` 👤 Obrigada.
- `2026-05-20 11:29` 🤖 Disponha.
- `2026-05-26 10:58` 👤 **[ÁUDIO]** Oi, bom dia, tudo bem? A gente pode marcar a minha infusão para amanhã às 7:30? Porque na quinta-feira eu vou ter consulta com o meu médico. Se a gente puder mudar, eu agradeço. Um beijo!
- `2026-05-26 11:00` 🤖 **[ÁUDIO]** Bom dia, Juliana, tudo bem? Edlene. Sim, a gente consegue, sim, mudar de quinta para quarta, tá bom? Já estou fazendo essa alteração. Tenha um bom dia.
- `2026-05-26 11:28` 👤 **[ÁUDIO]** Obrigado, Edilene. Um beijo.
- `2026-05-28 18:10` 🤖 Boa tarde!
- `2026-05-28 18:12` 🤖 Próxima infusão dia 03/06 as 14:30 hs e consulta em 08/06 as 12:00 hs.
- `2026-05-29 13:51` 👤 Bom dia.
- `2026-05-29 13:51` 👤 Só pra me organizar, tenho somente mais uma infusão paga, correto?
- `2026-05-29 13:52` 👤 Ontem tive consulta com meu médico.
- `2026-05-29 13:59` 🤖 Bom dia, Juliana. Tudo bem?
- `2026-05-29 13:59` 🤖 Você fez o protocolo de 10 infusões e fez 7 infusões.
- `2026-05-29 14:01` 👤 **[ÁUDIO]** Vou gravar o áudio que é mais fácil. É, bom dia, tudo bem? Ontem eu passei com o meu psiquiatra e ele falou que para eu cumprir o protocolo, eu preciso fazer mais uma sessão semanal e depois quatro sessões quinzenais, que seriam cinco sessões. Como eu tenho três, vou precisar de duas, mais duas, pagar mais duas sessões. Aí eu queria ver com você se eu já consigo pagar essas duas sessões, como é que eu faço pra ficar tudo certinho então. E ele vai mandar uma carta pro doutor... Esqueci o nome do doutor, mas pro doutor falando da avaliação que ele fez comigo ontem. E aí eu também passo com ele dia oito, não tem problema.
- `2026-05-29 14:04` 🤖 Oi Ju! É a Marisa
- `2026-05-29 14:04` 👤 Oi
- `2026-05-29 14:07` 🤖 Entendi, sem problemas. Você pode fazer mais estas duas sessões e pagar o valor do pacote, ainda podemos parcelar em 3 vezes.
- `2026-05-29 14:07` 🤖 É importante você nos encaminhar a solicitação do seu médico ok?
- `2026-05-29 14:14` 👤 Combinado.
- `2026-05-29 14:14` 👤 Vou enviar assim que receber.
- `2026-05-29 14:14` 👤 Muito obrigada
- `2026-05-29 14:17` 🤖 Disponha!
- `2026-05-29 14:17` 🤖 Ótimo final de semana!
- `2026-06-01 16:52` 👤 **[ÁUDIO]** Oi, tudo bem? Boa tarde. A gente consegue antecipar a minha sessão para amanhã?
- `2026-06-01 18:56` 👤 Oi, meninas.
- `2026-06-01 18:56` 👤 Podemos mudar?
- `2026-06-01 18:57` 🤖 Boa tarde, Ju.
- `2026-06-01 18:57` 🤖 Pode ser amanhã as 07:30 hs?
- `2026-06-01 18:58` 👤 Simm
- `2026-06-01 19:30` 🤖 Agendado!
- `2026-06-01 19:31` 🤖 Ju me desculpe, as 07:30 já tem paciente agendado. Pode ser as 08:30 hs?
- `2026-06-01 19:32` 👤 Pode sim
- `2026-06-01 19:32` 🤖 Muito obrigada!
- `2026-06-09 15:34` 👤 Boa tarde! Tudo bem? Podemos marcar a próxima infusão para segunda-feira?
- `2026-06-09 15:34` 👤 E quando tem agendamento com o Dr. Ivan?
- `2026-06-09 15:41` 🤖 **[ÁUDIO]** Oi, boa tarde, Ju, tudo bem? Edilene aqui da Clínica Or. Ju, o seu retorno, você pode agendar com o Dr. Ivan quando você se sentir confortável em fazer, porque o seu protocolo de 10, ele encerrou no dia 21/05. Aí dia 27/05 e dia 02/06, essas infusões, elas foram feitas desse novo protocolo que o seu esposo falou, né, referente a mais 4 infusões recomendadas pelo seu médico. Então se você quiser já agendar o retorno e agendar as outras infusões também, pode ser feito assim, tá bom?
- `2026-06-09 15:56` 👤 Oi Edilene, estou perdida por aqui...rs O combinado com meu médico é fazer mais 4 infusões para encerrar o protocolo. Tenho 4 a pagar, é isso?
- `2026-06-09 15:56` 👤 Me ajuda...rs
- `2026-06-09 15:58` 🤖 **[ÁUDIO]** Oi, Ju, desculpa, é... talvez eu não tenha sido clara. O que acontece: você fechou o protocolo de dez infusões, só que você fez doze e o seu médico recomendou mais quatro. Então você teria essas duas pra pagar, né, referente ao protocolo novo que o seu médico recomendou e mais duas que você ainda não fez.
- `2026-06-09 15:59` 👤 Entendi.
- `2026-06-09 16:00` 👤 Não seriam 6 para pagar? Duas já feitas e mais 4 que farei.
- `2026-06-09 16:01` 🤖 **[ÁUDIO]** Então, Ju, pelo que eu entendi, o seu médico recomendou só mais quatro infusões após finalizar o protocolo com 10. No caso, seriam 14 no total. Como você já fez 12, aí teria que pagar somente mais duas.
- `2026-06-09 16:02` 👤 Eu preciso fazer mais 4, quinzenais, nos meses de junho e julho.
- `2026-06-09 16:03` 🤖 Nesse caso sim terá que pagar as 6. Para seguir o protocolo do seu médico
- `2026-06-09 16:03` 👤 Entendi.
- `2026-06-09 16:03` 👤 Agora fechou.
- `2026-06-09 16:04` 👤 Vou pedir a receita do médico para formalizar mais 4 infusões. Poderá.ser.feito o valor de 750,00 por sessão?
- `2026-06-09 16:05` 🤖 Certo. Podemos manter o valor pago no protocolo anterior.
- `2026-06-09 16:06` 👤 Muito obrigada!!!
- `2026-06-09 16:11` 👤 Então podemos deixar a próxima infusão para segunda, primeiro horário?
- `2026-06-09 16:13` 🤖 Sim podemos, agendado para dia 15/06 as 07h30. Seguimos a disposição.
- `2026-06-09 16:15` 👤 Ok
- `2026-06-09 16:15` 👤 Obrigada.
- `2026-06-09 16:15` 🤖 Disponha.
- `2026-06-16 13:20` 👤 **[ÁUDIO]** Oi, Edilene, bom dia, tudo bom? Edilene, é - me ajuda. Eu preciso ver com o meu médico quantas ainda eu vou fazer e quantas eu já fiz. Eu confesso que eu acabei me perdendo aí no meio do processo. E aí eu queria te pedir um apoio. Você consegue me mandar as datas que eu fiz e qual que era o - a quantidade de cetamina? Para eu apresentar para ele esse levantamento e questionar quantas mais eu vou fazer, por favor?
- `2026-06-16 13:23` 🤖 Bom dia, Ju! É a Marisa. Tudo bem?
- `2026-06-16 13:25` 🤖 Só esclarecendo, você precisa saber as datas e as dosagens de todas infusões realizadas ou só do último protocolo?
- `2026-06-16 13:25` 👤 **[ÁUDIO]** Edilene, se você puder me passar de 100% do que eu já fiz, não só da última, eu acho que vai me ajudar mais.
- `2026-06-16 13:32` 🤖 Oi Ju! É a Marisa rs
- `2026-06-16 13:32` 🤖 Veja se são estas informações que você precisa:
- `2026-06-16 13:41` 🤖 juliana.pdf
- `2026-06-16 13:41` 👤 Perfeito.
- `2026-06-16 13:42` 👤 Assim consigo falar com facilidade com meu médico
- `2026-06-16 13:42` 👤 Obrigada e desculpe o trabalho
- `2026-06-16 13:42` 🤖 Estamos a disposição.

</details>


### Juliana Alves — `5517997768453`

**Custom fields:** `{"mensagem": "Lead confirmou agendamento cetamina para amanhã às 08:00. Procedimento: infusão de cetamina; Origem: whatsapp da clínica.", "interesse": "Infusão de Cetamina", "observacoes": "Lead confirmou agendamento cetamina para amanhã às 08:00. Procedimento: infusão de cetamina; Origem: whatsapp da clínica.", "data_horario": "2024-03-09T08:00:00-03:00", "qualificacao": "interessado", "procedime`

**Cenário:** `agendamento_recorrente_paciente_ativo` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Paciente recorrente em tratamento de manutenção com cetamina. Realizou a última sessão de um pacote e iniciou um novo ciclo de manutenção semanal prescrito pelo médico. Houve uma tentativa frustrada de agendamento para o mesmo dia devido à falta de vaga e feriado no dia seguinte, resultando no agendamento para a semana posterior. Por fim, confirmou nova sessão para o dia 17/06 às 08:00.


**Objeções:** indisponibilidade de agenda no dia solicitado, atraso na entrega da prescrição pelo médico externo

**Gatilhos:** continuidade do tratamento, facilidade de agendamento por whatsapp

<details><summary>Transcrição completa</summary>

- `2026-05-13 13:25` 👤 bom dia, tudo bem? tem disponibilidade de horario amanha?  é a minha ultima sessao do pacote ne?
- `2026-05-13 13:34` 🤖 Oi Juliana! Você fez 8 sessões até o momento
- `2026-05-13 13:34` 🤖 Pode ser amanhã as 08:00 hs?
- `2026-05-13 13:35` 👤 pode sim
- `2026-05-13 13:40` 🤖 Juliana, desculpe! Pode ser as 07:30 hs ou as 09:30? O horário das 08:00 hs já foi preenchido.
- `2026-05-13 13:40` 👤 9:30
- `2026-05-13 13:41` 🤖 ok obrigada!
- `2026-05-20 15:35` 👤 Boa tarde, tudo bem? Consigo ir amanhã?
- `2026-05-20 15:35` 👤 Aí é minha última sessão do pacote ne?
- `2026-05-20 16:13` 🤖 Oi Ju!
- `2026-05-20 16:13` 🤖 Pode ser amanhã as 08:00 hs?
- `2026-05-20 16:13` 🤖 Sim! É a ultima infusão
- `2026-05-20 16:51` 👤 Pode sim
- `2026-05-20 16:52` 🤖 Agendado!
- `2026-05-26 18:42` 👤 Boa tarde. Tem horário pra amanhã?
- `2026-05-26 18:51` 🤖 Olá Ju!
- `2026-05-26 18:51` 🤖 Pode ser as 08:30 hs?
- `2026-05-26 18:53` 👤 Podia sim
- `2026-05-26 19:00` 👤 Pode*
- `2026-05-26 19:00` 🤖 Agendado!
- `2026-06-03 13:11` 👤 Bom dia, tudo bem?
- `2026-06-03 13:16` 🤖 Bom dia, Ju!
- `2026-06-03 13:27` 👤 Amanhã estará aberto?
- `2026-06-03 13:38` 🤖 Olá bom dia Juliana, como vai? Não teremos atendimento amanhã.
- `2026-06-03 13:38` 👤 Bem tb?
- `2026-06-03 13:38` 👤 Ops
- `2026-06-03 13:38` 👤 Bem tb kkk
- `2026-06-03 13:41` 👤 Minha sessões acabaram, e semana passada passei em consulta e ele vai manter uma semanal. Na vdd já tinha prescrito mais 20 e eu paguei 10. Ele não enviou até agr, me respondeu que mais tarde envia. Consigo agendar pra hoje e dps enviar? Pq amanhã não abre e sexta tô de plantão 🥹🤦🏼‍♀️ Pq se não der, ficarei sem essa semana
- `2026-06-03 13:42` 👤 Disse q envia até 11:30, mas é enrolado kkkkk
- `2026-06-03 14:01` 🤖 Oi Ju! Hoje já não temos mais horário disponível.
- `2026-06-03 14:01` 👤 semana q vem marco
- `2026-06-03 14:03` 🤖 Já que deixar agendado?
- `2026-06-03 14:04` 👤 Sim sim
- `2026-06-03 14:04` 👤 Dia 9
- `2026-06-03 14:05` 🤖 Pode ser as 08:00 hs?
- `2026-06-03 14:06` 👤 Pode sim
- `2026-06-03 14:06` 🤖 ok agendado!
- `2026-06-08 23:46` 👤 Gj9fRG-FULL.pdf
- `2026-06-08 23:46` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-16 13:04` 👤 Bom diaa
- `2026-06-16 13:04` 👤 Amanhã de manhã tem?
- `2026-06-16 13:17` 🤖 Bom dia, Ju. Agendei para amanhã as 08:00 hs. Tudo bem?
- `2026-06-16 13:17` 👤 Tudico

</details>


### Rosangela — `5511982071521`

**Custom fields:** `{"interesse": "Infusão de Cetamina"}`

**Cenário:** `agendou_procedimento_pos_consulta` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Rosangela, paciente antiga, buscou agenda com Dr. Ivan. Realizou teleconsulta após alinhar pagamento via PIX (devido a limite de cartão). Após a consulta, recebeu indicação de protocolo de 8 infusões de Cetamina. Estava em Blumenau e aguardou retorno a SP para agendar. Retornou o contato solicitando horário para a primeira sessão, que foi confirmado para o dia 09/06. Atendimento finalizou reforçando as condições comerciais do pacote.


**Objeções:** Logística (estava em Blumenau), Liberação de limite no cartão de crédito

**Gatilhos:** Reembolso, Parcelamento em 6x, Desconto no pacote de infusões, Possibilidade de teleconsulta inicial

<details><summary>Transcrição completa</summary>

- `2026-05-28 20:52` 👤 Boa tarde, queria saber quando teria agenda disponível com o Dr Ivan. Aguardo retorno. Obrigada
- `2026-05-28 20:52` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-28 20:53` 🤖 Olá Rosangela!
- `2026-05-28 20:53` 👤 Olá
- `2026-05-28 20:53` 🤖 Tivemos um reagendamento e estamos com o horário de amanhã as 10:00 hs livre. Você tem disponibilidade?
- `2026-05-28 20:54` 🤖 A consulta pode ser presencial ou online.
- `2026-05-28 20:55` 👤 Eu queria pagar com meu cartão, mas acabei de pagar a fatura, será q não teria agenda amanhã no final da tarde que eu acho que amanhã a parte da tarde já é o meu cartão tá liberado
- `2026-05-28 20:59` 🤖 Entendo! De sexta feira o último horário de atendimento do Dr. Ivan é as 12:00 hs. Vamos agendar para semana que vem?
- `2026-05-28 21:00` 🤖 Temos horário dia 02/06 as 17:00 hs. Seria melhor para você?
- `2026-05-28 21:00` 👤 Vamos deixar para amanhã mesmo
- `2026-05-28 21:00` 👤 Eu pago amanhã antes da consulta
- `2026-05-28 21:00` 👤 Pode ser?
- `2026-05-28 21:01` 👤 Qual valor da consulta
- `2026-05-28 21:06` 🤖 Sim. Pode ser
- `2026-05-28 21:07` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-28 21:07` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-28 21:11` 👤 Eu vou fazer Pix
- `2026-05-28 21:12` 👤 Eu acho que meus dados todo já tem aí porque eu sou paciente
- `2026-05-28 21:12` 👤 Vc pode me passar a chave pix
- `2026-05-28 21:13` 🤖 Certo! Então só me passe o número do seu cpf. Por favor.
- `2026-05-28 21:13` 👤 00386174989
- `2026-05-28 21:13` 🤖 A consulta será online?
- `2026-05-28 21:14` 👤 Sim
- `2026-05-28 21:14` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-28 21:14` 🤖 Por favor, preciso que você me envie o comprovante até as 09:30 hs. ok?
- `2026-05-28 21:15` 👤 Vou fazer hj ainda
- `2026-05-28 21:16` 🤖 ok obrigada
- `2026-05-28 21:22` 👤 *[imagem]*
- `2026-05-28 21:25` 🤖 Muito  obrigada Rosangela!
- `2026-05-28 21:25` 🤖 Consulta online agendada para amanha as 10:00 hs
- `2026-05-28 21:25` 🤖 Amanhã pela manha enviaremos o link
- `2026-05-29 11:47` 🤖 Olá bom dia Rosangela, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-29 11:47` 🤖 Rosângela Farias - Dr. Ivan Barenboim - 29/05/2026 Sexta-feira, 29 de maio · 10:00 – 10:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/nwb-gzxv-ijm
- `2026-05-29 13:04` 🤖 Bom dia, Rosabgela.
- `2026-05-29 13:04` 🤖 Dr. Ivan te aguarda no meet
- `2026-05-29 13:28` 🤖 segue o link do App da Clínica para que consiga *verificar suas prescrições* e fazer seus próprios agendamentos de consulta. *App IOS*: https://apps.apple.com/br/app/cl%C3%ADnica-%C3%B3r-psiquiatria/id6745094818 *App Android*: https://play.google.com/store/apps/details?id=br.com.clinicaorpsiquiatria.app  *WebApp*: https://orpsiquiatria.vsaudeapp.com.br/app Para acessar o App use seu e-mail de cadastro e a *senha: 010203*  As prescrições se encontram em *arquivos*.  Qualquer dúvida sigo a disposi
- `2026-05-29 13:29` 🤖 Segue vídeo do passo a passo
- `2026-05-29 13:29` 🤖 [Vídeo]
- `2026-05-29 13:30` 🤖 Oi Rosangela. O Dr. Ivan recomendou para você o protocolo inicial de infusões de cetamina.
- `2026-05-29 13:30` 🤖 Em geral, são feitas duas infusões por semana por 4 semanas.
- `2026-05-29 13:30` 🤖 O preço por infusão fica R$800,00 caso você feche o pacote de 8 infusões. Senão, cada infusão avulsa fica R$900,00.
- `2026-05-29 13:31` 🤖 Este pacote ainda inclui uma consulta de reavaliação com o Dr. ao final dele.
- `2026-05-29 13:31` 🤖 Parcelamos no cartão em até 6x e emitimos nota para reembolso.
- `2026-05-29 13:31` 🤖 Vamos agendar a primeira infusão?
- `2026-05-29 13:37` 👤 Oie! Então, eu só preciso saber certinho que dia vou ir embora daqui de Blumenau
- `2026-05-29 13:37` 👤 To aqui agora
- `2026-05-29 13:38` 🤖 Entendi! Entro em contato na próxima semana ok?
- `2026-05-29 13:39` 👤 Eu explicei pro Dr. que eu quero saindo aqui de Blumenau passar aí na clínica eu sabendo certinho que dia eu vou eu já aviso pra ver se dá pra encaixar um horário pra mim
- `2026-05-29 13:39` 👤 Assim que eu conseguir falar com meu marido eu mando mensagem hoje ainda
- `2026-05-29 13:41` 🤖 Sem problemas. Estamos a disposição!
- `2026-06-08 20:13` 👤 Boa tarde, tudo bem?
- `2026-06-08 20:30` 🤖 Boa tarde. Tudo bem e você?
- `2026-06-08 20:44` 👤 Boa tarde, amanhã de manhã teria horário disponível às 10:30h?
- `2026-06-08 20:44` 👤 Pra fazer seção de Cetamina?
- `2026-06-08 20:54` 🤖 Olá Rosangela!
- `2026-06-08 20:55` 👤 Olá
- `2026-06-08 20:55` 🤖 Agendado!
- `2026-06-08 22:25` 👤 Obrigada!
- `2026-06-08 22:25` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-10 12:14` 🤖 Olá bom dia Rosangela, como vai? Conforme solicitou ontem, segue os valores referente ao protocolo que o  doutor Ivan indicou que são 8 infusões de escetamina. Em geral, são feitas duas infusões por semana por 4 semanas.  O preço por infusão fica R$800,00 caso você feche o pacote de 8 infusões. Senão, cada infusão avulsa fica R$900,00.  Este pacote ainda inclui uma consulta de reavaliação com o Dr. ao final dele.  Vamos agendar sua próxima infusão?

</details>


### Oliver — `5511945011592`

**Custom fields:** `{"origem": "Google - Orgânico", "mensagem": "Lead solicitou marcação da sessão de cetamina para semana que vem, com disponibilidade de 15:00 às 18:00 devido mudança de cronograma; estava quinzenal. Mantém prioridade para cetamina.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead solicitou marcação da sessão de cetamina para semana que vem, com disponibilidade de 15:00 às 18:00 devid`

**Cenário:** `reagendamento_recorrente` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Oliver é um paciente recorrente em tratamento de cetamina. Ao longo da conversa, realizou diversos agendamentos de infusões e uma teleconsulta de retorno com o Dr. Ivan após completar 4 sessões. Solicitou notas fiscais para reembolso e, por fim, tentou ajustar seu horário para o período da tarde devido a mudanças de cronograma, mas acabou confirmando a próxima sessão para segunda-feira às 10:00.


**Objeções:** conflito de agenda

**Gatilhos:** manutenção de tratamento, reembolso convênio

<details><summary>Transcrição completa</summary>

- `2026-05-18 11:14` 👤 Oii bom dia!
- `2026-05-18 11:14` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-18 11:14` 👤 É o Oliver, gostaria de marcar minha próxima sessão
- `2026-05-18 11:14` 👤 Teria horário hoje?
- `2026-05-18 11:16` 🤖 Olá bom dia Oliver, qual horário aproximadamente gostaria de agendar?
- `2026-05-18 11:16` 👤 Umas 11 às 15
- `2026-05-18 11:25` 🤖 Temos horário as 10h, seria conveniente para você?
- `2026-05-18 11:25` 👤 sim
- `2026-05-18 11:26` 🤖 Certo, agendado.
- `2026-05-18 11:26` 🤖 Seguimos a disposição.
- `2026-05-18 11:26` 👤 ok
- `2026-05-18 11:26` 👤 obg
- `2026-05-25 10:21` 👤 Bom dia, tudo bem? Teria horário pra hoje?
- `2026-05-25 10:21` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-25 10:39` 🤖 Olá bom dia Oliver, como vai? Temos horário sim, qual horário aproximado seria mais conveniente para você?
- `2026-05-25 10:39` 👤 Teria as 9:00?
- `2026-05-25 10:41` 🤖 Temos horário as 09h30, esse horário funciona para você?
- `2026-05-25 10:41` 👤 Sim
- `2026-05-25 10:45` 🤖 Agendado. Seguimos a disposição.
- `2026-06-01 10:09` 👤 Bom dia meninas
- `2026-06-01 10:09` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-01 10:09` 👤 Gostaria de marcar minha próxima consulta da Cetamina
- `2026-06-01 10:09` 👤 Teria hoje as 9:30 ou 10?
- `2026-06-01 10:43` 🤖 Olá bom dia Oliver, como vai? Temos horário as 09h30, esse horário funciona para você?
- `2026-06-01 11:03` 👤 Sim
- `2026-06-01 11:08` 🤖 Agendado.
- `2026-06-01 13:50` 🤖 Bom dia, Oliver!
- `2026-06-01 13:52` 🤖 Bom dia, Oliver. Você já fez 4 infusões deste novo protocolo, agora é necessário agendar o retorno com o Dr. Ivan.
- `2026-06-01 13:52` 🤖 Temos horário amanhã as 10:00 hs. Você tem disponibilidade?
- `2026-06-01 13:57` 👤 Vou verificar aqui só um momentinho
- `2026-06-01 14:00` 👤 Pode ser na quarta-feira?
- `2026-06-01 14:00` 🤖 Sim! Pode ser quarta as 10:00 hs?
- `2026-06-01 14:06` 👤 Sim
- `2026-06-01 14:07` 🤖 Presencial ou online?
- `2026-06-01 14:16` 👤 Online
- `2026-06-01 14:16` 🤖 Agendado! Grata!
- `2026-06-01 14:16` 🤖 Marisa rs
- `2026-06-01 14:17` 👤 Obrigado Marisa
- `2026-06-01 14:17` 🤖 Disponha!
- `2026-06-01 19:25` 👤 Boa tarde
- `2026-06-01 19:25` 👤 Td bem?
- `2026-06-01 19:25` 👤 Poderiam me reenviar os comprovantes para eu obter o reembolso do convênio por gentileza
- `2026-06-01 19:26` 👤 Obrigado ☺️
- `2026-06-01 19:29` 🤖 NFSe_52686124_15259.pdf
- `2026-06-02 14:21` 👤 Oi bom dia, o dr teria horario hoje a tarde?
- `2026-06-02 14:23` 🤖 Bom dia, Oliver! Tudo bem? Popde ser as 17:00 hs?
- `2026-06-02 14:28` 👤 sim
- `2026-06-02 14:28` 👤 marcado
- `2026-06-02 14:29` 🤖 Agendado!
- `2026-06-02 14:30` 🤖 On line! Certo?
- `2026-06-02 14:32` 👤 sim
- `2026-06-02 14:33` 🤖 ok
- `2026-06-02 16:05` 🤖 Oliver! Segue o link para consulta.
- `2026-06-02 16:05` 🤖 Oliver De Paula Jimenez - Dr. Ivan Barenboim - 02/06/2026 Terça-feira, 2 de junho · 5:00 – 5:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/rgi-wkuw-fzq
- `2026-06-14 08:45` 👤 Oi tudo bem? Aqui é o Oliver
- `2026-06-14 08:45` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-14 08:46` 👤 Gostaria de marcar minha sessão de cetamina para semana que vem, que agora é quinzenal mas agora eu estou com uma mudança de cronograma de horário que só vou poder das 15:00 às 18:00.  É possível?
- `2026-06-15 10:56` 🤖 Olá bom dia Oliver, como vai? Nosso ultimo horário de infusão são as 15h30 caso esteja disponível, qual dia da semana que vem gostaria de agendar, para vermos a disponibilidade de horário.
- `2026-06-15 11:15` 👤 Tá bom o obrigado
- `2026-06-15 11:15` 👤 A minha próxima é semana que vem né?
- `2026-06-15 11:21` 🤖 **[ÁUDIO]** Oi, Oliver, tudo bem? Sim, acredito que seja a semana que vem. Eu vou verificar aqui, mas eu preciso que você me diga qual dia da semana que você prefere vir por volta desse horário, para eu poder verificar a disponibilidade.
- `2026-06-15 11:36` 👤 Pode ser segunda que vem então no mesmo no horário de sempre as 10:00
- `2026-06-15 11:43` 🤖 Agendado
- `2026-06-15 11:45` 👤 obg
- `2026-06-15 11:45` 🤖 Disponha.

</details>


### Juca (Sérgio) Palacios — `5519971111975`

**Custom fields:** `{"origem": "Indeterminado", "interesse": "Infusão de Cetamina", "data_horario": "2026-05-15T10:00:00-03:00", "procedimentos": "[\"Sessão de terapia\",\"Infusão de cetamina\"]"}`

**Cenário:** `lead_recorrente_fechamento_pacote` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Juca (Sérgio) realizou retorno online com Dr. Ivan, que recomendou protocolo de manutenção de 10 sessões de cetamina por R$ 8.000,00. O lead apresentou dificuldades financeiras, realizando crowdfunding e solicitando parcelamento em 12x usando dois cartões (o dele e o da irmã). Houve problemas técnicos com o link de pagamento antifraude. Após vários adiamentos por crises de dor física, o lead confirmou o início do protocolo para quarta-feira, com a intenção de pagar presencialmente.


**Objeções:** Limite de cartão de crédito, Dificuldade financeira, Dores físicas impedindo deslocamento, Problemas com link de pagamento antifraude

**Gatilhos:** Melhoria com tratamento anterior, Parcelamento em 12x, Necessidade de controle de dor física

<details><summary>Transcrição completa</summary>

- `2026-05-07 16:52` 👤 **[ÁUDIO]** Oi, bom dia! Por acaso minha esposa entrou em contato com vocês hoje?
- `2026-05-07 17:13` 🤖 Oi Juca! Boa tarde!
- `2026-05-07 17:13` 🤖 Não
- `2026-05-07 17:42` 🤖 Boa tarde, Juca. Tudo bem?
- `2026-05-07 17:42` 🤖 O Dr. Ivan pediu para adiantar o seu retorno.
- `2026-05-07 17:43` 🤖 Pode ser dia 11/05 as 12:00 hs?
- `2026-05-07 17:43` 🤖 O retorno será online?
- `2026-05-07 18:02` 👤 **[ÁUDIO]** Oi, boa tarde. É... vai ser no dia 11, segunda-feira que vem, é isso? Que o dia que a minha esposa iria comigo é o dia do rodízio do carro. Então, até esqueci de falar, mas é... como a gente vai fazer online, que eu quero que minha esposa participe, é... eu não sei se segunda-feira ela pode ir, enfim. Pode ser nesse dia, eu só vou confirmar a hora que eu falar com ela qual que vai ser o dia e o horário da infusão, tá bom? Obrigado.
- `2026-05-07 18:13` 🤖 **[ÁUDIO]** Oi Juca, Marisa, tudo bem? Boa tarde. Juca, só me confirma: vai ser online ou vai ser presencial o retorno? Eu não entendi, porque você falou que a sua esposa quer participar, mas aí de forma online ela também consegue participar. Qual que é a sua a sua opção preferida?
- `2026-05-11 12:34` 🤖 Olá bom dia Sergio, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-11 12:34` 🤖 Sergio Magalhães Palácios Junior  - Dr Ivan Barenboim - 11/05/2026 Segunda-feira, 11 de maio · 12:00 – 12:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/ayb-uirq-jho
- `2026-05-11 12:35` 👤 Tranquilo eu nem costumo abrir meu e-mail é só spam rsrs
- `2026-05-11 15:03` 🤖 Olá Juca! O Dr. Ivan vai atrasar alguns minutos
- `2026-05-11 15:04` 👤 Quantos mais ou menos?
- `2026-05-11 15:04` 🤖 Ele esta finalizando um atendimento, mais uns 5 min.
- `2026-05-11 15:05` 👤 Vc pode me avisar aqui no WhatsApp e eu entro na sala na hora?
- `2026-05-11 15:05` 🤖 Sim podemos.
- `2026-05-11 15:08` 🤖 Dr te aguarda na sala do meet.
- `2026-05-11 15:40` 🤖 **[ÁUDIO]** Olá Juca, boa tarde tudo bem? É a Marisa.
Juca o Dr. recomenda uma nova fase de protocolo de setamina para você, né? Que nós chamamos de protocolo de manutenção. São 10 sessões de setamina. A princípio você vai fazer uma por semana, depois você passa em retorno. Então são quatro, aí você passa no retorno e depois o doutor vai confirmar se serão de 15 em 15 dias mais 6.
- `2026-05-11 15:40` 🤖 **[ÁUDIO]** O valor do protocolo é R$ 8.000,00. O doutor autorizou que você faça em 12 vezes sem juros no cartão, tá bom? Eh, vamos agendar?
- `2026-05-11 16:00` 👤 Eu ainda tenho uma sessão do protocolo antigo.
- `2026-05-11 16:01` 👤 Posso marcar para quarta feira as 10:00?
- `2026-05-11 16:05` 🤖 Sim pode ser na quarta feira as 10h.
- `2026-05-12 12:50` 👤 Olá tive uns imprevistos, podemos mudar para sexta as 10:00?
- `2026-05-12 12:55` 🤖 Bom dia! Alterado!
- `2026-05-13 18:33` 🤖 Juca, caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr
- `2026-05-13 19:43` 👤 Ok
- `2026-05-13 21:23` 👤 **[ÁUDIO]** Olá, boa noite. Eu vou pedir a gentileza para vocês, porque eu estou fazendo, né, alguns grupos de crowdfunding, que é de doações por causas, e inclusive uma de rifa social, que eu vou rifar um ar condicionado aqui que vale dois mil e trezentos, né, para conseguir pagar essa segunda fase do tratamento. Então eu queria que o doutor, assim, em breves palavras, né, só falasse realmente do meu caso, né, colocasse meu nome, o CRM, e falasse o porquê que eu estou fazendo, né, o tempo que eu estou sofrendo com esses problemas, né, de dores, depressão e ansiedade. E eu vou falar uma coisa, tá? Ênfase na dor. Porque as pessoas tendem a ter mais empatia com quem sente dor física, né, do que quem sente dor emocional. Porque quem nunca sentiu acha que é frescura, né? Então, né, pode falar de tudo, mas se puder dar um foco, né, no como o tratamento também ajuda na dor neurológica, e vem ajudando realmente, para eu poder postar isso na internet o mais rápido possível para arrecadar o dinheiro para fazer a segunda fase do tratamento. Obrigado.
- `2026-05-13 21:26` 🤖 Oi Juca. Você deseja uma declaração por escrito?
- `2026-05-13 21:27` 👤 Sim por favor.
- `2026-05-13 21:28` 👤 É para dar credibilidade, e no final das contas estarei fazendo propaganda de vcs de forma gratuita, rsrs. Só para descontrair
- `2026-05-13 21:31` 🤖 Certo. Iremos solicitar a pessoa responsável e assim que possível te retornamos. Seguimos à disposição.
- `2026-05-18 13:48` 👤 Ola posso marcar minha ultima consulta do pacote para quarta feira as 10:00?
- `2026-05-18 13:50` 🤖 Bom dia, Juca. Tudo bem?
- `2026-05-18 13:50` 🤖 Seria a infusão?
- `2026-05-18 13:50` 👤 Sim
- `2026-05-18 13:50` 🤖 Temos horário as 09:30 ou as 11:30 hs. Qual seria a melhor opção?
- `2026-05-18 13:50` 👤 9:30
- `2026-05-18 13:51` 🤖 Certo! Agendado
- `2026-05-18 13:51` 👤 Obrigado.
- `2026-05-18 13:53` 🤖 Disponha!
- `2026-05-19 19:37` 🤖 Boa tarde, Juca!
- `2026-05-19 19:37` 🤖 A declaração solicitada, está disponível no App.
- `2026-05-19 19:37` 👤 Boa tarde!
- `2026-05-19 19:37` 👤 Ah obrigado!
- `2026-05-19 19:38` 🤖 Disponha!
- `2026-05-22 01:11` 👤 Olá bom dia,
- `2026-05-22 01:11` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-22 01:12` 👤 Eu combinei com o Dr Ivan de dividir as próximas 10 sessões em 12x.
- `2026-05-22 01:13` 👤 Mas eu vou fazer assim me passa um link de 4.000,00 para pagar em 10x.
- `2026-05-22 01:14` 👤 E quando eu for aí eu passo os outros 4.000,00 porque aí ja virou o meu cartão.
- `2026-05-22 01:17` 👤 Marca para mim, na próxima quarta as 10:00
- `2026-05-22 01:17` 👤 Aliás marca para as próximas 4 quartas as 10:00
- `2026-05-22 10:53` 👤 **[ÁUDIO]** Oi, meninas. É... eu combinei com o doutor de pagar em em 12 vezes, né, o valor total. Só que será em dois cartões. Então me passa o link do pagamento de 4.000 em 10 vezes, tá? Nesse cartão eu vou pagar em 10 vezes e não em 12. E aí quando eu for aí, aí eu passo pessoalmente o outro cartão, eh, aí vai ser em 12 vezes, tá bom? Obrigado.
- `2026-05-22 11:07` 🤖 **[ÁUDIO]** Oi, bom dia, tudo bem? Edilene, aqui da Clínica Orr. Eu vi sua mensagem, tá bom? O doutor, ele autorizou fazer 12 vezes o valor total do tratamento, né? Então, nesse caso, eu não posso parcelar 4.000 em 10 vezes e depois mais 4.000, que na verdade não é o valor referente ao protocolo, né? Então eu preciso confirmar com o doutor se ele autoriza parcelar 4.000 em 10 vezes, tá? Porque a autorização que a gente faz esse valor é no máximo em 5 vezes, tá bom? E como ele autorizou fazer esse pagamento parcelado em 12 vezes, eh, eu não posso permitir sem o aval dele que você pague uma parte agora e a outra parte quando você vier, tá bom? Eu vou verificar com ele essa possibilidade e te retorno.
- `2026-05-22 11:11` 👤 **[ÁUDIO]** É que quarta-feira que vem, eu estaria aí, né, fazendo o novo protocolo. Então, eu não sei, eu não vejo problema, né, hoje é sexta, até esperar até quarta para passar o cartão. Mas se tiver problema, precisar ser os dois no mesmo dia, passa um link de 4 mil, que a gente vai pagar em um cartão, em 10 vezes, e outro link de 4 mil para passar no cartão em 12 vezes. A única coisa que a gente vai fazer o pagamento de 8 mil, a única coisa que eu preciso usar dois cartões, porque senão eu estouro o limite do cartão, né, eu não consigo passar 8 mil em um só. Eu tenho que dividir nesses dois. Então, se você quiser, manda dois links: um em 10 vezes, outro em 12 e fazemos os dois pagamentos hoje. Senão, quando eu tiver aí, eu levo o cartão físico, ponho na maquina de vocês e pago também. Vocês que veêm como preferem fazer, para mim é tanto faz.
- `2026-05-22 11:25` 🤖 **[ÁUDIO]** Oi, Juca! O problema não é quando você vai passar o cartão. A questão aqui é que o doutor autorizou R$ 8.000,00 em 12 vezes, não R$ 4.000,00 em 10 e mais R$ 4.000,00 em 12. Não foi isso que o doutor autorizou. Por isso que eu estou aguardando o retorno dele referente a sua solicitação, tá bom?
- `2026-05-22 12:22` 👤 **[ÁUDIO]** Sim, eu entendo que tenha que falar com o doutor, mas ficou até melhor para ele, porque uma parte que era para ser em 12 ficou em 10. Né? Então, eh, isso vai poupar juros dele, então ficou melhor. Eh, e na verdade é 8 mil, a única coisa é que são dois cartões para poder, eh, ter o crédito, né? Porque o cartão tem limite e ele também tem outras coisas que a gente precisa comprar com o cartão. Então, eh, tivemos que dividir em dois, tá bom? Mas é... é aquilo que a gente combinou com o doutor e um pouquinho melhor para ele.
- `2026-05-22 12:24` 🤖 **[ÁUDIO]** Oi, Juca. Então, Juca, na verdade não, não fica melhor pro doutor parcelar 4.000 em dez vezes, né? Quanto menos parcelamento, menos taxas ele paga no banco. Então por isso que eu vou aguardar o retorno dele, tá bom? E assim que eu tiver o retorno dele, eu falo com você novamente. Tenha um bom dia.
- `2026-05-22 12:26` 👤 **[ÁUDIO]** Mas não é 4 mil em 12 vezes. É 8 mil. Porque... Vai vir, vai pra ele 8 mil, a diferença é que é em dois cartões. Então ele permitiu 8 mil em 12 vezes, ele vai receber 8 mil... Hum... Em onze vezes, digamos, né? Porque uma parte ele recebe em 10 e outra parte ele recebe em 12. Mas, né, se esse for o grande problema, vamo fazer em 10, né? Porque é... É a mesma pessoa que vai pagar. Só que em dois cartões diferentes. Então não é 4 mil. É 8 mil. Né? É que nem cê... Cê vai pagar o... Alguma coisa, cê dá duas notas de cinco, não foi que cê deu cinco... Né? E os outros cinco pra outra coisa. É... Cê soma, né? Então... Passa isso pra ele, né? Passa... Peça a compreensão dele porque... É... Pra mim, assim, arrumar esse dinheiro foi muito difícil. Foi muito difícil.
- `2026-05-22 12:26` 🤖 Posso te ligar?
- `2026-05-22 12:27` 👤 Sim
- `2026-05-22 14:52` 👤 Eu sei que depende do Ok do Dr, mas pensa comigo os dois cartoes com a mensalidade de 400+400 da 800 reais por mês. É exatamente igual a pagar com um cartão 800. Eu sei que tem os juros do cartão mas se ele tirasse 20 reais dos 800 ficaria 780. Com dois cartaoes o juros ficaria 10+10 e no final ele fica 780.
- `2026-05-22 14:52` 🤖 Juca é a Marisa
- `2026-05-22 14:53` 👤 Essa é a única maneira de eu continuar o tratamento, não tenho condiçoes de fazer de outra forma.
- `2026-05-22 14:53` 🤖 Fique tranquilo. Assim que o Dr. Ivan responder, entraremos em contato contigo!
- `2026-05-22 14:53` 👤 O outro cartão é da minha irmã ela vai pagar metade.
- `2026-05-22 14:54` 🤖 Certo!
- `2026-05-22 14:55` 👤 Não sei se consigo ficar tranquilo…até ter uma resposta.
- `2026-05-22 14:56` 🤖 Hoje o Dr. Ivan não está na Clínica, não sei se teremos esta resposta ainda hoje.
- `2026-05-22 14:56` 👤 Eu entendo.
- `2026-05-22 17:25` 👤 Nenhuma resposta do Dr Ivan?
- `2026-05-22 17:27` 🤖 **[ÁUDIO]** Oi Juca, tudo bem? Edilene. Então, como hoje é feriado judaico, eu acredito que o doutor vai responder mais para o fim da tarde, tá bom? Assim que finalizar o feriado dele, ele sinaliza para a gente as solicitações que nós já fizemos hoje pela manhã, tá? Mas fica tranquilo que assim que a gente tiver um retorno, a gente avisa você.
- `2026-05-22 17:34` 👤 Ele é Judeu? Que feriado é hoje?
- `2026-05-22 17:36` 👤 Eu sou fascinado  pela história e cultura Judaica
- `2026-05-22 17:37` 👤 Afinal meu Salvador (Jesus) é judeu.
- `2026-05-22 17:39` 👤 **[ÁUDIO]** “Sabe o que que é? É que a gente estava quebrando a cabeça como arrumar esse dinheiro, que da primeira vez a gente já fez uma rifa solidária pelas pessoas ajudarem, né? Metade — mais da metade — foi ajuda, né, de pessoas que eu conheço, mas eu não tinha como pedir de novo. E minha irmã é assim: ela fez um ato de fé. Ela falou: “João, eu vou pagar a metade”. E num ato de fé, né, porque eu nem sei como vai ser daqui para frente, ela está desempregada. E, assim, na minha cabeça, é muito lógico que é a mesma coisa. Tipo, a pessoa pede para mim: “Ó, vou falar, vou comprar esse bolinho, quanto é? Ah, é dez reais”. Aí eu tiro duas notas de cinco, ele fala: “Não, eu não posso aceitar duas notas de cinco. Se for duas notas de cinco, aí tem juros de mais dois reais”, entende? É essa a lógica, porque é pra mesma pessoa e os valores vão cair na mesma data. Então é a mesma coisa que, em vez de dar dez reais, eu tô dando duas notas de cinco, que dá exatamente dez, né? Então, eu tô angustiado mesmo, porque eu melhorei muito, mas eu preciso desse tratamento, porque eu não melhorei completamente. Se eu tivesse melhorado completamente, eu não estaria angustiado do jeito que eu tô agora.”
- `2026-05-22 18:07` 🤖 Olá boa tarde Juca, conforme havíamos dito sobre após o retorno do doutor iriamos te contatar, o Dr Ivan autorizou o seu pagamento ser da forma que você sugeriu 4000 em 10x e os outros 4000 em 12x. Podemos gerar o link de pagamento?
- `2026-05-22 18:08` 👤 Pode graças a Deus....
- `2026-05-22 18:09` 👤 Como está na sexta-feira a tarde vc pode gerar hoje para pagamento na segunda?
- `2026-05-22 18:09` 👤 Muito obrigado.
- `2026-05-22 18:10` 🤖 Não temos essa opção.
- `2026-05-22 18:12` 🤖 https://pay.sumup.com/b2c/X0RVQO8J3F
- `2026-05-22 18:12` 🤖 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-22 18:13` 👤 **[ÁUDIO]** Até que hora pode pagar? Porque, por exemplo, o cartão que a gente tem, né, o cartão virtual, ele muda aquele código de... aquele código, né, de verificação, a cada dia. Então, eu preciso esperar ela chegar aqui, eu não sei que horas ela chega, e aí fazer. E eu não sei até que horas pode fazer o pagamento, entendeu?
- `2026-05-22 18:15` 🤖 **[ÁUDIO]** Oi, Juca, tudo bem? Então, esse link, ele tem a duração de 24 horas, tá bom? Aí você pode fazer o pagamento quando a sua esposa chegar em casa e enviar o comprovante pra gente poder agendar as suas próximas infusões, tá bom? A gente fica no aguardo.
- `2026-05-22 18:16` 👤 **[ÁUDIO]** Então esse é o que a minha irmã vai pagar, eu já encaminhei para ela. Agora falta fazer o meu, né? Que é de 4000 em 12 vezes, né? Então esse aí eu mandei para minha irmã e falta o outro para somar os 8000 do tratamento.
- `2026-05-22 18:18` 👤 Faltou o meu link
- `2026-05-22 18:18` 🤖 https://pay.sumup.com/b2c/X6I2SLS474
- `2026-05-22 18:18` 🤖 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-22 18:20` 🤖 **[ÁUDIO]** Olá, Juca, tudo bem? É a Marisa. Os dois links foram enviados, tá bom? Então na segunda-feira, no primeiro horário, nós entraremos em contato para fazer os agendamentos, tá bom? Muito obrigada, bom final de semana!
- `2026-05-22 18:21` 👤 Sim vou fazer assim que a Fabiana chegar aqui.
- `2026-05-22 20:06` 👤 *[imagem]*
- `2026-05-22 20:38` 🤖 Muito obrigada Juca!
- `2026-05-22 21:23` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-22 21:23` 👤 **[ÁUDIO]** Olá, boa noite, se vocês estiverem ainda trabalhando, ou bom dia. É, eu não estou conseguindo pagar pelo link, o cartão tá vindo sendo recusado. Não é por falta de saldo, a gente tem saldo Pros quatro mil, é que esse cartão é cheio de de coisas antifraude, furto, etc. Então assim, é um valor que não é o usual a gente pagar, né? É, e pode ser que eles bloquearam. Eu vou tentar de qualquer forma fazer pelo meu celular, pra ver se dá alguma diferença, mas eu não acredito. Mas de qualquer forma, a gente, eu vou aí, né, se se o médico tem pressa em receber, adianta a consulta de quarta - bom, pra segunda não dá, né, porque segunda não vai dar pra avisar, mas - putz, terça-feira eu também não posso... então quarta-feira eu vou aí com o cartão e passo o cartão se eu não conseguir pagar pelo link, tá OK?
- `2026-05-25 14:41` 👤 **[ÁUDIO]** Oi, bom dia! É, primeiro eu queria gostaria de confirmar a minha sessão na quarta-feira, né, e fechar todas as quartas-feiras às 10 horas, né, pro pro mês inteiro. É, e outra coisa, eu não consegui fazer o pagamento pelo link, esse cartão é muito chato, meu, ele trava tudo, assim que é um pouco diferente. E como tá no nome da minha esposa, eu vou tentar fazer na hora do almoço se vocês me passarem o link. Mas se não der, na quarta-feira eu consigo passar, por que quando coloca a senha, aí ele, né, ele aceita qualquer transação. Quando aparece alguma transação diferente via internet, ele bloqueia, aí a Fabiana tem que ir lá, né, a gente tem que ligar, falar "pode desbloquear", né? Enfim, é... a última vez que eu fui pra aí, tive meus cartões clonados, né? Então a gente fez BO, tudo, mas o nível de segurança dos caras em relação aos cartões deles, tá... tá muito alto.
- `2026-05-25 14:42` 👤 **[ÁUDIO]** Outra coisa, eu conversei com a Fabiana, né? E a gente decidiu, assim, né, que o doutor possa dar o diazepam, né, e não o rivotril, porque o diazepam não altera a minha consciência, né, eu fico completamente consciente e ele alivia demais as dores, por um tempo, dor física, pra eu poder fazer academia, né? Faz três semanas que eu não faço academia, aí a dor aumenta, a dor aumenta e eu não faço academia. Então eu preciso de algo assim, eu sei que não é tratamento para dor, mas é algo que relaxa os músculos o suficiente para eu ir para a academia, aí eu faço academia dois, três dias, passa a dor e eu toco o barco pra frente. Então, conversa com o doutor se na quarta-feira ele pode me dar uma receita de diazepam, né, 60 comprimidos, né, alguma coisa assim mais para eventualidade, espero que seja uma caixa que dure muito tempo.
- `2026-05-25 14:45` 🤖 **[ÁUDIO]** Olá, bom dia, tudo bem? Então, referente à solicitação de medicação, vou orientar você que faça o pedido diretamente para o doutor, já que você tem algumas recomendações referente às suas medicações, tá bom? O doutor autorizando, ele vai fazer e vai deixar pronto para quando você vier fazer sua infusão. Nós vamos agendar então a sua infusão para quarta-feira, tá bom?
- `2026-06-03 15:34` 👤 Boa tarde, hj eu estava com muita dor não consegui ir a clínica. Não foi planejado mas aconteceu.  Vcs vão trabalhar esta sexta-feira?
- `2026-06-03 16:03` 🤖 Olá boa tarde, como vai? Na sexta temos horário as 09h30. Esse horário funciona para você?
- `2026-06-10 18:21` 🤖 Olá! Boa tarde Juca. Tudo bem?
- `2026-06-10 18:22` 🤖 Estamos sentindo sua falta!
- `2026-06-10 18:24` 👤 Boa tarde, eu estou com dor e estava sem os remédios para dor. Eu tentei ir hj mas não consegui. Eu ja consegui a receita e vou comprar os remédios hj, vcs por um acaso tem horário na sexta-feira?
- `2026-06-10 18:27` 🤖 Entendo! Pode ser sexta feira as 10:00 hs?
- `2026-06-10 18:27` 👤 Sim!!
- `2026-06-15 17:47` 👤 **[ÁUDIO]** Oi, olá! É, realmente não deu para ir na sexta, porque eu peguei o remédio na sexta e ele demora alguns dias para fazer efeito. Então acordei com muita dor, não tinha condições. Mas aí passou o sábado, domingo, eu continuei tomando, né, a pregabalina, e melhorou, né? Então agora estou tranquilo, estou fazendo tudo, vou voltar para a academia, né? Voltei a trabalhar. Então, quarta-feira eu vou naquele horário que a gente tem combinado, né? E aí a gente deixa, né, as próximas quatro quartas-feiras aí marcadas para fazer a primeira parte do protocolo. Eu não lembro o nome do doutor. Eu preciso falar com ele. Vocês podem me passar novamente para eu achar aqui no meu WhatsApp?
- `2026-06-15 18:02` 🤖 Boa tarde. Tudo bem?
- `2026-06-15 18:02` 🤖 10:00  hs?
- `2026-06-15 20:35` 🤖 Juca! Quarta feira não temos disponível o horário das 10:00 hs. Pode ser 09:30 hs?
- `2026-06-15 22:01` 👤 sim
- `2026-06-15 22:02` 🤖 Juca! Você já estava na agenda as 10:00 hs rs
- `2026-06-15 22:02` 🤖 Tudo certo!

</details>


### Isabela Terlizzi — `5521979559740`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2024-06-26T10:30:00-03:00", "procedimentos": "[\"Infusão de cetamina\",\"Sessão de terapia\"]"}`

**Cenário:** `reagendamento_ajuste_fluxo` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Isabela buscava conciliar a infusão de cetamina com a sessão de terapia no mesmo dia para evitar espera. Inicialmente cancelou a terapia por falta de horários próximos, mas após a atendente oferecer uma nova data (quarta-feira) com ambos os horários disponíveis, a paciente aceitou prontamente. O atendimento finalizou com a confirmação de que sua prescrição médica já estava disponível no aplicativo da clínica.


**Objeções:** tempo de espera entre sessões

**Gatilhos:** conveniência de horários, continuidade do tratamento

<details><summary>Transcrição completa</summary>

- `2026-05-06 20:26` 👤 Claro pode ser sim!
- `2026-05-06 20:26` 🤖 Muito obrigada!
- `2026-05-07 14:20` 👤 comprovante-157379201767.pdf
- `2026-05-18 19:18` 🤖 Olá Isabella. Tudo bem?
- `2026-05-18 19:18` 🤖 Podemos agendar sua infusão nesta quinta feira as 10:30 hs?
- `2026-05-18 19:19` 👤 Pode mas teria como antecipar a terapia depois tb?
- `2026-05-18 19:20` 🤖 Entendo! Na verdade a agenda da Dra. Maísa está preenchida o dia todo.
- `2026-05-18 19:22` 👤 Tudo bem, vou 10:30…mas pode cancelar pra mim a Dra Maisa não quinta pq se não fico muito tempo esperando
- `2026-05-18 19:23` 🤖 Entendo! Combinado!
- `2026-05-29 10:24` 🤖 Bom dia, Isa! Tudo bem? É a Marisa
- `2026-05-29 10:25` 🤖 Na semana que vem a Dra. Maisa vai atender na quarta feira. Posso confirmar sua cetamina e a sessão para o os horários de sempre na quarta feira?
- `2026-05-29 10:52` 👤 Sim por favor!!
- `2026-05-29 11:02` 🤖 Muito obrigada!
- `2026-06-11 21:42` 🤖 Olá boa tarde  Isabela, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-06-11 21:46` 👤 Obrigada!

</details>


### Ivan — `5511997477000`

**Custom fields:** `{"mensagem": "Lead pediu horário amanhã às 10h; pagamento confirmado; protocolo de manutenção com cetamina (10 infusões, 4 semanais + 6 quinzenais); valor 8000 em 9x sem juros.", "interesse": "Infusão de Cetamina", "pagamento": 8000, "observacoes": "Lead pediu horário amanhã às 10h; pagamento confirmado; protocolo de manutenção com cetamina (10 infusões, 4 semanais + 6 quinzenais); valor 8000 em 9`

**Cenário:** `agendou_procedimento_pos_consulta` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Lead realizou teleconsulta e iniciou protocolo de cetamina (8 sessões), optando por pagar a primeira avulsa (R$ 900) antes de fechar o pacote (R$ 6.400) devido ao receio de efeitos dissociativos. Teve problemas com o tipo de receita para Cannabis, resolvidos via aplicativo da clínica. Após completar a fase inicial, aceitou o protocolo de manutenção (R$ 8.000 em 9x), mas suspendeu o início imediato por conta de uma cirurgia dia 23/06, ficando de retomar após a recuperação.


**Objeções:** seguranca_procedimento, receita_errada, logistica_viagem, cirurgia_emergente

**Gatilhos:** reembolso_plano_saude, parcelamento_sem_juros_alto, conforto_estacionamento, facilidade_app

<details><summary>Transcrição completa</summary>

- `2026-05-07 12:01` 🤖 Olá bom dia Ivan, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-07 12:01` 🤖 Ivan Ghadieh - Dr. Ivan Barenboim - 07/05/2026 Quinta-feira, 7 de maio · 10:00 – 10:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/wgc-vvbs-rha
- `2026-05-07 12:01` 👤 Bom dia
- `2026-05-07 12:01` 👤 Posso usar esse link no notebook?
- `2026-05-07 12:03` 🤖 Bom dia! Sim!
- `2026-05-07 12:04` 👤 As 10 h, ok?
- `2026-05-07 12:04` 🤖 Sim!
- `2026-05-07 12:59` 🤖 Olá Ivan! Informo que o Dr. Ivan vai atrasar alguns minutos.
- `2026-05-07 12:59` 👤 Ok. Sem problemas.
- `2026-05-07 13:09` 🤖 Oi Ivan! Pode entrar
- `2026-05-07 13:35` 🤖 **[ÁUDIO]** Olá, Ivan, bom dia. Marisa da Clínica Ortho, tudo bem? Ivan, o doutor Ivan conversou conosco e ele prescreveu para você um protocolo de citamina, certo?
- `2026-05-07 13:35` 🤖 **[ÁUDIO]** Este protocolo são oito infusões, duas por semana durante quatro semanas.
- `2026-05-07 13:35` 🤖 **[ÁUDIO]** Nós podemos fazer o agendamento?
- `2026-05-07 13:35` 🤖 **[ÁUDIO]** Em relação a valores, o valor seria R$ 6.400, que você pode parcelar em seis vezes sem juros, e nós ainda emitimos nota para reembolso.
- `2026-05-07 13:37` 👤 **[ÁUDIO]** Olha, bom dia. Eu... são oito sessões. Será que eu consigo me adaptar ao medicamento? Até porque ele tem uma questão de dissociação, né? Não sei se eu vou me adaptar a isso. Será que seria o ideal eu já comprar o pacote todo ou fazer um pra ver como é que é? O que você acha?
- `2026-05-07 13:39` 🤖 **[ÁUDIO]** Olá, Ivan. Realmente a prescrição do doutor foi o pacote. Mas se você se sentir mais seguro, você pode fazer a primeira infusão e aí você se sentindo bem você dá continuidade no tratamento.
- `2026-05-07 13:39` 🤖 **[ÁUDIO]** A infusão avulsa o valor é 900 reais, tá? Então você faria essa infusão e você se sentindo bem aí você pode fazer o pacote, tá bom? Podemos agendar? Que dia seria melhor para você e seria melhor de manhã ou à tarde?
- `2026-05-07 13:44` 👤 **[ÁUDIO]** Bom, vê se eu entendi. Eu faço a primeira e pago R$ 900,00, certo? Se eu me, se eu me sentir bem e tudo mais, e prosseguir, eu pago a diferença pra R$ 6.400,00, é isso?
- `2026-05-07 13:46` 🤖 **[ÁUDIO]** Correto, Ivan, isso mesmo. Tá bom?
- `2026-05-07 13:47` 👤 **[ÁUDIO]** Tá certo, então vamos marcar assim.
- `2026-05-07 13:57` 🤖 **[ÁUDIO]** Orivan, pode ser segunda-feira? Como é que está a sua disponibilidade?
- `2026-05-07 14:06` 👤 Segunda consigo ir
- `2026-05-07 14:14` 🤖 Pode ser dia 11/05 as 09:00 hs?
- `2026-05-07 14:15` 👤 Como não sou de SP teria que ser a tarde
- `2026-05-07 14:22` 🤖 Certo! Pode ser as 14:00 hs?
- `2026-05-07 14:22` 👤 É o ideal
- `2026-05-07 14:22` 🤖 Ótimo! Agendado.
- `2026-05-07 14:22` 👤 Almoçar não atrapalha o procedimento?
- `2026-05-07 14:22` 🤖 Não!
- `2026-05-07 14:23` 👤 Obrigado
- `2026-05-07 14:23` 🤖 Vou te mandar as recomendações.
- `2026-05-07 14:23` 🤖 As recomendações para as infusões com cetamina são as seguintes:   1. Jejum não é necessário, mas não aconselhamos estar com o estômago excessivamente cheio antes da aplicação.  2. Acompanhantes são bem-vindos e poderão ficar com o paciente durante o procedimento. Entretanto, NÃO é necessário que o paciente venha acompanhado.   3. No entanto, você NÃO pode dirigir após a aplicação de cetamina.  4. Evite o consumo de bebidas alcoólicas 24h antes e depois da aplicação.  5. Psicoestimulantes como V
- `2026-05-07 14:51` 👤 Obrigado
- `2026-05-07 14:52` 🤖 Disponha
- `2026-05-12 11:55` 👤 Olá bom dia
- `2026-05-12 11:56` 👤 Eu falo com quem?
- `2026-05-12 11:58` 🤖 Olá bom dia Ivan, como vai? Sou Edilene da Clínica Ór, em que posso te ajudar?
- `2026-05-12 11:59` 👤 Oi Edilene, estou bem sim e vc?
- `2026-05-12 12:08` 🤖 Estou bem, obrigada por perguntar.
- `2026-05-12 12:08` 🤖 Como posso te ajudar?
- `2026-05-12 12:09` 👤 Eu desmarquei a sessão de cetamina na semana passada e gostaria de saber se o Dr Ivan pode me atender amanhã
- `2026-05-12 12:18` 🤖 Bom dia, Sr. Ivan!
- `2026-05-12 12:18` 🤖 Agora é a Marisa. Tudo bem?
- `2026-05-12 12:19` 🤖 O senhor está com alguma dúvida, ou deseja passar por uma nova consulta?
- `2026-05-12 12:20` 👤 Nenhuma dúvida
- `2026-05-12 12:20` 👤 Apenas marcar o início do tratamento com cetamina
- `2026-05-12 12:22` 🤖 Certo o Sr. Deseja iniciar o tratamento amanhã. Qual seria o melhor período de manhã ou a tarde?
- `2026-05-12 12:22` 👤 Manhã
- `2026-05-12 12:22` 👤 Umas 10 h
- `2026-05-12 12:23` 🤖 Temos horário as 10:30 hs. Pode ser?
- `2026-05-12 12:24` 👤 Sim
- `2026-05-12 12:24` 👤 Pode ser
- `2026-05-12 12:24` 👤 Quanto tempo dura a sessão?
- `2026-05-12 12:24` 🤖 Certo! Agendado!
- `2026-05-12 12:24` 🤖 **[ÁUDIO]** Silvano, demora 40 minutos a sessão. Depois tem o tempo de recuperação, que vai de paciente pra paciente, que pode demorar de 20 a uma hora, tá?
- `2026-05-12 12:25` 👤 Está bem
- `2026-05-12 12:25` 👤 Obrigado
- `2026-05-12 12:26` 🤖 Disponha!
- `2026-05-12 12:26` 👤 Obrigado
- `2026-05-12 12:27` 🤖 Disponha!
- `2026-05-13 12:24` 👤 **[ÁUDIO]** Olá, bom dia. Eu estou me dirigindo aí à clínica e eu gostaria de saber se, como da outra vez eu usei a garagem, gostaria de saber se eu posso usar de novo. Seria possível isso?
- `2026-05-13 12:28` 🤖 **[ÁUDIO]** Bom dia, seu Ivan, tudo bem? Pode sim, sem nenhum problema, tá bom? Tchau tchau, até logo.
- `2026-05-13 12:29` 👤 Bom dia por gentileza, você pode avisar o porteiro para ele poder abrir lá o portão para mim, por favor?
- `2026-05-13 12:30` 🤖 Não tem porteiro na entrada?
- `2026-05-13 12:31` 👤 Ah tá, tudo bem, obrigado.
- `2026-05-13 13:10` 🤖 ivan.pdf
- `2026-05-21 18:58` 👤 Boa tarde
- `2026-05-21 18:58` 👤 Uma informação: Que horas abre a clínica?
- `2026-05-21 19:01` 🤖 Oi Ivan. Tudo bem?
- `2026-05-21 19:01` 🤖 A Clínica abre as 07:30 hs.
- `2026-05-21 19:01` 👤 Estou bem sim e vc?
- `2026-05-21 19:01` 👤 Ah sim
- `2026-05-21 19:01` 🤖 Tudo bem!
- `2026-05-21 19:01` 👤 Quero ver se eu chego mais cedo amanhã
- `2026-05-21 19:02` 🤖 Certo! Só peço por gentiliza, que nos confirme ainda hoje, para atualizarmos o agendamento. ok?
- `2026-05-21 19:03` 👤 Umas 9:30
- `2026-05-21 19:32` 🤖 Ivan me desculpe, tive que resolver um problema interno
- `2026-05-21 19:34` 🤖 A sua próxima infusão está agendada para o dia 03/06. Você deseja alterar para amanha?
- `2026-05-21 19:37` 👤 Pode ser às 9:30?
- `2026-05-21 19:39` 👤 Imaginei que fosse dia 22 amanhã
- `2026-05-21 19:41` 👤 22,25,27,02 e 05
- `2026-05-21 19:41` 👤 É o que eu tenho marcado aqui
- `2026-05-21 19:44` 🤖 Você tem razão! Desculpe, confundi de Ivan rs
- `2026-05-21 19:45` 👤 Sem problemas
- `2026-05-21 19:45` 👤 Amanhã estarei aí
- `2026-05-21 19:45` 👤 Umas 9:30
- `2026-05-21 19:45` 🤖 Você está agendado ´para amanhã as 10:00 hs. O horário das 09:30 hs  já está preenchido.
- `2026-05-21 19:46` 🤖 Pode ser as 09:00 hs?
- `2026-05-21 19:51` 👤 Pode ser sim
- `2026-05-21 19:51` 🤖 Ok
- `2026-05-25 13:33` 👤 Bom dia
- `2026-05-25 13:34` 👤 Infelizmente não consegui ir hj na sessão das 8 h
- `2026-05-25 13:34` 🤖 Sim! Sentimos sua falta Ivan
- `2026-05-25 13:34` 🤖 Deseja agendar para outro horário ou dia?
- `2026-05-25 13:35` 👤 Quarta já temos um horário marcado né
- `2026-05-25 13:40` 👤 Será que sexta umas 14 h é possível me atender?
- `2026-05-25 13:41` 🤖 Sim! Quarta já está marcado
- `2026-05-25 13:42` 🤖 Pode ser as 13:30 hs?
- `2026-05-25 13:42` 🤖 Na sexta? As 14:00 hs o horário não está disponível
- `2026-05-25 13:44` 👤 Eu tenho um compromisso às 11 h aqui em Itu. Mesmo que eu não almoce não conseguiria estar aí esse horário.
- `2026-05-25 13:45` 🤖 Entendo! O senhor não pode vir terça e quinta?
- `2026-05-25 13:46` 👤 Da outra semana)
- `2026-05-25 13:47` 👤 Já está marcado terça e sexta pois quinta é feriado
- `2026-05-25 13:55` 🤖 Não, estou falando desta semana. Já que você não pode vir hoje e sexta feira não tem horário.
- `2026-05-25 13:56` 👤 Estou fazendo um outro tratamento para a coluna e as sessões serão amanhã e quinta
- `2026-05-25 13:56` 👤 *[imagem]*
- `2026-05-25 13:57` 👤 Talvez tenhamos que deixar uma única sessão essa semana
- `2026-05-25 13:58` 👤 E marcamos essa de hj para quarta dia 3
- `2026-05-25 14:11` 🤖 Então agendamos as 08:00 hs para dia 03 e 05/06?
- `2026-05-25 14:13` 👤 Esse horário é muito cedo para mim
- `2026-05-25 14:13` 👤 Tenho que sair às 5 daqui
- `2026-05-25 14:13` 👤 E acordar 4:30
- `2026-05-25 14:13` 👤 10 h é o ideal
- `2026-05-25 14:18` 🤖 Certo! Agendado!
- `2026-05-25 14:22` 🤖 Sr. Ivan. No dia 27/05 vou alterar o horário para as 10:00 hs. ok?
- `2026-05-25 14:26` 👤 Ótimo
- `2026-05-25 14:26` 👤 Obrigado
- `2026-05-25 14:27` 🤖 Disponha
- `2026-05-28 15:03` 👤 Olá boa tarde
- `2026-05-28 15:09` 🤖 Boa tarde, Ivan!
- `2026-05-28 15:10` 👤 Eu falo com quem?
- `2026-05-28 15:10` 🤖 Marisa rs
- `2026-05-28 15:10` 👤 Oi Marisa, td bem?
- `2026-05-28 15:10` 🤖 Bem e você?
- `2026-05-28 15:10` 👤 Estou bem sim
- `2026-05-28 15:10` 👤 2 coisas
- `2026-05-28 15:11` 👤 O meu compromisso de amanhã foi desmarcado
- `2026-05-28 15:11` 👤 Então quero ver se vc tem um horário para mim na parte da manhã
- `2026-05-28 15:11` 👤 9 ou 10 h
- `2026-05-28 15:12` 🤖 Certo! Temos horário as 09:00 hs
- `2026-05-28 15:12` 👤 Ótimo
- `2026-05-28 15:12` 👤 Pode agendar ?
- `2026-05-28 15:13` 🤖 Agendado!
- `2026-05-28 15:13` 👤 Ótimo
- `2026-05-28 15:13` 👤 Obrigado
- `2026-05-28 15:14` 👤 Outra coisa
- `2026-05-28 15:14` 🤖 Disponha!
- `2026-05-28 15:14` 👤 A receita da cannabis que o Dr Ivan trocou para mim da branca para a azul não está sendo aceita
- `2026-05-28 15:14` 👤 Tem que ser a branca
- `2026-05-28 15:14` 👤 Rs
- `2026-05-28 15:14` 👤 Tá difícil entender né?
- `2026-05-28 15:15` 👤 Vc consegue falar com ele para fazer a branca e eu pego amanhã?
- `2026-05-28 15:15` 🤖 kkk sem problemas, vou solicitar e assim que estiver disponível, lhe informo
- `2026-05-28 15:15` 👤 Ok. Muito obrigado!
- `2026-05-28 15:16` 👤 A branca é possível enviar via WPP, correto? Se vc conseguir hj seria interessante pois na farmácia onde achei tem um único frasco.
- `2026-05-28 15:16` 🤖 Disponha! Tenha uma ótima tarde!
- `2026-05-28 15:17` 🤖 Entendi! Vou solicitar para o Dr. Ivan com urgência, mas ele não está na clinica hoje.
- `2026-05-28 15:19` 👤 Ah sim
- `2026-05-28 15:19` 👤 Eu aguardo
- `2026-05-28 15:19` 👤 Obrigado
- `2026-05-29 10:59` 👤 Bom dia, meninas! Infelizmente não consegui ir até vcs hj. Estou em crise neuropática nas pernas e isso causa muita dor. Nos vemos na semana que vem. Bom final de semana
- `2026-05-29 11:01` 🤖 Bom dia, Ivan!
- `2026-05-29 11:01` 🤖 Obrigada por sinalizar
- `2026-05-29 11:02` 🤖 Lhe desejamos melhoras!
- `2026-05-29 11:02` 🤖 Bom final de semana!
- `2026-05-29 11:04` 👤 Muito obrigado
- `2026-05-29 13:44` 👤 Olá
- `2026-05-29 13:44` 👤 Eu de novo
- `2026-05-29 13:44` 👤 Foi com vc que eu falei sobre trocar a receita de CDB azul por uma branca?
- `2026-05-29 13:45` 👤 Será que vc consegue me enviar uma branca aqui pelo WPP?
- `2026-05-29 13:46` 🤖 Oi Ivan!
- `2026-05-29 13:47` 🤖 Foi comigo sim! Já pedi para o Dr. Ivan, estou aguardando o retorno dele.
- `2026-05-29 13:47` 👤 Tá ótimo
- `2026-05-29 13:47` 👤 Obrigado
- `2026-05-29 13:47` 🤖 Disponha!
- `2026-05-29 18:54` 👤 Boa tarde!!
- `2026-05-29 18:55` 👤 Conseguiu a receita?
- `2026-05-29 19:11` 🤖 **[ÁUDIO]** "Olá, Ivan, boa tarde, tudo bem? Aqui é Edilene, da Clínica OR. Ivan, sua solicitação ela foi feita, né, faz dois dias, a gente tá aguardando o doutor retornar. Eh, acabei de enviar mensagem novamente pro doutor, pedindo pra que ele verifique a sua solicitação, e estamos aguardando o retorno. Mas, assim que possível eu te aviso, caso a receita já esteja no aplicativo, e se for física, se ela vai estar disponível pra retirada na portaria, tá bom? O doutor tá em atendimento ainda, e por esse motivo ele não conseguiu me responder ainda, tá?"
- `2026-05-29 19:12` 👤 Muito bom. Muito obrigado.
- `2026-05-29 19:13` 👤 **[ÁUDIO]** Ah, não, mas olha, eu gostaria de usar o final de semana para tomar esse canabidiol. Queria experimentar um dia que não fosse durante a semana, né? Para ver a reação. Será que você não consegue mandar pelo eh... tem um aplicativo que vocês mandam receita médica, se não me engano é Memed, é isso? Eh... porque por ser uma receita branca e não ser azul, nossa, isso dá uma confusão. Ele me deu uma branca, cheguei na farmácia: "não, tem que ser azul". Aí peguei uma azul com ele. Aí cheguei na farmácia: "não, tem que ser branca". Gente, o que que é isso? O médico vai achar que isso é palhaçada. Resultado: não consegui comprar, então tô pedindo essa gentileza dele fazer uma branca e me mandar por aqui, pelo WhatsApp. Pode ser?
- `2026-05-29 19:20` 🤖 **[ÁUDIO]** Oi, Ivan. Então, o doutor acabou de sinalizar que tá no aplicativo, tá? Você consegue, você tem acesso tudo certinho? Já conseguiu pegar alguma prescrição lá no aplicativo?
- `2026-05-29 19:21` 👤 **[ÁUDIO]** Não, eu não tenho esse aplicativo. Como é que chama? Ou então me mande um link, por gentileza.
- `2026-05-29 19:24` 🤖 **[ÁUDIO]** Tá certo, Ivan, eu vou te mandar as informações do app para você, tá bom?
- `2026-05-29 19:24` 👤 Tá obrigado
- `2026-05-29 19:26` 🤖 Segue o link do App da Clínica para que consiga *verificar suas prescrições* e fazer seus próprios agendamentos de consulta. *App IOS*: https://apps.apple.com/br/app/cl%C3%ADnica-%C3%B3r-psiquiatria/id6745094818 *App Android*: https://play.google.com/store/apps/details?id=br.com.clinicaorpsiquiatria.app  *WebApp*: https://orpsiquiatria.vsaudeapp.com.br/app Para acessar o App use seu e-mail de cadastro ig@alibaba.com.br e a *senha: 010203*  As prescrições se encontram em *arquivos*.  Qualquer dúv
- `2026-05-29 19:35` 👤 Consegui
- `2026-05-29 19:35` 👤 Muito obrigado
- `2026-05-29 19:50` 🤖 Imagina. Disponha
- `2026-06-01 21:28` 🤖 Olá boa tarde  Ivan, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-06-01 21:29` 👤 Olá boa noite
- `2026-06-01 21:29` 👤 Sim, obrigado!
- `2026-06-01 21:29` 🤖 Disponha!
- `2026-06-02 11:44` 👤 **[ÁUDIO]** Olá, bom dia. Pessoal, me desculpem, mas eu não consegui sair cedo e eu não consigo estar aí às dez. Eu tô saindo agora de Itu, eu devo chegar por volta de umas, de uma meio-dia, mais ou menos. Será que é possível vocês me atenderem?
- `2026-06-02 11:57` 🤖 Bom dia, Ivan! Sem problemas.
- `2026-06-03 14:27` 👤 **[ÁUDIO]** Olá, bom dia, tudo bem? Olha, na sexta eu vou estar aí de manhã, né? E minha filha vai até mim, vai me buscar. Não é meu filho, e ela não vai de Uber, ela vai estar com o carro dela. Ela não é de São Paulo, ela vem de Ribeirão. Então, eu quero ver com vocês se é possível ela usar a vaga onde eu paro. Eu vou parar bem encostadinho na mureta e aí ela para na frente. É possível isso?
- `2026-06-03 14:34` 🤖 **[ÁUDIO]** Olá, Ivan, tudo bem? Edilene aqui da Clínica Or. É possível, desde que a vaga ela não esteja em uso, né? Aí então a gente não tem esse controle. Conforme os pacientes vão chegando, quem vai direcionando quais vagas estão disponíveis ou não é o pessoal da portaria. Então não posso te garantir isso.
- `2026-06-03 15:15` 👤 Ah sim
- `2026-06-03 15:16` 👤 De qq forma eu agradeço
- `2026-06-03 15:18` 🤖 Imagina. Disponha.
- `2026-06-09 12:34` 👤 Bom dia
- `2026-06-09 12:34` 🤖 Bom dia, Ivan!
- `2026-06-09 12:34` 🤖 É a Marisa
- `2026-06-09 12:34` 👤 Td bem por aí?
- `2026-06-09 12:35` 👤 Oi Marisa
- `2026-06-09 12:35` 🤖 Tudo bem e você?
- `2026-06-09 12:35` 👤 Estou bem tbm
- `2026-06-09 12:35` 👤 Estou marcado para amanhã
- `2026-06-09 12:35` 👤 Mas estou em Campinas e já terminou meu compromisso aqui
- `2026-06-09 12:35` 👤 Será que eu posso fazer a sessão hj
- `2026-06-09 12:36` 👤 Umas 12 h
- `2026-06-09 12:37` 🤖 Temos horário as 12:30 hs. Pode ser?
- `2026-06-09 12:37` 👤 Pode ser sim
- `2026-06-09 12:38` 🤖 Agendado!
- `2026-06-09 12:38` 👤 Até mais tarde
- `2026-06-09 12:40` 🤖 Até!
- `2026-06-15 12:34` 🤖 Olá bom dia Ivan, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-06-15 12:34` 🤖 Ivan Ghadieh - Dr Ivan Barenboim - 15/06/2026 Segunda-feira, 15 de junho · 10:00 – 10:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/dky-feze-zmt
- `2026-06-15 12:42` 👤 Bom dia
- `2026-06-15 12:42` 👤 Ok obrigado
- `2026-06-15 12:43` 🤖 Disponha
- `2026-06-15 13:01` 🤖 Dr Ivan, pediu para sinalizar que irá atrasar uns minutos.
- `2026-06-15 13:01` 👤 Ok. Sem problemas
- `2026-06-15 13:24` 🤖 Oi Ivan! O Dr. aguarda no meet
- `2026-06-15 14:34` 🤖 Oi Ivan! É a Marisa. Tudo bem?
- `2026-06-15 14:34` 🤖 Caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr
- `2026-06-15 14:35` 🤖 O Dr. Ivan recomendou para você o protocolo de manutenção.
- `2026-06-15 14:35` 🤖 São 10 infusões. 4 infusões semanais e 6 quinzenais.
- `2026-06-15 14:37` 🤖 Valor R$ 8000,00 pode ser parcelado em 9 vezes sem juros.
- `2026-06-15 14:37` 🤖 Vamos agendar a próxima infusão?
- `2026-06-15 15:02` 👤 Olá
- `2026-06-15 15:02` 👤 Vc tem um horário amanhã umas 10 h?
- `2026-06-15 15:03` 🤖 Sim! Agendado!
- `2026-06-15 15:03` 👤 Obrigado
- `2026-06-15 15:07` 🤖 Disponha!😊
- `2026-06-15 18:26` 👤 Estou com um problema
- `2026-06-15 18:27` 🤖 Oi Ivan!
- `2026-06-15 18:27` 👤 Dia 23 vou passar por uma cirurgia e devo ficar algumas semanas sem poder ir até vcs
- `2026-06-15 18:27` 👤 Talvez o ideal é começar a fazer a manutenção logo depois desse período
- `2026-06-15 18:28` 🤖 Entendo! Sem problemas! O que for melhor pra você está ótimo!
- `2026-06-15 18:29` 👤 CamScanner 30-04-2026 09.30 (1).pdf
- `2026-06-15 18:29` 👤 Irei fazer esse procedimento dia 23 desse mês
- `2026-06-15 18:30` 👤 Como vou ficar afastado do dia a dia talvez o ideal é deixarmos para quando eu conseguir me recuperar
- `2026-06-15 18:31` 🤖 Certo! Sem problemas. Ficamos no aguardo!
- `2026-06-15 18:31` 🤖 Boa cirurgia!
- `2026-06-15 18:33` 👤 Obrigado

</details>


### Michelle Kartychak — `19293133624`

**Custom fields:** `{"mensagem": "Chegando para consulta com Dra Maísa às 12:30; paciente Michelle. Dor de cólica e dor no joelho.", "interesse": "Psicoterapia", "observacoes": "Chegando para consulta com Dra Maísa às 12:30; paciente Michelle. Dor de cólica e dor no joelho.", "data_horario": "2023-07-07T09:30:00-03:00", "qualificacao": "interessado", "procedimentos": "EMT", "nome_preferido": "Michelle", "tentou_agend`

**Cenário:** `reagendamento_recorrente_e_ajuste_receitas` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Michelle é uma paciente recorrente realizando tratamento combinado de EMT, infusões de Cetamina e psicoterapia. A conversa é marcada por constantes pedidos de alteração de horário (reagendamentos de última hora) e avisos de atraso pela paciente. Ela também solicita ajustes de dosagem de Cetamina com o Dr. Ivan e aponta erros em receitas anteriores (Rivotril), solicitando novas prescrições de diversos psicotrópicos. O atendimento tem sido flexível para acomodar as necessidades agudas da paciente.


**Objeções:** indisponibilidade de horário (tarde), erro em receita médica

**Gatilhos:** agilidade no atendimento, ajuste de medicação, flexibilidade de horário

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:49` 🤖 Sim podemos agendar. Seguimos a disposição.
- `2026-05-12 12:46` 👤 Oi bom dia podemos ter consulta as 11h invez?
- `2026-05-12 12:49` 🤖 Bom dia, Michele. Você deseja agendar uma consulta?
- `2026-05-12 12:49` 🤖 Temos horário para consulta hoje as 12:00 hs. Pode ser?
- `2026-05-12 13:15` 👤 Sim consulta e infusao
- `2026-05-12 13:40` 🤖 Agendado para as 12:00 hs
- `2026-05-15 03:05` 👤 Amanha podemos mudar para 9/30
- `2026-05-15 03:05` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-15 05:26` 👤 Ou melhor seria as 10h
- `2026-05-15 11:07` 🤖 Olá bom dia Michelle, como vai? Temos horário as 10h30. Funciona para você?
- `2026-05-15 11:39` 👤 Funciona sim muito obrigada
- `2026-05-15 11:40` 🤖 Certo, reagendado.
- `2026-05-15 13:28` 👤 Vou chegar as 11
- `2026-05-15 13:32` 🤖 Certo! Muito obrigada por sinalizar.
- `2026-05-15 13:33` 👤 Desculpa pelo atraso
- `2026-05-15 13:35` 🤖 ok
- `2026-05-20 11:23` 👤 Vou chegar as 9
- `2026-05-20 11:30` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar, vamos avisar as enfermeiras.
- `2026-05-22 12:23` 👤 Oi tudo bem cheho as 10
- `2026-05-22 12:23` 👤 Desculpa
- `2026-05-22 12:28` 🤖 Bom dia, Michelle!
- `2026-05-22 12:29` 🤖 Tudo bem! Já informamos as enfermeiras.
- `2026-05-22 12:37` 👤 Obrigada
- `2026-05-22 12:38` 👤 Vai precisar aumentar a dose da ketamina denovo eu escrevo para o dr?
- `2026-05-22 12:41` 🤖 Sim! Por favor, escreva para o Dr. Ivan.
- `2026-05-25 11:27` 👤 Chegarei as 9
- `2026-05-25 11:27` 👤 Td bem
- `2026-05-25 11:36` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar e iremos avisar as enfermeiras, seguimos a disposição.
- `2026-05-27 11:35` 👤 Oii
- `2026-05-27 11:35` 👤 Eu bou chegar as 9:15
- `2026-05-27 11:36` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar vamos avisar as enfermeiras.
- `2026-05-28 17:21` 🤖 Oi Michelle. A Dra Maísa psicóloga disse que pode te antender ainda hoje as 17:00 hs, mão pode atrasar de forma alguma. Você tem disponibilidade?
- `2026-05-28 19:54` 👤 Oiii
- `2026-05-28 19:56` 👤 Acabei de ver isso puxa infelixmente eu to longe podemos fazer amamha de manha ? Ou terca de manha ?
- `2026-05-28 19:57` 🤖 Oi Michelle. Vamos verificar com a Dr. Maisa e te retornamos.
- `2026-05-28 19:57` 🤖 Você consegue vir na próxima quarta as 17:00 hs?
- `2026-05-28 20:16` 👤 Nao consigo de tarde
- `2026-05-28 20:16` 👤 So de manha
- `2026-05-29 01:22` 👤 Amanha confirmado emt 7:30
- `2026-05-29 01:22` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-29 10:31` 👤 Opa 8h to ai!
- `2026-05-29 10:31` 🤖 Bom dia! ok
- `2026-06-01 21:36` 🤖 Olá boa tarde  Michelle, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-06-02 11:33` 👤 Oi bom dia podemos fazer emt hj as 10:30?
- `2026-06-02 11:34` 👤 To mt abatida
- `2026-06-02 11:37` 🤖 Bom dia Michelle, como vai? Podemos sim fazer as 10h30.
- `2026-06-02 13:39` 👤 Pode ser as 11:30?
- `2026-06-02 13:40` 👤 Eu tambem preciso de receitas de atentah 80mg  Ribotril 4mg  Brintillex 30mg
- `2026-06-02 13:42` 🤖 Oi Michelle. As 11:30 hs não é possível, pode ser as 12:30 hs?
- `2026-06-03 11:49` 👤 Oi to chegando em 10mj
- `2026-06-03 11:51` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar.
- `2026-06-04 00:29` 👤 **[ÁUDIO]** Oi, tudo bem? Duas coisas. A receita do Rivotril estava escrito 4mg, e o máximo dele é 2. Tudo bem que eu tenho em casa. Mas o que eu não tenho é o Atenta. Atenta 80mg acabou hoje. Aí vou ficar sem amanhã. E na sexta-feira, ou antes, se possível, puder me enviar a receita pra eu pegar, agradeço. Tá bom, obrigada.
- `2026-06-04 00:29` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-05 10:01` 👤 Oi bom dia vou chegar hoje as 9
- `2026-06-05 10:59` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar, vamos avisar as enfermeiras.
- `2026-06-08 12:23` 🤖 Obrigada por sinalizar. Vamos avisar as enfermeiras.
- `2026-06-09 10:53` 👤 Oi bom dia vou chegar hoje as 10h
- `2026-06-09 10:53` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-09 10:54` 👤 Tambem mudei minha passagem para dia 7 de julho
- `2026-06-09 11:13` 🤖 **[ÁUDIO]** Bom dia, Michele, tudo bem? Edilene, aqui da Clínica Or. Vou avisar as meninas, tá bom? Que você vai chegar às dez.
- `2026-06-09 11:16` 👤 Perfeito obrigada
- `2026-06-10 19:04` 👤 Amanha o emt preciso reagendar para 9:30
- `2026-06-10 19:04` 👤 E depois eu faco apos a consulta com a dra mais
- `2026-06-10 19:04` 👤 Maisa
- `2026-06-10 19:06` 🤖 ok Michelle. Por favor, não atrase para consulta da Dra Maisa, pois não temos outro horário disponível. Bjs
- `2026-06-10 19:07` 👤 Nao atrasarei  ! Pode deixa mt obrigada
- `2026-06-11 12:23` 👤 Ja to chegando
- `2026-06-11 12:26` 🤖 **[ÁUDIO]** Oi Michele, bom dia, tudo bem? Ah, agradeço por sinalizar que você já está chegando. É, com relação à sessão com a doutora, aconteceu um imprevisto, quando você chegar aqui a gente explica direitinho, tá bom? Mas você pode fazer seu MT tranquilamente.
- `2026-06-15 10:09` 👤 Oi bom dia to com muita colica e. Dor no joelho eu vou chegar hoje 12:30 tudo bem?
- `2026-06-15 10:10` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-15 10:56` 🤖 Olá bom dia Michelle, como vai? Agradecemos por sinalizar, vamos avisar as enfermeiras.
- `2026-06-15 11:48` 👤 Oi bom dia vou escovar os dentes toma um banhp rapido e devo chegar as 10:15 no maximo
- `2026-06-15 11:51` 🤖 Certo, sem problemas.
- `2026-06-15 12:59` 👤 Chego 10:30
- `2026-06-16 10:59` 👤 Hoje chego as 8:30
- `2026-06-16 10:59` 🤖 Olá bom dia Michelle, como vai?
- `2026-06-16 11:00` 🤖 Agradecemos por sinalizar.
- `2026-06-16 20:03` 👤 Amanha as 7:30 ja estarei pronta para fazer emt  Pegar receitas de venvase 30mg. 2 caixas  Vencase 70mg  Rivotril 2mg x2 caiaxas    Preciso sair do consultorio as 10:45/11h no max q tenho medico dps exames
- `2026-06-16 20:03` 👤 Amanha nao tera atraso
- `2026-06-16 20:04` 🤖 ok Mi
- `2026-06-16 20:06` 👤 Mt obrigada
- `2026-06-16 20:26` 👤 Quarta dia 24   Preciso fazer infusao e emet as 11:30h tudo bem Tenho reumatllogista as 8h

</details>


### Laura. — `5511996004166`

**Custom fields:** `{"mensagem": "Cliente informou que irá enviar o encaminhamento assim que possível. Perguntou sobre o uso de Spravato.", "interesse": "Infusão de Cetamina", "observacoes": "Cliente informou encaminhamento e perguntou sobre Spravato; acordado encaixe para 12:00; link_consulta: https://api.memed.com.br/v1/prescricoes/UcCEO4/pdf?document=9aeb071d-bbe5-4e0f-ab55-17aa4c54618f", "data_horario": "2026-06-`

**Cenário:** `agendou_apos_cotacao_e_visita` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Laura tem transtorno bipolar tipo II e buscava tratamento com Cetamina após indicação. Após receber orçamento (R$ 800/sessão no pacote), negociou parcelamento em 8x, o que foi concedido como exceção. Apresentou encaminhamento médico e preencheu o formulário clínico. Agendou um protocolo inicial de 8 sessões, realizando diversas trocas de horários devido à sua escala de trabalho, sendo prontamente atendida pela equipe.


**Objeções:** Forma de aplicação (preferência por Spravato descartada), Valor total, Flexibilidade de horários/escala de trabalho

**Gatilhos:** Pioneirismo/Experiência (10 anos), Preço acessível (pacote), Facilidade de pagamento (parcelamento em 8x)

<details><summary>Transcrição completa</summary>

- `2026-05-13 15:39` 👤 Boa tarde, tudo bem?  Gostaria de informações e valores sobre o tratamento com quetamina
- `2026-05-13 15:39` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-13 15:40` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-05-13 15:40` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-05-13 15:43` 👤 Eu tenho transtorno bipolar tipo II e atualmente estou na fase de depresso muito forte, difícil de controlar com medicação usual e já o tratamento com quetamina o ano passado
- `2026-05-13 15:45` 🤖 **[ÁUDIO]** Olá, Laura. Tudo bem? Aqui é a Marize quem está falando. Laura, imagino que não deve ser nada fácil passar por isso, né? É realmente bem difícil. O tratamento de cetamina nosso é um dos mais modernos. Nós temos mais de 10 anos de experiência. A clínica foi percursora, né, do tratamento no Brasil. Então você pode ter certeza que você está num lugar onde você pode confiar, que tem toda a experiência que você precisa.
- `2026-05-13 15:45` 🤖 **[ÁUDIO]** O doutor Ivan, ele tem mais de 15 anos de experiência, é formado pela Faculdade Federal do Rio de Janeiro, uma das melhores faculdades do Brasil e tem bastante propriedade e especialidade no problema que você apresentou.
- `2026-05-13 15:46` 🤖 **[ÁUDIO]** Nós vemos pessoas, eh, já no segundo tratamento, saírem muito bem de... perto do que elas chegaram, né? Com o tratamento com o Dr. Ivan, tanto nos tratamentos tradicionais quanto com cetamina ou estimulação magnética transcraniana EMT.
- `2026-05-13 15:46` 🤖 **[ÁUDIO]** Você já tem indicação? É, você falou que já fez o tratamento, foi conosco?
- `2026-05-13 15:46` 🤖 **[ÁUDIO]** Normalmente o doutor prescreve, a princípio, oito sessões de cetamina. Essas sessões são realizadas duas vezes por semana durante quatro semanas.
- `2026-05-13 15:47` 🤖 **[ÁUDIO]** O valor do tratamento de escetamina, se você fizer o pacote, sai por R$ 800 cada sessão. Então, se você fizer o pacote das oito infusões, o valor será R$ 6.400. Você pode parcelar em até seis vezes no cartão, sem juros, e ainda nós emitimos nota para reembolso.
- `2026-05-13 15:47` 🤖 **[ÁUDIO]** Caso você faça o tratamento avulso, aí o valor da infusão sai por 900 reais.
- `2026-05-13 15:47` 🤖 **[ÁUDIO]** Nesse valor ainda está inclusa uma consulta de avaliação de tratamento com o Doutor Ivan, né? Uma consulta de retorno.
- `2026-05-13 15:47` 🤖 **[ÁUDIO]** Caso você não tenha encaminhamento, seria interessante você passar em uma consulta com o doutor Ivan, para ele verificar se realmente o tratamento seria interessante no seu caso. E assim, você poder fazer o tratamento. Se você fizer o pacote, essa consulta não é cobrada. Caso contrário, o valor da consulta é 750 reais e pode parcelar em três vezes.
- `2026-05-13 15:48` 🤖 **[ÁUDIO]** Com certeza eu posso te afirmar que nós temos muitos casos de pessoas que fazem o tratamento de cetamina e retomam a vida, ficam equilibradas e bem. Então, é lógico, isso depende de cada pessoa, mas nós temos resultados, muitos resultados positivos.
- `2026-05-13 15:48` 🤖 **[ÁUDIO]** Você ficou com alguma dúvida? Como posso te ajudar com mais informações?
- `2026-05-13 15:49` 👤 Eu já faço acompanhamento e tenho encaminhamento
- `2026-05-13 15:49` 👤 Eu o primeiro tratamento eu fiz na unifesp
- `2026-05-13 15:50` 👤 Como funciona a sessão de vocês? A quetamina é subcutânea ou endovenosa?
- `2026-05-13 15:51` 🤖 Endovenosa
- `2026-05-13 15:52` 🤖 **[ÁUDIO]** No seu caso, como você já possui encaminhamento, aí seria interessante você nos enviar esse encaminhamento, eu vou enviar para você também um formulário e envio para o Dr. Ivan tanto o seu encaminhamento quanto as respostas do formulário. Ele vai verificar se você já pode iniciar o tratamento. Posso te enviar o formulário?
- `2026-05-13 16:32` 👤 Pode mandar sim
- `2026-05-13 16:32` 👤 Vocês fazem com spravato tbm?
- `2026-05-13 16:41` 🤖 **[ÁUDIO]** Olá, tudo bem? Aqui quem fala é a Edilene da Clínica Ora. A Marisa estava conversando com você, você fez uma perguntinha aqui. Não trabalhamos com Spravato, somente a cetamina no formato de endovenosa, tá bom?
- `2026-05-13 16:44` 👤 Ta bom
- `2026-05-13 16:44` 👤 Assim que tiver o encaminhamento mando para vocês
- `2026-05-13 17:11` 🤖 Combinado!
- `2026-05-13 17:11` 🤖 Segue o formulário para preenchimento.
- `2026-05-13 17:11` 🤖 https://docs.google.com/forms/d/e/1FAIpQLSfyCdjtHMwq_nMQEernR4oQtPMz0AMJlB4ouABpzJYttBQBLw/viewform?usp=sf_link Por gentileza ao finalizar o preenchimento do formulário nos informe, para verificar se será necessário uma consulta ou não.
- `2026-05-14 17:34` 👤 https://api.memed.com.br/v1/prescricoes/UcCEO4/pdf?document=9aeb071d-bbe5-4e0f-ab55-17aa4c54618f
- `2026-05-14 17:34` 👤 Meu encaminhamento para as sessões
- `2026-05-14 17:38` 🤖 Muito obrigada Laura! Você conseguiu preencher o formulário?
- `2026-05-14 17:47` 👤 Irei preencher
- `2026-05-14 17:52` 👤 Preenchido
- `2026-05-14 17:54` 🤖 Muito obrigada! Enviarei o encaminhamento e o formulário para o Dr. Ivan e logo lhe retorno
- `2026-05-14 18:52` 🤖 Olá Laura. O Dr. Ivan já aprovou o inicio do seu tratamento. Vamos agendar?
- `2026-05-14 19:01` 👤 Poderia me passar um orçamento mais detalhado pfv
- `2026-05-14 19:02` 🤖 Apesar de sermos referência e pioneiros neste tratamento no Brasil, o preço das nossas infusões com escetamina é o mais baixo da cidade, pois acreditamos que este  avanço no tratamento da depressão tem que ser cada vez mais acessível aos que dele necessitam.
- `2026-05-14 19:02` 🤖 Normalmente, o doutor indica 8 infusões de escetamina como protocolo inicial de tratamento. Em geral, são feitas duas infusões por semana por 4 semanas.
- `2026-05-14 19:02` 🤖 O preço por infusão fica R$800,00 caso você feche o pacote de 8 infusões. Senão, cada infusão avulsa fica R$900,00.
- `2026-05-14 19:03` 🤖 Este pacote ainda inclui uma consulta de reavaliação com o Dr. ao final dele.
- `2026-05-14 19:03` 🤖 Parcelamos no cartão em até 6x e emitimos nota para reembolso
- `2026-05-14 20:17` 👤 Esse valor teria como parcelar em mais vezes ?
- `2026-05-14 20:30` 🤖 Consegui uma exceção para você. Você pode parcelar em 8 vezes sem juros.
- `2026-05-14 21:23` 👤 Obrigada
- `2026-05-14 21:23` 👤 As sessões precisam ser feitas com intervalo de qnto tempo entre elas?
- `2026-05-14 21:24` 🤖 Imagina! O que podemos fazer para ajudar, nós fazemos.
- `2026-05-14 21:24` 🤖 Pelo menos um dia de intervalo
- `2026-05-14 21:45` 👤 Eu posso conhecer a clínica?
- `2026-05-14 21:49` 🤖 Claro!
- `2026-05-14 21:49` 👤 Vocês ficam abertos até que horas?
- `2026-05-14 22:06` 🤖 **[ÁUDIO]** Oi. Nosso horário de atendimento é das 7:30 e a infusão de cetamina é até às 15:30 de segunda a quinta. Às sextas-feiras é das 7:30 às 14:00, está bom? Se você for vir mesmo, você me informa para eu agendar aqui a sua visita, tá bom?
- `2026-05-14 22:08` 👤 Eu gostaria de ir na terça-feira
- `2026-05-14 22:11` 👤 Podemos agendar para as 12h00?
- `2026-05-15 11:35` 🤖 Olá bom dia Laura, como vai? Referente a sua dúvida  temos atendimento de segunda a sexta feira - início as 07h30 até as 15h30. Segunda à quinta, na sexta feira encerramos os atendimentos 1h mais cedo, às 14h30. Caso queira vir visitar a Clínica na terça, estamos a disposição.
- `2026-05-15 16:33` 🤖 Olá Laura! Você vem nos visitar na terça feira?
- `2026-05-15 16:34` 👤 Boa tarde
- `2026-05-15 16:34` 👤 Vou sim
- `2026-05-15 16:34` 🤖 Ótimo! Será bem vinda!
- `2026-05-15 16:35` 👤 No caso, na terça-feira eu já poderia deixar marcado todas as sessões?
- `2026-05-15 16:35` 👤 E também já deixar pago?
- `2026-05-15 16:36` 🤖 Claro. Pode sim.
- `2026-05-15 16:36` 👤 E no caso, sempre tem horário disponível pela manhã?
- `2026-05-15 16:37` 👤 Vocês trabalham com número de paciente por horário?
- `2026-05-15 16:38` 🤖 **[ÁUDIO]** Olá Laura, tudo bem? É a Marisa. Na verdade, você perguntou se sempre tem horário disponível pela manhã? A nossa agenda é bem concorrida, então as pessoas costumam fazer o agendamento com bastante antecedência, tá? E nós atendemos um paciente a cada meia hora. Nós agendamos sempre a cada meia hora.
- `2026-05-15 16:45` 👤 Entendi
- `2026-05-15 16:45` 👤 Eu pergunto pq a minha escala no trabalho é um pouco complicada
- `2026-05-15 16:45` 👤 E as vezes acaba mudando bastante
- `2026-05-15 16:46` 👤 A agenda de vocês sempre está aberta ou vocês abrem por mês?
- `2026-05-15 16:53` 🤖 Sempre está aberta.
- `2026-05-15 16:57` 👤 Para esse mês ainda tem horário?
- `2026-05-15 17:12` 🤖 Sim
- `2026-05-19 15:00` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-19 15:03` 👤 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento: 22/11/92 CPF: 355.176.878-14 RG: 44.241.230-7 Endereço completo com CEP:  rua almirante Noronha 956 apto 112 cep 02043061 Tel/Cel: 11 996004166 E-mail: laurapeitl@gmail.com Profissão: Médica Veterinária  Estado civil: Solteira  Nacionalidade: Brasileira  Contato de emergência: 11 999953868 Através de qual canal chegou até nós (Google, Instagram, Facebook,
- `2026-05-19 15:04` 👤 Laura Peitl
- `2026-05-19 15:26` 🤖 Datas agendadas para infusão: 25/05 e 28/05 as 09h 01/06 e 04/06 as 09h 10/06 e 12/06 as 09h 16/06 e 19/06 as 09h. Segue as recomendações: 1. Jejum não é necessário, mas não aconselhamos estar com o estômago excessivamente cheio antes da aplicação.  2. Acompanhantes são bem-vindos e poderão ficar com o paciente durante o procedimento. Entretanto, NÃO é necessário que o paciente venha acompanhado.   3. No entanto, você NÃO pode dirigir após a aplicação de cetamina.  4. Evite o consumo de bebidas 
- `2026-05-19 15:39` 👤 Obrigada
- `2026-05-19 15:41` 🤖 Disponha. Seguimos a disposição.
- `2026-05-25 12:02` 👤 Bom dia, estou a caminho.
- `2026-05-25 12:06` 🤖 Olá bom dia, como vai? Agradecemos por sinalizar.
- `2026-05-26 15:13` 👤 Bom dia; tudo bem?  Dia 04/06 é feriado e eu tenho sessão de quetamina, a clínica irá funcionar normalmente?
- `2026-05-26 15:15` 🤖 Olá boa tarde Laura, como vai ? Vamos verificar se terá atendimento e te retornamos assim que possível.
- `2026-05-26 15:16` 👤 Caso não tenha atendimento, gostaria de remarcar para o dia 03/06
- `2026-05-26 17:14` 👤 Eu tenho uma sessão essa quinta dia 28/05 às 09h00, poderia reagendar para as 12h00?
- `2026-05-26 17:20` 🤖 Oi Laura! Reagendado para 28/05 as 12:00 hs.
- `2026-05-26 17:20` 👤 Obrigada
- `2026-05-26 17:20` 🤖 Dia 03/06 pode ser as 12:00 hs?
- `2026-05-26 17:21` 👤 Pode sim
- `2026-05-26 17:21` 🤖 ok agendado dia 03/06 as 12:00 hs.
- `2026-05-26 17:21` 👤 Obrigada
- `2026-05-26 17:21` 🤖 Disponha!
- `2026-05-28 18:12` 👤 Boa tarde
- `2026-05-28 18:13` 👤 Poderia passar todas as minhas sessões para o horário das 12h?
- `2026-05-28 18:18` 🤖 Olá Laura!
- `2026-05-28 18:26` 🤖 Dia 01/06 - o horário não está disponível Dia 03/06 - 12:00 hs Dia 10/06 - 12:00 hs Dia 12:06 - pode ser as 12:30 hs? Dia 19/06 - 12:00 hs
- `2026-05-28 18:36` 👤 Datas agendadas para infusão: 01/06 as 11h30 e 03/06 às 12h 10/06 às 12h00 e dia 12/06 às 12h 16/06 e 19/06 as 12h
- `2026-05-28 18:36` 👤 Confere?
- `2026-05-28 18:37` 👤 Dia 01/06 pode ser às 11h30?
- `2026-05-28 18:50` 🤖 Dia 01/06 só temos horário as 13:30 hs. Pode ser? Dia 12/06 temos horário as 12:30 hs. Pode ser?
- `2026-05-28 18:51` 🤖 O restante está ok
- `2026-05-28 18:52` 👤 Então o dia 01 pode deixar as 09h msm
- `2026-05-28 18:53` 👤 E o dia 12 pode ser às 12h30
- `2026-05-28 18:58` 🤖 Combinado!
- `2026-05-28 18:58` 👤 Obrigada
- `2026-06-01 10:10` 👤 Bom dia
- `2026-06-01 10:10` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-01 10:10` 👤 O horário da das 13h30 de hoje ainda está disponível
- `2026-06-01 10:45` 🤖 Olá bom dia Laura, como vai? Temos horário as 14h30, funciona para você?
- `2026-06-01 10:48` 👤 Está perfeito
- `2026-06-01 10:48` 👤 Muito obrigada
- `2026-06-01 10:48` 👤 Pode marcar
- `2026-06-01 10:58` 🤖 Certo, reagendado. Seguimos a disposição.
- `2026-06-11 19:28` 👤 Boa tarde
- `2026-06-11 19:29` 👤 Gostaria de confirmar o meu horário amanhã, pois recebi um e-mail dizendo que é às 09h00, porém aqui na conversa está remarcado para as 12h30
- `2026-06-11 19:35` 🤖 Oi Laura, realmente houve algum equivoco e ficou agendado para as 09:00 hs. Temos horário amanhã as 13:30 hs. Pode ser?
- `2026-06-11 19:35` 👤 Não tem as 12h?
- `2026-06-11 19:36` 👤 Se não tiver deixa as 09h00
- `2026-06-11 19:36` 👤 Ou um encaixe
- `2026-06-11 19:36` 🤖 Pode vir as 12:00 hs.
- `2026-06-11 19:37` 👤 Obrigada
- `2026-06-11 19:37` 🤖 Disponha!
- `2026-06-15 16:06` 👤 Boa tarde
- `2026-06-15 16:06` 👤 Preciso trocar o horário da minha sessão de amanhã
- `2026-06-15 16:07` 👤 Seria possível as 08h?
- `2026-06-15 16:53` 🤖 Boa tarde, Laura! Sim! Reagendado!

</details>


### Laís Carrara — `5511940569963`

**Custom fields:** `{"data_horario": "2024-07-10T09:30:00-03:00"}`

**Cenário:** `reagendamento_longo_prazo` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead buscou informações sobre infusão de cetamina para depressão resistente. A atendente explicou o protocolo, preços (R$ 800-900 por sessão) e a política de abatimento da consulta no tratamento. A lead agendou inicialmente para 10/06, preferindo presencial para evitar pagamento antecipado da teleconsulta por razões financeiras. Na véspera, solicitou reagendamento para o mês seguinte (10/07), o qual foi confirmado pela clínica.


**Objeções:** Pagamento antecipado para teleconsulta, Indisponibilidade financeira imediata (esperar dia do pagamento)

**Gatilhos:** Preço competitivo, Abatimento do valor da consulta no tratamento, Parcelamento sem juros, Reembolso convênio

<details><summary>Transcrição completa</summary>

- `2026-05-26 15:10` 👤 Oii bom dia
- `2026-05-26 15:10` 👤 Queria saber o preço de uma consulta e da infusão de cetamina
- `2026-05-26 15:11` 🤖 Olá,  sou a Marisa, consultora da Clínica Ór.
- `2026-05-26 15:11` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-05-26 15:12` 👤 Eu tenho depressão resistente há 9 anos
- `2026-05-26 15:12` 👤 Estou tentando duloxetina no momento, mas, novamente, sem sucesso
- `2026-05-26 15:20` 🤖 **[ÁUDIO]** Olá, Laís, bom dia, tudo bem? Meu nome é Marisa.
- `2026-05-26 15:20` 🤖 **[ÁUDIO]** Entendi, Laís. Realmente não deve ser nada fácil passar por isso, né? Você está precisando de um atendimento mais especializado que possa te ajudar a sair dessa situação.
- `2026-05-26 15:20` 👤 Bom diaa
- `2026-05-26 15:21` 🤖 **[ÁUDIO]** O Dr. Ivan tem mais de 15 anos de experiência e eu acredito que ele pode te ajudar bastante nesse caso, porque ele é especialista no tratamento de depressão. Então, eu creio que ele possa realmente encontrar um caminho para te ajudar. Nós temos tratamentos tradicionais e, como você questionou sobre a escetamina, eu vou te explicar um pouquinho.
- `2026-05-26 15:21` 🤖 **[ÁUDIO]** Você já tem encaminhamento para cetamina? Caso você não tenha, o primeiro passo seria passar em consulta com o Dr. Ivan. Na consulta, ele reserva uma hora para te explicar todo o procedimento, verificar suas necessidades e aí, caso seja necessário fazer cetamina, iniciar o tratamento.
- `2026-05-26 15:21` 🤖 **[ÁUDIO]** A cetamina, o doutor Ivan, a princípio, indica oito infusões. Essas infusões são feitas duas vezes por semana, durante quatro semanas.
- `2026-05-26 15:22` 🤖 **[ÁUDIO]** Em relação ao valor, você fazendo o pacote das oito infusões, a cetamina sairá no valor de R$800. Caso você faça a infusão avulsa, o valor é R$900. Eu posso te garantir que o nosso preço é o melhor da cidade de São Paulo, mas eu creio que você pode verificar isso com facilidade fazendo o orçamento em outras clínicas.
- `2026-05-26 15:22` 🤖 **[ÁUDIO]** Em relação ao pagamento, pode ser pago em seis vezes sem juros no cartão de crédito e nós emitimos nota para reembolso. Nesse valor também está inclusa uma consulta de retorno com o Doutor Ivan. Caso você faça o protocolo conosco, você também tem como cortesia a consulta inicial.
- `2026-05-26 15:22` 🤖 **[ÁUDIO]** Ficou com alguma dúvida, posso te ajudar esclarecendo algo mais?
- `2026-05-26 15:23` 🤖 **[ÁUDIO]** Nós temos horário com o doutor Ivan na quinta-feira, dia 28, às 17 horas. Você tem disponibilidade?
- `2026-05-26 15:27` 👤 Nossa, excelente o preço
- `2026-05-26 15:27` 👤 Eu não consigo nesse dia
- `2026-05-26 15:28` 👤 Teria depois do dia 5 alguma terça ou sexta?
- `2026-05-26 15:28` 👤 É presencial?
- `2026-05-26 15:29` 🤖 Você pode fazer a consulta presencial ou online!
- `2026-05-26 15:29` 👤 Legal
- `2026-05-26 15:29` 🤖 Você prefere de manhã ou a tarde?
- `2026-05-26 15:29` 👤 Tarde
- `2026-05-26 15:31` 🤖 A tarde temos horário disponível dia 10/06 as 17:00 hs. Você tem disponibilidade?
- `2026-05-26 15:43` 👤 Sim, pode ser mesmo sendo quarta se for on-line!!
- `2026-05-26 15:44` 🤖 Certo!
- `2026-05-26 15:44` 🤖 **[ÁUDIO]** Olá! Deixa eu te explicar como é que funciona o agendamento de consulta online: é realizado mediante a pagamento. Aí, você fechando o pacote, a consulta — das infusões — aí nós fazemos o abatimento no valor do pacote desse valor que será pago, tá bom?
- `2026-05-26 15:45` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-26 15:50` 👤 Ahhh sim
- `2026-05-26 15:50` 👤 Qual o valor c
- `2026-05-26 15:51` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-26 15:55` 🤖 Volto a falar, caso você faça o tratamento conosco o valor será abatido no tratamento.
- `2026-05-26 15:55` 🤖 Se você fizer a consulta presencial não será necessário fazer o pagamento antecipado da consulta.
- `2026-05-26 16:00` 👤 Ahhh
- `2026-05-26 16:00` 👤 Pode ser presencial então
- `2026-05-26 16:00` 👤 Porque quis marcar depois do dia 5 pra aguardar meu pagamento kkkk!
- `2026-05-26 16:01` 🤖 kkk sem problemas
- `2026-05-26 16:01` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-26 16:15` 👤 Nome completo: Laís Carrara Pavia Marques Data de nascimento: 22/12/1994 CPF: 442.549.408-31 RG: 39.554.030-6 Endereço completo com CEP: Avenida Doutor Altino Arantes, 1132, ap. 103 - Vila Clementino - 04042-005 Tel/Cel: 11 94056 9963 E-mail: laiscarr@gmail.com Profissão: Analista de Marketing Estado civil: Solteira Nacionalidade: Brasileira Contato de emergência: Minha mãe, Sílvia - 11 2441 0635 ou 11 99753 6918 Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicaç
- `2026-05-26 16:45` 🤖 Muito obrigada pelas informações Lais.
- `2026-05-26 16:45` 🤖 Consulta presencial agendada para o dia 10/06 as 17:00 hs
- `2026-05-26 17:10` 👤 Obrigada!!
- `2026-06-09 18:17` 👤 Oie
- `2026-06-09 18:17` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-09 18:17` 👤 Vou precisar remarcar minha consulta de amanhã
- `2026-06-09 18:17` 👤 :(
- `2026-06-09 18:17` 👤 Podemos deixar lá pelo dia 10 do mês que vem?
- `2026-06-09 18:22` 🤖 Olá, tudo bem?
- `2026-06-09 18:23` 🤖 De sexta feira o Dr. Ivan atende as 09:30 hs até as 11:00 hs. Qual horário você deseja?
- `2026-06-09 18:23` 🤖 Se você preferir, você também pode fazer consulta online.
- `2026-06-09 18:51` 👤 Ahhh dia 10 do mês que vem é sexta
- `2026-06-09 18:51` 👤 Pode ser 9h30!! Presencial mesmo
- `2026-06-09 18:52` 🤖 Certo! Reagendado!
- `2026-06-09 18:52` 👤 Obrigada!!
- `2026-06-09 18:52` 🤖 Disponha!

</details>
