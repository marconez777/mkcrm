---
title: "Estudo: Paciente antigo"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Paciente antigo' do funil Agendamentos Novo (Clínica ÓR): 30 leads."
---

# Estudo: Paciente antigo

**Coluna:** `Paciente antigo` (posição 1) — **30 leads** analisados.


## 1. Perfil típico

O lead desta coluna é um paciente recorrente ou familiar responsável (frequentemente a mãe) que possui alto grau de confiança na clínica e nos médicos (foco em Dr. Ivan e Dra. Maísa). O contato é utilitário: renovação de receitas controladas, agendamento de sessões de manutenção (Cetamina) ou consultas de seguimento. Valorizam a agilidade operacional, preferem pagar via PIX e dependem do fluxo de Notas Fiscais para reembolso. Alternam entre presencial e teleconsulta conforme a rotina permite, mas demonstram fidelidade ao especialista, aguardando novas datas em caso de imprevistos médicos em vez de buscar outros profissionais. Embora já conheçam a casa, apresentam fricções pontuais com ferramentas digitais (App) e exigem respostas rápidas do suporte administrativo.


### Procedimentos mais mencionados

- Consulta Psiquiátrica de Seguimento
- Infusão de Cetamina (Protocolos)
- Renovação de Receitas Controladas (Azul/Branca)
- Psicoterapia (Pacotes/Protocolos)

### Profissionais mais mencionados

- Dr. Ivan Barenboim
- Dra. Maísa

### Objeções mais comuns

- Indisponibilidade de horários específicos em curto prazo.
- Preferência estrita por atendimento presencial em detrimento da teleconsulta.
- Problemas de acesso ao aplicativo para ver receitas.
- Conflitos de agenda pessoal/trânsito.

### Gatilhos de entrada na coluna

- Renovação de receitas de uso contínuo (Rivotril, Daforin, Konduz, Quetiapina).
- Agendamento de sessões de manutenção (Cetamina/Infusões).
- Necessidade de nota fiscal para reembolso de convênio.
- Reagendamento por imprevistos médicos.

## 2. Padrões observados (Top 10)

1. Uso de PIX como forma preferencial de pagamento imediato (R$ 750,00 por consulta).
2. Cenário recorrente de mães gerenciando a saúde e o financeiro de filhos adultos.
3. Alta fidelidade a profissionais específicos (Dr. Ivan e Dra. Maísa são os nomes centrais).
4. Conversas diretas e objetivas, focadas em horários ou documentos.
5. Uso da clínica como hub de 'manutenção' (receita + infusão), sem necessariamente passar por nova consulta a cada contato.
6. Demanda frequente por Notas Fiscais detalhadas para reembolso.
7. Migração fluida entre Teleconsulta e Presencial conforme a conveniência logística do dia.
8. Aceitação de valores de pacotes de infusão (R$ 800/sessão) vs unitário (R$ 900).
9. Tratamentos combinados (Psiquiatria + Psicoterapia).
10. Valorização do relacionamento pessoal com a recepção (chamar atendentes pelo nome).

## 3. Erros recorrentes do agente IA atual

- A IA ocasionalmente ignora que o 'paciente' e o 'lead' do WhatsApp são pessoas diferentes (mãe agendando para filho).

## 4. Recomendações para o agente de **pipeline**

- B-Rule: Ao identificar 'renovação de receita', disparar lembrete de consulta de retorno em 30-45 dias.
- Campo Extra: Criar campo 'Responsável Financeiro' para casos onde a NF deve sair em nome diferente do paciente.
- Controle de Saldo: Para protocolos (ex: Cetamina), atualizar o campo 'Sessões Restantes' no CRM após cada confirmação.
- Status de Retorno: Mover para 'Manutenção/Paciente Ativo' em vez de encerrar a oportunidade.

## 5. Recomendações para o agente de **atendimento**

- Tom de voz: Amigável e humanizado (chamar pelo nome, demonstrar conhecimento do histórico).
- Follow-up de NF: Sempre confirmar o recebimento da Nota Fiscal após o envio, pois é crucial para o reembolso do paciente.
- Alternativa de App: Se o paciente relatar erro no App, enviar o PDF da receita imediatamente via WhatsApp sem questionar, mas registrar o erro técnico.
- Prazos de Receita Física: Ser transparente sobre o horário que a receita física estará na portaria para evitar viagens perdidas.
- Política de Cancelamento: Reforçar gentilmente a regra de cancelamento para pacientes com histórico de reagendamento tardio.

## 6. Alertas

- ⚠️ Delay de resposta no suporte quase resultou na perda de horários de especialistas (Caso Camila).
- ⚠️ Pacientes com perfil de cancelamento frequente/tardio que exigem monitoramento de taxas (Caso Camila).
- ⚠️ Dificuldade técnica recorrente com o aplicativo da clínica, gerando demanda manual para a recepção (Caso Tainá).
- ⚠️ Solicitações de Notas Fiscais com edições específicas (nomes de dependentes/datas retroativas) para fins de reembolso.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Julia | 5511999753327 | 0 | 0 |  |
| 2 | Lead #3654204 | 5511999988207 | 0 | 0 |  |
| 3 | Lead #3656114 | 5511992504111 | 0 | 0 |  |
| 4 | Lead #3656118 | 5511998728422 | 1 | 0 |  |
| 5 | Claudia Regina | 5511988072952 | 1 | 0 |  |
| 6 | Marcelo Mendes de Castro | 5521981996991 | 0 | 0 |  |
| 7 | Lead #3714898 | 5511940085003 | 0 | 0 |  |
| 8 | Lead #3767654 | 5511975173735 | 0 | 0 |  |
| 9 | Edson dos Santos Silva | 5511946470443 | 0 | 0 |  |
| 10 | Angela | 5511991085739 | 17 | 0 | agendou_primeira_msg |
| 11 | Rosália Pcte | 5511998375061 | 9 | 0 | renovacao_receita_sem_consulta |
| 12 | Bruna Cesar | 5511910925285 | 14 | 2 | lead_sumiu_apos_cotacao_pacote |
| 13 | Lead #3801072 | 5511953744294 | 0 | 0 |  |
| 14 | Isabelle | 5511934382828 | 0 | 0 |  |
| 15 | Pedro/Danielle Gomes | 5511983071181 | 0 | 0 |  |
| 16 | Alfredo Alves | 5511991143802 | 0 | 0 |  |
| 17 | Bruno Ñavincopa | 5511942271508 | 17 | 0 | reagendamento_por_imprevisto_medico |
| 18 | Lead #3838208 | 5511982536070 | 0 | 0 |  |
| 19 | Lead #3935406 | 5511984777974 | 0 | 0 |  |
| 20 | Camila Basílio Pcte | 5511993834646 | 94 | 1 | reagendamento_frequente_e_nova_consulta_especialista |
| 21 | Jessica Srour | 5511973671818 | 45 | 0 | agendou_consulta_direta |
| 22 | Maria Elena | 5511992853606 | 120 | 27 | agendou_apos_logistica_e_financeiro |
| 23 | Carla Domene. | 5511976519396 | 0 | 0 |  |
| 24 | Gabriel Araujo | 5511966344512 | 0 | 0 |  |
| 25 | Arthur Witte | 5524992675766 | 0 | 0 |  |
| 26 | Daniele Lima | 5511995867075 | 0 | 0 |  |
| 27 | José Jeová | 5511986947988 | 22 | 10 | solicitacao_receita_paciente_antigo |
| 28 | Tainá Dewitte | 5511940122424 | 22 | 0 | solicitacao_receita_administrativo |
| 29 | Julia Consorte | 5511950745628 | 0 | 0 |  |
| 30 | Maria Neuza Marcelino da Silva | 554899695535 | 10 | 0 | agendou_procedimento_direto |

## 8. Conversas analisadas (transcrição + síntese)

_10 leads com conversa analisada._


### Angela — `5511991085739`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "pagamento": "750", "data_horario": "2026-02-20T10:00:00-03:00", "teleconsulta": "Sim", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `agendou_primeira_msg` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A lead Angela entrou em contato para agendar uma consulta para o Marcelo. Devido a uma cirurgia de vesícula recente do paciente, solicitou a modalidade de teleconsulta. O atendimento foi rápido, ofertando horário para o dia seguinte, que foi aceito de imediato. A lead realizou o pagamento via PIX (R$ 750,00) e o agendamento foi finalizado com sucesso.


**Gatilhos:** Agendamento rápido, Teleconsulta devido à cirurgia

<details><summary>Transcrição completa</summary>

- `2026-05-25 11:13` 👤 Bom dia
- `2026-05-25 11:13` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-25 11:13` 👤 Preciso agendar consulta marcelo
- `2026-05-25 11:13` 👤 Pode ser on line
- `2026-05-25 11:39` 🤖 Olá bom dia Angela, como vai? Temos horário disponível amanhã as 10h30, esse horário funciona para vocês?
- `2026-05-25 11:52` 👤 Ótimo
- `2026-05-25 11:52` 👤 Pode ser
- `2026-05-25 11:52` 👤 Ele não consegue ir presencial fez uma cirurgia da vesícula
- `2026-05-25 11:52` 👤 Pode ser o. Line
- `2026-05-25 11:53` 👤 Eu faço o pix
- `2026-05-25 11:53` 👤 E te mando
- `2026-05-25 11:54` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-25 17:11` 👤 *[imagem]*
- `2026-05-25 17:12` 👤 Celular marcelo 99452-4817
- `2026-05-25 19:44` 🤖 Boa tarde! Muito obrigada
- `2026-05-25 19:44` 🤖 Consulta agendada!
- `2026-05-25 19:48` 👤 *[imagem]*

</details>


### Rosália Pcte — `5511998375061`

**Custom fields:** `{"mensagem": "Solicitação de receita de Rivotril"}`

**Cenário:** `renovacao_receita_sem_consulta` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Rosália entrou em contato solicitando a renovação da receita de Rivotril. O atendimento agilizou o pedido com o Dr. Ivan sem a necessidade imediata de uma nova consulta (visto que possivelmente já é paciente da casa). A solicitação foi atendida e a receita disponibilizada via aplicativo no dia seguinte.


**Gatilhos:** agilidade na prescrição, uso de aplicativo da clínica

<details><summary>Transcrição completa</summary>

- `2026-06-08 12:23` 🤖 Oi Rosalia! Conseguimos um encaixe as 12:00 hs. Pode ser?
- `2026-06-08 14:28` 👤 Bom dia
- `2026-06-08 14:28` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-08 14:28` 👤 Poderia ja deixar preparada a receita
- `2026-06-08 14:29` 🤖 Bom dia, Rosalia?
- `2026-06-08 14:29` 🤖 Qual seria a medicação?
- `2026-06-08 14:30` 👤 Rivotril
- `2026-06-08 14:36` 🤖 Vamos solicitar ao Dr. Ivan
- `2026-06-09 18:11` 🤖 Olá boa tarde  Rosália, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.

</details>


### Bruna Cesar — `5511910925285`

**Cenário:** `lead_sumiu_apos_cotacao_pacote` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** Bruna é uma paciente antiga que entrou em contato para verificar a data da última infusão e valores atuais. A atendente informou o preço unitário (R$ 900) e do pacote (R$ 800/sessão em até 6x). Foi oferecida uma consulta de reavaliação com o Dr. Ivan como cortesia caso feche o pacote. A lead informou que 'vai verificar e volta a falar', encerrando o contato sem agendamento imediato.


**Objeções:** verificar disponibilidade financeira/pessoal

**Gatilhos:** valor de pacote, parcelamento, consulta cortesia na compra do protocolo

<details><summary>Transcrição completa</summary>

- `2026-05-12 13:02` 👤 Olá bom dia! Tudo bem?
- `2026-05-12 13:02` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-12 13:06` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-05-12 13:06` 🤖 Como posso ajudar?
- `2026-05-12 13:11` 👤 Oi Marisa, sou Bruna já fiz tratamento com vocês
- `2026-05-12 13:12` 👤 Gostaria de saber se qual foi a data da minha ultima infusão e se os valores estão iguais
- `2026-05-12 13:21` 🤖 **[ÁUDIO]** Oi, Bruna, tudo bem? Edilene aqui da Clínica Orto. Bruna, de acordo com aqui a agenda, a sua última infusão foi dia 11/07 do ano passado e agora as infusões elas estão saindo R$ 900 avulsas, tá bom?
- `2026-05-12 13:25` 👤 Nossa achei que fazia mais tempo
- `2026-05-12 13:26` 👤 E no pacote de oito ficaria quanto?
- `2026-05-12 13:36` 🤖 Disponha!
- `2026-05-12 13:39` 🤖 Dentro do pacote cada infusão custa R$800,00, o valor de R$ 6.400,00, parcelamos em até 6x sem juros.
- `2026-05-12 13:41` 🤖 **[ÁUDIO]** Oi Bruna, tudo bem? Bruna, no caso, como você fez a sua última infusão há um tempinho atrás, é interessante que agende uma consulta com o Dr. Ivan e, caso você feche o protocolo, essa consulta ela fica como cortesia, tá bom? A gente está à disposição e se você quiser agendar, a gente pode até agendar a sua consulta no modo online, pode ser?
- `2026-05-12 13:59` 👤 Vou verificar direitinho e volto a falar contigo
- `2026-05-12 13:59` 👤 Obrigada pelo retorno

</details>


### Bruno Ñavincopa — `5511942271508`

**Custom fields:** `{"data_horario": "2024-06-30T14:00:00-03:00", "procedimentos": "Primeira Consulta"}`

**Cenário:** `reagendamento_por_imprevisto_medico` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Bruno já havia agendado uma consulta inicial presencial com a Dra. Maisa. Devido a um imprevisto de saúde da médica, foi oferecida a opção de teleconsulta no mesmo dia, porém o paciente optou por aguardar e manter o formato presencial. A consulta foi reagendada com sucesso para a quinta-feira seguinte, às 18:00 hs.


**Objeções:** preferência por atendimento presencial invés de online

**Gatilhos:** atendimento presencial, fidelidade à Dra. Maisa

<details><summary>Transcrição completa</summary>

- `2026-05-21 11:09` 🤖 Bom dia, Bruno. Tudo bem?
- `2026-05-21 11:12` 🤖 A Dra. Maisa sugeriu uma sessão para hoje as 14:00 hs. Você tem disponibilidade?
- `2026-05-21 11:29` 👤 Bom dia, tudo bem? Seria presencial? Se sim, pode confirmar
- `2026-05-21 11:29` 🤖 Sim presencial
- `2026-05-21 11:30` 🤖 Posso confirmar?
- `2026-05-21 11:30` 👤 Pode sim, obrigado
- `2026-05-21 11:30` 🤖 Disponha
- `2026-06-11 14:42` 👤 Bom dia, tudo bem? Gostaria de marcar uma consulta com a Dra. Maisa
- `2026-06-11 14:42` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-11 14:46` 🤖 Bom dia, Bruno. Como vai?
- `2026-06-11 14:47` 🤖 A Dra. Maisa hoje não se sentiu bem e não atendeu de forma presencial, sua sessão pode ser online ou você prefere presencial na semana que vem?
- `2026-06-11 14:47` 👤 Tudo bem e vc? Prefiro presencial na semana que vem
- `2026-06-11 14:49` 🤖 Temos o horário das 18:00 hs disponível na próxima quinta. Você tem disponibilidade?
- `2026-06-11 14:50` 👤 Sim, pode ser
- `2026-06-11 14:53` 🤖 Agendado!
- `2026-06-11 15:09` 👤 Obrigado
- `2026-06-11 15:10` 🤖 Disponha!

</details>


### Camila Basílio Pcte — `5511993834646`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "data_horario": "2026-05-14T10:30:00-03:00", "teleconsulta": "true", "link_consulta": "https://meet.google.com/mts-vktz-gtp", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `reagendamento_frequente_e_nova_consulta_especialista` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente Camila buscava horários com a Dra. Maísa, alternando entre presencial e teleconsulta por questões de viagem e trânsito. Houve múltiplos reagendamentos e uma quase cobrança de taxa por cancelamento tardio. Em seguida, solicitou atendimento com o Dr. Ivan. Após um atraso na resposta da clínica, a consulta com o Dr. Ivan foi confirmada de última hora por teleconsulta.


**Objeções:** Conflito de agenda (trânsito), Conflito de agenda (outros médicos), Política de cancelamento em cima da hora

**Gatilhos:** Teleconsulta, Atendimento presencial em SP, Referência específica de profissional

<details><summary>Transcrição completa</summary>

- `2026-05-11 16:31` 👤 Ola! Td bem? Quais horarios a dra maysa tem disponível?
- `2026-05-11 16:31` 👤 E quais dias?
- `2026-05-11 16:41` 🤖 **[ÁUDIO]** Oi, Camila, tudo bem? Edilene aqui da Clínica Oris. Camila, os horários da Dra. Maísa, ela faz atendimento presencial toda quinta-feira aqui na clínica. Porém, os onlines nós não temos todos os horários. Aliás, nós não temos horário na agenda dela porque ela nos diz o dia e o horário pra gente sinalizar para o paciente. E aí no caso eu posso verificar com ela. Você tem preferência pelo período da manhã ou tarde?
- `2026-05-11 16:46` 👤 E os presenciais? Eu to em sp de novo. Mas independente tenho preferência pelos periodos de tarde
- `2026-05-11 16:56` 🤖 Presenciais por enquanto somente as quintas. Mas temos que ver com a Dra os horários pois ela esta com a agenda preenchida.
- `2026-05-11 17:47` 🤖 Olá Camila! Tudo bem? Conseguimos um encaixe na quinta as 11:00 hs. Você tem disponibilidade?
- `2026-05-11 17:47` 👤 Nao tem a tarde? Ou virtual a tarde outro dia?
- `2026-05-11 17:53` 🤖 Presencial a tarde na quinta feira não temos horário disponível. Vou verificar com a Dr. Maisa uma sugestão online em outra data.
- `2026-05-11 17:53` 👤 Okk mt obrigada
- `2026-05-11 19:55` 🤖 Olá Camila! A Dra. Maisa sugeriu dia 13/05 as 16:00 hs. (online). Você tem disponibilidade?
- `2026-05-11 19:56` 👤 Sim sim
- `2026-05-11 19:56` 🤖 Agendado!
- `2026-05-13 18:58` 🤖 Olá Camila!
- `2026-05-13 18:58` 🤖 Segue link para sessão de terapia.
- `2026-05-13 18:58` 🤖 link sessão Camila 16:00: https://meet.google.com/mts-vktz-gtp
- `2026-05-13 20:06` 👤 Edilene, prox semana a dra maysa tem horario presencial a tarde na quinta?
- `2026-05-13 22:04` 🤖 Boa noite, Camila. Pode ser as 17:00 hs?
- `2026-05-13 22:05` 👤 Sim sim
- `2026-05-13 22:05` 🤖 ok agendado
- `2026-05-19 17:45` 👤 Ola meninas, td bem? Entao, to com uns problemas de saude e só consegui a endocrino que eu preciso em encaixe pra quinta no horario da consulta… teriamos como mudar ou pular essa semana? (Pq sexta a dom eu viajo)
- `2026-05-19 17:45` 👤 Amanha teria hr?
- `2026-05-19 17:46` 👤 Mesmo nao presencial
- `2026-05-19 17:46` 🤖 Olá Camila! Tudo bem?
- `2026-05-19 17:46` 🤖 Poder online amanhã as 16:00 hs?
- `2026-05-19 17:46` 👤 Pode sim!
- `2026-05-19 17:47` 🤖 Combinado!
- `2026-05-19 17:47` 👤 Mt obrigada!
- `2026-05-19 17:47` 🤖 Disponha!
- `2026-05-19 17:48` 👤 *[imagem]*
- `2026-05-19 17:56` 🤖 Camila! Podemos alterar para amanhã as 17:00 hs?
- `2026-05-19 20:01` 🤖 Oi Camila? rs
- `2026-05-19 21:30` 👤 Opa
- `2026-05-19 21:30` 👤 Oi pode sim
- `2026-05-19 21:31` 🤖 Combinado! Grata!
- `2026-05-25 20:54` 👤 Ola! Td bem? Queria saber se eu poderia fazer por telemedicina essa quinta minha consulta com a dra maisa
- `2026-05-25 20:56` 🤖 Oi Camila. Tudo bem?
- `2026-05-25 20:57` 🤖 Normalmente de quinta a Dra. Maisa atende as consultas presenciais. Vou verificar com ela, quando ela pode te atender online ok?
- `2026-05-25 20:57` 🤖 Logo te retorno!
- `2026-05-25 20:57` 👤 Ok! Mt obrigada!!
- `2026-05-26 10:42` 🤖 Olá bom dia Camila, como vai? A Dra Maísa sugeriu que suas sessões sejam todas as quartas as 17h. Podemos agendar?
- `2026-05-27 12:10` 🤖 Bom dia, Camila. Tudo bem?
- `2026-05-27 12:10` 🤖 Por favor, podemos confirmar sua sessão hoje com a Dra. Maisa?
- `2026-05-27 17:02` 👤 Sim
- `2026-05-27 17:04` 🤖 Agradecemos a confirmação.
- `2026-06-02 13:20` 🤖 Bom dia, Camila. Tudo bem?
- `2026-06-02 13:20` 🤖 Somente esta semana, o seu atendimento com a Dra. Maisa pode ser hoje as 19:00 hs?
- `2026-06-03 11:11` 🤖 Olá! bom dia Camila, como vai? Como não tivemos retorno até o momento, a Dra. solicitou que realizássemos o reagendamento da sua sessão. Por gentileza, poderia nos informar quais dias e horários são mais convenientes para você? Assim, verificaremos a disponibilidade da Dra. e alinharemos os próximos atendimentos da melhor forma possível. Ficamos à disposição e aguardamos seu retorno. 💙
- `2026-06-03 13:58` 👤 Desculpa a demora pra responder. Ia perguntar se nao podia ser hoje ou amanha?
- `2026-06-03 14:00` 🤖 Amanhã a Dra não fará atendimento devido ao feriado. Podemos verificar a possibilidade de ser agora as 11h, pode ser?
- `2026-06-03 14:01` 👤 Pode ser
- `2026-06-03 14:01` 👤 Meio dia n tem?
- `2026-06-03 14:02` 🤖 Não, já temos paciente agendado.
- `2026-06-03 14:02` 👤 Entendi
- `2026-06-03 14:05` 🤖 A Dra esta finalizando um atendimento, vamos verificar e já te retornamos.
- `2026-06-03 14:05` 👤 Ok
- `2026-06-03 14:20` 🤖 Camila a Dra Maísa irá te atender agora, pode ser?
- `2026-06-03 14:20` 👤 Ok
- `2026-06-10 18:37` 👤 Ola, td bem? Só pra confirmar, hoje minha consulta com a dra maysa é as 17 certo?
- `2026-06-10 19:05` 🤖 Olá Camila!
- `2026-06-10 19:05` 🤖 Correto!
- `2026-06-10 19:06` 👤 Combinado!
- `2026-06-10 19:07` 👤 Teria como remarcar por telemedicina amanha ou sexta?
- `2026-06-10 19:10` 🤖 Camila, a Dra. pede para informar desistência com um dia de antecedência. Normalmente a desistência no mesmo dia gera cobrança da sessão que não foi realizada.
- `2026-06-10 19:10` 🤖 Vou verificar com a Dra. e lhe retorno
- `2026-06-10 19:14` 👤 Eh porque estou dirigindo e ta transito, nao chegarei a tempo
- `2026-06-10 19:33` 🤖 Camila, a Dr. Maisa sugeriu amanhã as 18:00 hs. Você tem disponibilidade?
- `2026-06-10 19:34` 👤 Mas pode ser por video?
- `2026-06-10 19:34` 👤 Tenho sim
- `2026-06-10 19:35` 🤖 Sim online! Agendado!
- `2026-06-10 20:46` 👤 Mt obrigada!☺️
- `2026-06-10 20:46` 🤖 Disponha!
- `2026-06-10 20:52` 👤 O dr ivan tem hr sexta?
- `2026-06-10 20:53` 🤖 O Dr. Ivan não fará atendimento nesta sexta.
- `2026-06-10 20:53` 🤖 Pode ser amanhã online?
- `2026-06-10 20:54` 🤖 Temos horário amanhã as 10:30 hs.
- `2026-06-10 20:54` 👤 Pode sim!
- `2026-06-10 21:35` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-06-10 21:46` 👤 Eu vou pedir pra minha mae entrar em contato pq ela que fica c essa parte
- `2026-06-10 22:08` 🤖 Combinado! Boa noite!
- `2026-06-11 17:14` 🤖 Oi Camila. Tudo bem?
- `2026-06-11 18:13` 🤖 Temos horário segunda feira dia 15/06 as 11h30 e as 17h. Qual horário seria mais conveniente para vocês?
- `2026-06-12 22:16` 👤 Ola! Desculpa a hora! Seria melhor as 17
- `2026-06-12 22:16` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-16 15:03` 🤖 Olá boa tarde Camila, como vai? Ontem acabamos que não vimos seu retorno sobre a consulta com o Dr Ivan, gostaria de fazer hoje as 17h, ainda esta disponível esse horário.
- `2026-06-16 15:03` 🤖 Caso tenha o interesse podemos agendar. Seguimos a disposição.
- `2026-06-16 16:50` 👤 Desejo sim
- `2026-06-16 16:50` 👤 Esta vago ainda?
- `2026-06-16 16:51` 🤖 Sim esta  disponível, podemos agendar?
- `2026-06-16 16:51` 👤 Sim
- `2026-06-16 16:53` 🤖 Certo, agendado.
- `2026-06-16 16:53` 👤 Obrigada
- `2026-06-16 17:43` 🤖 Camila, segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-06-16 17:43` 🤖 Camila Almeida Brasilio de Lima - Dr Ivan Barenboim - 16/06/2026 Terça-feira, 16 de junho · 5:00 – 5:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/xxp-rrbv-wzf

</details>


### Jessica Srour — `5511973671818`

**Cenário:** `agendou_consulta_direta` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A lead entrou em contato buscando agendamento específico com o Dr. Ivan. Houve uma breve negociação de horários, resultando no agendamento de uma teleconsulta para a quarta-feira seguinte. O pagamento de R$ 750,00 via PIX foi realizado prontamente. A paciente solicitou que a NF fosse emitida em nome da filha (Sharon) para fins de convênio/imposto. A consulta ocorreu conforme planejado e a interação final focou no envio da NF por e-mail.


**Objeções:** Indisponibilidade de horário (ajustado rapidamente)

**Gatilhos:** Indicação de profissional específico, Necessidade de agendamento rápido, Reembolso (Nota Fiscal)

<details><summary>Transcrição completa</summary>

- `2026-05-25 15:23` 👤 Boa tarde
- `2026-05-25 15:23` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-25 15:23` 👤 Td bem?
- `2026-05-25 15:23` 👤 Preciso agendar uma consulta com o Dr Ivan
- `2026-05-25 15:24` 🤖 Boa tarde, Jessica. Tudo bem e você?
- `2026-05-25 15:25` 🤖 Temos horário amanhã as 10:30 hs. Você tem disponibilidade?
- `2026-05-25 15:26` 👤 Não consigo … tem na 4a feira?
- `2026-05-25 15:27` 🤖 Sim. Temos horário as 10:30 ou as 17:30 hs. Qual horário você prefere?
- `2026-05-25 15:38` 👤 17:30 pode ser
- `2026-05-25 15:41` 🤖 Certo! A consulta será presencial ou online?
- `2026-05-25 15:42` 👤 On-line
- `2026-05-25 15:44` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-25 15:52` 👤 Pix
- `2026-05-25 15:52` 👤 Pode ser a NF em nome da minha filha?
- `2026-05-25 16:01` 🤖 Sim a nota pode ser no nome de sua filha.
- `2026-05-25 16:01` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-25 19:44` 👤 ComprovanteSantander-1779738275.242053.pdf
- `2026-05-25 19:50` 🤖 Jessica! A nota é para ser em nome da sua filha?
- `2026-05-25 19:50` 👤 Sim
- `2026-05-25 19:50` 👤 Sharon Srour Acherboim
- `2026-05-25 19:50` 👤 CPF: 424.597.188-61
- `2026-05-25 19:50` 👤 End. Rua Padre João Manuel, 493/15o andar
- `2026-05-25 19:51` 🤖 Certo! Consulta online agendada para o dia 27/05 as 17:30 hs.
- `2026-05-25 19:51` 👤 cep: 01411-001
- `2026-05-27 10:58` 🤖 Olá bom dia Jessica, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-27 10:59` 🤖 Jessica Sandra Srour  - Dr Ivan Barenboim - 26/05/2025 Quarta-feira, 27 de maio · 5:30 – 6:00pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/hfu-mzde-ebe
- `2026-05-27 20:27` 👤 Boa tarde
- `2026-05-27 20:27` 👤 O dr está no horário?
- `2026-05-27 20:28` 🤖 Boa tarde!
- `2026-05-27 20:28` 🤖 Sim
- `2026-05-27 20:28` 👤 Em 2 min então?
- `2026-05-27 20:31` 🤖 Ele já entra
- `2026-05-29 12:24` 👤 Bom dia
- `2026-05-29 12:25` 👤 Pode me enviar a NFiscal em nome da Sharon, minha filha
- `2026-05-29 12:29` 🤖 Olá bom dia, como vai? A nota fiscal foi emitida e encaminhada para o e-mail da Sharon, conforme solicitado. Seguimos a disposição.
- `2026-05-29 12:29` 👤 Ahh
- `2026-05-29 12:29` 👤 Obrigada!
- `2026-05-29 12:35` 👤 Ps: ela diz que não recebeu
- `2026-05-29 12:35` 👤 Tem como enviar no meu e-mail?
- `2026-05-29 12:35` 👤 Jessicasrour01@gmail.com
- `2026-05-29 12:36` 🤖 Certo Jessica. Estamos enviando diretamente para Sharon.
- `2026-05-29 12:36` 👤 Ok
- `2026-05-29 12:36` 👤 Obrigada
- `2026-05-29 12:36` 🤖 Disponha!

</details>


### Maria Elena — `5511992853606`

**Custom fields:** `{"interest": "Psicoterapia", "mensagem": "Lead pediu para perguntar a Camila e depois cobrar. Disse estar ocupada no trabalho. Pergunta se Camila nao estava marcada hoje às 17h com o Dr. Ivan e se é preciso pagar para confirmar a consulta.", "pagamento": "2400", "observacoes": "Lead pediu para perguntar a Camila e depois cobrar. Disse estar ocupada no trabalho. Pergunta se Camila nao estava marcad`

**Cenário:** `agendou_apos_logistica_e_financeiro` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Maria Elena gerencia o tratamento da Camila (filha). O lead realizou o pagamento de R$ 4.800,00 por protocolo de terapia e R$ 750,00 por consulta psiquiátrica. Houve intensa negociação sobre a emissão de notas fiscais nominais à Maria Elena para reembolso de sessões realizadas pela Camila. Após uma falha de comunicação da clínica que resultou na perda de um horário, a consulta com Dr. Ivan foi reagendada e paga via PIX no dia 16/06.


**Objeções:** Nota fiscal com data retroativa/nominal para reembolso plana de saúde, Preferência por pix/cartão parcelado, Erro de comunicação no agendamento anterior

**Gatilhos:** Reembolso facilitado, Agilidade na entrega de receita física, Flexibilidade de horários Dra. Maísa

<details><summary>Transcrição completa</summary>

- `2026-05-12 14:01` 🤖 Bom dia, Maria Elena. Como vai?
- `2026-05-12 14:02` 🤖 Podemos enviar o link de pagamento no valor de R$ 4800,00? Valor da metade das sessões.
- `2026-05-12 14:06` 👤 Bom dia 🌞
- `2026-05-12 14:06` 👤 Pode sim
- `2026-05-12 14:08` 🤖 Muito obrigada!
- `2026-05-12 14:08` 🤖 https://pay.sumup.com/b2c/XMKN8HWMQS
- `2026-05-12 14:09` 🤖 Por favor, assim que possível, nos envie o comprovante.
- `2026-05-12 14:13` 👤 Edilene, vc poderá emitir 2 notas por mês de consulta medica no valor de 900,00
- `2026-05-12 14:13` 👤 Em meu nome e a outra em nome da Camila?
- `2026-05-12 14:23` 🤖 **[ÁUDIO]** Olá, Maria Helena, tudo bem? É Edirlene, aqui da Clínica OR. Então, Maria Helena, essas notas elas vão ser emitidas como procedimento psicológico, porque é referente à terapia com a Dra. Maisa. E aí, no caso, na nota eu descrevo o número de sessões que você está aderindo no protocolo com a Dra. Maisa. E normalmente, com o relatório, os planos de saúde, eles reembolsam. Eu não sei como é que funciona com relação ao seu plano de saúde.
- `2026-05-12 14:56` 👤 Ah tá
- `2026-05-12 14:56` 👤 Nao sabia
- `2026-05-12 14:57` 👤 Mas ai vou precisar de outro pedido medico do Ivan encaminhando-a a essa terapia
- `2026-05-12 14:58` 👤 Aquela primeira nota da Maisa eu coloquei como consulta com pediatra e eles me reembolsaram pois o carimbo era do Ivan como psiquiatra
- `2026-05-12 15:12` 🤖 Nesse caso a Dra Maisa tinha que ter carimbado e assinado.
- `2026-05-12 15:13` 👤 **[ÁUDIO]** "Ah então, Edilene, bom dia. Eu achei que fosse ela que fosse carimbar, né? Mas aí tava Ivan. Eu não entendi, mas aí eu falei: bom, vai ver que é o Ivan que recebe o dinheiro e depois paga pra ela, né? Então eu falei: bom, eu vou colocar então como consulta psiquiátrica. Aí mandei eles me reembolsaram dessa forma. Agora eu sei que tem reembolso de sessões de terapia. Aí vem escrito, né, sessão de terapia. Mas aí tem que ser a doutora Maísa que tem que carimbar mesmo e rubricar."
- `2026-05-12 15:15` 🤖 **[ÁUDIO]** Sim, exatamente. Aí como a Camila agora pretende fazer o as terapias de modo presencial, eu faço a nota com o número de sessões, né, que você tá pagando, o valor de cada sessão e coloco os dados da Dra. Maísa na nota, que é o CRP e ela carimba e assina. É só isso, essa é a diferença entre uma nota e a outra e o plano paga.
- `2026-05-12 15:16` 👤 **[ÁUDIO]** É, mas eu não sei se paga esse total aí de uma vez, né? Ou se eu teria que mandar por mês.
- `2026-05-12 15:24` 👤 Kd o link ?
- `2026-05-12 15:24` 🤖 https://pay.sumup.com/b2c/XMKN8HWMQS
- `2026-05-12 15:26` 🤖 **[ÁUDIO]** Oi, Helena. Então, antes de eu emitir a nota, você pode verificar junto ao seu plano de saúde se é pago dessa forma. É, a maioria dos nossos pacientes, quando têm o relatório para sessões de terapia e a nota, a maioria, nunca tivemos um retorno de que não houve reembolso, mesmo que a nota feita no valor total.
- `2026-05-12 15:29` 👤 **[ÁUDIO]** Não, então tá bom, posso tentar.
- `2026-05-12 15:30` 👤 **[ÁUDIO]** Tá marcado amanhã, 11:30, né? Agora, eu não sabia que era presencial, ela tinha me falado que era online.
- `2026-05-12 15:30` 👤 **[ÁUDIO]** Edilene, ela precisa também marcar uma consulta com o Dr. Ivan, viu? Porque como ela ficou fora de São Paulo, estava no interior se tratando, ela precisa ver essa medicação, rever a medicação, porque ela está dormindo muito, muitas horas seguidas, não sei o que está acontecendo e engordando demais.
- `2026-05-12 15:32` 🤖 **[ÁUDIO]** Certo, entendi. Helena, no caso da consulta de amanhã, vai ser online mesmo, tá? Ela tinha te dito que seria online, eu que me confundi, porque ela disse, ela perguntou sobre os horários da Dra. Maísa, tanto no presencial quanto no online. Mas com relação a agendar a consulta da Dra. Ivana, a gente pode agendar sim, tá? Vou te passar os dias e horários.
- `2026-05-12 15:33` 👤 Pode passar direto p ela, por favor
- `2026-05-12 15:33` 👤 De certo o pagto?
- `2026-05-12 15:35` 🤖 Sim! Obrigada!
- `2026-05-12 21:25` 👤 Oi
- `2026-05-12 21:25` 👤 Edilene
- `2026-05-12 21:25` 👤 Eu achei um pedido medico de psicoterapia que o Ivan fez p mim em dez e eu nao usei.
- `2026-05-12 21:26` 👤 Poderia entao fazer essas notas da Dra Maisa em meu nome?
- `2026-05-12 21:26` 👤 *[imagem]*
- `2026-05-12 21:26` 👤 Obrigada!
- `2026-05-13 11:56` 🤖 **[ÁUDIO]** Oi, Maria Helena, tudo bem? Bom dia, Edilene. Então, Maria Helena, referente à nota, eu vi aqui que nesse pedido médico que o doutor Ivan fez pra você, tá como 40 sessões, né? E o número de sessões que a doutora Maíra recomendou pra Camila é diferente. Tem algum problema colocar como o número de sessões da Camila em si? Porque daí eu consigo sim emitir a nota com o número de sessões na descrição. Então vai exatamente dessa forma que eu estou descrevendo pra você: procedimento psicológico, dezoito sessões de terapia no valor de R$ 600,00 cada. Embaixo eu coloco o nome da doutora, o CRP dela e o valor total na nota.
- `2026-05-13 12:01` 👤 Bom dia
- `2026-05-13 12:01` 👤 Isso mesmo
- `2026-05-13 12:01` 👤 Pode ser assim e eu mando p a Porto p ver se me reembolsam
- `2026-05-13 12:02` 👤 Se nao der certo ai a gnt pensa em outro jeito
- `2026-05-13 12:03` 👤 A unica coisa q eles querem que coloque as datas das sessoes
- `2026-05-13 12:04` 👤 Entao teriamos que dizer que eu fiz sessoes desde abril
- `2026-05-13 12:04` 👤 Tem problema p vcs?
- `2026-05-13 12:44` 🤖 **[ÁUDIO]** Oi, Marilena. Tudo bem? Desculpa a demora que eu estava respondendo algumas outras demandas aqui. Referente a colocar as datas, eu preciso que a Camila finalize as 18 sessões para eu colocar as datas, tá? Porque eu não consigo colocar datas à frente. Só consigo fazer a nota com datas retroativas. Então, a única opção é emitir essa nota quando ela finalizar o protocolo, ou a nota ir sem datas. Aí, você me diz o que você prefere para que eu emita a nota. Infelizmente, eu não consigo colocar datas pra frente ou criar datas, por que se o plano de saúde solicitar alguma comprovação aqui da agenda, não vai ter como eu comprovar que ela fez a terapia conosco.
- `2026-05-13 15:06` 👤 **[ÁUDIO]** Ah, bom dia, Edilene, mas não dá para fazer em meu nome essa nota.
- `2026-05-13 15:06` 👤 **[ÁUDIO]** Que esse pedido aí do Ivan tá no meu nome, entendeu?
- `2026-05-13 15:41` 🤖 Sim a nota pode sim ser emitida no seu nome.
- `2026-05-13 16:17` 👤 Entao podemos colocar datas de abril e maio?
- `2026-05-13 16:18` 👤 Edilene, q hs a Camila marcou sessao com a Dra Maisa
- `2026-05-13 16:18` 👤 ?
- `2026-05-13 16:19` 🤖 Maria Elena posso te ligar?
- `2026-05-13 16:32` 👤 Pode sim!
- `2026-05-13 16:32` 👤 Desculpa
- `2026-05-13 16:32` 👤 Eu nao estava na sala
- `2026-05-15 15:01` 👤 Bom dia
- `2026-05-15 15:01` 👤 O Dr Ivan deixou uma receita para o Dr Mesquita?
- `2026-05-15 15:04` 🤖 Estamos verificando.
- `2026-05-15 15:05` 👤 **[ÁUDIO]** Edilene, bom dia. É que o Ângelo tá aí perto, aí ele queria saber, porque aí ele já passa aí pra pegar na portaria.
- `2026-05-15 15:05` 🤖 **[ÁUDIO]** Sim, a gente já enviou mensagem aqui para o doutor Ivan e está aguardando o retorno, tá bom?
- `2026-05-15 15:06` 👤 **[ÁUDIO]** Você tem o celular do Ângelo? O WhatsApp do Ângelo? Eu vou mandar para você porque eu vou ter que sair da sala para uma reunião, aí você responde para ele, por favor, se já está pronto.
- `2026-05-15 15:09` 🤖 **[ÁUDIO]** Já retirou aqui, tá bom, Maria Helena? Ele acabou de sair. É que eu já peguei a receita e já desci e já entreguei pra ele.
- `2026-05-15 15:10` 👤 Ok obrigada!!’
- `2026-05-15 15:10` 👤 *[imagem]*
- `2026-05-15 15:10` 🤖 Disponha
- `2026-06-01 16:19` 👤 Boa tarde
- `2026-06-01 16:19` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-01 16:19` 👤 Edilene?
- `2026-06-01 16:20` 👤 Preciso saber se vc pode fazer uma nota em meu nome ref 4 sessoes de terapia ?
- `2026-06-01 16:20` 👤 Total: 2.400,00
- `2026-06-01 16:20` 👤 E próximo mês vc faz outra de mais 4 sessões
- `2026-06-01 16:21` 👤 Ai a gnt liquida aquele deposito de 4.800
- `2026-06-01 16:49` 🤖 Olá boa tarde Maria Elena, como vai? Vou fazer conforme solicitado. Seguimos a disposição.
- `2026-06-01 16:51` 🤖 As duas notas serão feitas no seu nome?
- `2026-06-01 17:20` 👤 Isso mesmo
- `2026-06-01 17:20` 👤 Vou usar aquele pedido de terapia que o Ivan me passou em dez25
- `2026-06-01 17:23` 🤖 okay
- `2026-06-01 17:31` 🤖 **[ÁUDIO]** Oi, Mariele, só uma dúvida. É, essa nota ela precisa ser carimbada e assinada? Porque como a nota vai ser feita no nome da doutora Maisa, o carimbo dela fica com ela. Aí nesse caso, a gente teria que aguardar até quarta-feira, que é o dia que ela vai fazer atendimento presencial. Tudo bem?
- `2026-06-01 17:54` 👤 Ixi
- `2026-06-01 17:54` 👤 Tudo bem
- `2026-06-01 17:55` 👤 Precisa do carimbo sim
- `2026-06-01 17:56` 🤖 Certo.
- `2026-06-11 16:33` 👤 Edilene, boa tarde
- `2026-06-11 16:33` 👤 Td bem?
- `2026-06-11 16:33` 👤 Vc conseguiu a nota da Dra Maisa?
- `2026-06-11 17:06` 🤖 **[ÁUDIO]** Olá, Maria Helena, tudo bem? É a Edilene, aqui da Clínica Orme. Maria Helena, referente a sua dúvida da nota, a nota ela foi emitida, né? Eu consigo imprimir para você, porém hoje eu não consigo te mandar ela carimbada e assinada porque a Dra. Maísa não veio pra clínica por questões de saúde, mas na semana que vem eu consigo te entregar essa nota carimbada e assinada. Tá bom?
- `2026-06-11 17:09` 👤 **[ÁUDIO]** Oi, Dilene, tudo bem? Não, eu precisa do carimbo com o visto, né? E outra coisa: a Camila marcou, conseguiu marcar com o Ivan?
- `2026-06-11 17:10` 🤖 **[ÁUDIO]** Então, Maria Helena, com relação à nota, eu não consigo te entregar ela assinada e carimbada hoje, né? Como eu te disse, por conta da saúde, da ausência da doutora Maisa. E com relação à Camila, nós temos um horário disponível amanhã, que foi de interesse da Camila, porém ela disse que falaria com você para você fazer o pagamento. Qual é a forma de pagamento? Vai ser Pix ou você quer que a gente te envie o link de pagamento no cartão de crédito?
- `2026-06-11 17:12` 👤 Link do cartao
- `2026-06-11 17:13` 🤖 A vista ou em 3x ?
- `2026-06-11 17:14` 👤 3 x por favor
- `2026-06-11 17:15` 🤖 **[ÁUDIO]** Oi, Marilena. Desculpa, a gente cometeu um equívoco aqui. A gente já até conversou com ela, mas ela disse que iria falar com você e a gente acabou não agendando porque, como você só nos perguntou agora no período da tarde, aí não tem horário para amanhã, porque amanhã o doutor Ivan não vai fazer atendimento. No caso, a gente pode verificar um dia na segunda, no período da tarde é melhor ou no período da manhã?
- `2026-06-11 17:52` 🤖 Temos horário segunda feira dia 15/06 as 11h30 e as 17h. Qual horário seria mais conveniente para vocês?
- `2026-06-11 18:10` 👤 Poderia perguntar p ela e depois me cobrar, por favor
- `2026-06-11 18:10` 👤 Estou ocupada aqui no trabalho
- `2026-06-11 18:13` 🤖 Combinado!
- `2026-06-15 21:28` 👤 Oi
- `2026-06-15 21:29` 👤 A Camila nao estava marcada p hoje as 17hs com o Ivan?
- `2026-06-15 21:29` 👤 Eu precisava pagar primeiro p confirmar a consulta?
- `2026-06-16 12:12` 🤖 **[ÁUDIO]** Olá, Maria Helena, bom dia, tudo bem? Edilene aqui da Clínica Or. Vamos lá tirando as suas dúvidas referente à consulta da Camila. O que acontece: ontem, devido à demanda de mensagens, a gente acabou perdendo a mensagem dela e não vimos que ela tinha confirmado o horário das 17 horas e com isso já tinha passado o horário das 11:30. Então a gente imaginou que, como ela não tinha confirmado, nenhum dos nenhuma das opções dos horários tinha sido acordado. E a outra questão, por ser online, o pagamento ele é antecipado, né? E aí nós enviamos outro horário para a Camila, ela não nos retornou referente a isso. Nós temos horário ainda hoje, horário do meio-dia e meio e das 17 horas, tanto no modo online quanto no presencial. Você quer agendar para hoje?
- `2026-06-16 12:16` 👤 **[ÁUDIO]** Oi, Edilene, bom dia! Então, hoje eu tive que dormir aqui na casa da minha mãe, então não tive com a Camila, e eu tô ligando lá e ela não está tendendo, deve estar dormindo. Se você puder tentar de novo, mas eu sei que hoje, né, hoje que tem às dezessete horas a... psicoterapia com a Dra. Maísa? Se eu não me engano, ela me falou que era hoje. Dá uma consultada aí, por favor. Obrigada.
- `2026-06-16 12:17` 👤 Se ela marcar com Ivan depois me avisa que eu mando o pix p vc
- `2026-06-16 12:32` 🤖 **[ÁUDIO]** Oi, Maria Helena, então, o horário da Camila é quarta-feira às 17:00. A doutora não sinalizou pra gente alterar pra terça-feira. Mas assim que a gente conseguir falar com a Camila, a gente te informa, tá bom?
- `2026-06-16 15:01` 👤 Ah tá
- `2026-06-16 15:01` 👤 Ok
- `2026-06-16 16:54` 🤖 Boa tarde Maria Elena, a Camila nos respondeu. Aceitou a teleconsulta hoje as 17h.
- `2026-06-16 16:54` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-06-16 16:57` 👤 *[imagem]*
- `2026-06-16 16:57` 👤 Oie
- `2026-06-16 16:58` 👤 Passei o pix mas a nota pode ser em meu nome
- `2026-06-16 17:21` 🤖 Certo, combinado.
- `2026-06-16 17:36` 🤖 Nota fiscal impressa, carimbada e assinada, podemos deixar na portaria para ser retirada?
- `2026-06-16 18:33` 👤 Ja pode me mandar scanneada?
- `2026-06-16 18:34` 🤖 Deixamos em um envelope para ser retirado na portaria, pode ser?
- `2026-06-16 18:34` 👤 Tudo bem
- `2026-06-16 18:34` 👤 Eu peço p o Angelo retirar
- `2026-06-16 18:34` 👤 Obrigada!!
- `2026-06-16 18:34` 🤖 Disponha.
- `2026-06-16 18:35` 👤 *[imagem]*
- `2026-06-16 19:02` 👤 **[ÁUDIO]** Edilene, tudo bem? Eu tô pra te falar uma coisa e sempre esqueço. Eu tenho recebido aqui no meu celular os lembretes da Camila, dos remédios da Camila. É, será que quando ela passar na consulta, ele deve mudar os remédios? Aí você faz o novo plano pra ela no celular dela? Você sabe qual é o número do celular dela, né?
- `2026-06-16 19:04` 🤖 **[ÁUDIO]** Oi Maria Helena, tudo bem? Então, o sistema que coloca quando o doutor Ivan ele lancha o primeiro horário das medicações, a gente não tem acesso a alterar esses horários e a gente não consegue mudar no sistema. A gente até teve algumas reclamações de outros pacientes com relação a isso, mas é uma coisa que a gente não consegue alterar. Alguns pacientes até escolheram excluir o aplicativo pra parar de receber essas notificações.

</details>


### José Jeová — `5511986947988`

**Custom fields:** `{"origem": "Google - Orgânico", "data_horario": "2025-11-24T10:00:00-03:00", "procedimentos": ["Retorno"]}`

**Cenário:** `solicitacao_receita_paciente_antigo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O paciente José Jeová entrou em contato para solicitar renovação de diversas receitas (Quetiapina, Remeron, Alprazolam) com o Dr. Ivan. Houve duas interações: na primeira, a receita digital foi enviada via app; na segunda, o paciente solicitou receita física (azul) para retirada na portaria. Apesar de um pequeno atraso do médico, a receita foi disponibilizada e retirada pelo paciente.


**Gatilhos:** atendimento_humanizado, agilidade_portaria

<details><summary>Transcrição completa</summary>

- `2026-05-12 12:32` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-12 12:32` 👤 **[ÁUDIO]** Bom dia Adilene, tudo bem? Como é que tá as coisas, como é que tá vocês? Adilene, precisaria de pedir as receitas pro doutor... Ivan. E ver se ele manda a receita pra mim do Quetiapina de... as duas de 100, né? Eu não sei se tem de 200... que eu tava tomando de 175, mas aí meu sono tá um pouco meio devagar ainda. Então, você pede, por favor, a de 100, Quetiapina de 100, duas caixas. E o resto também, que ele sabe lá tudinho, o Polar, o Remeron, entendeu? Ele sabe o restante tudinho. Você pode ver pra mim por favor, minha querida? Um beijo pra todas vocês aí, tá bom? Fica com Deus.
- `2026-05-12 12:43` 🤖 **[ÁUDIO]** Bom dia, Seu José, tudo bem? É a Marisa. Tudo bem, nós vamos solicitar assim que estiver disponível e informo o senhor, tá bom? Muito obrigada.
- `2026-05-12 13:18` 👤 **[ÁUDIO]** Obrigado, Marisa, obrigado.
- `2026-05-12 13:37` 🤖 Abraços!
- `2026-05-12 17:58` 👤 Obrigado
- `2026-05-12 18:19` 🤖 Olá boa tarde Sr. José, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-05-12 18:20` 👤 🙏🏽🙏🏽
- `2026-05-25 14:36` 👤 **[ÁUDIO]** Boa tarde, Edilene e Mariza, tudo bem? Edilene, você pode pedir, por favor, a receita azul que eu passo aí quarta-feira cedo e pego na recepção? É do Alprazolam de um miligrama, tá? Você me dá o retorno depois, por favor? Muito obrigado. Uma ótima semana para vocês.
- `2026-05-25 14:40` 🤖 **[ÁUDIO]** Olá, seu José, tudo bem? É Dilene aqui da Clínica Or. Seu José, o seu Alprazolam é em gotas ou ele é em comprimidos?
- `2026-05-25 14:41` 👤 **[ÁUDIO]** É comprimido Edilene, é comprimido tá, de 1mg. Obrigado, viu.
- `2026-05-25 14:42` 🤖 Certo. Vamos solicitar ao responsável e assim que possível te retornamos. Seguimos à disposição.
- `2026-05-26 13:23` 👤 **[ÁUDIO]** "Bom dia, Edilene, desculpa estar te perguntando, deixa eu te falar: será que vai estar pronta a receita amanhã? Porque eu tenho uma consulta aí na Paulista e eu passaria e já pegaria a receita cedo na portaria. Você pode ver isso para mim, por favor, minha querida, você e a Marisa? Tá bom, obrigado, viu? Um beijo para vocês."
- `2026-05-26 13:25` 🤖 **[ÁUDIO]** Bom dia, Seu José, tudo bem? Acredito que sim, tá? Mas até o fim do dia eu confirmo para o senhor que vai estar lá na portaria.
- `2026-05-26 13:25` 👤 👏👏👏🫶🙏🏽🙏🏽
- `2026-05-26 21:43` 👤 **[ÁUDIO]** Boa noite, eu gostaria de saber se a receita ficou na portaria, por favor. Muito obrigado, boa noite.
- `2026-05-26 21:44` 🤖 Oi Sr. Jeova. Tudo bem?
- `2026-05-26 21:45` 🤖 O Dr. Ivan teve problemas e só conseguira fazer as receitas pendentes amanhã.
- `2026-05-26 21:46` 👤 Ok
- `2026-06-01 13:18` 👤 **[ÁUDIO]** Bom dia, meninas, tudo bem com vocês? Deixa eu perguntar uma coisa, a minha receita já está na portaria? Posso mandar pegar, por favor? Um abraço para todos, uma ótima semana.
- `2026-06-01 13:31` 🤖 Olá bom dia Sr José Jeová, como vai? Sim já esta disponível para ser retirada.
- `2026-06-01 13:37` 👤 Obrigado

</details>


### Tainá Dewitte — `5511940122424`

**Cenário:** `solicitacao_receita_administrativo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Tainá entrou em contato em dois momentos distintos (maio e junho) solicitando a renovação de receitas de Daforin e Konduz. Em ambas as situações, relatou urgência e dificuldade técnica com o aplicativo da clínica, solicitando o envio direto pelo WhatsApp. A equipe administrativa processou os pedidos junto ao médico e realizou a entrega dos PDFs conforme solicitado, finalizando o atendimento com sucesso operacional.


**Objeções:** falha_tecnica_app

**Gatilhos:** renovacao_receita, daforin, konduz

<details><summary>Transcrição completa</summary>

- `2026-05-11 16:36` 👤 Boa tarde,  Poderia solicitar receita do Daforin 20mg 60cp  E já a do konduz 35 mg Também pfvr
- `2026-05-11 16:36` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-11 17:06` 🤖 Olá boa tarde Tainá Dewitte, como vai? Vamos solicitar a pessoa responsável e assim que possível te retornamos. Seguimos a disposição.
- `2026-05-11 17:06` 👤 Favor solicitar com urgência pois estou quase sem Daforin
- `2026-05-11 17:09` 🤖 Vou solicitar ao doutor com urgência. Ele vai verificar seu prontuário e definir se pode renovar a prescrição ou se você precisa de uma nova consulta.O prazo para renovação de receitas é de 48h. Mas, normalmente, ele faz bem mais rápido que isso. Por isso, aconselhamos que entre em contato sempre com antecedência para esse tipo de solicitação.
- `2026-05-11 17:10` 👤 Normalmente o faço mas este mês falhei. Ok. Obrigada
- `2026-05-12 18:23` 🤖 Olá boa tarde Taina, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-05-12 18:57` 👤 Boa tarde, Quando possível poderia encaminhar por aqui pfvr? O app não funciona no meu celular
- `2026-05-12 19:15` 🤖 Receita 12_05_2026 172716.pdf
- `2026-06-10 00:23` 👤 Bom dia- a quem ver amanhã... Rs   Poderiam solicitar a receita do  Daforin 20mg pfvr?
- `2026-06-10 00:23` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-10 10:52` 🤖 Olá bom dia Tainá, como vai? Iremos solicitar a pessoa responsável  e assim que possível te retornamos. Seguimos a disposição.
- `2026-06-11 12:45` 🤖 Olá bom dia Taina, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-06-11 12:56` 👤 Bom dia, infelizmente o app não funciona no meu celular. Poderia encaminhar aqui pfvr?
- `2026-06-11 13:06` 🤖 Olá Taina!
- `2026-06-11 13:06` 🤖 Desculpe, havia esquecido.
- `2026-06-11 13:07` 🤖 Segue a receita.
- `2026-06-11 13:07` 🤖 Taina.pdf
- `2026-06-11 13:22` 👤 Obgda 😉
- `2026-06-11 13:22` 👤 Imagina, somos muitos pacientes
- `2026-06-11 13:27` 🤖 Disponha!

</details>


### Maria Neuza Marcelino da Silva — `554899695535`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2025-12-01T10:00:00-03:00", "qualificacao": "interessado", "procedimentos": ["Retorno"], "tipo_atendimento": "sessao_cetamina", "demonstrou_interesse": true, "procedimento_interesse": "cetamina", "procedimento_agendado_em": "2026-06-16T16:00:00.000Z"}`

**Cenário:** `agendou_procedimento_direto` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Maria Neuza entrou em contato solicitando disponibilidade para uma sessão de cetamina no dia seguinte às 13h. O atendente confirmou a disponibilidade de horário e a paciente prontamente confirmou o agendamento. O procedimento foi marcado para o dia 16/06/2026.


**Gatilhos:** disponibilidade de agenda

<details><summary>Transcrição completa</summary>

- `2026-06-01 13:01` 👤 Se tiver desistência me avise Por favor.
- `2026-06-01 13:02` 🤖 Combinado.
- `2026-06-15 16:23` 👤 Boa tarde Amanhã às treze horas dá para fazer cetamina?
- `2026-06-15 16:24` 🤖 Olá boa tarde Maria Neuza, como vai?
- `2026-06-15 16:25` 👤 Bem
- `2026-06-15 16:26` 🤖 Sim, temos horário as 13h, podemos agendar?
- `2026-06-15 16:26` 👤 Sim Confirmado
- `2026-06-15 16:26` 👤 Obrigada.
- `2026-06-15 16:28` 🤖 Certo, agendado.

</details>
