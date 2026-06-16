---
title: "Estudo: lead parou de responder"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'lead parou de responder' do funil Agendamentos Novo (Clínica ÓR): 14 leads."
---

# Estudo: lead parou de responder

**Coluna:** `lead parou de responder` (posição 7) — **14 leads** analisados.


## 1. Perfil típico

O lead típico que parou de responder nesta coluna divide-se em dois perfis: 1) O 'Espectador', que inicia o contato por curiosidade ou urgência momentânea, mas silencia ao ser confrontado com a triagem clínica (pergunta sobre sintomas/queixas) ou com o valor da consulta particular (R$ 750); 2) O 'Paciente Recorrente' que, embora já esteja em fluxo, parou de confirmar sessões de manutenção ou reagendou após imprevistos e não retomou a sequência. Há também uma parcela de contatos B2B (fornecedores) que não deveriam estar no funil de vendas. Geralmente são leads que buscam psiquiatria especializada (Cetamina, EMT, Bipolaridade) e possuem indicação externa.


### Procedimentos mais mencionados

- Infusão de Cetamina
- Estimulação Magnética Transcraniana (EMT)
- Consulta Psiquiátrica (Primeira vez)
- Teleconsulta de seguimento

### Profissionais mais mencionados

- Dr. Ivan Barenboim
- Dra. Maisa
- Consultora Marisa (Atendimento)
- Consultora Edilene (Atendimento)

### Objeções mais comuns

- Conflito de agenda (reagendamentos da própria clínica).
- Aumento de preço de procedimentos (EMT).
- Preço da consulta inicial (R$ 750).
- Necessidade de relatório de médico externo antes de iniciar infusões.

### Gatilhos de entrada na coluna

- Lead enviou 'Oi' e não prosseguiu após a apresentação da consultora.
- Lead solicitou informações de triagem e parou após a pergunta sobre sintomas.
- Lead recebeu valores de consulta e horários, mas não confirmou o agendamento.

## 2. Padrões observados (Top 10)

1. Leads que param de responder imediatamente após a pergunta sobre o quadro clínico (filtro de triagem).
2. Interrupção da jornada após o envio do valor da consulta (R$ 750).
3. Recidiva de contato fora do horário comercial com demora na resposta do lead no dia seguinte.
4. Pacientes recorrentes que param de responder após agendamentos automáticos de sessão.
5. Preferência por comunicação via texto em casos de transtornos graves (ideação suicida).
6. Urgência inicial que esfria se o agendamento não for imediato.
7. Busca por reembolso de convênio como fator decisivo (Nota Fiscal).
8. Conversão facilitada quando a consulta inicial é abatida no valor do tratamento (EMT/Cetamina).
9. Leads qualificados por indicação (psicólogos) que hesitam na confirmação final da data.
10. Interações que terminam após o envio de links de pagamento ou links de reunião.

## 3. Erros recorrentes do agente IA atual

- Nomear leads com caracteres genéricos (ex: '.' ou emojis) em vez de identificar o nome real durante a conversa.
- Não filtrar contatos comerciais/fornecedores de leads assistenciais.

## 4. Recomendações para o agente de **pipeline**

- Criar automação de 'Follow-up de 24h' para leads que estacionam na pergunta de triagem.
- Mover contatos identificados como fornecedores (Fabiane, Priscila) para uma lista separada de 'Suprimentos/B2B'.
- Adicionar campo 'Origem da Indicação' (ex: Psicólogo) para personalizar o fechamento.
- Implementar alerta de 'Reagendamento Crítico' caso a clínica desmarque mais de uma vez com o mesmo paciente.

## 5. Recomendações para o agente de **atendimento**

- Para leads que param na triagem: 'Entendemos que falar sobre os sintomas pode ser difícil. Esse breve relato serve apenas para o Dr. Ivan preparar seu atendimento de forma mais personalizada.'
- Para casos de sumiço pós-preço: enviar prova social ou reforçar o bônus de abatimento da consulta em tratamentos de EMT/Cetamina.
- Humanizar o follow-up: 'Olá [Nome], notamos que não conseguimos concluir seu agendamento. Ficou alguma dúvida sobre o valor ou sobre o funcionamento da clínica?'
- Handoff: Casos de ideação suicida (ex. Felipe Moulin) devem ter prioridade máxima e canal de texto respeitado.

## 6. Alertas

- ⚠️ Loop de mensagens automáticas detectado em um lead (Natalie), disparando 11 notificações repetidas.
- ⚠️ Presença de fornecedores de insumos (B2B) misturados ao funil de pacientes.
- ⚠️ Risco de 'churn' por reagendamentos sucessivos causados pela clínica (caso Fabio Dalla).

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Ana Clara Borelli | 5511943864277 | 58 | 1 | agendamentos_recorrentes_tratamento |
| 2 | Fabio Dalla | 5511939327948 | 13 | 1 | reagendamento_por_imprevisto_clinica |
| 3 | Julia Coletti | 5519983141318 | 42 | 0 | agendou_apos_mudanca_formato |
| 4 | . | 5511973444438 | 53 | 3 | agendou_apos_retorno_contato |
| 5 | Fabiane Medical Magazine | 555481650194 | 37 | 0 | admin_parceria |
| 6 | Felipe Moulin | 5511971952811 | 99 | 8 | agendou_procedimento_direto |
| 7 | 👧🏻♾️👶🏽 | 554384172799 | 7 | 0 | aguardando_triagem_clinica |
| 8 | Gisele | 556791061994 | 5 | 0 | aguardando_retorno_lead_apos_triagem |
| 9 | Rubia Oliveira | 556696089862 | 3 | 0 | aguardando_retorno_triagem |
| 10 | Priscila | 5511937637106 | 7 | 0 | fora_escopo_distribuidora |
| 11 | — | 5511947367684 | 2 | 0 |  |
| 12 | — | 5511970669511 | 2 | 0 |  |
| 13 | Mah | 5513920054251 | 4 | 0 | lead_parou_apos_primeira_msg |
| 14 | Beatriz Ortega | 5513997638540 | 9 | 4 | sumiu_apos_cotacao_e_horario |

## 8. Conversas analisadas (transcrição + síntese)

_12 leads com conversa analisada._


### Ana Clara Borelli — `5511943864277`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2026-06-05T11:30:00-03:00", "teleconsulta": "true", "link_consulta": "https://meet.google.com/xwx-uang-xyc", "procedimentos": ["Retorno", "Infusão de cetamina"]}`

**Cenário:** `agendamentos_recorrentes_tratamento` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente Ana Clara já está em tratamento e mantém contato frequente para agendar várias sessões de infusão de cetamina e teleconsultas com o Dr. Ivan. A comunicação é direta, com foco em disponibilidade de horários, geralmente solicitando vagas para o mesmo dia ou curto prazo. Todos os agendamentos solicitados foram realizados com sucesso e sem objeções.


**Gatilhos:** agilidade no agendamento, disponibilidade de horários próximos, continuidade do tratamento

<details><summary>Transcrição completa</summary>

- `2026-05-12 11:41` 🤖 Olá bom dia Ana Clara, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-12 11:41` 🤖 Ana Clara Borelli Barros Fischer - Dr Ivan Barenboim - 12/05/2026 Terça-feira, 12 de maio · 11:30am – 12:00pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/pyo-gcdx-yvu
- `2026-05-12 12:34` 👤 Myo obrigada:)
- `2026-05-12 13:27` 👤 Tem horário pra infusao.hoje caso o Dr recomende?
- `2026-05-12 13:27` 🤖 Olá, Ana!
- `2026-05-12 13:28` 🤖 Pode ser as 13:00 hs?
- `2026-05-12 13:28` 👤 Pode sim :)
- `2026-05-12 13:28` 🤖 ok
- `2026-05-12 14:43` 👤 O dr nao está atendendo
- `2026-05-12 14:43` 🤖 Ana o Dr esta finalizando um atendimento.
- `2026-05-12 14:44` 👤 Ahh ok
- `2026-05-13 16:53` 👤 Boa tarde, tudo bem? Queria deixar marcado um horario na sexta, por acaso tem?
- `2026-05-13 17:08` 🤖 Olá boa tarde Ana Clara, na sexta temos horário as 12h30. Funciona para você?
- `2026-05-13 17:24` 👤 Funciona sim :)
- `2026-05-13 17:31` 🤖 Certo, agendado.
- `2026-05-13 17:36` 👤 Mto obrigada:)
- `2026-05-18 13:05` 👤 Bom dia tudo bem? Por acaso tem horario hj?
- `2026-05-18 13:07` 🤖 Bom dia! Pode ser as 13:00 hs?
- `2026-05-18 13:07` 👤 Pode sim :)
- `2026-05-18 13:08` 🤖 Agendado!
- `2026-05-20 13:17` 👤 Bom dia, tudo bem? Teria horario perto das 11h hj?
- `2026-05-20 13:23` 🤖 Bom dia, Clara. Tudo bem e você?
- `2026-05-20 13:24` 👤 Tudo bem tbm
- `2026-05-20 13:24` 🤖 Posso te colocar as 11:30 hs?
- `2026-05-20 13:24` 👤 Pode sim
- `2026-05-20 13:24` 👤 Mto obrigada
- `2026-05-20 13:24` 🤖 Agendado!
- `2026-05-25 13:36` 👤 Bom dia tudo bem?
- `2026-05-25 13:36` 👤 Tem horário pra hj a tarde?
- `2026-05-25 13:37` 🤖 Bom dia, Ana!
- `2026-05-25 13:37` 🤖 Pode ser as 13:00 hs?
- `2026-05-25 13:37` 👤 Pode sim :)
- `2026-05-25 13:39` 🤖 Agendado!
- `2026-05-25 13:40` 🤖 Ana. Me desculpe
- `2026-05-25 13:40` 🤖 Pode ser as 15:30 hs?
- `2026-05-25 13:43` 👤 Pode sim!
- `2026-05-25 13:43` 👤 Sem problemas
- `2026-05-25 13:43` 🤖 Obrigada!
- `2026-05-25 13:43` 👤 Eu que agradeço
- `2026-05-25 13:59` 🤖 Disponha
- `2026-05-26 16:02` 👤 Boa tarde, tudo bem? Queria deixar marcado amanhã, tem horario as 12h ou proximo?
- `2026-05-26 16:05` 🤖 Olá boa tarde Ana Clara, como vai? Temos horário amanhã as 12h30, funciona para você?
- `2026-05-26 16:06` 👤 Funciona sim :)
- `2026-05-26 16:10` 🤖 Agendado, seguimos a disposição.
- `2026-05-26 16:11` 👤 Mto obrigada :)
- `2026-06-01 12:13` 👤 Bom dia, tudo bem? Por acaso tem horario agora de manhã perto das 11h?
- `2026-06-01 12:16` 🤖 **[ÁUDIO]** Oi, Ana, tudo bem? Então, hoje o único horário que a gente tem disponível são às 10 da manhã. Esse horário funciona para você?
- `2026-06-01 12:19` 👤 Funciona sim :)
- `2026-06-03 12:07` 👤 Bom dia tudo bem? Teria horario proximo as 11h?
- `2026-06-03 12:10` 🤖 Bom dia, Ana! Pode ser as 12:30 hs?
- `2026-06-03 12:11` 👤 Pode sim :)
- `2026-06-03 12:11` 🤖 Agendado!
- `2026-06-05 11:11` 🤖 Olá bom dia Ana Clara, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-06-05 11:11` 🤖 Ana Clara Borelli Barros Fischer - Dr Ivan Barenboim - 05/06/2026 Sexta-feira, 5 de junho · 11:30am – 12:00pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/xwx-uang-xyc
- `2026-06-08 12:23` 🤖 Disponha!
- `2026-06-11 17:06` 👤 Boa tarde, tudo bem? Queria deixar minha infusão agendada, segunda-feira às 11h ou algum horário próximo tem vaga?
- `2026-06-11 17:11` 🤖 Agendado! Bom final de semana.
- `2026-06-11 17:15` 👤 Mto obrigada, bom fim de semana

</details>


### Fabio Dalla — `5511939327948`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "pagamento": "400", "data_horario": "2025-12-16T12:30:00-03:00", "procedimentos": "[\"Infusão de cetamina\",\"EMT\",\"Consulta de seguimento\",\"Retorno\"]"}`

**Cenário:** `reagendamento_por_imprevisto_clinica` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O paciente recebeu um desconto nas sessões de R$ 600 para R$ 400 concedido pelo Dr. Ivan. A conversa foca em sucessivos reagendamentos por parte da clínica: primeiro com a Dra. Maisa e depois por motivo de saúde da profissional, com sugestão de nova data pela atendente Edilene. O lead demonstra compreensão e educação, mas o fluxo de tratamento parece instável devido às mudanças de agenda.


**Objeções:** conflito_de_agenda_reagendamento

**Gatilhos:** desconto_concedido, acompanhamento_continuo

<details><summary>Transcrição completa</summary>

- `2026-05-12 16:38` 🤖 Boa tarde, Fábio! Tudo bem?
- `2026-05-12 16:38` 🤖 Marisa da Clinica Ór!
- `2026-05-12 17:08` 👤 Oi Marisa, boa tarde! Tudo bem e você?
- `2026-05-12 17:14` 🤖 Tudo bem!
- `2026-05-12 17:17` 🤖 Em resposta a sua solicitação o Dr. Ivan concedeu um desconto para suas sessões de R$ 600,00 para R$ 400,00.
- `2026-05-12 17:31` 👤 Nossa, que boa notícia!🙏 Muito obrigado!
- `2026-05-12 17:43` 🤖 Disponha!
- `2026-05-14 13:15` 🤖 Bom dia, Fabio. Tudo bem? Surgiu um imprevisto com a Dra. Maisa e não será possível realizar atendimentos hoje. Você tem disponibilidade amanhã as 08:30 hs?
- `2026-05-14 13:24` 👤 Oi, bom dia. Tudo bem. Obrigado por avisar. Amanhã não consigo...
- `2026-05-14 13:24` 👤 Estamos no caminho, hoje tenho retorno com Dr Ivan
- `2026-05-14 13:25` 🤖 Certo! obrigada!
- `2026-06-11 11:18` 🤖 **[ÁUDIO]** Olá, Fábio, tudo bem? Bom dia, Edilene da Clínica Or. É, tô sinalizando que a doutora pediu para reagendar os pacientes de hoje porque ela acordou com o olho inchado, um mal-estar, e aí ela pediu pra gente reagendar os pacientes porque ela não vai conseguir fazer o atendimento. Vai ao médico verificar o que aconteceu e aí pediu para eu estar avisando aos pacientes. Vou manter o seu horário, mas na próxima quinta-feira, qualquer dúvida pode mandar mensagem aqui na clínica que nós te retornamos, tá bom? Tchau, tchau.
- `2026-06-11 12:49` 👤 Oi, bom dia Edilene. Obrigado por avisar!

</details>


### Julia Coletti — `5519983141318`

**Custom fields:** `{"mensagem": "Tânia Isabel vitachi Coletti - CPF 08510643881", "interesse": "Consulta com psiquiatria", "pagamento": "750", "data_horario": "2026-05-25T17:00:00-03:00", "teleconsulta": "true", "link_consulta": "https://meet.google.com/pkx-dwqr-eoc", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `agendou_apos_mudanca_formato` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A paciente Julia Coletti solicitou agendamento para psiquiatria, inicialmente presencial para o dia 25/05. No dia da consulta, devido a um diagnóstico de influenza, solicitou a alteração para teleconsulta. O atendimento foi ágil na conversão do formato, processou o pagamento via PIX e realizou o envio do link do Meet. Houve solicitação posterior (08/06) da nota fiscal em nome da mãe (Tânia), que foi prontamente atendida.


**Objeções:** convalescença_saude

**Gatilhos:** emissao_nota_fiscal_reembolso, agendamento_rapido, atendimento_humanizado

<details><summary>Transcrição completa</summary>

- `2026-05-15 14:29` 👤 Olá bom dia
- `2026-05-15 14:29` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-15 14:29` 👤 Tudo bem ?
- `2026-05-15 14:29` 👤 Gostaria de marcar um horário com o dr
- `2026-05-15 14:30` 👤 Consigo dia 22 à tarde  Ou dia 25
- `2026-05-15 14:30` 👤 Teria disponibilidade?
- `2026-05-15 14:37` 🤖 Bom dia, Julia!
- `2026-05-15 14:38` 🤖 Temos horário dia 25/05 as 17:00 hs. Você tem disponibilidade?
- `2026-05-15 14:40` 👤 Sim
- `2026-05-15 14:40` 👤 Confirmado
- `2026-05-15 14:40` 👤 Mt obrigada 🙏🏻
- `2026-05-15 14:43` 🤖 Disponha!
- `2026-05-15 14:43` 🤖 Julia! A consulta será presencial ou online?
- `2026-05-15 14:47` 👤 Presencial pode ser ?
- `2026-05-15 16:17` 🤖 Sim! Agendado!
- `2026-05-25 12:52` 🤖 Bom dia, Julia. Tudo bem?
- `2026-05-25 12:53` 🤖 Podemos confirmar sua consulta hoje as 17:00 hs?
- `2026-05-25 13:06` 👤 Olá tudo bem
- `2026-05-25 13:06` 👤 Eu iria mandar msg agr  Poderia ser online a consulta ? Eu estou com influenza
- `2026-05-25 13:10` 🤖 Olá bom dia Julia, como vai? Sim sua consulta pode ser online.
- `2026-05-25 13:11` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-25 13:11` 👤 Pix
- `2026-05-25 13:12` 👤 Qual o valor mesmo ?
- `2026-05-25 13:12` 👤 Aí a nota fiscal vai ser no nome da minha mãe
- `2026-05-25 13:12` 👤 Q nem as anteriores
- `2026-05-25 13:12` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-25 13:14` 👤 Qual seria o pix
- `2026-05-25 13:26` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-25 14:08` 👤 *[imagem]*
- `2026-05-25 14:08` 👤 O pix
- `2026-05-25 14:08` 👤 A nota fiscal será no nome dela obrigada
- `2026-05-25 14:08` 👤 Tânia Isabel vitachi Coletti  085 106 438 81
- `2026-05-25 14:30` 🤖 Muito obrigada Julia!
- `2026-05-25 14:30` 🤖 Segue o link para consulta
- `2026-05-25 14:31` 🤖 Julia Coletti - Dr. Ivan Barenboim - 25/05/2026 Segunda-feira, 25 de maio · 5:00 – 5:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/pkx-dwqr-eoc
- `2026-06-08 13:35` 👤 Olá bom dia
- `2026-06-08 13:35` 👤 Poderia me enviar a nota fiscal
- `2026-06-08 13:35` 👤 Nome de Tânia
- `2026-06-08 14:16` 🤖 Bom dia, Juliua!
- `2026-06-08 14:16` 🤖 Segue a nota fiscal.
- `2026-06-08 14:16` 🤖 Julia.pdf
- `2026-06-08 14:18` 👤 Obrigada 🙏🏻

</details>


### . — `5511973444438`

**Custom fields:** `{"origem": "Google - Orgânico", "interesse": "EMT", "enviar_dia": "2026-06-05T03:00:00.000Z", "data_horario": "2026-06-05T12:00:00-03:00", "teleconsulta": "false", "procedimentos": ["Primeira Consulta"]}`

**Cenário:** `agendou_apos_retorno_contato` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Natalie retomou o contato questionando preços de EMT. A atendente explicou que a consulta de R$ 750 vira cortesia se o tratamento for fechado, informando o novo valor da sessão (R$ 250). A lead aceitou e agendou a primeira consulta para 05/06. Após a consulta inicial, a lead iniciou o protocolo de sessões, enviando avisos de chegada na clínica em datas subsequentes (08, 10, 12 e 15/06).


**Objeções:** Aumento do valor da sessão (de 200 para 250 reais)

**Gatilhos:** Abatimento da consulta no tratamento (cortesia), Pagamento parcelado em 6x, Reembolso de convênio (nota fiscal)

**Erros do bot:** Loop de mensagens automáticas (11 mensagens repetidas sobre o início da consulta em um curto intervalo)

<details><summary>Transcrição completa</summary>

- `2026-06-03 21:42` 👤 Boa noite, tudo bem? Continuam os mesmos valores?
- `2026-06-03 21:42` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-03 21:46` 👤 750 reais é somente a primeira consulta, certo? Ao longo do tratamento serão sessões de 200 reais apenas?
- `2026-06-03 21:47` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-03 21:47` 🤖 Como é seu nome?
- `2026-06-03 21:48` 👤 Natalie
- `2026-06-03 21:48` 🤖 Certo. O seu interesse é no tratamento de EMT?
- `2026-06-03 21:48` 👤 Isso
- `2026-06-03 21:49` 👤 Fiquei de agendar antes, mas não deu certo, agora consigo agendar mais tranquilamente
- `2026-06-03 21:49` 🤖 **[ÁUDIO]** Oi Natalie, boa tarde, Marisa, tudo bem? Natalie, a consulta do doutor é R$750, mas se você fizer o tratamento conosco, a consulta é cortesia, você não paga a consulta. As sessões de MT é R$ 250, não mais R$ 200, tá? E o doutor normalmente prescreve 40 sessões. Essas sessões são feitas em 20 dias, duas vezes, duas por dia, com o intervalo de uma hora. E cada sessão dura 15 minutos.
- `2026-06-03 21:50` 🤖 **[ÁUDIO]** Você pode pagar eh o pacote em até seis vezes sem juros, e nós ainda emitimos eh nota para reembolso e também está incluso no pacote a consulta no final do tratamento de reavaliação do doutor Ivan.
- `2026-06-03 21:51` 🤖 **[ÁUDIO]** Caso você queira, nós ainda temos horário para a consulta dia 5 de junho, perdão, às 12 horas. Você tem disponibilidade?
- `2026-06-03 21:53` 👤 Perfeito então, gostaria de marcar para dia 5 então
- `2026-06-03 21:53` 🤖 Certo!
- `2026-06-03 21:53` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: CPF: Data de nascimento: RG: Profissão: E-mail: Tel/Cel: CEP: Endereço completo : Profissão: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-06-03 21:54` 👤 Eu iria perguntar isso, quer que eu envie por aqui ou pelo forms?
- `2026-06-03 21:55` 🤖 Por aqui. Por favor.
- `2026-06-03 21:55` 👤 Certo
- `2026-06-03 22:00` 👤 Natalie Weles Alencar Figueiredo 493.597.958-52 20/11/2002 50.462.765-X Analista de Sistemas naftiew@gmail.com  11973444438 06216260 Rua Lourenço Collino, 333 - Presidente Altino 11942933842 Google
- `2026-06-03 22:05` 🤖 Muito obrigada pelas informações!
- `2026-06-03 22:05` 🤖 Consulta presencial agendada para o dia 05/06 as 12:00 hs com o Dr. Ivan Barenboim.
- `2026-06-03 22:06` 👤 Muito obrigada!
- `2026-06-03 22:06` 🤖 Disponha!
- `2026-06-04 15:00` 🤖 Olá, .Natalie 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 05/06/2026 12:00  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene.
- `2026-06-04 20:44` 👤 Olá, pode confirmar
- `2026-06-04 20:44` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-05 14:00` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:05` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:10` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:15` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:20` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:25` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:30` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:35` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:40` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:45` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 14:50` 🤖 .Natalie, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-08 15:36` 👤 Boa tarde, tudo bem? Já estou a caminho
- `2026-06-08 15:44` 🤖 Olá Natalie. Tudo bem?
- `2026-06-08 15:44` 🤖 Você tem até 30 minutos de tolerância.
- `2026-06-08 15:46` 👤 Ok, obrigado!
- `2026-06-10 16:39` 👤 Boa tarde, estou a caminho
- `2026-06-10 16:40` 🤖 Boa tarde. Agradecemos por sinalizar.
- `2026-06-10 16:56` 👤 Por nada
- `2026-06-10 17:25` 👤 Estou chegando
- `2026-06-12 15:04` 👤 Boa tarde, estou a caminho
- `2026-06-12 15:06` 🤖 ok vamos avisar as enfermeiras
- `2026-06-15 16:34` 👤 Boa tarde, estou a caminho
- `2026-06-15 16:50` 🤖 ok vamos avisar as enfermeiras

</details>


### Fabiane Medical Magazine — `555481650194`

**Cenário:** `admin_parceria` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A Clínica ÓR entrou em contato com a fornecedora Fabiane (Medical Magazine) para cotação de diversos insumos hospitalares. Houve negociação de itens como extensores e seringas, com a fornecedora se oferecendo para cobrir preços da concorrência (Medcom). O pedido parcial foi fechado após ajustes de estoque. No último contato, a clínica buscou epinefrina, mas desistiu devido à exigência de compra de caixa fechada (100un).


**Objeções:** Produto em falta (Seringa 60ml Descarpack), Estoque insuficiente (Extensores), Venda apenas em caixa fechada (Epinefrina)

**Gatilhos:** Cotação de insumos médicos, Agilidade no orçamento, Negociação de preço cobrindo concorrente (Medcom)

<details><summary>Transcrição completa</summary>

- `2026-05-11 13:50` 👤 orcamento_29575 (1).pdf
- `2026-05-12 14:41` 🤖 Olá bom dia Fabiane, como vai? Vocês trabalham com Amidarona 3 mg/ml?
- `2026-05-12 14:41` 👤 Bom dia, tudo bem?
- `2026-05-12 14:42` 👤 não dispomos nesta apresentação
- `2026-05-12 14:43` 🤖 Certo, agradeço o retorno.
- `2026-05-12 14:45` 👤 disponha
- `2026-05-29 13:29` 🤖 Olá bom dia, como vai? Por gentileza poderia me enviar o orçamento desses itens: 10 caixas com 25 unidades de seringa de 60ml  3 caixas de cloridrato de ondacentrona 2mg/ml 4 caixas de luvas de procedimento sem pó Tam P 4 pacotes de algodão bola 5 cx com 50 unidades de cateter 22 safelet 5 cx de cateter 24 safelet 300 extensor 40 cm 300 extensor multivias com clamp ( médix) 1cx de seringa de 1ml com agulha 08 fita micropore 10cmx10m
- `2026-05-29 13:32` 👤 Bom dia
- `2026-05-29 13:32` 👤 tudo bem?
- `2026-05-29 13:37` 👤 10 caixas com 25 unidades de seringa de 60ml   slip ou lock?
- `2026-05-29 13:45` 👤 orcamento_32350.pdf
- `2026-05-29 17:52` 🤖 Boa tarde Fabiane, como vai? Por gentileza poderia colocar seringa 60ml descarpack luer lock e retirar alguns itens
- `2026-05-29 17:55` 👤 Boa tarde
- `2026-05-29 17:55` 👤 essa seringa está em falta
- `2026-05-29 17:56` 🤖 okay
- `2026-05-29 17:58` 🤖 Nesse caso por gentileza gostaria de um novo orçamento com 4 pacotes de algodão bola 300 extensor 40 cm 1cx de seringa de 1ml com agulha.
- `2026-05-29 18:01` 👤 os outros itens você conseguiu com menor valor?
- `2026-05-29 18:02` 🤖 Sim, temos vocês e a Medcom como nossos fornecedores.
- `2026-05-29 18:03` 👤 se quiser me passar os valores que conseguiu, posso ver se consigo fazer
- `2026-05-29 18:04` 🤖 Faz fechei o pedido, esse itens eles estão sem.
- `2026-05-29 18:06` 👤 pode me passar sempre os valores menores que conseguir
- `2026-05-29 18:07` 👤 orcamento_32350 (1).pdf
- `2026-05-29 18:08` 🤖 Conseguir
- `2026-05-29 18:09` 👤 quer fechar este pedido?
- `2026-05-29 18:11` 🤖 Sim por favor.
- `2026-05-29 18:11` 👤 está bem, obrigada
- `2026-05-29 18:12` 👤 300 extensor 40 cm tenho em estoque somente as 200 unidades que orcei
- `2026-05-29 18:12` 🤖 Certo, pode ser
- `2026-05-29 19:35` 👤 Olá, como vai? Em que posso ajudar?😃
- `2026-06-08 17:32` 🤖 Olá boa tarde Fabiane, como vai? Você teriam ampolas de epinefrina 1mg/ml?
- `2026-06-08 17:34` 👤 Olá, como vai? Em que posso ajudar?😃
- `2026-06-08 17:35` 🤖 Olá boa tarde Fabiane, como vai? Você teriam ampolas de epinefrina 1mg/ml?
- `2026-06-08 17:36` 👤 Boa tarde
- `2026-06-08 17:36` 👤 sim, vendida somente em caixa com 100 unidades
- `2026-06-08 17:37` 🤖 Certo, vou ver se encontro por unidade.

</details>


### Felipe Moulin — `5511971952811`

**Custom fields:** `{"form_submission": {"name": "Felipe Moulin", "email": "felipe.moulin@icloud.com", "phone": "(11) 97195-2811"}}`

**Cenário:** `agendou_procedimento_direto` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Lead com depressão resistente há 20 anos e ideação suicida buscou informações sobre cetamina. Apresentou urgência e solicitou preços. Inicialmente tinha receio de trocar de médico, mas a clínica ofereceu a triagem via relatório do médico externo (Dr. Allan) para agilizar. Após envio do formulário e relatório, o agendamento da 1ª infusão foi feito e realizado no mesmo dia. Posteriormente, o lead reagendou a sessão seguinte por esquecimento.


**Objeções:** Preferência por texto em vez de áudio, Dependência de encaminhamento do médico externo

**Gatilhos:** Preço acessível (referência de menor preço), Pioneirismo/Experiência (10 anos), Urgência no tratamento (ideação suicida/depressão resistente), Facilidade de reembolso

<details><summary>Transcrição completa</summary>

- `2026-05-29 00:46` 🤖 Olá Felipe Moulin, tudo bem?  Você já tentou tratar a depressão, tomou remédio, esperou a melhora… mas continua sofrendo?  Talvez o problema não seja você, mas a estratégia usada até aqui.  Preparei uma vídeo-aula sobre alternativas aos antidepressivos, como escetamina, EMT e outras abordagens para casos mais difíceis. 🧠  Assista agora e entenda novos caminhos para o seu tratamento.
- `2026-05-29 00:46` 👤 Olá! Fiz o teste de depressão PHQ-9 e gostaria de agendar uma avaliação.  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=95432c32ff)
- `2026-05-29 10:20` 🤖 Bom dia, Felipe. Tudo bem? Você deseja agendar uma consulta com o psiquiatra?
- `2026-05-29 11:31` 👤 gostaria de mais informações sobre a infusão de cetamina
- `2026-05-29 11:31` 👤 preços
- `2026-05-29 11:31` 👤 quando teria disponibilidade
- `2026-05-29 11:36` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-05-29 11:47` 👤 depressao ha mais de 20 anos e ansiedade
- `2026-05-29 11:47` 👤 tomo remedios, terapia, e nada parece adiantar
- `2026-05-29 11:48` 👤 tenho ideacao suicida, vazio existencial e momentos de felicidade, seguidos por ansiedade e depressão
- `2026-05-29 11:52` 🤖 **[ÁUDIO]** Olá Felipe, tudo bem? Quem fala é Marisa. Bom dia.

Felipe, eu li o seu relato e eu imagino que não deve ser nada fácil passar por isso, né? Você realmente está precisando de um tratamento mais especializado que possa te ajudar a sair dessa situação.
- `2026-05-29 11:52` 🤖 **[ÁUDIO]** Você já tem encaminhamento para cetamina?
- `2026-05-29 11:53` 🤖 **[ÁUDIO]** A nossa clínica, ela é pioneira no tratamento de cetamina. Nós trabalhamos com cetamina há mais de 10 anos. O Dr. Ivan, que é o médico responsável, tem muita experiência e ele é especialista em ansiedade e depressão. Então, você pode ter certeza que você está no lugar certo, com profissionais extremamente especializados, que podem te ajudar a realmente melhorar da situação que você está.
- `2026-05-29 11:53` 🤖 **[ÁUDIO]** A gente percebe com a cetamina que tem muitas pessoas que têm resultados muito positivos e conseguem ter uma qualidade de vida melhor, sair dessa situação de desânimo, enfim, melhorar seu quadro de uma forma geral.
- `2026-05-29 11:54` 🤖 **[ÁUDIO]** Normalmente, o Dr. Ivan prescreve oito infusões iniciais. Essas infusões são realizadas duas vezes por semana, durante quatro semanas. O valor da infusão se você fizer as oito infusões é R$ 800,00 cada e você pode parcelar em até seis vezes sem juros e nós emitimos nota para reembolso. Nesse valor também está inclusa a consulta de retorno com o Dr. Ivan, justamente para acompanhar como você está, quais são suas necessidades em relação ao tratamento.
- `2026-05-29 11:55` 🤖 **[ÁUDIO]** O importante realmente seria se possível você passar em consulta com o doutor Ivan. Ele utiliza uma hora para te dar toda a atenção merecida, ver quais são as suas necessidades e, junto com você, verificar qual seria o melhor tratamento. Então seria bem importante se você pudesse passar em consulta com ele. Se você fizer o pacote, a consulta é uma cortesia, ela não é cobrada. Caso você não faça o pacote, o valor da consulta é 750 reais que pode ser parcelado em três vezes sem juros e também emitimos nota para reembolso.
- `2026-05-29 11:55` 🤖 **[ÁUDIO]** Nós temos horário disponível para consulta no dia 2 de junho às 11 horas. Você tem disponibilidade? Aguardo seu retorno.
- `2026-05-29 12:00` 👤 me manda texto pf?
- `2026-05-29 12:01` 🤖 Compreendi a sua situação, Felipe. Imagino que seja bem difícil passar por isso.
- `2026-05-29 12:02` 🤖 Certamente, você está precisando de algum tratamento mais eficaz que possa realmente te ajudar a sair dessa situação.
- `2026-05-29 12:02` 🤖 Já conseguimos ajudar muitas pessoas em situações semelhantes a sua.
- `2026-05-29 12:02` 🤖 O Protocolo de Infusões com Cetamina para Depressão Resistente da Clínica Ór não é um tratamento comum. É a maior novidade no tratamento  da depressão das últimas décadas.
- `2026-05-29 12:03` 🤖 Apesar de sermos referência e pioneiros neste tratamento no Brasil, o preço das nossas infusões com escetamina é o mais baixo da cidade, pois acreditamos que este  avanço no tratamento da depressão tem que ser cada vez mais acessível aos que dele necessitam
- `2026-05-29 12:03` 🤖 Normalmente, o doutor indica 8 infusões de escetamina como protocolo inicial de tratamento. Em geral, são feitas duas infusões por semana por 4 semanas.
- `2026-05-29 12:04` 🤖 O preço por infusão fica R$800,00 caso você feche o pacote de 8 infusões. Senão, cada infusão avulsa fica R$900,00.
- `2026-05-29 12:04` 🤖 Parcelamos no cartão em até 6x e emitimos nota para reembolso.
- `2026-05-29 12:05` 🤖 O interessante seria você passar em consulta com o Dr. Ivan
- `2026-05-29 12:05` 🤖 O Dr. Ivan reserva uma hora para esta consulta inicial. Assim, ele pode avaliar o seu caso de maneira completa, definir um diagnóstico e decidir, em conjunto com você, a melhor conduta.
- `2026-05-29 12:06` 🤖 Temos horário para consulta dia 02/06 as 11:00 hs. Você tem disponibilidade?
- `2026-05-29 12:06` 🤖 Caso você faça o pacote conosco a consulta será uma cortesia.
- `2026-05-29 13:21` 👤 Obrigado!
- `2026-05-29 13:22` 👤 Eu já te retorno, tá bem? Eu já tenho um psiquiatra que cuida de mim e falei com ele ontem sobre isso
- `2026-05-29 13:22` 👤 Daí estou esperando o retorno dele
- `2026-05-29 13:37` 🤖 Certo Felipe! Se você quiser, você pode enviar o encaminhamento médico e lhe enviamos um formulário para preenchimento, para que o Dr. Ivan avalie se você pode iniciar as infusões sem a necessidade da consulta.
- `2026-05-29 13:46` 👤 Ok!
- `2026-05-29 13:46` 👤 Já retorno para vocês, tá?
- `2026-05-29 13:46` 👤 Hoje vocês não teriam disponibilidade? Ou amanhã?
- `2026-05-29 13:48` 🤖 Hoje teríamos horário as 13:00 hs.
- `2026-05-29 13:48` 👤 Vou ver se adianto a resposta dele
- `2026-05-29 13:48` 🤖 Não atendemos aos sábados
- `2026-05-29 13:48` 👤 Ele se chama dr Allan Doriguetto
- `2026-05-29 13:49` 🤖 Vou te enviar o formulário ok?
- `2026-05-29 13:49` 👤 Ok!
- `2026-05-29 13:49` 🤖 https://docs.google.com/forms/d/e/1FAIpQLSfyCdjtHMwq_nMQEernR4oQtPMz0AMJlB4ouABpzJYttBQBLw/viewform?usp=sf_link Por gentileza ao finalizar o preenchimento do formulário nos informe, para verificar se será necessário uma consulta ou não.
- `2026-05-29 13:49` 👤 Ok!
- `2026-05-29 13:49` 🤖 Fico no aguardo do encaminhamento!
- `2026-05-29 13:56` 👤 Pronto
- `2026-05-29 13:56` 👤 Formulário preenchido
- `2026-05-29 14:00` 🤖 Muito obrigada. Fico no aguardo do encaminhamento.
- `2026-05-29 14:00` 👤 Ok
- `2026-05-29 14:00` 👤 Aguardando resposta do meu médico
- `2026-05-29 14:01` 👤 Assim que ele responder, eu te posiciono
- `2026-05-29 14:01` 👤 Adoraria fazer a primeira sessão hoje às 13h pq realmente estou precisando e quero experimentar o tratamento
- `2026-05-29 14:01` 👤 Estou no aguardo dele
- `2026-05-29 14:01` 🤖 Certo! Estamos a disposição!
- `2026-05-29 14:14` 👤 Ola!
- `2026-05-29 14:14` 👤 Podemos marcar às 13h
- `2026-05-29 14:15` 👤 O meu médico já está preparando um relatório do meu atendimento com ele
- `2026-05-29 14:16` 🤖 Preciso da aprovação do Dr. Ivan primeiro. Assim que você enviar o relatório, vou pedir a avaliação com urgencia.
- `2026-05-29 14:17` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-29 14:19` 👤 Felipe Moulin 28/11/1985 06267044645 58581255 Rua General Jardim, 415 / 1505 01223-011 11 971952811 Felipe.moulin@icloud.com Consultor de marketing Solteiro Brasileiro Maira Moulin - 21 987805342 Google
- `2026-05-29 14:25` 👤 O médico está providenciando o relatório do meu atendimento
- `2026-05-29 14:37` 🤖 Tudo bem!
- `2026-05-29 14:43` 👤 W6y82w-FULL.pdf
- `2026-05-29 14:43` 👤 Relatório do meu psiquiatra!
- `2026-05-29 14:51` 🤖 Oi. Vou pedir a aprovação do DR. Ivan e logo te retorno
- `2026-05-29 14:51` 👤 Muitíssimo obrigado!
- `2026-05-29 14:51` 👤 Mesmo
- `2026-05-29 15:19` 👤 Oi
- `2026-05-29 15:20` 👤 Algum retorno?
- `2026-05-29 15:31` 🤖 **[ÁUDIO]** Olá, Felipe, tudo bem? Felipe, estamos aguardando ainda, tá? Um retorno do nosso médico responsável. Eh, também surgiu um horário às 14 horas hoje. E aí qualquer coisa a gente coloca você nesse horário, se estiver tudo bem para você, tá bom? Tchau.
- `2026-05-29 15:31` 👤 Ok
- `2026-05-29 15:32` 👤 Assim q ele retornar, me avisa
- `2026-05-29 15:32` 👤 Q eu vou
- `2026-05-29 15:38` 🤖 Ela acabou de retornar, podemos te agendar sua infusão as 14h, esse horário funciona para você?
- `2026-05-29 15:38` 👤 Funciona sim
- `2026-05-29 15:39` 🤖 Certo, agendado.
- `2026-05-29 15:41` 👤 Quer q eu chegue aí um pouco antes? Tipo 13:45?
- `2026-05-29 15:43` 🤖 Se quiser chegar mais cedo pode chegar.
- `2026-05-29 15:44` 👤 Ok
- `2026-05-29 16:47` 👤 Estou a caminho. Chego às 14:00 mesmo, no máximo 14:10, segundo o Uber
- `2026-05-29 17:10` 🤖 Obrigada por sinalizar!
- `2026-06-08 13:57` 👤 Bom dia!
- `2026-06-08 13:57` 👤 Gostaria de confirmar a minha sessão essa semana. Qual dia e horário mesmo, por favor?
- `2026-06-08 13:59` 🤖 Oi Felipe!
- `2026-06-08 13:59` 🤖 Hoje as 13:00 hs.
- `2026-06-08 14:35` 👤 Putz
- `2026-06-08 14:36` 👤 Podemos remarcar para amanhã?
- `2026-06-08 14:38` 🤖 Sim! Reagendado para amanhã no mesmo horário.
- `2026-06-08 14:39` 👤 Obrigado
- `2026-06-08 14:39` 🤖 Disponha!
- `2026-06-09 20:57` 👤 Boa tarde!
- `2026-06-09 20:57` 👤 Poderiam verificar pf se eu deixei meu óculos aí,
- `2026-06-09 20:58` 🤖 Boa tarde Felipe!
- `2026-06-09 20:58` 🤖 Sim! Está aqui
- `2026-06-09 20:59` 👤 Obrigado!

</details>


### 👧🏻♾️👶🏽 — `554384172799`

**Custom fields:** `{"mensagem": "Lead é primeira consulta; código ref=145280bea1; interessado em agendar primeira consulta.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead é primeira consulta; código ref=145280bea1; interessado em agendar primeira consulta.", "qualificacao": "interessado", "procedimentos": "[\"Primeira Consulta\"]", "demonstrou_interesse": true, "procedimento_interesse": "primeira_co`

**Cenário:** `aguardando_triagem_clinica` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead entrou em contato fora do horário comercial interessado em agendar uma primeira consulta. A consultora Marisa iniciou o atendimento no dia seguinte, confirmando que se trata de um paciente novo. No momento, o fluxo parou após a atendente solicitar informações sobre o quadro clínico (queixas) para direcionamento com o Dr. Ivan.


**Gatilhos:** agendamento_consulta, primeira_vez

<details><summary>Transcrição completa</summary>

- `2026-06-09 00:23` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=145280bea1)
- `2026-06-09 00:23` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-09 12:07` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-09 12:07` 🤖 Bom dia! Você já é paciente ou seria a primeira vez?
- `2026-06-09 13:32` 👤 Primeira vê
- `2026-06-09 13:32` 👤 Vez
- `2026-06-09 13:33` 🤖 Certo! Como o Dr. Ivan faz vários tratamentos como ansiedade, depressão, alcolismo e etc, você poderia relatar qual seria o seu caso?

</details>


### Gisele — `556791061994`

**Custom fields:** `{"origem": "Indeterminado", "mensagem": "Lead perguntou como funciona o tratamento de bipolaridade. Foi informada a precificação e o funcionamento do tratamento pela atendente.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead perguntou como funciona o tratamento de bipolaridade. Foi informada a precificação e o funcionamento do tratamento pela atendente.", "qualificacao": "interessa`

**Cenário:** `aguardando_retorno_lead_apos_triagem` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A lead entrou em contato buscando informações sobre o tratamento de bipolaridade. A atendente Marisa realizou o acolhimento inicial e solicitou que a lead descrevesse seu problema para melhor direcionamento antes de passar valores. A conversa parou na fase de triagem clínica inicial, sem objeções ou agendamento até o momento.


**Gatilhos:** Tratamento especializado para bipolaridade

<details><summary>Transcrição completa</summary>

- `2026-06-09 14:53` 👤 Bom dia
- `2026-06-09 14:54` 👤 Como funciona o tratamento de bipolaridade
- `2026-06-09 14:54` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-09 14:54` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-09 14:54` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.

</details>


### Rubia Oliveira — `556696089862`

**Cenário:** `aguardando_retorno_triagem` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A paciente Rubia entrou em contato fora do horário comercial manifestando interesse em agendar uma consulta. As consultoras Edilene e Marisa iniciaram o atendimento na manhã seguinte, solicitando mais informações sobre o quadro clínico para realizar o direcionamento correto. O atendimento parou na fase de triagem inicial.


**Gatilhos:** Desejo de agendamento imediato

<details><summary>Transcrição completa</summary>

- `2026-06-10 01:10` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=c9b0840bc2)
- `2026-06-10 01:10` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-10 10:53` 🤖 Olá, bom dia, somos Edilene e Marisa, consultoras da Clínica Ór.  Antes de dar continuidade ao seu atendimento, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.

</details>


### Priscila — `5511937637106`

**Cenário:** `fora_escopo_distribuidora` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** O contato parece ser de um bot/atendente buscando insumos hospitalares (água destilada 500ml) junto à RVD Saúde. A atendente Priscila respondeu informando a disponibilidade apenas na embalagem de 5 litros, fornecendo o link para compra. A interação não se trata de agendamento de consultas ou procedimentos médicos, mas de uma transação comercial de suprimentos.


**Objeções:** Indisponibilidade de volume específico (500ml)

**Gatilhos:** Compra de insumos hospitalares

<details><summary>Transcrição completa</summary>

- `2026-06-10 16:23` 🤖 Boa tarde, você trabalham com agua destilada para injeção 500ml?
- `2026-06-10 16:23` 👤 Olá! Seja bem-vindo(a) à RVD Saúde! Nossa equipe vai te atender em breve.  🕒 Atendimento: Seg. a Qui. – 9h às 18h Sexta – 9h às 17h (Final de semana e feriados: sem atendimento)  📄 Boletos ou 2ª via: boletos@rvdsaude.com.br  📦 Trocas, devoluções, reclamações ou rastreios: sac@rvdsaude.com.br 0800 580 2858  Para agilizar, envie seu CPF ou CNPJ no início da mensagem. Conte com a gente! Equipe RVD Saúde 💜
- `2026-06-10 16:24` 🤖 22.685.339 0001/01
- `2026-06-10 16:25` 🤖 Agua destilada para injeção 500ml
- `2026-06-10 18:01` 👤 Boa tarde Meu nome é Priscila
- `2026-06-10 18:02` 👤 temos de 5 litros
- `2026-06-10 18:02` 👤 https://www.rvdsaude.com.br/034940_agua_destilada_5_lts_soft_water/p

</details>


### Mah — `5513920054251`

**Custom fields:** `{"mensagem": "Lead iniciou conversa apenas com oi; não há indicação clara de interesse em procedimento específico.", "observacoes": "Lead iniciou conversa apenas com oi; não há indicação clara de interesse em procedimento específico."}`

**Cenário:** `lead_parou_apos_primeira_msg` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead entrou em contato com um 'Oi' genérico. A atendente Marisa respondeu prontamente se apresentando e perguntando como poderia ajudar, mas o lead não deu continuidade à conversa após essa interação inicial. Não há informações sobre sintomas ou procedimentos de interesse.


<details><summary>Transcrição completa</summary>

- `2026-06-11 11:31` 👤 Oi
- `2026-06-11 11:31` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-11 11:53` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-11 11:53` 🤖 Como posso ajudá-la?

</details>


### Beatriz Ortega — `5513997638540`

**Custom fields:** `{"origem": "Indeterminado", "mensagem": "Lead foi indicado pela psicóloga para procurar psiquiatra; pediu informações sobre precificação e funcionamento do tratamento.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead foi indicado pela psicóloga para procurar psiquiatra; pediu informações sobre precificação e funcionamento do tratamento.", "qualificacao": "interessado", "procedimento`

**Cenário:** `sumiu_apos_cotacao_e_horario` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Beatriz buscou atendimento psiquiátrico por indicação de sua psicóloga para avaliação de quadro atual. A atendente explicou o funcionamento da consulta (1h de duração), apresentou o currículo do Dr. Ivan e ofereceu um horário para o dia 15/06. Apesar de detalhar preço (R$ 750) e condições de pagamento/reembolso, o lead não respondeu após o envio das opções de agenda.


**Gatilhos:** Indicação de psicóloga, Experiência do profissional (15 anos), Possibilidade de reembolso/parcelamento, Opção de teleconsulta

<details><summary>Transcrição completa</summary>

- `2026-06-11 18:41` 👤 Olá, gostaria de entender como funciona a consulta on-line com o Dr Ivan?
- `2026-06-11 18:41` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-11 18:43` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-11 18:43` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-11 18:47` 👤 ok, minha psicologa pediu para procurar um psiquiatra para enteder melhor o meu momento atual.
- `2026-06-11 19:10` 🤖 **[ÁUDIO]** Olá, Beatriz. É a Marisa, tudo bem?
Certo, entendi, Beatriz. Sua psicóloga pediu para procurar um psiquiatra, né, para entender melhor o seu momento.
Eu creio que você esteja no lugar certo. O Dr. Ivan tem mais de 15 anos de experiência, é formado por uma das melhores faculdades do Brasil e é especialista em tratamentos de depressão refratária, ansiedade e problemas psiquiátricos em geral.
- `2026-06-11 19:10` 🤖 **[ÁUDIO]** Ele reserva uma hora para conversar contigo, verificar as suas queixas e também junto com você verificar qual seria o melhor tratamento. Ele faz tanto o tratamento tradicional como tratamentos inovadores como cetamina e estimulação magnética transcraniana.
- `2026-06-11 19:11` 🤖 **[ÁUDIO]** Nós temos horário com ele no dia 15 de junho às 10:30. Você tem disponibilidade? A consulta pode ser online ou presencial. Nós estamos na Alameda Campinas, no Jardins, uma travessa da Avenida Paulista, número 802.
- `2026-06-11 19:11` 🤖 **[ÁUDIO]** O valor da consulta é 750 reais que você pode parcelar em 3 vezes sem juros, e nós emitimos também nota para reembolso. Você tem disponibilidade? Possui alguma dúvida? Algo que eu possa te ajudar?

</details>
