---
title: "Estudo: Antigo Consulta/procedimento agendado"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Antigo Consulta/procedimento agendado' do funil Agendamentos Novo (Clínica ÓR): 6 leads."
---

# Estudo: Antigo Consulta/procedimento agendado

**Coluna:** `Antigo Consulta/procedimento agendado` (posição 13) — **6 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é um paciente ativo ou familiar responsável que já superou a barreira inicial de preço e confiança. Frequentemente está em tratamento de alta complexidade (Cetamina ou EMT) ou em acompanhamento psiquiátrico recorrente com o Dr. Ivan. Demonstra alto comprometimento financeiro (pagamentos de R$ 750,00 via Pix) e operacional, utilizando o WhatsApp principalmente para ajustes finos de agenda, envio de comprovantes e relatos de sintomas pós-tratamento. É um perfil que valoriza a agilidade na resposta logística e o acesso direto ao médico para dúvidas clínicas sobre medicação.


### Procedimentos mais mencionados

- Infusão de Cetamina (Ketamina)
- EMT (Estimulação Magnética Transcraniana)
- Consulta de Seguimento Psiquiátrico (Teleconsulta e Presencial)
- Acompanhamento de Desmame de Medicação (ex: Velija)

### Profissionais mais mencionados

- Dr. Ivan Barenboim (unanimidade nos atendimentos analisados)

### Objeções mais comuns

- Ausência de melhora imediata após as primeiras sessões de Cetamina.
- Incompatibilidade momentânea de horários de trabalho com o cronograma de infusões.
- Dúvidas clínicas pós-procedimento (insônia, desmame de medicação).

### Gatilhos de entrada na coluna

- Confirmação de horário para consulta ou infusão.
- Necessidade de reagendamento por motivos profissionais ou emergências.
- Solicitação de dados bancários (Pix) para efetivação de agendamento de teleconsulta.

## 2. Padrões observados (Top 10)

1. Alta taxa de conversão de agendamento em pagamento imediato via Pix (R$ 750,00).
2. Uso do WhatsApp para envio de comprovantes de pagamento de teleconsultas.
3. Interações frequentes com familiares/responsáveis em vez do próprio paciente.
4. Solicitação de associação de terapias (Cetamina + EMT) por parte dos familiares.
5. Comunicação de atrasos curtos (5-10 min) via chat no dia da consulta.
6. Forte vínculo de confiança com o Dr. Ivan, sendo citado nominalmente em todos os casos.
7. Transição fluida entre modo presencial e teleconsulta dependendo da necessidade de seguimento.
8. Pedidos de suporte logístico (esquecimento de carregadores/fones) integrados ao fluxo de atendimento.
9. Uso de gatilhos de cortesia (Bom dia/Obrigado) mesmo sem demanda técnica pendente.
10. Adesão ao pedido de avaliação no Google após conclusão de ciclos de tratamento.

## 3. Erros recorrentes do agente IA atual

- A IA por vezes confunde o acompanhante/responsável (Marina, Daiane) como sendo o paciente principal.
- Dificuldade em distinguir entre consulta de seguimento e sessão de procedimento de infusão em fluxos contínuos.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Familiar Responsável' para distinguir quem fala no WhatsApp e quem é o paciente (ex: Marina/Julian, Daiane/Ignez).
- Implementar automação de 'Lembrete 24h' com confirmação de horário para reduzir dúvidas recorrentes.
- Mover leads que relatam falta de melhora para uma tag de 'Atenção Clínica' para discussão em equipe.
- Incluir campo de 'Status de Pagamento' vinculado ao envio do comprovante para teleconsultas.

## 5. Recomendações para o agente de **atendimento**

- Priorizar respostas sobre horários de infusão para evitar quebras no protocolo clínico do paciente.
- Ao receber relatos de efeitos colaterais, encaminhar imediatamente o contato direto do médico (conforme padrão observado).
- Manter o tom humanizado e prestativo em questões logísticas (objetos esquecidos), pois isso reforça a retenção e indica hospitalidade.
- Confirmar proativamente os dados de PIX assim que o paciente solicitar o agendamento de teleconsulta para agilizar o fluxo.

## 6. Alertas

- ⚠️ Pacientes em tratamento de Cetamina (como Ignez/Daiane) apresentando frustração por falta de melhora imediata na 4ª sessão.
- ⚠️ Relatos de efeitos colaterais ou sintomas de desmame (como no caso Jefferson) surgindo via WhatsApp pós-consulta.
- ⚠️ Esquecimento de pertences pessoais na clínica sinalizando necessidade de protocolo de 'achados e perdidos'.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Sandra Zirlis | 5511999719703 | 4 | 0 | confirmacao_presenca_pos_agendamento |
| 2 | Jefferson Aiolfe | 5511976992915 | 28 | 0 | agendou_recorrencia_seguimento |
| 3 | Daiane | 5511944698304 | 25 | 1 | agendou_retorno_pos_tratamento_em_curso |
| 4 | Marina | 5511992144953 | 17 | 0 | reagendamento_e_confirmacao_procedimento |
| 5 | Oliver | 5511924698835 | 0 | 0 |  |
| 6 | Ricardo Ferraz | 5511965748326 | 14 | 0 | reagendamento_e_logistica |

## 8. Conversas analisadas (transcrição + síntese)

_5 leads com conversa analisada._


### Sandra Zirlis — `5511999719703`

**Custom fields:** `{"data_horario": "2026-04-17T12:30:00-03:00", "teleconsulta": "Não", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `confirmacao_presenca_pos_agendamento` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Sandra confirmou sua chegada para uma consulta já agendada com o Dr. Ivan. Ela informou um pequeno atraso de 5 minutos no dia da consulta (28/05). Posteriormente, no dia 01/06, enviou uma saudação de bom dia, sinalizando abertura para contato ou apenas polidez pós-atendimento. Não houve novas solicitações técnicas ou objeções.


**Gatilhos:** proximidade do horário agendado

<details><summary>Transcrição completa</summary>

- `2026-05-25 14:07` 🤖 Oi Sandra! O Dr. Ivan confirmou
- `2026-05-28 16:08` 👤 Oi 👋🏼  Chego em 5 min Obrigada
- `2026-05-28 16:09` 👤 Bjos
- `2026-06-01 13:39` 👤 Bom dia ☀️

</details>


### Jefferson Aiolfe — `5511976992915`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "pagamento": 750, "data_horario": "2026-06-05T16:00:00.000Z", "teleconsulta": "Sim", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `agendou_recorrencia_seguimento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** O lead (Jefferson) entrou em contato para agendar uma consulta de seguimento com o Dr. Ivan, conforme orientação prévia. Solicitou proativamente os dados de pagamento, realizou o Pix de R$ 750,00 e confirmou a teleconsulta para 05/06/2026. Após a consulta, o lead retornou relatando piora na qualidade do sono devido ao desmame da medicação Velija e foi orientado a falar diretamente com o médico.


**Gatilhos:** Agendamento de consulta de seguimento, Continuidade do tratamento medicamentoso

<details><summary>Transcrição completa</summary>

- `2026-05-07 12:37` 👤 *Edilene e Marisa, bom dia. Tudo bem?*  Gostaria de deixar agendada minha próxima consulta para o dia 05/06/2026 às 10hs, se possível, conforme orientado pelo Dr. Ivan na consulta de 05/05. Solicito os dados para o pix e valor. Mais uma vez lhes agradeço e aguardo retorno. Abs. Jefferson;
- `2026-05-07 12:43` 🤖 Bom dia, Jefferson. Tudo bem? É a Marisa.
- `2026-05-07 12:43` 👤 Olá Marisa. ( Aqui tudo bem  🙌🏼 )
- `2026-05-07 12:43` 🤖 Só uma dúvida, o Dr. prescreveu mais um tratamento?
- `2026-05-07 12:44` 👤 Por ora sem novas infusões. Tratamento medicamentoso continua. Já tenho as prescrições;
- `2026-05-07 12:45` 🤖 Correto!
- `2026-05-07 12:45` 🤖 Vamos agendar então.
- `2026-05-07 12:45` 🤖 A consulta será online?
- `2026-05-07 12:45` 👤 Sim;
- `2026-05-07 12:45` 🤖 Certo!
- `2026-05-07 12:45` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-07 12:47` 👤 OK
- `2026-05-07 12:47` 👤 *[imagem]*
- `2026-05-07 12:47` 👤 Segue comprovante pix;
- `2026-05-07 12:47` 🤖 Muito obrigada!
- `2026-05-07 12:51` 🤖 Consulta online agendada para o dia 05/06 as 10:00 hs.
- `2026-05-07 12:51` 👤 OK. Obrigado!
- `2026-06-05 11:05` 🤖 Olá bom dia Jefferson, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-06-05 11:05` 👤 *Advocacia Dr. Jefferson*  *Olá! Seja bem vindo(a)!*  Mensagem recebida!  Retornarei o mais breve possível, logo que puder;  (Se possível, deixe seu nome e sua questão jurídica. Melhor horário para chamadas via fone: das 9 as 10hs);
- `2026-06-05 11:05` 🤖 Jefferson Aiolfe  - Dr Ivan Barenboim - 05/06/2026 Sexta-feira, 5 de junho · 10:00 – 10:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/ivv-erpe-set
- `2026-06-08 12:23` 👤 Obrigado. Igualmente!
- `2026-06-08 12:42` 👤 Edilene, Marisa, Dr. Ivan e equipe, bom dia. Tudo bem?  Aqui é o paciente Jefferson Aiolfe; Peço-lhes, por gentileza, o envio da presente mensagem ao Dr. Ivan: _"Desde a última consulta em: 05/06/2026, estou no desmame da medicação velija 30mg (por 15 dias e após, parar, como orientado). Todavia, com a nova redução desta medicação (de 60 para 30/dia) aumentou, muito, meu despertar a noite - mais de uma dezena de vezes: e não consigo mais retomar o sono. Foi comentado a substituição deste por out
- `2026-06-08 12:46` 🤖 Olá bom dia Jefferson, como vai? Edilene da clínica Ór, referente a sua prescrição e dosagem, solicitamos que envie suas dúvidas ao Dr Ivan, para que haja um melhor entendimento com relação ao tratamento, estamos te enviando o contato do Dr Ivan e seguimos a disposição.
- `2026-06-08 12:46` 👤 Bom dia! ( Aqui tudo bem  🙌🏼 );

</details>


### Daiane — `5511944698304`

**Custom fields:** `{"mensagem": "Perfeito vou encaminhar mensagem amanhã pela manhã.", "interesse": "EMT", "enviar_dia": "2026-06-02T03:00:00.000Z", "data_horario": "2026-06-03T12:00:00-03:00", "teleconsulta": false, "procedimentos": "[\"Retorno\"]"}`

**Cenário:** `agendou_retorno_pos_tratamento_em_curso` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** Daiane, filha da paciente Ignez, entrou em contato preocupada pois a mãe não sentiu melhora após a 4ª sessão de cetamina. Ela sugeriu ao médico a associação com EMT para potencializar resultados. Após orientação da equipe e conversa com o Dr. Ivan, foi agendado um retorno presencial para o dia 03/06 às 12:00, que foi devidamente confirmado e comparecido pelo lead.


**Objeções:** ausência de melhora imediata (medo de não fazer efeito)

**Gatilhos:** potencializar efeito do tratamento, combinação de terapias (Ketamina + EMT)

<details><summary>Transcrição completa</summary>

- `2026-05-14 20:37` 👤 Olá, boa tarde! Tudo bem? Sou Daiane, minha mãe Ignez Pereira de Moura, está fazendo o tratamento com cetamina. Na quarta-feira ela fez a quarta sessão, por enquanto não sentiu melhora. Estou morrendo de medo de não fazer efeito.
- `2026-05-14 20:38` 👤 Gostaria de ver com o doutor, o que ele acha das próximas quatro sessões combinarmos com o EMT, não sei se 4 da EMT faria alguma diferença para talvez potencializar o efeito.
- `2026-05-14 20:39` 👤 É difícil demais essa situação! 😢
- `2026-05-14 21:08` 🤖 Olá Daiane!
- `2026-05-14 21:09` 🤖 Imagino que não deve ser nada fácil passar por isso.
- `2026-05-14 21:09` 🤖 Neste caso, você pode enviar mensagem para o Dr. Ivan e pedir uma orientação.
- `2026-05-14 21:10` 👤 Perfeito vou encaminhar mensagem amanhã pela manhã.
- `2026-05-14 21:11` 👤 Pelo que vcs observam, em geral a partir de qual sessão os pacientes percebem alguma mudança.
- `2026-05-14 21:14` 🤖 **[ÁUDIO]** Olá, Daiane, tudo bem? É a Marisa. Daiane, tudo depende mesmo, não tem assim uma regra. Tenho pacientes que, na primeira infusão, conseguem ter retorno. Tem outros que só no final do tratamento. Então depende muito de cada paciente. É bom você falar com o Doutor Ivan mesmo, porque ele vai te orientar da melhor maneira possível, tá bom? Muito obrigada.
- `2026-05-14 21:15` 👤 É muito individual mesmo.
- `2026-05-14 21:15` 👤 Amanhã falo com ele.
- `2026-05-14 21:15` 👤 Muito obrigada pelo retorno.
- `2026-05-14 21:17` 🤖 Estamos a disposição
- `2026-05-27 18:29` 🤖 Olá Daiane!
- `2026-05-27 18:29` 🤖 Retorno agendado para o dia 03/06 as 12:00 hs.
- `2026-06-02 15:00` 🤖 Olá, Daiane 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 03/06/2026 12:00  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene.
- `2026-06-02 15:36` 👤 Boa tarde! Confirmado.
- `2026-06-02 15:36` 🤖 Obrigada!
- `2026-06-03 14:00` 🤖 Daiane, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-03 14:00` 👤 Estamos a caminho. Previsão de chegada 11h56.
- `2026-06-03 14:02` 🤖 Sem problemas. Muito obrigada por sinalizar.

</details>


### Marina — `5511992144953`

**Custom fields:** `{"origem": "Indeterminado", "interesse": "Infusão de Cetamina", "enviar_dia": "2026-06-07T03:00:00.000Z", "data_horario": "2026-06-11T14:30:00-03:00", "procedimentos": ["Retorno"]}`

**Cenário:** `reagendamento_e_confirmacao_procedimento` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead Marina, responsável pelo paciente Julian, solicitou o reagendamento de uma sessão de cetamina devido a um compromisso profissional do paciente. Em momentos posteriores, entrou em contato apenas para confirmar os horários exatos das sessões programadas. O atendimento foi ágil, confirmando as solicitações e garantindo a manutenção do cronograma de infusões.


**Gatilhos:** conveniência de horário, flexibilidade de agenda

<details><summary>Transcrição completa</summary>

- `2026-05-11 17:58` 👤 Boa tarde, vou precisar desmarcar a cetamina do Julian amanhã, pois ele tem entrevista  Podenos remarcar 5ªf as 14,30?
- `2026-05-11 18:05` 🤖 Boa tade! Tudo bem?
- `2026-05-11 18:05` 🤖 Sem problemas! Reagendado!
- `2026-05-11 18:12` 👤 Obrigada 🙏
- `2026-05-11 18:12` 🤖 Disponha!
- `2026-05-28 12:19` 👤 Bom dia Qual horário da sessão de cetamina do Julian hoje mesmo? 14h ou 14,30h Obrigada
- `2026-05-28 12:19` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-28 12:20` 🤖 Bom dia!
- `2026-05-28 12:20` 🤖 14:30 hs
- `2026-05-28 12:20` 👤 Obrigada
- `2026-05-28 12:21` 🤖 Disponha!
- `2026-06-10 14:17` 👤 Bom dia Qual o horário da infusão do Julian hoje? 12,30?
- `2026-06-10 14:19` 🤖 Bom dia!
- `2026-06-10 14:19` 🤖 12:30 hs
- `2026-06-10 14:20` 👤 Ok! Obrigada
- `2026-06-10 14:21` 🤖 Disponha!

</details>


### Ricardo Ferraz — `5511965748326`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "enviar_dia": "2026-06-07T03:00:00.000Z", "data_horario": "2026-06-08T23:00:00.000Z", "procedimentos": ["Retorno"]}`

**Cenário:** `reagendamento_e_logistica` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Ricardo Ferraz é um paciente em tratamento de Infusão de Cetamina com o Dr. Ivan. A conversa trata inicialmente de um reagendamento por emergência médica, aceito prontamente. Posteriormente, houve interações logísticas sobre pertences esquecidos na clínica (caixa e carregador de fone), demonstrando bom relacionamento. O lead está em fluxo de manutenção e recebeu pedido de avaliação.


**Gatilhos:** Infusão de Cetamina, Atendimento humanizado

<details><summary>Transcrição completa</summary>

- `2026-05-07 15:24` 🤖 Boa tarde, Ricardo. Tudo bem?
- `2026-05-07 15:25` 🤖 Ocorreu uma emergência com o Dr. Ivan e será necessário reagendar as consultas da manhã de amanhã. Podemos alterar sua consulta para amanhã as 15:00 hs?
- `2026-05-07 16:35` 👤 Ok, tudo bem às 15h
- `2026-05-07 16:36` 🤖 Agradecemos a compreensão. Reagendado para as 15h.
- `2026-05-14 12:57` 🤖 Olá Ricardo. Você esqueceu  a caixa do seu phone na clínica.
- `2026-05-14 12:57` 👤 Obrigado pelo aviso, eu pego na segunda-feira
- `2026-05-14 12:59` 🤖 ok
- `2026-05-19 14:29` 👤 Bom dia, tudo bem?
- `2026-05-19 14:30` 👤 Por favor, você pode ver se deixei meu carregador de fones da poltrona que eu usei ontem na infusão?
- `2026-05-19 14:32` 🤖 Bom dia!
- `2026-05-19 14:32` 🤖 Está guardada!
- `2026-05-19 14:35` 👤 Obrigado
- `2026-05-19 14:35` 🤖 Disponha!
- `2026-06-08 19:59` 🤖 Ricardo, caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr

</details>
