---
title: "Estudo: Fechamento pendente procedimento"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Fechamento pendente procedimento' do funil Agendamentos Novo (Clínica ÓR): 6 leads."
---

# Estudo: Fechamento pendente procedimento

**Coluna:** `Fechamento pendente procedimento` (posição 9) — **6 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é predominantemente um paciente em tratamento continuado ou recorrente, demonstrando alto grau de fidelidade à Clínica ÓR e a profissionais específicos como Dr. Ivan e Dra. Maysa. São indivíduos que já superaram a barreira do preço inicial e agora gerenciam a sustentabilidade do tratamento através de pacotes fechados (como Cetamina/Escetamina) ou buscam o reembolso do plano de saúde. Possuem agendas apertadas, demandando agilidade em encaixes e pontualidade na entrega de documentos administrativos (NF e relatórios). A relação já ultrapassou a formalidade clínica, envolvendo frequentemente membros da família e pagamentos de alto valor via PIX.


### Procedimentos mais mencionados

- Infusão de Cetamina (Ciclo e Manutenção)
- Escetamina (Spravato)
- Consulta de Seguimento Psiquiátrico
- Sessões de Psicologia em continuidade

### Profissionais mais mencionados

- Dr. Ivan Barenboim (Psiquiatria)
- Dra. Maysa/Maísa (Psicologia)

### Objeções mais comuns

- Indisponibilidade de horários específicos (preferência por turnos/dias fixos).
- Dificuldade logística para sessões presenciais (resolvida com teleconsulta).
- Atrasos médicos em horários agendados.
- Necessidade de documentação burocrática (NF/Relatórios) para viabilizar o reembolso (preço invisível).

### Gatilhos de entrada na coluna

- Necessidade de pacotes de manutenção (Cetamina/Escetamina) após ciclo inicial.
- Demanda urgente por encaixes de seguimento (Dra. Maysa/Dr. Ivan).
- Finalização de consulta inicial e necessidade de agendar o plano de tratamento proposto.

## 2. Padrões observados (Top 10)

1. Forte dependência de reembolso de convênio para viabilizar tratamentos de alto ticket.
2. Leads nesta etapa costumam ser recorrentes ou parentes de pacientes já ativos.
3. Aceitação de reagendamentos e atrasos médicos devido à alta confiança nos profissionais (Dra. Maysa e Dr. Ivan).
4. Migração frequente entre presencial e teleconsulta para conciliar agendas.
5. Uso de comprovantes de PIX como único validador de confirmação imediata.
6. Solicitação proativa de pacotes/ciclos fechados para obter melhores condições financeiras.
7. Negociações de horários de última hora (encaixes) para manutenção de tratamento.
8. Alta sensibilidade a prazos de recebimento de Notas Fiscais.
9. Indicação familiar como fator decisivo para fechamento de protocolos longos.
10. Comunicação direta e assertiva sobre horários (leads sem tempo para 'friendly talk').

## 3. Erros recorrentes do agente IA atual

- A IA pode classificar 'solicitação de NF' como interesse em nova compra, quando é suporte administrativo.
- Dificuldade em distinguir 'consulta de seguimento' de 'procedimento' (Cetamina) em leads recorrentes.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Status do Documento' (Pendente/Enviado) para NF e Relatórios de reembolso no CRM.
- Implementar automação de 'Cobrança de Comprovante' para leads com sessões agendadas sem confirmação de PIX.
- Mover leads que solicitam apenas documentos para uma sub-etapa de 'Pós-Venda/Administrativo' para não poluir a taxa de conversão comercial.

## 5. Recomendações para o agente de **atendimento**

- Antecipar o envio de Notas Fiscais e Relatórios médicos, pois são gatilhos de atrito se houver atraso.
- Ao oferecer pacotes (ex: 10 sessões), formalizar por escrito os horários travados para evitar confusão.
- Em casos de atraso médico, avisar com o máximo de antecedência possível para reduzir a fricção em leads de alto ticket.
- Script Sugerido: 'Olá [Nome], identifiquei que o Dr. [Nome] teve um pequeno imprevisto e atrasará X minutos. Podemos manter ou prefere que eu busque um encaixe prioritário para ainda hoje?'

## 6. Alertas

- ⚠️ Identificada insatisfação de familiar (Ana Paula) com atraso de posicionamento médico, exigindo atenção para evitar churn.
- ⚠️ Lead 'Sonia' agendou 10 sessões (R$ 8.000) com promessa de pagamento futuro; risco de inadimplência ou quebra de fluxo se não monitorado.
- ⚠️ Ocorrência de atrasos médicos em teleconsultas (Carmen Silvia) que podem impactar a experiência do paciente no fechamento.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Camilla Hattori | 5511999701522 | 26 | 0 | agendamento_apos_conflito_horario |
| 2 | Carla | 5511934275562 | 22 | 0 | agendou_recorrencia_e_pediu_cotacao |
| 3 | Ana Paula 🌼 | 5511996300704 | 48 | 2 | solicitacao_documentos_pos_consulta |
| 4 | Rodrigo Wainberg | 555196689688 | 66 | 3 | reagendamento_e_administrativo |
| 5 | 🌈 | 5511983259045 | 120 | 6 | agendou_apos_primeira_consulta |
| 6 | carmen silvia simoes | 5517991328804 | 14 | 0 | agendou_apos_pagamento |

## 8. Conversas analisadas (transcrição + síntese)

_6 leads com conversa analisada._


### Camilla Hattori — `5511999701522`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "qualificacao": "em_negociacao", "teleconsulta": "Não", "procedimentos": ["Consulta de seguimento"], "tentou_agendar": false, "tentou_pagamento": true, "demonstrou_interesse": true, "procedimento_interesse": "seguimento"}`

**Cenário:** `agendamento_apos_conflito_horario` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead Camilla buscava uma consulta de seguimento com urgência para o mesmo dia no período da tarde. Devido à falta de vagas imediatas, houve uma negociação de horários. Após demonstrar persistência e preferência pela Dra. Maysa e pelo turno da tarde, a atendente Marisa conseguiu um encaixe para a quinta-feira subsequente às 17h. A paciente confirmou o agendamento e enviou o comprovante (provavelmente de pagamento ou documento).


**Objeções:** indisponibilidade_de_horario_imediata, restricao_de_periodo_tarde

**Gatilhos:** urgencia_pessoal, preferencia_por_profissional_especifico

<details><summary>Transcrição completa</summary>

- `2026-06-08 12:23` 🤖 Não temos mais horário disponíveis no período da tarde hoje, temos as 11h, poderia ser online nesse caso.
- `2026-06-08 12:23` 👤 Obrigada !
- `2026-06-08 12:23` 👤 Oie, tudo bem e com vc ?
- `2026-06-08 12:23` 🤖 Em que podemos te ajudar?
- `2026-06-08 12:23` 👤 E quinta de tarde, teriam algum horário ?
- `2026-06-08 12:23` 👤 Desculpem 😞
- `2026-06-08 12:23` 👤 Eu sei que é difícil mas tá tudo tão caótico que esqueci de agendar antes
- `2026-06-08 12:23` 👤 Mas… teriam algum horário para hoje ? 😁
- `2026-06-08 12:23` 🤖 Quinta temos as 17h, funciona para você?
- `2026-06-08 12:23` 🤖 Disponha
- `2026-06-08 12:23` 👤 Perfeito, pode ser sim !
- `2026-06-08 12:23` 👤 Eu só poderia de tarde :/ vcs não tem nenhum horário ?
- `2026-06-08 12:23` 🤖 Camila temos horário no período da manhã funciona para você?
- `2026-06-08 12:23` 👤 Gostaria de marcar uma consulta com o Dr
- `2026-06-08 12:23` 🤖 Certo, agendado.
- `2026-06-11 19:57` 👤 *[imagem]*
- `2026-06-11 20:04` 🤖 Muito obrigada!
- `2026-06-12 11:08` 👤 Oi meninas, bom dia ! Vcs não esquecem por favor de ver para mim o horário com a Dra Maysa ? 🙏🏻❤️
- `2026-06-12 11:26` 🤖 Olá bom dia Camilla, como vai? Iremos verificar sim, assim que possível te informamos, seguimos a disposição.
- `2026-06-12 11:44` 🤖 Bom dia, Camila! É a Marisa. Tudo bem?
- `2026-06-12 11:45` 🤖 Conseguimos o horário das 17:00 hs na quinta com a Dra. Maísa. Você tem disponibilidade?
- `2026-06-12 11:46` 👤 Oi Marisa :)  Tudo bem e com vc ? Ahh ótimo ! Tenho sim ! Marcado então !
- `2026-06-12 11:46` 👤 Essa próxima quinta né ?
- `2026-06-12 11:46` 🤖 Sim! Agendado! Bjs
- `2026-06-12 11:47` 👤 Obrigada ❤️ até
- `2026-06-12 11:50` 🤖 Bjs!

</details>


### Carla — `5511934275562`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2024-02-12T12:00:00-03:00", "teleconsulta": "Sim", "procedimentos": ["Consulta de seguimento", "Infusão de cetamina"]}`

**Cenário:** `agendou_recorrencia_e_pediu_cotacao` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=indefinido · fora_escopo=False


**Síntese:** Carla entrou em contato inicialmente para verificar um agendamento de cetamina e marcou para uma segunda-feira. Posteriormente, informou que o Dr. Ivan prescreveu mais 6 sessões de escetamina. Ela agendou a primeira sessão para terça-feira às 12h e solicitou o valor do pacote fechado. A clínica informou o valor de R$ 4.800,00 para o ciclo completo.


**Objeções:** Preço (implícito ao pedir cotação de pacote)

**Gatilhos:** Continuidade de tratamento, Pedido médico para novas sessões, Desconto em pacote

<details><summary>Transcrição completa</summary>

- `2026-05-14 20:52` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-14 20:52` 👤 Olá. Eu agendei a próxima cetamina? Não lembro
- `2026-05-14 21:16` 🤖 Boa tarde, Carla! Tudo bem?
- `2026-05-14 21:16` 🤖 Não agendou não. Vamos agendar?
- `2026-05-14 21:24` 👤 Por favor. Pode ser pra segunda ou terça
- `2026-05-14 21:25` 🤖 Pode ser segunda as 12:00 hs?
- `2026-05-14 21:26` 👤 Pode
- `2026-05-14 21:27` 🤖 ok agendado
- `2026-05-14 21:27` 🤖 Bom final de semana!
- `2026-06-03 17:40` 👤 Olá, boa tarde
- `2026-06-03 17:40` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-03 17:40` 👤 O dr Ivan pediu mais 6 sessões semanais de escetamina
- `2026-06-03 17:41` 👤 Queria marcar a primeira dessas 6 pra terça
- `2026-06-03 17:42` 🤖 Olá Carla! Tudo bem?
- `2026-06-03 17:42` 🤖 Pode ser terça as 12:00 hs?
- `2026-06-03 17:42` 👤 Pode
- `2026-06-03 17:42` 🤖 Agendado!
- `2026-06-03 17:42` 👤 Obrigada
- `2026-06-03 17:42` 🤖 Disponha!
- `2026-06-04 10:02` 👤 Olá, bom dia. Quanto fica o pacote de 6 sessões de escetamina no pix?
- `2026-06-04 10:02` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-05 10:42` 🤖 Olá bom dia Carla, como vai? Referente a sua dúvida o valor do pacote com 6 infusões fica R$ 4.800,00 no pix ou no cartão de crédito.

</details>


### Ana Paula 🌼 — `5511996300704`

**Custom fields:** `{"mensagem": "Lead solicita comprovantes de pagamento associados às notas fiscais; anexos Ana Paula.pdf, Ana Paula2.pdf, Ana Paula3.pdf", "interesse": "Consulta com psiquiatria", "observacoes": "Lead solicita comprovantes de pagamento associados às notas fiscais; anexos Ana Paula.pdf, Ana Paula2.pdf, Ana Paula3.pdf", "qualificacao": "interessado", "teleconsulta": "Não", "procedimentos": ["Consulta`

**Cenário:** `solicitacao_documentos_pos_consulta` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead (mãe do paciente João Cicero) inicialmente demonstrou insatisfação com um procedimento médico, cobrando posicionamento do Dr. Ivan. Posteriormente, solicitou Notas Fiscais e comprovantes de pagamento via cartão de crédito para fins de reembolso no convênio. O atendimento forneceu as notas e está em processo de localizar os comprovantes específicos com o financeiro.


**Gatilhos:** reembolso_convenio

<details><summary>Transcrição completa</summary>

- `2026-05-29 12:21` 👤 Ola bom dia
- `2026-05-29 12:22` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-29 12:22` 👤 Peço a gentileza de avisar o Dr Ivan para ler a mensagem que enviei a ele e me  dar um retorno.
- `2026-05-29 12:26` 👤 Afinal os.mèdicos tem que se co_responsabilizar quando adotam um.procedimento equivocado com o paciente e o custo emocional e financeiro nao pode ficar so.com o paciente e com.os pais.
- `2026-05-29 12:29` 🤖 Bom dia. Tudo bem?
- `2026-05-29 12:30` 🤖 Me desculpe, não consegui identificar. Qual é o nome completo do paciente?
- `2026-05-29 12:30` 👤 Joao cicero nosralla de oliveira nicolau
- `2026-05-29 12:32` 🤖 Muito obrigada! Vamos informar ao Dr. Ivan
- `2026-05-29 12:33` 👤 Ok! Grata
- `2026-06-09 13:52` 👤 Ola bom dia
- `2026-06-09 13:53` 👤 Por favor gsotaria que vc me enviasse as notas fiscais da consukta que realizei
- `2026-06-09 13:53` 👤 Eu estou com muiya dificuldade pra achar
- `2026-06-09 13:55` 🤖 Bom dia, Tudo bem?
- `2026-06-09 13:55` 🤖 Por favor, confirme o cpf que foi emitido as notas.
- `2026-06-09 14:09` 👤 175397258-26
- `2026-06-09 14:14` 🤖 Seguem as notas solicitadas.
- `2026-06-09 14:15` 🤖 Ana Paula.pdf
- `2026-06-09 14:15` 🤖 Ana Paula2.pdf
- `2026-06-09 14:15` 🤖 Ana Paula3.pdf
- `2026-06-09 14:30` 👤 Muito grata!
- `2026-06-12 20:24` 👤 Por favor seria demais pedir os comprovantes de pagamento associados a essas notas fiscais ?
- `2026-06-12 20:27` 🤖 **[ÁUDIO]** Boa tarde, Ana Paula, tudo bem? Eu não me recordo, peço desculpas, peço para você me ajudar a recordar. Você fez os pagamentos aqui presencialmente e precisava desses comprovantes da máquina, é isso que você precisa?
- `2026-06-12 20:35` 👤 presencialmente
- `2026-06-12 20:35` 👤 eu preciso para o convenio
- `2026-06-12 20:35` 👤 fiz com cartao de credito
- `2026-06-12 20:35` 👤 eu cheguei a enviar pra você?
- `2026-06-12 20:44` 🤖 **[ÁUDIO]** Oi, eu vou verificar com o departamento financeiro se é possível, tá bom? Mas só segunda-feira porque hoje não tem mais ninguém aqui. Beijos!
- `2026-06-12 20:47` 👤 175397258-26
- `2026-06-12 20:47` 👤 sem problemas. muito obrigada
- `2026-06-15 19:35` 🤖 Boa tarde, Ana. Tudo bem?
- `2026-06-15 19:38` 👤 Oi td bem e vc
- `2026-06-15 19:38` 👤 Conseguiu?
- `2026-06-15 19:39` 🤖 Precisamos das datas de pagamentos para que o financeiro possa localizar os comprovantes. Você sabe me dizer?
- `2026-06-15 19:51` 👤 Nao seria as datas das notas ?
- `2026-06-15 19:51` 👤 Eeu vou ver
- `2026-06-15 19:52` 👤 29/01
- `2026-06-15 19:52` 🤖 Na verdade não necessariamente.
- `2026-06-15 19:53` 🤖 As vezes emitidos a nota em outra data.
- `2026-06-15 19:53` 👤 04/12
- `2026-06-15 19:53` 👤 29/01
- `2026-06-15 19:56` 👤 29 ou 30/10
- `2026-06-15 20:12` 🤖 Por favor, me informe os últimos 4 dígitos do cartão de crédito.
- `2026-06-15 20:47` 👤 2693
- `2026-06-15 20:47` 👤 Mas se nao der certo tudo bem
- `2026-06-15 20:47` 👤 Valeu o esforço
- `2026-06-15 20:48` 🤖 Certo! Lhe retorno assim que possível.

</details>


### Rodrigo Wainberg — `555196689688`

**Custom fields:** `{"origem": "Indicação de paciente", "mensagem": "O relatório pedido foi referente ao primeiro pagamento, englobando 11 consultas: 12/02 - avaliação, 20/02, 26/02, 05/03, 12/03, 19/03, 23/03, 31/03 - online, 07/04, 10/04 - online, 16/04. Precisa do relatório assinado pela Dra.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead pediu novo horário para consulta com Dr Yvan; confirma inte`

**Cenário:** `reagendamento_e_administrativo` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Lead recorrente em tratamento com Dr. Yvan (psiquiatria) e Dra. Maísa (psicologia). Solicitou relatório retroativo de 11 sessões para reembolso e nota fiscal de consulta recente. Houve uma série de reagendamentos: primeiro por indisponibilidade médica e depois por solicitação do lead. Após tentar trocar o horário de quinta-feira e não encontrar alternativas, o lead decidiu manter o horário original presencial de quinta às 11h.


**Objeções:** Incompatibilidade de horário

**Gatilhos:** Dra Maísa (Psicologia), Dr Yvan (Psiquiatria), Relatório para reembolso/plano de saúde

<details><summary>Transcrição completa</summary>

- `2026-05-12 12:27` 👤 Bom dia
- `2026-05-12 12:27` 👤 Ainda tem o horário das 11h esta quinta?
- `2026-05-12 12:40` 🤖 Bom dia, Rodrigo. Tudo Bem?
- `2026-05-12 12:40` 🤖 Já alterei seu horário para as 11:00 hs novamente.
- `2026-05-12 12:50` 👤 Tudo bem
- `2026-05-12 12:50` 👤 Obrigado
- `2026-05-12 12:55` 👤 Eu esqueci de falar pra vocês: O relatório que eu pedi foi referente ao primeiro pagamento. São estas 11 consultas 12/02 - avaliação  20/02 26/02 05/03 12/03 19/03 23/03 31/03 - online 07/04 10/04 - online  16/04  Preciso que a Dra faça o relatório assinado
- `2026-05-12 12:58` 🤖 Certo Rodrigo. Vamos solicitar para Dra. com urgência
- `2026-05-14 13:26` 👤 Amanha consigo 9:30-10:30
- `2026-05-14 13:26` 👤 Pode ser?
- `2026-05-14 13:30` 🤖 Pode ser as 10:30 hs online?
- `2026-05-14 13:36` 👤 Não consigo
- `2026-05-14 13:50` 🤖 https://acrobat.adobe.com/id/urn:aaid:sc:VA6C2:e3e8b9b3-5878-4ad6-aafa-cd699b101839
- `2026-05-14 13:51` 🤖 Vc não tem outro horário disponível?
- `2026-05-14 13:53` 👤 11h-12h
- `2026-05-14 14:04` 🤖 Confirmado o horário para amanhã Rodrigo.
- `2026-05-14 14:06` 👤 11-12h isso?
- `2026-05-14 14:06` 🤖 Sim
- `2026-05-14 14:06` 👤 ok,obrigado
- `2026-05-14 14:06` 🤖 Disponha!
- `2026-05-14 14:07` 🤖 Te enviei o relatório em PDF, mas também está aqui pronto para retirada conosco.
- `2026-05-14 14:13` 👤 Ok, acho que o plano aceita online. Qualquer coisa eu pego semana q vem ai
- `2026-05-14 14:14` 🤖 Combinado!
- `2026-05-18 12:33` 👤 Bom dia
- `2026-05-18 12:33` 👤 Preciso marcar uma consulta com Dr Yvan
- `2026-05-18 12:33` 👤 Pode ser on-line
- `2026-05-18 12:36` 🤖 Bom dia, Rodrigo. Como vai? Temos horário amanhã as 10:00 hs. Você tem disponibilidade?
- `2026-05-18 12:41` 👤 tudo bem
- `2026-05-18 12:41` 👤 sim
- `2026-05-18 12:45` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-18 12:45` 👤 credito
- `2026-05-18 12:46` 🤖 https://pay.sumup.com/b2c/X35WVATCL5
- `2026-05-18 12:47` 🤖 Por favor, assim que possível nos envie o comprovante para finalizarmos o agendamento.
- `2026-05-18 12:51` 👤 *[imagem]*
- `2026-05-18 12:55` 🤖 Muito obrigada!
- `2026-05-18 12:56` 🤖 Consulta online agendada para dia 19/05 as 10:00 hs.
- `2026-05-19 13:02` 🤖 Olá bom dia Rodrigo, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-19 13:02` 🤖 https://meet.google.com/hwn-bdsn-fzz
- `2026-05-20 12:17` 👤 Bom dia
- `2026-05-20 12:17` 👤 Está confirmada minha sessão amanhã 11h presencial?
- `2026-05-20 12:18` 🤖 Bom dia, Rodrigo! Confirmada.
- `2026-05-20 12:23` 👤 Obrigado
- `2026-05-20 12:24` 🤖 Disponha!
- `2026-05-20 12:24` 👤 Também preciso da nota referente à consulta de ontem por favor
- `2026-05-20 12:28` 🤖 Rodrigo! A nota foi enviada para seu e-mail no dia 18/05.
- `2026-05-20 12:30` 👤 achei aqui, desculpe
- `2026-05-20 12:30` 🤖 Fique tranquilo! Obrigada!
- `2026-06-11 11:15` 🤖 **[ÁUDIO]** Olá, bom dia, Rodrigo, tudo bem? A Edilene da Clínica Or. Rodrigo, a doutora pediu para sinalizar que hoje ela acordou com o olho inchado e muito dolorido, muita dor de cabeça, um mal-estar. Pediu para sinalizar que hoje não vai ter atendimento presencial e gostaria de verificar com você a possibilidade das sessões delas serem online no período da tarde. Se possível, você nos dá um retorno, por gentileza?
- `2026-06-11 12:53` 👤 **[ÁUDIO]** "Oi, bom dia, tudo bem? É, hoje eu não consigo à tarde. Vamos deixar para a semana que vem, é, presencial, na quinta no mesmo horário, tudo bem?"
- `2026-06-11 13:04` 🤖 **[ÁUDIO]** Olá, Rodrigo, tudo bem? Sim, obrigado pelo retorno. A gente vai reagendar então para a semana que vem, tá bom? Tenha um bom dia!
- `2026-06-16 16:38` 👤 Boa tarde
- `2026-06-16 16:38` 👤 Não vou conseguir ir nesta quinta 11h
- `2026-06-16 16:38` 👤 Tem outro horário?
- `2026-06-16 16:41` 🤖 Boa tarde Rodrigo, como vai?
- `2026-06-16 16:41` 🤖 Iremos verificar com a Dra Maísa e te retornamos, pode ser opções no modo online também?
- `2026-06-16 16:42` 👤 Tudo bem
- `2026-06-16 16:42` 👤 Melhor presencial, mas se n der, pode ser online
- `2026-06-16 17:05` 🤖 Vamos verificar e retornamos assim que possível.
- `2026-06-16 20:48` 🤖 Olá Rodrigo! Na quinta feira a Dra. não tem mais horários disponíveis. A dra sugeriu uma sessão online na sexta feira as 20:00 hs. Você tem disponibilidade?
- `2026-06-16 20:55` 👤 Não. Vou reagendar meu compromisso de quinta. Vamos  manter presencial às 11h
- `2026-06-16 20:55` 👤 Tudo bem?
- `2026-06-16 20:56` 🤖 Sem problemas!

</details>


### 🌈 — `5511983259045`

**Custom fields:** `{"mensagem": "Chave pix: 07644613897", "interesse": "Infusão de Cetamina", "pagamento": "750", "observacoes": "Video enviado; avaliação marcada; teleconsulta com link; pagamento de 750 pendente; chave pix 07644613897.", "qualificacao": "interessado", "teleconsulta": "true", "link_consulta": "https://meet.google.com/hei-qyuu-wzw", "procedimentos": ["Infusão de cetamina", "Primeira Consulta"], "tent`

**Cenário:** `agendou_apos_primeira_consulta` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente Sonia realizou teleconsulta inicial (paga via PIX) e completou o primeiro protocolo de 8 sessões de cetamina. Após retorno online com Dr. Ivan, iniciou um novo protocolo de manutenção (10 sessões por R$ 8.000). A paciente demonstra alto nível de satisfação, agendando sessões recorrentes para si e para um familiar (Ricardo), com promessa de pagamento para a próxima segunda-feira.


**Gatilhos:** Indicação de familiar (Ricardo), Atendimento humanizado, Parcelamento sem juros

<details><summary>Transcrição completa</summary>

- `2026-05-12 13:44` 🤖 Bom dia, Sonia. Tudo bem?
- `2026-05-12 13:45` 🤖 Sou Marisa da Clínica Ór. Fui informada que você deseja agendar uma consulta com o Dr. Ivan.
- `2026-05-12 13:46` 🤖 Temos horário dia 14/05 as 10:30 hs. Você tem disponibilidade?
- `2026-05-12 13:51` 👤 Bom dia, tudo e vc?  Tenho sim.
- `2026-05-12 13:51` 👤 Quinta feira
- `2026-05-12 13:51` 🤖 Certo!
- `2026-05-12 13:51` 🤖 A consulta será presencial ou online?
- `2026-05-12 13:55` 👤 Se puder prefiro on-line
- `2026-05-12 13:58` 🤖 Certo!
- `2026-05-12 13:58` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-12 14:03` 👤 Pix
- `2026-05-12 14:04` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-12 14:04` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-12 14:12` 👤 *[imagem]*
- `2026-05-12 14:22` 👤 Sônia Valéria Gonçalves  09.01.1966 07644613897 14.357.099 Rua guapuã 17 apt.11 04324-050 (11)983259045 soniavgoncalves38@gmail.com Gerente Solteira Brasileira  Ricardo (11)96574-8326 Ricardo ( paciente do dr)
- `2026-05-12 14:29` 🤖 Muito obrigada!
- `2026-05-12 14:30` 🤖 Consulta online agendada para o dia 14/05 as 10:30 hs.
- `2026-05-12 14:31` 🤖 A plataforma utilizada é o Google Meet e o link será enviado no dia da consulta pela manhã.
- `2026-05-12 14:31` 👤 Ok
- `2026-05-14 13:29` 🤖 Olá bom dia Sonia, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-14 13:29` 🤖 Sonia Valéria Gonçalves - Dr Ivan  Barenboim - 14/05/2026 Quinta-feira, 14 de maio · 10:30 – 11:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/gbt-cmfx-ecp
- `2026-05-14 14:26` 👤 Olá. Vcs irão me passar por aqui as informações e datas para infusão de cerâmica?
- `2026-05-14 14:26` 🤖 **[ÁUDIO]** Olá, Sonia, tudo bem? Quem fala é a Mariza.
- `2026-05-14 14:27` 🤖 **[ÁUDIO]** O doutor prescreveu para você o protocolo de cetamina, que são oito infusões. Essas infusões são realizadas duas vezes por semana durante quatro semanas.
- `2026-05-14 14:27` 🤖 **[ÁUDIO]** Você -- a infusão é realizada em 40 minutos, mais o tempo de recuperação, que vai de pessoa para pessoa, mas normalmente de 20 no máximo uma hora.
- `2026-05-14 14:27` 🤖 **[ÁUDIO]** O pacote das oito infusões tem o valor de 6.400 reais, pode ser parcelado em até seis vezes sem juros, e nós emitimos nota para reembolso também.
- `2026-05-14 14:28` 🤖 **[ÁUDIO]** As infusões são realizadas das 07:30 da manhã às 15:30 de segunda a quinta, e às sextas-feiras das 07:30 da manhã até às 14:00.
- `2026-05-14 14:28` 🤖 **[ÁUDIO]** Podemos agendar? Qual seria o melhor dia para você?
- `2026-05-14 15:20` 👤 Gostaria de fazer a primeira amanhã às 8:00 e as próximas de seg e quinta às 15:30.  Poderia ser assim?
- `2026-05-14 15:25` 🤖 Oi! Temos os seguinte horários disponíveis próximos aos horários solicitados:
- `2026-05-14 15:26` 🤖 15/05 08:30 hs 18/05 15:00 hs 21/05 15:00 hs
- `2026-05-14 15:26` 🤖 Pode ser?
- `2026-05-14 15:29` 👤 Pode sim
- `2026-05-14 15:30` 🤖 Certo! Agendado.
- `2026-05-14 15:30` 👤 Obrigada até amanhã
- `2026-05-14 15:30` 🤖 Até amanha!
- `2026-05-18 19:13` 👤 07644613897
- `2026-05-18 19:14` 👤 Chave pix
- `2026-05-19 19:34` 🤖 Boa tarde. Sonia!
- `2026-05-19 19:35` 🤖 O pix de devolução do valor da consulta foi realizado hoje  as 16:27H.
- `2026-05-19 19:36` 🤖 Peço por gentileza que verifique se está tudo certo.
- `2026-05-19 19:36` 🤖 Estamos a disposição.
- `2026-05-19 19:51` 👤 Boa tarde! Recebi certinho. Muito obrigada 🥰
- `2026-05-19 19:52` 🤖 Disponha!😊
- `2026-05-22 13:05` 👤 Bom dia … na próxima semana gostaria de marcar na segunda e quinta às 15:30 . Para mim e para Ricardo Ferraz
- `2026-05-22 13:08` 🤖 Bom dia, Sonia! Tudo bem?
- `2026-05-22 13:09` 🤖 Segunda feira a tarde nossa agenda já está preenchida. Pode ser na terça?
- `2026-05-22 13:09` 🤖 Não posso colocar os dois no mesmo horário. Posso colocar as 15:00 e 15:30 hs?
- `2026-05-22 13:10` 👤 Pode ser
- `2026-05-22 13:11` 👤 Pode ser na terça
- `2026-05-22 13:13` 👤 Coloca o Ricardo no primeiro horario
- `2026-05-22 13:15` 👤 Já queria deixar as próximas marcadas. 01.06 - 15:00 e 15:30  03.06 - 15:00 e 15:30
- `2026-05-22 13:23` 🤖 Certo Sonia! Todos os agendamentos solicitados foram realizados!
- `2026-05-29 14:23` 👤 Bom dia
- `2026-05-29 14:24` 👤 Só confirmando
- `2026-05-29 14:24` 👤 01.06 e 03.06
- `2026-05-29 14:38` 🤖 Bom dia!
- `2026-05-29 14:38` 🤖 Confirmado!
- `2026-06-09 15:21` 👤 Boa tarde,  pensei em alterar minha consulta para quinta ou sexta on-line , pois ele deve indicar mais sessões e eu já faria na segunda feira junto com o Ricardo.
- `2026-06-09 15:30` 🤖 Boa tarde! Sonia
- `2026-06-09 15:31` 🤖 Pode ser quinta feira as 10:00 ou as 17:30 hs. Qual horário você prefere?
- `2026-06-09 15:33` 👤 Quinta às 10:00
- `2026-06-09 15:33` 🤖 Agendado!
- `2026-06-09 15:33` 👤 Obrigada
- `2026-06-09 15:34` 🤖 Disponha!
- `2026-06-10 18:30` 👤 Boa tarde. Será que conseguimos agendar para8 final do dia a consulta. Tive um imprevisto. 🙏🏻
- `2026-06-10 19:08` 🤖 Olá Sonia. Pode ser hoje as 18:00 hs?
- `2026-06-10 20:02` 🤖 Oi Sonia?
- `2026-06-10 20:05` 👤 Oi …
- `2026-06-10 20:06` 👤 Pode ser na sexta tb
- `2026-06-10 20:06` 👤 Hoje eu não consigo
- `2026-06-10 20:07` 🤖 Pode ser dia 12/06 as 11:00 hs?
- `2026-06-10 20:10` 👤 Perfeito
- `2026-06-10 20:10` 👤 Muito obrigada
- `2026-06-10 20:12` 🤖 Disponha
- `2026-06-10 20:13` 🤖 Ai Sonia, desculpe! Sexta feira o Dr. Ivan não fará atendimento.
- `2026-06-10 20:14` 🤖 Não pode ser amanhã as 17:30 hs?
- `2026-06-10 20:15` 👤 Pode sim
- `2026-06-10 20:17` 🤖 Ótimo! Obrigada.
- `2026-06-10 20:18` 🤖 Você quer retorno presencial mesmo ou prefere online?
- `2026-06-10 20:18` 👤 Prefiro on-line
- `2026-06-10 20:19` 🤖 Combinado!
- `2026-06-10 20:19` 👤 Obrigada
- `2026-06-10 20:19` 🤖 Disponha!
- `2026-06-11 13:17` 🤖 Olá bom dia Sonia, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-06-11 13:17` 🤖 Sônia Valéria Gonçalves - Dr Ivan Barenboim - 11/06/2026 Quinta-feira, 11 de junho · 5:00 – 5:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/hei-qyuu-wzw
- `2026-06-11 13:23` 👤 Obrigada
- `2026-06-11 13:23` 🤖 Imagina. Disponha.
- `2026-06-11 13:50` 🤖 Olá, 🌈 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 11/06/2026 17:00  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene.
- `2026-06-11 13:52` 👤 Confirmado
- `2026-06-11 13:52` 👤 Consulta on line
- `2026-06-11 13:53` 🤖 Certo! Consulta online
- `2026-06-11 19:00` 🤖 🌈, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-11 20:08` 🤖 Sonia! Me desculpe, o seu horário na verdade é as 17:30 hs. Creio que ocorreu um equivoco com o envio do link.
- `2026-06-11 20:08` 👤 Tudo bem
- `2026-06-11 20:08` 👤 Vc envia outro link ou é esse mesmo?
- `2026-06-11 20:08` 🤖 Pode ser este mesmo
- `2026-06-11 20:08` 👤 Ok
- `2026-06-11 20:40` 🤖 Sonia, o Dr. atrasou alguns minutos!
- `2026-06-11 20:41` 👤 Vc me avisa quando for para entrar?
- `2026-06-11 20:41` 🤖 Aviso sim
- `2026-06-11 20:42` 👤 Ok
- `2026-06-11 20:45` 🤖 Oi Sonia!
- `2026-06-11 20:45` 🤖 O Dr. está te aguardando no meet.
- `2026-06-11 20:55` 🤖 Sonia, caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr
- `2026-06-11 20:57` 🤖 O Dr. Ivan recomendou o tratamento de manutenção que são 10 infusões de Cetamina. O valor é R$ 8000,00 que pode ser parcelado em 8 vezes sem juros.
- `2026-06-11 20:57` 🤖 A primeira infusão já está agendada para o dia 15/06 as 15:00 hs.
- `2026-06-11 20:58` 🤖 segue o link do App da Clínica para que consiga *verificar suas prescrições* e fazer seus próprios agendamentos de consulta. *App IOS*: https://apps.apple.com/br/app/cl%C3%ADnica-%C3%B3r-psiquiatria/id6745094818 *App Android*: https://play.google.com/store/apps/details?id=br.com.clinicaorpsiquiatria.app  *WebApp*: https://orpsiquiatria.vsaudeapp.com.br/app Para acessar o App use seu e-mail de cadastro e a *senha: 010203*  As prescrições se encontram em *arquivos*.  Qualquer dúvida sigo a disposi
- `2026-06-11 20:59` 🤖 Segue o vídeo do passo a passo.
- `2026-06-11 20:59` 🤖 [Vídeo]
- `2026-06-11 21:54` 👤 Agendado! Na segunda faço o pagamento
- `2026-06-11 21:54` 🤖 Sem problemas!
- `2026-06-11 21:54` 🤖 Bom final de semana!
- `2026-06-11 21:55` 👤 Ótimo final de semana. Muito obrigada! Assim q chegar em casa faço a avaliação. Vcs sao impecáveis parabéns! 👏👏👏
- `2026-06-11 21:56` 🤖 Muito obrigada! Abraços
- `2026-06-11 21:56` 👤 *[imagem]*

</details>


### carmen silvia simoes — `5517991328804`

**Custom fields:** `{"mensagem": "Dados de pagamento fornecidos: PIX. Pedem envio do comprovante para finalizarmos agendamento.", "interesse": "Consulta com psiquiatria", "pagamento": 750, "observacoes": "Dados de pagamento fornecidos: PIX. Pedem envio do comprovante para finalizarmos agendamento.", "qualificacao": "interessado", "procedimentos": ["Primeira Consulta"], "nome_preferido": "Carmem", "tentou_pagamento": `

**Cenário:** `agendou_apos_pagamento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A lead Carmem demonstrou interesse em consulta psiquiátrica com o Dr. Ivan. A clínica enviou os dados de pagamento (R$ 750,00 via PIX), e a paciente efetuou o pagamento e enviou o comprovante. O agendamento foi realizado para o mesmo dia via Google Meet, porém houve um aviso de atraso por parte do médico, que foi aceito pela paciente.


**Gatilhos:** Consulta com Dr. Ivan Barenboim, Teleconsulta

<details><summary>Transcrição completa</summary>

- `2026-06-08 13:13` 🤖 Bom dia, Carmem. Tudo bem?
- `2026-06-08 13:13` 🤖 Sou Marisa da clínica Ór.
- `2026-06-08 13:13` 🤖 Você deseja agendar uma consulta com o Dr. Ivan Barenboim?
- `2026-06-10 19:34` 🤖 Boa tarde!
- `2026-06-10 19:34` 🤖 Marisa da Clinica Ór
- `2026-06-10 19:34` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-06-16 13:06` 👤 *[imagem]*
- `2026-06-16 13:12` 🤖 Olá Carmem. Segue o link para consulta.
- `2026-06-16 13:12` 🤖 Carmen Silvia Simões - Dr. Ivan Barenboim - 16/06/2026 Terça-feira, 16 de junho · 6:00 – 6:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/yrj-uobg-hrk
- `2026-06-16 20:57` 🤖 Boa tarde, senhora Carmen.
- `2026-06-16 20:57` 🤖 O Dr. Ivan vai atrasar alguns minutos.
- `2026-06-16 20:58` 👤 Que horas eu ligo?
- `2026-06-16 20:58` 🤖 Quando for para entrar no link, eu aviso a senhora ok?
- `2026-06-16 20:59` 👤 Ok.

</details>
