---
title: "Estudo: Consulta finalizada"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Consulta finalizada' do funil Agendamentos Novo (Clínica ÓR): 17 leads."
---

# Estudo: Consulta finalizada

**Coluna:** `Consulta finalizada` (posição 5) — **17 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é um paciente de alto valor, muitas vezes recorrente ou indicado por terceiros, que já superou a barreira do preço (ticket médio de R$ 750 por consulta). Ele possui um perfil pragmático: utiliza o WhatsApp principalmente para resolver questões logísticas (links de teleconsulta), financeiras (notas fiscais para reembolso) e administrativas (validação de receitas digitais). É um público que exige agilidade, pois muitas vezes entra em contato em momentos de urgência medicamentosa ou após falhas técnicas (assinaturas digitais inválidas), demonstrando alta confiança na autoridade técnica do Dr. Ivan, mas baixa tolerância a fricções burocráticas ou falhas de comunicação sobre horários.


### Procedimentos mais mencionados

- Consulta Psiquiátrica (Primeira e Seguimento)
- Infusão de Cetamina
- EMT (Estimulação Magnética Transcraniana) - Protocolo Stanford
- Hipnoterapia / TST (Terapia de Sistemas Transformadores)
- Emissão de Laudos e Documentação para Reembolso

### Profissionais mais mencionados

- Dr. Ivan Barenboim (majoritário)
- Dra. Romana (administrativo/clínico)
- Dra. Maísa (psicóloga/TST)

### Objeções mais comuns

- Dificuldade logística para tratamentos intensivos ( EMT/Cetamina exigem presença em SP por 20-30 dias).
- Complexidade burocrática e falta de documentos específicos no checklist de reembolso.
- Negativa de emissão de receita sem consulta de reavaliação (quando há hiato no tratamento).
- Conflito de horários comerciais com a agenda disponível da clínica.

### Gatilhos de entrada na coluna

- Finalização de consulta presencial ou teleconsulta.
- Solicitação de documentos para reembolso (NF/Relatórios).
- Necessidade urgente de renovação de receita para pacientes em seguimento.
- Confirmação de pagamento de sessões de EMT ou Cetamina.

## 2. Padrões observados (Top 10)

1. Forte dependência da figura do Dr. Ivan (autoridade central).
2. Uso frequente do reembolso como viabilizador financeiro (foco total em NF).
3. Leads que 'furam' o funil pedindo receita antes de agendar (tentativa de bypass).
4. Pacientes estrangeiros ou de fora de SP buscando tratamentos de ponta (EMT/Cetamina).
5. Aceitação de valores altos (R$ 750) mediante parcelamento ou garantia de NF.
6. Interesse em 'combos' terapêuticos (Cetamina + Terapia TST).
7. Pacientes de seguimento que reaparecem apenas na 'urgência' da medicação.
8. Comunicação híbrida (links de pagamento + comprovantes via chat).
9. Resiliência do paciente: mesmo com atrasos do médico, o lead aguarda a consulta.
10. Preferência por horários de borda (início da manhã ou após 18h).

## 3. Erros recorrentes do agente IA atual

- Spam de mensagens de confirmação (loops de automação).
- Mensagens motivacionais ou scripts 'hallucinados' desconexos do contexto clínico/administrativo.
- Ignorar restrições de agenda explicitadas pelo lead no texto.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Motivo de Adiantamento': Segmentar leads que adiaram tratamento para o futuro (ex: prova, viagem) para follow-up em datas específicas.
- Automação de NF: Vincular a conferência de dados da NF (nome do paciente vs. nome do titular do plano) no momento do fechamento da consulta.
- Régua de Relacionamento: Disparar lembrete de renovação de receita 5 meses após a última consulta para evitar pedidos de urgência sem agenda.

## 5. Recomendações para o agente de **atendimento**

- Validar proativamente a assinatura digital das receitas antes do envio para evitar retorno do paciente da farmácia.
- Informar sobre atrasos médicos assim que detectados, oferecendo nova previsão ou reagendamento imediato.
- Padronizar o checklist de reembolso: informar todos os documentos necessários (incluindo orçamentos de terceiros, se o plano exigir) no primeiro contato pós-consulta.
- Scripts de Handoff: Ao finalizar a consulta de psiquiatria, oferecer ativamente o agendamento com a Dra. Maísa para terapias complementares (cross-sell).

## 6. Alertas

- ⚠️ Falha técnica recorrente: Assinaturas digitais do Dr. Ivan apresentando erro em farmácias (mencionado como problema repetido por pacientes).
- ⚠️ Instabilidade em automações: Disparos de spam de lembretes (5 mensagens em 5 minutos) e confirmação de horários que o paciente explicitamente disse não poder comparecer.
- ⚠️ Gestão de Tempo: Relatos de atrasos significativos do médico (até 3 horas em teleconsultas) sem aviso prévio proativo.
- ⚠️ Identificação de Leads: Erros de preenchimento/atendimento chamando o paciente por nomes diferentes (ex: Leônidas/Gilberto/Gabriel na mesma conversa).

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Bruno Sella Eugenio | 5511994526788 | 27 | 0 | pos_venda_administrativo |
| 2 | Lead #8766732 | 5511995552175 | 0 | 0 |  |
| 3 | Leônidas José dos Santos | 5511962090166 | 41 | 0 | agendou_teleconsulta_emergencial |
| 4 | Lead #9262476 | 972528573234 | 0 | 0 |  |
| 5 | Soraia Nora Da Mirtes | 5511963699897 | 33 | 0 | suporte_pos_atendimento_receita |
| 6 | Victor Martelli | 5511999202572 | 28 | 1 | agendou_apos_solicitacao_receita |
| 7 | Andrea de Marco Natali | 5511976917585 | 1 | 0 |  |
| 8 | Bauman | 5511941485827 | 35 | 0 | reagendamento_e_oferta_complementar |
| 9 | Guilherme Pirri Moreira de Menezes | 5511982669839 | 0 | 0 |  |
| 10 | Vinícius Frenzel | 555199673969 | 0 | 0 |  |
| 11 | Dan Friedlander | 5511983180173 | 27 | 0 | agendou_recorrencia |
| 12 | Felipe Baracat | 5511996884004 | 19 | 9 | agendou_consulta_adiou_procedimento |
| 13 | Lady Law | 5511981085656 | 17 | 1 | admin_financeiro_receitas |
| 14 | Mitchell Andres Mora | 5511969826385 | 45 | 10 | agendou_apos_primeiro_contato |
| 15 | Gilberto Castilho | 5511967142642 | 16 | 0 | confirmacao_e_duvida_pagamento |
| 16 | 11994096788 | 5511994096788 | 31 | 0 | agendou_recorrente |
| 17 | Milene Campanholo Picasso | 555181332357 | 37 | 3 | agendou_apos_primeira_msg |

## 8. Conversas analisadas (transcrição + síntese)

_12 leads com conversa analisada._


### Bruno Sella Eugenio — `5511994526788`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2026-04-29T11:00:00-03:00", "teleconsulta": "Sim", "procedimentos": ["Primeira Consulta"]}`

**Cenário:** `pos_venda_administrativo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O lead já é paciente e estava em contato para organizar a documentação de reembolso (Dra. Romana). Ele questionou a necessidade de orçamentos de outras clínicas que não estavam no checklist inicial, mas aceitou a orientação. Após providenciar os documentos, solicitou a emissão de uma nota fiscal, que precisou ser reenviada após uma falha no recebimento inicial. A conversa terminou de forma positiva com a resolução das pendências administrativas.


**Objeções:** falta_de_informacao_checklist, dificuldade_com_documentacao_plano_saude

**Gatilhos:** reembolso_plano_saude, agilidade_documental

<details><summary>Transcrição completa</summary>

- `2026-06-02 21:21` 🤖 Oi Bruno. Tudo bem?
- `2026-06-02 21:22` 🤖 Conversei com a Dra. Romana, ela disse que está faltando você enviar os documentos abaixo relacionados:
- `2026-06-02 21:23` 🤖 Orçamentos  de outras clínicas e as três últimas mensalidades do plano pagas ou declaração de quitação
- `2026-06-02 21:23` 👤 As mensalidades só tem uma por que o meu eh empresarial. Já tinha mandado e falei isso para ela
- `2026-06-02 21:23` 👤 Os 3 orçamentos não estavam no checklist
- `2026-06-02 21:24` 👤 Terei que correr atrás
- `2026-06-02 21:24` 👤 Conhecem clínicas que eu possa fazer isso ?
- `2026-06-02 21:25` 🤖 Sim!
- `2026-06-02 21:26` 🤖 Psiquiatria Adiel Rios Clínica Livaz  Instituto de Infusões Paulista
- `2026-06-02 21:28` 👤 Vou correr atrás disso amanhã e assim que me derem eu mando pra Romana
- `2026-06-02 21:28` 🤖 Combinado!
- `2026-06-08 20:41` 👤 olá, tudo bem? mandei o que faltava a romana
- `2026-06-08 20:41` 👤 em tempo, consegue mandar a segunda nota desse mês?
- `2026-06-08 20:46` 🤖 Que bom!
- `2026-06-08 20:46` 🤖 Vamos providenciar a nota.
- `2026-06-08 20:46` 👤 Agradeço
- `2026-06-10 13:34` 👤 olá bom dia!
- `2026-06-10 13:34` 👤 conseguiram ver a questão da nota?
- `2026-06-10 13:37` 🤖 Olá bom dia Bruno, como vai? Referente a sua dúvida, a Nf foi emitida e encaminhada para o e-mail de cadastro. Seguimos a disposição.
- `2026-06-10 13:37` 👤 muito obrigado
- `2026-06-10 13:50` 👤 conseguem confirmar se mandaram mesmo?
- `2026-06-10 13:50` 👤 não recebi
- `2026-06-10 13:52` 🤖 Acabamos de reenviar.
- `2026-06-10 13:53` 👤 agora chegou
- `2026-06-10 13:53` 👤 muito obrigado
- `2026-06-10 14:01` 🤖 Disponha

</details>


### Leônidas José dos Santos — `5511962090166`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "data_horario": "2026-04-23T11:30:00-03:00", "teleconsulta": "Não", "procedimentos": ["Primeira Consulta"]}`

**Cenário:** `agendou_teleconsulta_emergencial` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** O paciente (identificado erroneamente como Gilberto/Gabriel na conversa) confirmou uma consulta inicial e posteriormente solicitou uma encaixe de urgência para teleconsulta no mesmo dia. Questionou sobre o tempo de duração da consulta e solicitou envio de receita por motoboy (negado pela clínica). O agendamento foi realizado via link de pagamento (cartão de crédito à vista) após confirmação de envio de nota fiscal. Houve um pequeno atraso do médico no acesso ao Google Meet, mas a consulta foi realizada.


**Objeções:** Solicitação de motoboy para receita (negado), Atraso do médico no link da consulta

**Gatilhos:** Rapidez no atendimento, Teleconsulta, Parcelamento sem juros, Nota fiscal para reembolso

**Erros do bot:** Confusão de nomes (atendente chama o cliente de Gilberto e depois de Gabriel, enquanto o cadastro inicial diz Leônidas)

<details><summary>Transcrição completa</summary>

- `2026-05-13 11:46` 🤖 Bom dia! Podemos confirmar a consulta do Sr. Gilberto as 11:30 hs com o Dr. Ivan?
- `2026-05-13 11:50` 👤 Sim, pode
- `2026-05-13 11:51` 🤖 Muito obrigada!
- `2026-05-13 14:25` 👤 oi
- `2026-05-13 14:25` 👤 uma duvida
- `2026-05-13 14:26` 👤 para uma primeira consulta, qt tempo é de consulta?
- `2026-05-13 14:26` 🤖 Bom dia!
- `2026-05-13 14:26` 🤖 O Dr. reserva uma hora para a primeira consulta.
- `2026-05-13 14:27` 👤 ok
- `2026-05-13 14:27` 👤 obg
- `2026-05-28 19:28` 🤖 Olá boa tarde Gabriel,  sua receita estará disponível  para retirada hoje na portaria a partir das 18h.  *O prazo para retirar são 7 dias úteis.*
- `2026-05-28 19:53` 👤 oi
- `2026-05-28 19:54` 👤 consegue me mandar um motoboy
- `2026-05-28 19:54` 🤖 Oi! Não temos este serviço
- `2026-05-29 10:36` 👤 Oi
- `2026-05-29 10:36` 👤 Consigo uma consulta rápida com o dr hj?
- `2026-05-29 10:37` 👤 Pode ser online
- `2026-05-29 11:18` 🤖 Bom dia. Tudo Bem?
- `2026-05-29 11:19` 🤖 Temos horário as 12:30 hs. Você tem disponibilidade?
- `2026-05-29 11:21` 👤 Bom dia
- `2026-05-29 11:21` 👤 Tenho sim
- `2026-05-29 11:22` 🤖 Certo. As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-29 11:25` 👤 No crédito
- `2026-05-29 11:25` 👤 A nota fiscal vcs mandam hj?
- `2026-05-29 11:26` 🤖 Voce deseja credito a vista ou parcelado? Parcelamos em até 3 vezes sem juros.
- `2026-05-29 11:26` 🤖 A nota fiscal é enviada entre hoje e segunda feira. Tudo bem?
- `2026-05-29 11:31` 👤 Logico
- `2026-05-29 11:31` 👤 A vista
- `2026-05-29 11:33` 🤖 https://pay.sumup.com/b2c/XFK8BPXPZJ
- `2026-05-29 11:34` 🤖 Por favor, nos envie o comprovante de pagamento para finalizarmos o agendamento.
- `2026-05-29 11:40` 👤 *[imagem]*
- `2026-05-29 11:44` 🤖 Muito obrigada Gabriel!
- `2026-05-29 11:44` 🤖 Segue link para a consulta
- `2026-05-29 11:45` 🤖 Gabriel Meira Castilho - Dr. Ivan Barenboim - 29/05/2026 Sexta-feira, 29 de maio · 12:30 – 1:00pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/bkn-nccc-fth
- `2026-05-29 15:33` 👤 Oi
- `2026-05-29 15:34` 👤 Entrei no link mas p dr nao entrou
- `2026-05-29 15:35` 👤 Oi
- `2026-05-29 15:36` 🤖 Dr esta finalizando um atendimento disse que já entra na sala do meet
- `2026-05-29 15:37` 👤 Ta bom
- `2026-05-29 15:37` 👤 Sem problemas
- `2026-06-08 12:23` 🤖 Olá Gabriel. Para podermos aprimorar o nosso atendimento, precisamos muito do seu feedback! Agradecemos desde já! https://forms.gle/Jn1RnyEmc17whxeSA

</details>


### Soraia Nora Da Mirtes — `5511963699897`

**Custom fields:** `{"interesse": "Consulta com psiquiatria", "data_horario": "2026-01-28T10:30:00-03:00", "teleconsulta": "Sim", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `suporte_pos_atendimento_receita` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** A paciente entrou em contato em caráter de urgência, pois estava na farmácia e não conseguia comprar os medicamentos devido a um erro na assinatura digital da receita enviada pelo Dr. Ivan. Relatou que o problema já havia ocorrido no mês anterior. O atendimento intermediou o contato com o médico, que emitiu uma nova via. No dia seguinte, a clínica confirmou os dados de contato para uma futura teleconsulta da Sra. Mirtes.


**Objeções:** problema técnico com assinatura digital da receita

**Gatilhos:** resolução de problema com receita, agilidade no atendimento

<details><summary>Transcrição completa</summary>

- `2026-05-12 17:41` 👤 Fernanda.pdf
- `2026-05-12 17:42` 👤 Boa tarde meninas!  Preciso de um favor .  Enviei a receita acima para o Dr. Ivan, pois ele não validou (assinou) a receita. Não consigo comprar os remédios da minha filha
- `2026-05-12 17:42` 👤 Estou na farmácia
- `2026-05-12 17:44` 🤖 Oi Soraia! Como vai? Desculpe, mas a assinatura é digital.
- `2026-05-12 17:44` 👤 Sim. Eu sei
- `2026-05-12 17:44` 🤖 *[imagem]*
- `2026-05-12 17:45` 👤 Mês passado aconteceu a mesma coisa
- `2026-05-12 17:46` 🤖 Deve estar ocorrendo algum problema com a farmácia. Você tentou em outra farmácia?
- `2026-05-12 17:46` 👤 Sim
- `2026-05-12 17:46` 🤖 Da mesma rede?
- `2026-05-12 17:46` 👤 Mês passado fomos em 3 farmácias
- `2026-05-12 17:46` 👤 Não
- `2026-05-12 17:47` 🤖 Não entendo! Não estamos com problemas no sistema.
- `2026-05-12 17:47` 👤 Daí o sem Ivan teve que fazer outra receita🙄😩😩😩😩😩
- `2026-05-12 17:48` 🤖 ok, vou pedir outra receita para ele.
- `2026-05-12 17:48` 👤 Vc acha que consegue agora?
- `2026-05-12 17:48` 👤 Estou na farmácia
- `2026-05-12 17:49` 🤖 Vou tentar, já te falo.
- `2026-05-12 18:00` 🤖 Oi. O Dr, informou que já te respondeu.
- `2026-05-12 18:00` 🤖 Tudo certo?
- `2026-05-12 18:00` 👤 Sim. Vou tentar com essa nova receita. Obrigada
- `2026-05-12 18:00` 🤖 Disponha!
- `2026-05-13 14:50` 🤖 Olá bom dia Soraia, como vai? Poderia por gentileza nos confirmar o contato da Sra Mirtes para a teleconsulta via WhatsApp.
- `2026-05-13 15:03` 👤 Bom dia! Fora a fibromialgia, estou bem
- `2026-05-13 15:04` 👤 Mirtes Moraes Martins da Silva Lima 👆🏻
- `2026-05-13 15:31` 🤖 Muito obrigada
- `2026-05-13 15:32` 👤 Eu que agradeço!

</details>


### Victor Martelli — `5511999202572`

**Custom fields:** `{"origem": "Google - Orgânico", "interesse": "Consulta com psiquiatria", "pagamento": "750", "data_horario": "2025-11-18T17:00:00-03:00", "teleconsulta": "false", "procedimentos": ["Consulta de seguimento"]}`

**Cenário:** `agendou_apos_solicitacao_receita` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Victor entrou em contato para agendar uma consulta de retorno para Iza Rocche, solicitando urgência no envio de uma receita (Exodus). A clínica agendou para o dia seguinte com o Dr. Ivan e explicou corretamente que a receita dependia da reavaliação médica por conta do tempo desde a última consulta (Janeiro). O lead aceitou, confirmou o horário presencial e realizou o pagamento via PIX (R$ 750,00) após o comparecimento.


**Objeções:** Precisa de receita imediata antes da consulta

**Gatilhos:** Urgência com medicação (Exodus 20mg), Agendamento rápido para retorno

<details><summary>Transcrição completa</summary>

- `2026-05-20 15:01` 👤 Olá, bom dia
- `2026-05-20 15:01` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-20 15:06` 🤖 Bom dia, Victor! Tudo bem?
- `2026-05-20 15:06` 🤖 Como posso ajudar?
- `2026-05-20 15:07` 👤 Tudo otimo, preciso marcar uma consulta para a Iza, e o remedio dela acabou, vc consegue uma receita para comprar hoje?
- `2026-05-20 15:09` 🤖 Por favor, qual o nome completo dela?
- `2026-05-20 15:09` 👤 Iza Rocche
- `2026-05-20 15:10` 🤖 Temos horário com o Dr. Ivan amanhã as 11:30 hs. Ela tem disponibilidade?
- `2026-05-20 15:19` 👤 Vou perguntar
- `2026-05-20 15:47` 👤 Pode agendar
- `2026-05-20 16:03` 🤖 Agendado para amanhã as 11h30. Seguimos a disposição.
- `2026-05-20 16:04` 👤 Consegue enviar uma receita para ela nao ficar sem o remedio hoje
- `2026-05-20 16:05` 👤 Exodus 20mg que ela toma
- `2026-05-20 16:08` 🤖 **[ÁUDIO]** Olá, boa tarde, tudo bem? Edilene, aqui da clínica OR. Então, referente à sua solicitação de medicação, a gente pode sim enviar pro doutor, porém, como já faz um tempinho desde a última consulta da Isa, que foi em janeiro, seria necessário reavaliar o caso, né, o doutor verificar se essa é a dosagem adequada para ela. Por isso que pode ser que o doutor, ele mantenha a consulta pra amanhã, tá? E mesmo que a prescrição, ela não seja feita por conta dessa questão de ter que reavaliar o caso todas as vezes que, depois de um tempo que o paciente não passa em consulta, tá bom? Mas a gente vai solicitar sim.
- `2026-05-20 16:10` 👤 Ok
- `2026-05-20 16:16` 🤖 A consulta será presencial?
- `2026-05-20 16:16` 👤 Sim
- `2026-05-20 16:16` 🤖 ok obrigada
- `2026-05-21 12:56` 🤖 Bom dia! Podemos confirmar a consulta presencial  da Iza hoje com o Dr. Ivan as 11:30 hs?
- `2026-05-21 13:05` 👤 Pode comfirmar
- `2026-05-21 13:07` 🤖 Muito obrigada!
- `2026-05-21 14:34` 🤖 Olá! Voce sabe me dizer se a Iza está a caminho?
- `2026-05-21 14:35` 👤 Mais 5 minutos
- `2026-05-21 14:35` 👤 Esta chegando
- `2026-05-21 14:36` 🤖 Muito obrigada!
- `2026-05-21 15:09` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-21 15:11` 👤 *[imagem]*
- `2026-05-21 15:11` 🤖 Muito obrigada!

</details>


### Bauman — `5511941485827`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "pagamento": "750", "data_horario": "2026-04-22T12:30:00-03:00", "teleconsulta": "Não", "procedimentos": ["Retorno"]}`

**Cenário:** `reagendamento_e_oferta_complementar` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead Josef (Bauman) já é paciente em tratamento (Cetamina com Dr. Ivan). A conversa foca em ajustes de horário por atrasos e reagendamentos. A clínica aproveitou para ofertar terapia complementar (TST/Hipnoterapia) com a Dra. Maísa. O lead realizou o pagamento de R$ 750 (referente ao Dr. Ivan), mas declinou o horário imediato para a psicóloga, prometendo verificar agenda para a semana seguinte.


**Objeções:** conflito de agenda

**Gatilhos:** Infusão de Cetamina, Hipnoterapia, EMDR, TST

<details><summary>Transcrição completa</summary>

- `2026-05-13 13:40` 🤖 Olá bom dia Josef, como vai? O Dr Ivan conseguirá te atender as 12h30, podemos reagendar?
- `2026-05-13 13:41` 👤 Perfeito!
- `2026-05-13 13:41` 👤 Obrigado!
- `2026-05-13 13:43` 🤖 Certo, reagendado.
- `2026-05-13 15:33` 👤 Oi, tudo bem? Estou no transito, mas chego em 10 minutos, ok?
- `2026-05-13 15:40` 🤖 Obrigada por sinalizar
- `2026-05-13 16:42` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento.
- `2026-05-13 17:54` 👤 *[imagem]*
- `2026-05-13 17:54` 👤 Obrigado
- `2026-05-13 17:55` 🤖 Muito obrigada!
- `2026-06-09 14:30` 👤 Oi, tudo bem? Tenho uma consulta com o Dr. Ivan agora as 11h30. Só pra avisar que vou atrasar 10 mins, ta bom? Obrigado!
- `2026-06-09 14:30` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-09 14:33` 🤖 Bom dia, Josef!
- `2026-06-09 14:33` 🤖 Obrigada por sinalizar
- `2026-06-09 15:27` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-06-09 15:27` 👤 Obrigado!
- `2026-06-09 15:28` 🤖 Hipnoterapia/EMDR/TST
- `2026-06-09 15:28` 🤖 O que é a hipnoterapia/TST( terapia de superação de traumas)?
- `2026-06-09 15:28` 🤖 A terapia de superação de traumas( TST) consiste em utilizar técnicas como hipnose e EMDR que são comprovadamente eficazes para a neutralização do efeito dos traumas psicológicos no subconsciente do indivíduo.
- `2026-06-09 15:28` 🤖 Dessa forma, muitas vezes,  é possível quebrar padrões emocionais, cognitivos e comportamentais arraigados rapidamente.
- `2026-06-09 15:29` 🤖 Como funciona a hipnoterapia/TST?
- `2026-06-09 15:29` 🤖 A TST ou Terapia de Superação de Traumas é um processo terapêutico que envolve hipnoterapia, EMDR e outras técnicas que visam a diminuir ou neutralizar o efeito dos traumas sobre o funcionamento do indivíduo.  Primeiro, você faz uma sessão inicial de avaliação com a nossa psicóloga. Ao final da mesma, ela vai propor um protocolo de tratamento com o número mínimo de sessões estimado para obtenção de bons resultados. Normalmente, entre 6 e 12 sessões.
- `2026-06-09 15:30` 🤖 Valor da Sessão com a Dra. Maísa R$ 600,00
- `2026-06-09 15:30` 🤖 Temos horário as 10:00 hs.
- `2026-06-10 17:31` 🤖 Oi Josef. Tudo bem?
- `2026-06-10 17:31` 🤖 Você tem disponibilidade para amanhã?
- `2026-06-10 17:32` 🤖 Quanto ao pagamento da consulta, você conseguiu realizar?
- `2026-06-10 21:37` 👤 Oi tudo bem? Desculpe a demora! Segue o comprovante
- `2026-06-10 21:37` 👤 *[imagem]*
- `2026-06-10 21:39` 🤖 Muito obrigada!
- `2026-06-10 22:38` 👤 Infelizmente amanhã não vou conseguir, mas vou ver a agenda pra semana que vem e mando uma mensagem aqui
- `2026-06-10 22:39` 👤 Super obrigado!
- `2026-06-10 22:39` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-11 10:56` 🤖 Olá bom dia Josef, como vai? Agradecemos o retorno.

</details>


### Dan Friedlander — `5511983180173`

**Custom fields:** `{"origem": "Indicação de paciente", "interesse": "Consulta com psiquiatria", "data_horario": "2024-06-08T18:00:00-03:00", "teleconsulta": "false", "procedimentos": "[\"Primeira Consulta\"]"}`

**Cenário:** `agendou_recorrencia` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O paciente Dan Friedlander solicitou o que inicialmente chamou de retorno com o Dr. Ivan. Foi informado que o profissional não trabalha com retornos, sendo necessária uma nova consulta, o que foi aceito. Após ajustes de agenda para encontrar um horário mais tardio (18:00), a consulta foi agendada para o dia 08/06 de forma presencial. O paciente confirmou presença no dia do atendimento.


**Objeções:** indisponibilidade de horário inicial

**Gatilhos:** preferência por horário tardio, atendimento presencial

<details><summary>Transcrição completa</summary>

- `2026-05-25 13:55` 👤 Bom dia, preciso marcar o retorno no dr ivan
- `2026-05-25 13:55` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-25 13:55` 👤 comoe sta agenda semana q vem?
- `2026-05-25 15:19` 🤖 Boa tarde, Dan. Tudo bem?
- `2026-05-25 15:19` 🤖 Pode ser dia 05/06 as 11:30 hs?
- `2026-05-25 15:20` 🤖 Lembramos que o Dr. Ivan não trabalha com retorno, então seria uma nova consulta. Tudo bem?
- `2026-05-25 15:24` 👤 não consigo
- `2026-05-25 15:24` 👤 pode ser na semana seguinte
- `2026-05-25 15:24` 👤 do dia 8
- `2026-05-25 15:25` 🤖 Pode ser dia 08 as 17:00 hs?
- `2026-05-25 15:27` 👤 teria mais tarde? se possivle ltimo horario?
- `2026-05-25 15:28` 👤 se nao 17h ok
- `2026-05-25 15:29` 🤖 Pode ser as 18:00 hs?
- `2026-05-25 15:31` 🤖 A consulta será presencial ou online?
- `2026-05-25 15:34` 👤 Sim. Presencialmpor fabor
- `2026-05-25 15:34` 👤 Mas pode ser online
- `2026-05-25 15:34` 👤 O q o Dr ivan preferir na verdade
- `2026-05-25 15:35` 🤖 Certo! No caso a preferencia é sua! rs
- `2026-05-25 15:35` 👤 Presencial. Mas se ele quiser mudar sem problemas.
- `2026-05-25 15:35` 🤖 Combinado!
- `2026-05-25 15:36` 🤖 Consulta presencial agenda para o dia 08/06 as 18:00 hs.
- `2026-06-08 17:25` 🤖 Boa tarde, Dan. Tudo bem?
- `2026-06-08 17:25` 🤖 Podemos confirmar sua consulta hoje as 18:00 hs com o Dr. Ivan?
- `2026-06-08 17:30` 👤 Sim
- `2026-06-08 19:04` 🤖 Muito obrigada!

</details>


### Felipe Baracat — `5511996884004`

**Custom fields:** `{"pagamento": "750", "data_horario": "2026-05-08T12:30:00-03:00", "teleconsulta": "true"}`

**Cenário:** `agendou_consulta_adiou_procedimento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Felipe agendou e realizou a teleconsulta (R$ 750) com o Dr. Ivan, demonstrando forte interesse no tratamento (Cetamina + EMT). Houve uma negociação extensa sobre como emitir a nota fiscal para otimizar o reembolso pelo plano de saúde. Após a consulta, o lead decidiu adiar o início do tratamento para julho/2026 devido a uma prova importante e à impossibilidade logística de permanecer em SP agora. Solicitou a nota da consulta avulsa para reembolso imediato.


**Objeções:** Logística (precisaria passar 20-30 dias em SP), Conflito de rotina (prova importante no momento), Complexidade burocrática de reembolso

**Gatilhos:** Confiança no médico (Dr. Ivan), Necessidade de reembolso pelo plano de saúde, Tratamento com Cetamina e Estimulação Magnética Transcraniana (EMT)

**Erros do bot:** O bot enviou uma mensagem motivacional desconexa do contexto (hallucination ou script errado) às 20:38:21 após dúvida complexa sobre notas fiscais.

<details><summary>Transcrição completa</summary>

- `2026-05-06 20:33` 🤖 **[ÁUDIO]** Oi, Felipe, muito obrigada pelas informações. Deixa eu te explicar uma coisa: toda consulta que é online, o pagamento é feito antecipado. Aí você fechando o pacote, a gente desconta o valor da consulta, tá bom? Para que você não precise pagá-la. Então você vai pagar a consulta antecipadamente e, se você fechar o pacote, esse valor vai ser descontado.
- `2026-05-06 20:33` 🤖 **[ÁUDIO]** Qual a forma de pagamento que você prefere? Pode ser Pix ou no cartão de crédito parcelado em até três vezes.
- `2026-05-06 20:37` 👤 **[ÁUDIO]** É, não... tudo bem, Marilsa, eu pago. Mas deixa eu te falar: para mim é meio complicado vocês fazerem isso, porque olha só: se você desconta a consulta do meu... pacote lá do reembolso, você vai emitir nota do valor total ou você vai descontar? Porque aí o meu plano tinha aprovado o reembolso. Então, aí a consulta... tipo assim, não tenho problema de eu fazer o pagamento agora, eu faço um Pix agora para vocês. 

A minha questão só é essa que você falou de vocês descontarem isso do restante que eu tenho que pagar. Aí fica ruim porque aí sai do meu bolso e o plano que já aprovou o protocolo para mim, ele vai pagar o valor... menos 750 (reais), e aí eu não vou conseguir ter o reembolso da consulta. Ou então quando vocês forem me dar a nota, vocês vão me dar a nota do valor total? Certo? Vocês vão descontar no sentido de eu pagar o valor total menos 750, só que quando vocês me derem a nota, vocês vão me dar incluindo esses 750, sem mencionar que eu já tinha pago antes e etc., né? Porque senão o meu plano não reembolsa. Ou então eu teria que fazer consulta normal e aí pedir reembolso fora do tratamento, mas aí também o meu plano não reembolsa o valor total da consulta. Eles abaixaram o valor do reembolso de consulta, agora acho que está 450 só.

Mas enfim, é isso: eu faço o Pix agora para vocês, vocês me passam o Pix, não tem problema nenhum. Eu só estou perguntando como é que a gente faz depois, quando eu pagar o restante, você emite uma nota só sem mencionar que eu já tinha pago 750 a título de adiantamento de consulta? Certo? Você vai me dar uma nota só, dizendo que é... como é que fala... cetamina e o MT, pode ser?
- `2026-05-06 20:38` 🤖 **[ÁUDIO]** A prática leva à perfeição. É difícil chegar em algum lugar sem consistência e sem esforço, então, por isso, pratique todos os dias.
- `2026-05-06 20:40` 🤖 **[ÁUDIO]** Pode, pode sim. Tem nenhum problema, a gente emite uma nota só o valor total da acetamina. Tem problema não.
- `2026-05-06 20:40` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-06 20:42` 👤 **[ÁUDIO]** Bom, beleza. Eu vou fazer o Pix e aí depois a gente vê com calma como é que fica isso quando eu for fazer o pagamento do... do tratamento, porque inclusive eu acho que o plano vai fazer o pagamento do tratamento direto pra vocês. Mas aí eu explico que eu já tinha adiantado R$ 750,00, peço pra eles pagarem — sei lá, se for... acho que você tinha falado R$ 14.000,00. Vamos arredondar 14. Aí eles mandam R$ 13.250,00 pra vocês e R$ 750,00 pra mim. Mas aí isso a gente resolve depois. É, eu vou te mandar o Pix agora, só por favor não emite nota nem nada ainda disso, que aí depois a gente vê com calma a melhor forma de emitir isso. Pode ser? Muito obrigado, viu!
- `2026-05-06 20:42` 👤 Comprovante_06-05-2026_174240.pdf
- `2026-05-06 20:42` 🤖 Combinado!
- `2026-05-06 20:43` 🤖 Nós que agradecemos!
- `2026-05-06 20:43` 🤖 Consulta online agendada para o dia 08/05 as 12:30 hs.
- `2026-05-06 20:43` 🤖 Enviaremos o link do dia da consulta
- `2026-05-06 20:44` 🤖 A plataforma utilizada é o Google Meet.
- `2026-05-06 20:45` 👤 Fechado! Obrigado
- `2026-05-11 20:45` 👤 **[ÁUDIO]** Oi, boa tarde. É Marisa, né? Ô Marisa, eu preciso te pedir um favor. Eu não vou fazer o tratamento agora, porque eu não quero ir para São Paulo. Conversei bastante com a minha terapeuta e com a minha mãe. É, gostei muito do Dr. Ivan. Achei ele um cara bacana, conversamos e ele me explicou o que eu precisava saber. É, senti muita confiança e muita firmeza. E então eu vou fazer o tratamento, só que eu não vou fazer agora porque é o seguinte: eu mudar para São Paulo, mudar não, né, mas passar 20, 30 dias agora em São Paulo, vai virar minha cabeça de ponta- cabeça, vai mais me atrapalhar do que me ajudar. Então, é, eu não vou fazer o tratamento agora em maio, junho. Vou deixar para fazer em julho. Então, eu preciso de um favor: eu preciso da nota daquela consulta que eu paguei como consulta mesmo, é, porque eu vou... Como se eu tivesse feito uma consulta sem fazer o tratamento mesmo, né? Porque eu vou pedir reembolso para o meu plano desta consulta avulsa e aí mais pra frente, quando eu for fazer o tratamento, aí você nem vai descontar ela porque já vai ter passado um tempo, você cobra o tratamento inteiro. Pode ser?
- `2026-05-11 20:47` 🤖 **[ÁUDIO]** Olá, Felipe, boa tarde, tudo bem? É a Marisa mesmo. Não tem problema nenhum não, Felipe. Amanhã nós enviaremos a nota para você, tá bom? Ela é enviada no endereço de e-mail que você nos informou quando você fez o cadastro. Qualquer dúvida estamos à disposição. Se você quiser deixar agendado pro mês de junho, fique à vontade. Se você quiser esperar, não tem problema nenhum também. Tá bom? Um abraço, uma boa semana.
- `2026-05-11 20:52` 👤 **[ÁUDIO]** Oi Marisa, muito obrigado. Não, eu prefiro não deixar agendado, porque eu prefiro ver assim mais perto. Porque aí agora o foco no que eu tenho que fazer agora, que é essa prova, já aceitei que eu não vou conseguir fazer o tratamento agora. Paciência, já fiquei superfustrado, porque eu queria fazer, mas acabei tendo que decidir não fazer, né, por essa questão da rotina e tal. Mas aí passando a prova eu entro em contato com vocês e a gente já deixa tudo certinho, agenda, vê as datas. Tá bom? Muito obrigado.
- `2026-05-11 20:53` 🤖 Fique tranquilo!
- `2026-05-11 20:53` 🤖 Obrigada!

</details>


### Lady Law — `5511981085656`

**Custom fields:** `{"mensagem": "Cliente solicitou uma terceira nota no nome de Carmencita Assumpção Carneiro, CPF: 177866358-31."}`

**Cenário:** `admin_financeiro_receitas` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A paciente Marcela (Lady Law) enviou comprovante de pagamento e solicitou a emissão de uma terceira nota fiscal, referente à diferença de valores para fins de reembolso, em nome de sua mãe. Além das questões financeiras, a clínica informou sobre a disponibilidade de uma receita física para retirada na portaria e orientou o uso do novo aplicativo da clínica para acesso a prescrições e agendamentos. A interação foi puramente administrativa e de manutenção do tratamento.


**Gatilhos:** facilidade no reembolso, emissão de nota fiscal para terceiros, retirada de receita em portaria

<details><summary>Transcrição completa</summary>

- `2026-05-07 14:06` 👤 *[imagem]*
- `2026-05-07 14:43` 🤖 Bom dia Marcela.Tudo bem?
- `2026-05-07 14:43` 🤖 Obrigada pelo comprovante
- `2026-05-07 14:45` 🤖 **[ÁUDIO]** Oi, Marcela, tudo bem? Marcela, eu vi que você fez o valor de R$ 750, né? Mas você havia discriminado pra nós os valores referentes aos reembolsos. Você deseja que faça uma terceira nota no valor da diferença? Aguardo seu retorno, tá bom? Muito obrigada.
- `2026-05-14 16:55` 🤖 Olá Marcela, boa tarde. Estamos no aguardo referente aos valores para emissão das notas. Por gentileza assim que possível nos retorne. Seguimos a disposição.
- `2026-05-18 12:15` 👤 Se puder fazer uma terceira nota da diferença seria PERFEITO!!
- `2026-05-18 12:16` 👤 Pode ser no nome da minha mãe?!  Carmencita Assumpção Carneiro  CPF: 177866358-31
- `2026-05-18 12:17` 🤖 Certo, agradecemos o retorno.
- `2026-05-28 19:23` 🤖 Olá boa tarde Marcela,  sua receita estará disponível  para retirada hoje na portaria a partir das 18h.  *O prazo para retirar são 7 dias úteis.*
- `2026-05-28 20:10` 👤 Perfeito!!! Muito obrigada!!!
- `2026-05-28 20:10` 👤 Posso pedir pra retirarem amanhã de manhã?
- `2026-05-28 20:50` 🤖 Sim. Aportaria funciona 24 horas.
- `2026-06-01 20:25` 🤖 Boa tarde, Marcella!
- `2026-06-01 20:26` 🤖 segue o link do App da Clínica para que consiga *verificar suas prescrições* e fazer seus próprios agendamentos de consulta. *App IOS*: https://apps.apple.com/br/app/cl%C3%ADnica-%C3%B3r-psiquiatria/id6745094818 *App Android*: https://play.google.com/store/apps/details?id=br.com.clinicaorpsiquiatria.app  *WebApp*: https://orpsiquiatria.vsaudeapp.com.br/app Para acessar o App use seu e-mail de cadastro e a *senha: 010203*  As prescrições se encontram em *arquivos*.  Qualquer dúvida sigo a disposi
- `2026-06-01 20:26` 🤖 Segue o vídeo do passo a passo.
- `2026-06-01 20:26` 🤖 [Vídeo]

</details>


### Mitchell Andres Mora — `5511969826385`

**Custom fields:** `{"origem": "Google - Orgânico", "mensagem": "Mitchell provided full personal details for registration and confirmed understanding of consultation logistics.", "interesse": "EMT", "data_horario": "2026-05-14T12:00:00-03:00", "teleconsulta": "true", "link_consulta": "https://meet.google.com/irk-efsk-qiy"}`

**Cenário:** `agendou_apos_primeiro_contato` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** O lead (Mitchell Andres) buscou informações sobre EMT para TDAH, depressão, ansiedade e TEA. A atendente explicou o protocolo (40 sessões), valores (R$ 250/sessão) e benefícios (pacote com cortesia de avaliação). O lead optou por uma teleconsulta de avaliação inicial antes de decidir pelo tratamento completo. A consulta foi agendada e realizada em 14/05 via Google Meet após pagamento por cartão de crédito. Atualmente, a clínica tenta converter o início do tratamento.


**Objeções:** Necessidade de avaliação prévia à contratação de sessões

**Gatilhos:** Equipamentos modernos, Experiência do profissional (15 anos), Protocolo Stanford, Preço acessível/Custo-benefício, Cortesia na avaliação para quem fecha o pacote, Nota fiscal para reembolso

<details><summary>Transcrição completa</summary>

- `2026-05-11 19:33` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-11 19:34` 👤 Oi sou o Andres. Tenho interesse em saber mais sobre o tratamento com Estimulação Magnética Transcraniana. Estou buscando opções para o manejo de TDAH, depressão, ansiedade e possível TEA (espectro autista). Gostaria de entender melhor como funciona o processo de avaliação, quais condições vocês tratam com a EMT e os valores das sessões.
- `2026-05-11 19:34` 🤖 **[ÁUDIO]** Olá, boa tarde, tudo bem? Andres que se fala o seu nome? Não sei se estou pronunciando direito. Eu sou a Marisa da clínica Oro, vou te explicar como funciona.
- `2026-05-11 19:35` 🤖 **[ÁUDIO]** A estimulação magnética transcraniana da Clínica Ora tem uns equipamentos mais modernos do mercado. Nós temos experiências de mais de 10 anos, o médico responsável Dr. Ivan Baremboim que possui mais de 15 anos de experiência, bem focado na área de depressão, então realmente é uma pessoa que vai poder te ajudar bastante em relação à depressão, à ansiedade. O tratamento é bem eficaz nesse, nesses casos.
- `2026-05-11 19:35` 🤖 **[ÁUDIO]** O interessante seria realmente você passar por uma consulta de avaliação. Nessa consulta, ele vai verificar a situação, como pode te ajudar e, junto com você, ver o melhor caminho: se realmente é EMT ou qualquer outro tratamento que nós temos aqui na clínica.
- `2026-05-11 19:36` 🤖 **[ÁUDIO]** Para o tratamento de estimulação magnética transcraniana, normalmente o doutor prescreve 40 sessões em 20 dias, duas por dia, com intervalo de pelo menos uma hora. A sessão leva 15 minutos.
- `2026-05-11 19:36` 🤖 **[ÁUDIO]** Cada sessão de EMDR tem o valor de R$ 250, o pacote você pode fazer em até seis vezes sem juros, e nós emitimos nota para reembolso também.
- `2026-05-11 19:36` 🤖 **[ÁUDIO]** Está incluso também no pacote uma consulta de retorno com o Doutor Ivan. Caso você venha fazer o pacote conosco, você também tem como cortesia a consulta inicial.
- `2026-05-11 19:37` 🤖 **[ÁUDIO]** Então o ideal realmente seria você agendar uma consulta com o Dr. Ivan, verificar se o seu caso é indicado para iniciar o tratamento.
- `2026-05-11 19:37` 🤖 **[ÁUDIO]** Nós temos agenda com o Doutor Ivan agora na quinta-feira, dia 14. Você tem disponibilidade?
- `2026-05-11 19:37` 🤖 **[ÁUDIO]** Vou te mandar aqui mais informações sobre o tratamento, tá bom?
- `2026-05-11 19:38` 🤖 Apesar de utilizarmos equipamento de última geração e protocolos inovadores extremamente eficazes, nosso preço é o mais baixo da cidade, pois acreditamos que esse avanço no tratamento da depressão tem que ser cada vez mais acessível aos que dele necessitam
- `2026-05-11 19:39` 🤖 EMT   O que é EMT?   Estudos apontam que a Estimulação Magnética Transcraniana é uma alternativa de tratamento comprovadamente eficaz, segura e bem tolerada para a Depressão Maior e para o Transtorno de Ansiedade Generalizada.  Consiste em usar um equipamento capaz de emitir um campo magnético para estimular uma área do cérebro de forma não invasiva. Então, esta tecnologia permite a modulação de circuitos cerebrais profundos disfuncionais na depressão por meio do estímulo de uma área específica 
- `2026-05-11 19:39` 🤖 Como funciona o tto com EMT   Funciona da seguinte forma:  Primeiramente, você deve passar em consulta com o Dr. Ivan que, além de fazer uma avaliação do seu quadro em geral, vai poder confirmar se você realmente tem indicação de fazer este tratamento bem como tirar as suas dúvidas sobre o mesmo.
- `2026-05-11 19:40` 🤖 Confirmada a indicação, será feita uma sessão de parametrização para que sejam definidos, de maneira personalizada, tanto o alvo quanto a intensidade da estimulação. Em seguida, serão iniciadas as sessões do tratamento propriamente dito.
- `2026-05-11 19:40` 🤖 Utilizamos um protocolo avançado de neuromodulação baseado em estudos de ponta da Universidade Stanford nos EUA.  Esse protocolo permite que, em pouco tempo,  façamos uma quantidade de estímulos muito maior do que se costuma fazer em um protocolo tradicional de EMT. Dessa forma, aumentamos bastante a chance de sucesso do tratamento.   Sei que é bastante informação. Mas, ficou claro até aqui?
- `2026-05-11 19:41` 🤖 Indicações EMT   1- Pacientes com Depressão Maior que não respondem ao tratamento convencional com medicamentos.  2- Pacientes com Transtorno de Ansiedade Generalizada, associado ou não a depressão, que não respondem ao tratamento convencional com medicamentos.  3- Indivíduos que não toleram ou têm receio dos efeitos adversos dos psicotrópicos utilizados no tratamento da depressão.
- `2026-05-11 19:48` 👤 **[ÁUDIO]** Boa tarde, tudo bem? Isso está correto. Meu nome é Andrés e sinto pesquisando ajuda para ajudar com umas coisas. Estou interessado em DMT. 

Acho que é melhor pra ver, pra mim será melhor ter uma consulta antes que tudo, ou antes que prometer a fazer as 20 sessões de tudo. 

Ah, eu posso fazer a consulta o dia 14 sem problema.
- `2026-05-11 19:49` 👤 Tengo ate as 2pm livre o dia 14
- `2026-05-11 19:53` 🤖 Pode ser dia 14/05 as 12:00 hs?
- `2026-05-11 19:55` 👤 Sim 👍 sem problema
- `2026-05-11 19:59` 🤖 Certo! A consulta será presencial ou online?
- `2026-05-11 20:02` 👤 Online ta bom
- `2026-05-11 20:02` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-11 20:03` 🤖 Caso você faça o tratamento este valor será abatido do valor total.
- `2026-05-11 20:04` 👤 Ok claro. Com crédito porfa
- `2026-05-11 20:05` 🤖 Você deseja pagar a vista ou parcelado? Parcelamos em até 3 vezes sem juros.
- `2026-05-11 20:06` 👤 A vista
- `2026-05-11 20:15` 🤖 https://pay.sumup.com/b2c/XSHGQLFZ8T
- `2026-05-11 20:16` 🤖 Por favor, assim que possível, nos envie o comprovante de pagamento para finalizarmos o agendamento
- `2026-05-11 20:16` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-11 20:18` 👤 *[imagem]*
- `2026-05-11 20:19` 🤖 Muito obrigada! Fico no aguardo dos seus dados para cadastrá-lo no sistema.
- `2026-05-11 20:20` 👤 Mitchell Andres Mora  02/09/1993 051.538.678-20 Praca da bandeira 61, 01007-020 11 96982 6385 mitch.mora23@gmail.com genrente / soporte tecnico solteiro EUA  Uli Dias: 11 99656-5630 Google
- `2026-05-11 20:27` 🤖 Muito obrigada pelas informações. Consulta online agendada pa o dia 14/05 as 12:00 hs.
- `2026-05-11 20:27` 🤖 Utilizamos a plataforma Google Meet
- `2026-05-11 20:28` 🤖 O link será enviado no dia da consulta pela manhã.
- `2026-05-14 13:47` 🤖 Olá bom dia Mitchell, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-14 13:47` 🤖 Mitchell Andres Mora - Dr Ivan Barenboim - 14/05/2026 Quinta-feira, 14 de maio · 12:00 – 1:00pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/irk-efsk-qiy
- `2026-06-15 22:00` 🤖 Boa tarde, Mitchell. Tudo bem?
- `2026-06-15 22:00` 🤖 É a Marisa da clínica Ór.
- `2026-06-15 22:01` 🤖 Estou entrando em contato para saber se já podemos agendar o inicio do seu tratamento?

</details>


### Gilberto Castilho — `5511967142642`

**Custom fields:** `{"data_horario": "2024-06-29T10:00:00-03:00", "procedimentos": ["Primeira Consulta"]}`

**Cenário:** `confirmacao_e_duvida_pagamento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** O Sr. Gilberto entrou em contato para confirmar detalhes de sua consulta agendada para 29/06. Ele questionou se o valor havia sido parcelado, o que foi confirmado (3x), e buscou esclarecer se o atendimento seria um retorno ou uma nova consulta. A atendente confirmou tratar-se de uma nova consulta e o lead encerrou satisfeito.


**Gatilhos:** parcelamento em 3x

<details><summary>Transcrição completa</summary>

- `2026-05-13 15:21` 🤖 Olá Sr. Gilberto!
- `2026-05-13 15:21` 🤖 Marisa da clínica Ór!
- `2026-05-13 15:21` 👤 Olá
- `2026-05-13 15:22` 🤖 Sua próxima consulta está agendada para o dia 29/06 as 10:00 hs.
- `2026-05-13 15:22` 👤 Obrigado
- `2026-05-13 15:22` 🤖 Disponha
- `2026-05-13 15:23` 👤 O valor da consulta foi parcelado?
- `2026-05-13 15:23` 🤖 Sim em 3 vezes
- `2026-05-13 15:23` 👤 Ok. Obrigado
- `2026-05-13 18:16` 👤 Boa tarde
- `2026-05-13 18:17` 👤 A consulta de 29/06 é retorno ou nova consulta?
- `2026-05-13 18:19` 🤖 Olá Sr. Gilberto! Seria uma nova consulta.
- `2026-05-13 18:19` 👤 Obrigado
- `2026-05-13 18:19` 🤖 Disponha!

</details>


### 11994096788 — `5511994096788`

**Custom fields:** `{"interest": "Consulta com psiquiatria", "pagamento": 750, "data_horario": "2025-05-20T10:00:00-03:00", "teleconsulta": true, "procedimentos": "[\"Consulta de seguimento\"]"}`

**Cenário:** `agendou_recorrente` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Paciente recorrente solicitou consulta de seguimento via teleconsulta com o Dr. Ivan. O agendamento foi realizado para o dia 20/05 às 10h após confirmação de pagamento via PIX (R$ 750). Houve um atraso significativo por parte do médico, informado apenas após o horário previsto, mas o paciente aguardou. A jornada foi concluída com o envio das orientações para retirada da receita física.


**Gatilhos:** Atendimento por teleconsulta, Preferência por profissional específico (Dr. Ivan)

<details><summary>Transcrição completa</summary>

- `2026-05-18 15:26` 👤 Boa tarde  Dr Ivan tem horário p quarta ? Consulta não presencial
- `2026-05-18 15:26` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-18 15:27` 🤖 Boa tarde!
- `2026-05-18 15:27` 🤖 Você já é paciente?
- `2026-05-18 15:27` 👤 Sim
- `2026-05-18 15:27` 🤖 Você prefere de manhã ou a tarde?
- `2026-05-18 15:28` 👤 Tarde
- `2026-05-18 15:28` 🤖 Temos horário as 17:00 hs. Você tem disponibilidade?
- `2026-05-18 15:29` 👤 Não  Que horário vc tem p manhã?
- `2026-05-18 15:30` 🤖 10:00 hs
- `2026-05-18 15:30` 👤 Ok
- `2026-05-18 15:31` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-18 15:31` 🤖 Por favor, confirme o número do seu CPF, para localizar o seu cadastro.
- `2026-05-18 15:32` 👤 769898448-68
- `2026-05-18 15:35` 🤖 Obrigada! Qual será a forma de pagamento?
- `2026-05-18 15:36` 👤 Pic
- `2026-05-18 15:36` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-18 18:08` 👤 ComprovanteSantander-1779122047.6455178.pdf
- `2026-05-18 18:12` 🤖 Obrigada pelo comprovante!
- `2026-05-18 18:12` 🤖 Desculpe, o cadastro está incorreto, constam dois nomes para este CPF. Qual é o nome do paciente?
- `2026-05-18 18:13` 👤 Hiram Santiago
- `2026-05-18 18:16` 🤖 Muito obrigada!
- `2026-05-18 18:16` 🤖 Consulta online agendada para dia 20/05 as 10:00 hs.
- `2026-05-20 11:18` 🤖 Olá bom dia Hiram, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-20 11:18` 🤖 Hiram Santiago - Dr Ivan Barenboim - 20/05/2026 Quarta-feira, 20 de maio · 10:00 – 10:30am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/weq-tquk-uqj
- `2026-05-20 13:06` 🤖 Olá Hiram. Tudo bem?
- `2026-05-20 13:06` 🤖 O Dr. Ivan vai atrasar alguns minutos ok?
- `2026-05-20 13:06` 👤 Ok
- `2026-05-20 13:09` 👤 Me avisa quando estiver pronto por favor
- `2026-05-20 13:10` 🤖 Oi o Dr. está aguardando do meet
- `2026-05-20 19:14` 🤖 Olá boa tarde Hiram,  sua receita estará disponível  para retirada hoje na portaria a partir das 18h.  *O prazo para retirar são 7 dias úteis.*

</details>


### Milene Campanholo Picasso — `555181332357`

**Custom fields:** `{"origem": "Indicação de paciente", "interesse": "Consulta com psiquiatria", "enviar_dia": "2026-06-04T03:00:00.000Z", "data_horario": "2026-06-05T10:30:00-03:00", "procedimentos": "Primeira Consulta"}`

**Cenário:** `agendou_apos_primeira_msg` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead Milene buscou consulta com o Dr. Ivan por indicação. Questionou valores e informou que não poderia no horário sugerido (05/06 às 10:30). Apesar disso, o atendente prosseguiu com o cadastro e confirmou exatamente o horário que ela disse ser difícil. A paciente acabou confirmando a presença posteriormente. Houve um erro de automação com múltiplos lembretes idênticos no dia da consulta.


**Objeções:** Indisponibilidade de horário (inicialmente disse que não conseguia às 10:30)

**Gatilhos:** Indicação de conhecido (Bárbara Camargo), Autoridade do médico (Dr. Ivan), Consulta presencial

**Erros do bot:** Spam de lembretes (enviou a mesma mensagem 5 vezes em intervalos de 5 minutos no dia da consulta); Conflito de agenda: o bot confirmou o horário das 10:30 mesmo após a paciente dizer que não conseguiria naquele horário

<details><summary>Transcrição completa</summary>

- `2026-06-02 19:53` 👤 Olá, boa tarde, tudo bem? Aqui é a Milene. Queria por favor ter informações sobre a consulta com Dr Ivan.
- `2026-06-02 19:53` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-02 19:54` 🤖 **[ÁUDIO]** Olá, Milene, como vai? Quem fala é a Mariza, boa tarde.
- `2026-06-02 19:54` 🤖 **[ÁUDIO]** O doutor Ivan trabalha com tratamentos psiquiátricos, tratamentos voltados para ansiedade, depressão e todos os problemas psiquiátricos e também trabalha para tratamento de alcoolismo. Me compartilha um pouquinho comigo por qual motivo você está buscando tratamento para que nós possamos ver o que...
- `2026-06-02 19:55` 🤖 **[ÁUDIO]** O Dr. Ivan trabalha com vários procedimentos, né? Compartilha comigo um pouquinho do seu problema, se é seu o problema, se é problema psiquiátrico, se é problema de alcoolismo, qual seria o problema para que nós possamos verificar qual a melhor forma de lhe ajudar.
- `2026-06-02 21:57` 🤖 Olá.  Você ainda tem interesse em agendar a consulta?
- `2026-06-03 19:04` 👤 Olá, tem interesse sim
- `2026-06-03 19:04` 👤 Foi indicação da Bárbara Camargo
- `2026-06-03 19:04` 👤 Seria consulta para mim
- `2026-06-03 19:05` 👤 Queria verificar o valor por favor
- `2026-06-03 19:08` 🤖 Certo Milene!
- `2026-06-03 19:08` 🤖 Você está buscando ajuda no lugar certo, pois o Dr Ivan é formado há mais de 15 anos pela Universidade Federal do Rio Janeiro, uma das faculdades de medicina mais conceituadas do Brasil. O Dr. Ivan reserva 1 hora para entender tudo, tirar suas dúvidas e definir a conduta em conjunto com você.
- `2026-06-03 19:09` 🤖 A gente acompanha cada resultado! É comum vermos pacientes que chegam super mal e na segunda consulta já parece outra pessoa.
- `2026-06-03 19:09` 🤖 A consulta custa 750 reais. Aceitamos pix e cartões. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-06-03 19:10` 🤖 Temos horário dia 05/06 as 10:30 hs. Você tem disponibilidade?
- `2026-06-03 19:11` 👤 Certo
- `2026-06-03 19:12` 🤖 Você prefere consulta presencial ou online?
- `2026-06-03 19:15` 👤 Pode ser presencial
- `2026-06-03 19:15` 👤 Na sexta as 10:30 não consigo
- `2026-06-03 19:18` 👤 Qual o endereço?
- `2026-06-03 19:19` 🤖 Certo. Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: CPF: Data de nascimento: RG: Profissão: E-mail: Tel/Cel: CEP: Endereço completo : Profissão: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-06-03 19:27` 👤 Nome completo do paciente: Milene Campanholo Picasso CPF: 04452146945 Data de nascimento: 12/11/1991 RG: 86764610 Profissão: Médico E-mail: milenecpicasso@gmail.com Tel/Cel: 51981332357 CEP: 04040-032 Endereço completo: Rua Loefgren, 1543, apto 101 Profissão: Médica Contato de emergência: 51995959488 (Gustavo) Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação): Indicação Bárbara
- `2026-06-03 19:33` 🤖 Obrigada!
- `2026-06-03 19:33` 🤖 Consulta presencial agendada para o dia 05/06 as 10:30 hs.
- `2026-06-03 19:34` 👤 Obrigada
- `2026-06-03 19:34` 🤖 Disponha!
- `2026-06-04 13:30` 🤖 Olá, Milene 😊! Posso confirmar seu horário com *Dr. Ivan Barenboim * - Consulta no dia 05/06/2026 10:30  📍Endereço: Alameda Campinas 802, conjunto 31 (3°andar) Jardim Paulista - São Paulo. (Estamos próximos a Av Paulista Estação Trianon MASP do metrô.)   🔴 Observação: Pedimos a gentileza de um retorno, lembrando que a tolerância para atraso é de 30min. (Sujeito à remarcação caso não seja possível o atendimento.)   Grata Edilene.
- `2026-06-04 14:44` 👤 confirmo
- `2026-06-04 14:44` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-05 13:00` 🤖 Milene, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 13:05` 🤖 Milene, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 13:10` 🤖 Milene, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 13:15` 🤖 Milene, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙
- `2026-06-05 13:20` 🤖 Milene, sua consulta na ÓR começa em 1 hora. Te aguardamos! 💙

</details>
