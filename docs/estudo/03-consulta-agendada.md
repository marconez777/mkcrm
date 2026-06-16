---
title: "Estudo: Consulta Agendada"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Consulta Agendada' do funil Agendamentos Novo (Clínica ÓR): 1 leads."
---

# Estudo: Consulta Agendada

**Coluna:** `Consulta Agendada` (posição 3) — **1 leads** analisados.


## 1. Perfil típico

O lead típico desta coluna é um paciente em continuidade terapêutica (recorrente) que já possui vínculo com um profissional da clínica. Ele utiliza o modelo de reembolso de plano de saúde, o que torna a eficiência administrativa (emissão de notas e relatórios) tão importante quanto o atendimento clínico. Geralmente fecha pacotes fechados (protocolos de 10 sessões) para garantir a vaga na agenda e facilitar a gestão financeira, preferindo métodos de pagamento digitais e parcelados. É um perfil que busca previsibilidade de horários e documentos impecáveis para garantir o ressarcimento junto à operadora de saúde.


### Procedimentos mais mencionados

- Psicoterapia (Protocolo de 10 sessões)
- Renovação de ciclo terapêutico

### Profissionais mais mencionados

- Dra. Maísa

### Objeções mais comuns

- Dificuldades burocráticas com nota fiscal/relatórios para o plano de saúde
- Conflitos pontuais de agenda para sessões recorrentes
- Necessidade de parcelamento para viabilizar o pagamento do pacote antecipado

### Gatilhos de entrada na coluna

- Necessidade de renovação de protocolo/pacote de sessões
- Confirmação de continuidade do tratamento recorrente (psicoterapia)
- Solicitação de link de pagamento para novos ciclos de atendimento

## 2. Padrões observados (Top 10)

1. Foco total na logística de reembolso (NF + Relatório)
2. Preferência por pagamento parcelado via link (ex: SumUp)
3. Manutenção de horários fixos semanais (ex: sextas às 09:30)
4. Comunicação direta e resolutiva sobre valores de pacotes
5. Valorização da continuidade com o mesmo profissional (Dra. Maísa)
6. Uso de termos como 'protocolo' para se referir ao pacote de sessões
7. Interação administrativa sobrepondo-se à clínica no momento do agendamento
8. Confirmação de data específica para reinício/manutenção após pagamento
9. Expectativa de recebimento de documentos fiscais imediatamente após a compra
10. Resiliência do lead frente a pequenos ajustes de agenda por priorizar o atendimento recorrente

## 3. Erros recorrentes do agente IA atual

- Não identificado nesta amostra

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Consumo de Sessões' para disparar alerta quando o paciente atingir a 8ª sessão (gatilho de renovação).
- Adicionar tag 'Reembolso' para prioridade na fila de emissão de documentos.
- Extrair automaticamente a preferência de horário fixo do paciente para o CRM.

## 5. Recomendações para o agente de **atendimento**

- Sempre confirmar se o paciente precisará de relatório de datas junto com a NF para o reembolso.
- Ao enviar o link de pagamento, já deixar pré-agendado o horário fixo no sistema.
- Script: 'Olá [Nome], verifiquei que renovamos seu protocolo. Já estou preparando sua NF e o relatório de sessões para seu plano, conforme as datas tratadas.'
- Handoff: Informar ao financeiro a necessidade de detalhamento específico no corpo da NF para evitar glosas no plano do paciente.

## 6. Alertas

- ⚠️ Monitorar prazos de emissão de NF e relatórios para reembolso (fator crítico de retenção)
- ⚠️ Risco de churn caso a burocracia do plano de saúde não seja atendida adequadamente

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Thiago di Marcantonio | 5511981462431 | 61 | 8 | renovacao_protocolo_agendamento_recorrente |

## 8. Conversas analisadas (transcrição + síntese)

_1 leads com conversa analisada._


### Thiago di Marcantonio — `5511981462431`

**Custom fields:** `{"mensagem": "Lead Thiago mostrou interesse em terapia com Dr. Maísa; houve sugestão de sessão no dia 19/06 às 09:30, ainda não confirmada.", "interesse": "Psicoterapia", "observacoes": "Lead Thiago mostrou interesse em terapia com Dr. Maísa; houve sugestão de sessão no dia 19/06 às 09:30, ainda não confirmada.", "data_horario": "2024-05-31T09:30:00-03:00", "qualificacao": "interessado", "telecons`

**Cenário:** `renovacao_protocolo_agendamento_recorrente` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Thiago renovou seu protocolo de 10 sessões de psicoterapia com a Dra. Maísa, realizando o pagamento via link (SumUp) parcelado. A interação focou na resolução de uma questão burocrática sobre a emissão de Nota Fiscal e relatório de datas para reembolso do plano de saúde. Após o ajuste administrativo, o paciente confirmou a manutenção das sessões semanais (sextas às 09:30), apesar de um reagendamento pontual. Conversa finalizada com sessão confirmada para 19/06.


**Objeções:** burocracia_reembolso_nota_fiscal, conflito_agenda_pontual

**Gatilhos:** reembolso_plano_saude, parcelamento_cartao, continuidade_terapeutica

<details><summary>Transcrição completa</summary>

- `2026-05-12 14:51` 🤖 A Dra. Maisa sugeriu uma nova sessão para o dia 15/5 às 09:30. Você tem disponibilidade?
- `2026-05-12 15:22` 👤 Tenho sim, obrigado
- `2026-05-12 15:23` 🤖 Agendado! Grata!
- `2026-05-12 15:28` 👤 Eu quem agradeço
- `2026-05-26 10:45` 🤖 Olá bom dia Thiago, como vai? A Dra Maísa sugeriu que suas sessões sejam todas as sextas as 09h30. Podemos agendar?
- `2026-05-26 10:45` 👤 Bom dia. Podemos sim
- `2026-05-26 15:01` 🤖 **[ÁUDIO]** Olá, Thiago, tudo bem? Edilene aqui da Clínica Orth. Thiago, primeiramente agradeço pela confirmação, tá? Agora minha dúvida é referente ao seu protocolo, se a doutora chegou a sinalizar mais quantas sessões ela está te recomendando todas as sextas-feiras. E também sinalizar que a sessão do dia 15, ela já saiu do protocolo, né? O protocolo que você havia pago anteriormente foi até o dia 8 do 5. Aí essa sessão do dia 15 ela precisa ser paga e aí a gente pode ver quantas sessões a doutora vai recomendar para você pagar tudo junto. Pode ser?
- `2026-05-26 15:19` 👤 Ola, só uma dúvida: a sessão do dia 27 de março não aconteceu. Vc pode confirmar se está contabilizada, por favor?
- `2026-05-26 15:20` 👤 dai vou precisar da nf, com o relatorio de sessoes, as datas q ocorreram
- `2026-05-26 15:20` 👤 sobre o novo protocolo, podemos fazer para 10 sessoes
- `2026-05-26 15:47` 🤖 **[ÁUDIO]** Olá, Thiago, tudo bem? Então, o dia 27 de março não foi contabilizado, tá bom? Mesmo assim, se foram 11 sessões realizadas, então passou somente uma mesmo do protocolo de 10 que você havia feito. Sobre a nota, vou verificar aqui no site de notas, mas eu acredito que a nota ela já foi emitida com o número de sessões contratado, não tem as datas, mas eu vou verificar aqui no sistema e te dou um retorno, tá bom? E sobre o protocolo com mais 10 sessões, qual vai ser a forma de pagamento? Nós parcelamos esse valor em até seis vezes sem juros.
- `2026-05-26 15:47` 👤 ah, ok, obrigado por confirmar
- `2026-05-26 15:47` 👤 pode ser no cartao de credito, parcelado
- `2026-05-26 15:53` 🤖 Segue nota fiscal referente ao protocolo feito em fevereiro.
- `2026-05-26 15:53` 🤖 NFSe_52686124_14985.pdf
- `2026-05-26 15:55` 👤 obrigado. O plano de saúde pede detalhamento das sessoes realizadas, como feito nesta nota anterior
- `2026-05-26 15:56` 🤖 **[ÁUDIO]** Olá, Thiago, só tirando uma dúvida: então, dessa forma que foi a descrição da sua nota está ok, porque a gente não coloca as datas para frente, apesar da doutora ter sugerido uma data única, porque pode acontecer alguma intercorrência, você ter que mudar a data, né? De repente, viajar e demorar um pouquinho mais para retomar as sessões. Então por esse motivo a gente não coloca as datas para frente, né? Aí, no caso, se já tivesse realizado as sessões, era mais fácil de puxar as datas que já tinham sido realizadas. Então, com essa descrição da forma que está, o plano de saúde aceita.
- `2026-05-26 15:58` 👤 sim, faz sentido nao colocar a data pra frente. é q nao é usual pagar antes da realização. normalmente faz as sessoes, paga, e a aí já temos as datas corretas para colocar
- `2026-05-26 15:59` 👤 como feito nesta daqui, com as datas listadas, o plano aceita
- `2026-05-26 16:03` 🤖 **[ÁUDIO]** Oi Thiago, então, com relação às datas, o que acontece? Eu consigo usar as datas das sessões realizadas de fevereiro até agora em maio, né? Com esse novo pagamento que você vai realizar, porque a nota de fevereiro eu não consigo cancelar e colocar datas para que você utilize essa nota que foi feita em fevereiro. Mas essa que você vai efetuar o pagamento para mais dez sessões, eu consigo colocar as datas das sessões que você já realizou. Lembrando que você vai ter dez sessões, né? Pra fazer. Pode ser assim? Dessa forma? Não sei se ficou claro o meu áudio.
- `2026-05-26 16:39` 👤 **[ÁUDIO]** Oi, Edilene. Eu entendo, mas eu já tinha é... pedido, né, para ser com... com datas. Já tanto que o anterior a gente já tinha feito assim. É, eu acredito que não tenha problema não ser na nota, mas então precisa fazer um relatório atestando que datas foram realizadas, com o carimbo da clínica, tal. Não sei se tem algum modelo que vocês costumam fazer aí, talvez vocês saibam melhor do que eu o formato, porque eles não pedem que seja... seja necessariamente na data... na nota, mas eles pedem pra ter o relatório das sessões realizadas.
- `2026-05-26 18:04` 🤖 **[ÁUDIO]** Oi, Thiago, sem problemas, posso sim solicitar o relatório de que as sessões foram realizadas nas datas do seu pagamento anterior, tá bom? E com relação à próxima nota, eu posso emitir ela da mesma forma e ficar solicitando esse relatório para que você tenha o seu reembolso do plano de saúde, pode ser?
- `2026-05-26 19:28` 👤 por favor! isso deve bastar ;)
- `2026-05-26 19:30` 👤 acho q vale fazer o seguinte: vc me manda o relatorio e eu submeto para reembolso a nf+relatorio e vemos se passa (acredito q sim)
- `2026-05-26 19:30` 👤 esta nota do protocolo q vou pagar agora, seguramos só até ter resposta deles para emitir
- `2026-05-26 19:30` 👤 se precisar mudar algo, ja fazemos
- `2026-05-26 19:46` 🤖 Thiago vamos verificar com o setor responsável se é possível emitir a nota fiscal após a realização de todas as sessões de terapia. E assim que possível te retornamos referente a esse novo pagamento. E sobre o relatório iremos solicitar também com as datas das sessões já realizadas.
- `2026-05-27 18:35` 🤖 Segue *link* de pagamento referente a sessões de terapia com a Dra Maísa https://pay.sumup.com/b2c/XBPIZ834XO Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-27 19:01` 🤖 **[ÁUDIO]** Olá, boa tarde, Thiago, tudo bem? Thiago, vamos lá. Referente ao relatório, estou fazendo aqui o levantamento de datas, eh, com relação às sessões pagas da nota do dia 06 de fevereiro, tá? O que acontece: no dia 06 de fevereiro, você pagou 10 sessões com a Dra. Maísa, porém nesse dia você já tinha feito algumas sessões anteriormente. Então, eh, a doutora já fez os atendimentos, mesmo com algumas sessões, eh, já realizadas sem o pagamento. Nesse caso, tem algum problema eu colocar essas datas antes de fevereiro no relatório?
- `2026-05-27 19:03` 🤖 Fico no aguardo para dar seguimento ao relatório.
- `2026-05-28 15:47` 🤖 Olá boa tarde Thiago, como vai? Assim que possível por gentileza verifique o áudio, para darmos continuidade ao relatório solicitado. Sigo a disposição.
- `2026-05-28 19:52` 👤 Boa tarde
- `2026-05-28 19:52` 👤 Desculpe, em um monte de reunioes
- `2026-05-28 19:53` 👤 Eu nao sei, na verdade, mas acredito q nao haja problema
- `2026-05-28 19:53` 👤 Sao as datas reais em q foram realizados. Se pode pagar antes e pode pagar depois, nao vejo pq nao poderia pagar no meio
- `2026-05-28 19:53` 👤 Faz dessa forma, por favor
- `2026-05-28 19:54` 🤖 Certo, combinado.
- `2026-05-28 20:48` 🤖 Olá Thiago
- `2026-05-28 20:48` 🤖 Segue relatório solicitado.
- `2026-05-29 12:09` 🤖 Adobe Scan 28 de mai. de 2026 (4).pdf
- `2026-05-29 12:28` 👤 *[imagem]*
- `2026-05-29 12:30` 🤖 Agradecemos o envio do comprovante. Seguimos a disposição
- `2026-05-29 12:52` 🤖 **[ÁUDIO]** Olá, Thiago, bom dia, tudo bem? Thiago, quando você tiver um retorno do plano de saúde referente ao relatório, você sinaliza para a gente? Para as próximas sessões, os próximos pagamentos, nós fazermos da mesma forma: a gente emite a nota com o número de sessões, né, que você pagou, que são 10, e nós sinalizamos no relatório os dias que foram feitos, tá bom? Se der tudo certo aí, só nos traz um retorno, por gentileza. Tenha um bom dia, bom final de semana.
- `2026-05-29 15:44` 👤 Sim, pode deixar
- `2026-06-01 20:23` 🤖 Thiago. Boa tarde. Tudo bem?
- `2026-06-01 20:23` 🤖 A Dra. Maísa está perguntando se só esta semana a sessão pode ser amanhã as 09:30 hs?
- `2026-06-01 22:20` 👤 Ola. Amanha n consigo
- `2026-06-01 22:20` 👤 Fica pra 6a da outra semana
- `2026-06-01 22:20` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-11 20:04` 🤖 Olá Thiago. Tudo bem?
- `2026-06-11 20:04` 🤖 Podemos confirmar sua sessão com o Dr. Maísa amanhã as 09:30 hs?
- `2026-06-11 20:04` 👤 boa tarde. Podemos!
- `2026-06-11 20:04` 🤖 Muito obrigada!
- `2026-06-12 16:59` 🤖 Boa tarde, Tiago. Tudo bem?
- `2026-06-12 16:59` 🤖 Podemos confirmar sua próxima sessão para o dia 19/06 as 09:30 hs?
- `2026-06-15 14:49` 🤖 Bom dia, Thiago! Podemos confirmar a sessão?
- `2026-06-15 15:50` 👤 Bom dia. Podemos
- `2026-06-15 15:51` 🤖 Muito obrigada!

</details>
