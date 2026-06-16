---
title: "Estudo: Procedimento pago"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Procedimento pago' do funil Agendamentos Novo (Clínica ÓR): 7 leads."
---

# Estudo: Procedimento pago

**Coluna:** `Procedimento pago` (posição 11) — **7 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é um paciente em tratamento ativo ou manutenção, frequentemente lidando com quadros psiquiátricos complexos (como depressão resistente ou dependência). Ele demonstra alto nível de confiança na equipe técnica (Dr. Ivan e enfermagem), mas enfrenta barreiras logísticas significativas, como morar em cidades distantes ou ter agendas de trabalho rígidas. É um lead que demanda suporte constante via WhatsApp para agendamentos, notas fiscais e renovação de receitas, valorizando muito a flexibilidade de horários e a agilidade administrativa da clínica para manter a continuidade do tratamento prescrito.


### Procedimentos mais mencionados

- Infusão de Cetamina (predominante)
- Estimulação Magnética Transcraniana (EMT)
- Renovação de Receitas de Controle Especial (Venvanse, Zolpidem, etc)
- Terapia de Superação de Traumas (TST)
- Psicoterapia/EMDR

### Profissionais mais mencionados

- Dr. Ivan Barenboim (Psiquiatria)
- Marisa (Atendimento/Agenda)
- Edilene (Enfermagem)
- Dra. Maísa (Psicoterapia/Avaliação)

### Objeções mais comuns

- Logística e deslocamento (leads de cidades vizinhas ou com restrição de rodízio).
- Dificuldade em conciliar horários de trabalho com o tempo dos procedimentos.
- Necessidade de acompanhante obrigatório para infusões.
- Insegurança devido a experiências negativas com médicos anteriores (negligência).

### Gatilhos de entrada na coluna

- Pacientes que já passaram pela consulta e tiveram prescrição de procedimentos (Cetamina, EMT).
- Necessidade imediata de renovação de receitas de controle especial.
- Encaminhamento médico externo para protocolos específicos de infusão.

## 2. Padrões observados (Top 10)

1. Indicação direta de procedimentos de alto valor (Cetamina/EMT).
2. Frequente necessidade de reagendamento por motivos de força maior (saúde/trânsito).
3. Uso do atendimento para solicitações administrativas (notas fiscais para reembolso).
4. Migração de consultas presenciais para online para evitar faltas.
5. Valorização da disponibilidade de contato direto com o médico (vínculo de confiança).
6. Conversão dependente de horários extras e flexibilidade da enfermagem.
7. Pacientes que utilizam polifarmácia (múltiplas receitas de controle especial).
8. Solicitação de renovação de receitas via portaria/app sem consulta imediata.
9. Busca por atendimento humanizado após traumas em clínicas anteriores.
10. Urgência clínica motivando o fechamento rápido do procedimento.

## 3. Erros recorrentes do agente IA atual

- Envio de mensagens de sistema/textos aleatórios sobre funcionamento da IA para o paciente.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Paciente Recorrente' para monitorar o ciclo de vida do tratamento de Cetamina.
- Implementar tag de 'Risco de Absenteísmo' para leads que moram longe (ex: Baixada Santista/ABC).
- Mover para 'Pós-Atendimento/Manutenção' assim que a receita for renovada ou sessões finalizadas.
- Sinalizar casos de 'Alta Complexidade' para atenção redobrada no tempo de resposta do WhatsApp.

## 5. Recomendações para o agente de **atendimento**

- Reforçar a necessidade de acompanhante em todos os lembretes de infusão de cetamina.
- Manter a proatividade no envio de notas fiscais para reembolso, facilitando a manutenção financeira do paciente.
- Sugerir modelos híbridos de atendimento (online/presencial) para pacientes com histórico de atrasos por trânsito.
- Confirmar a retirada de receitas físicas na portaria para evitar viagens perdidas do paciente/portador.
- Pergunta-chave: 'Considerando o seu deslocamento, o senhor prefere que deixemos a sala de infusão reservada em um horário de menor tráfego?'

## 6. Alertas

- ⚠️ Presença de pacientes de alta complexidade (risco de internação e dependência química) na coluna.
- ⚠️ Lead Douglas apresenta alto índice de absenteísmo/reagendamento por morar em outra cidade.
- ⚠️ Erro detectado na IA (mensagem de sistema enviada fora de contexto para cliente Fernanda).

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Guilherme Santana | 5511940590620 | 16 | 0 | manutencao_administrativa_receita |
| 2 | Eduardo Freire | 5515997099655 | 0 | 0 |  |
| 3 | Gabriel Medeiros | 5511917497283 | 0 | 0 |  |
| 4 | Adriana Machado | 5511984009456 | 25 | 0 | agendamento_procedimento_direto |
| 5 | Douglas Willian | 5513974202633 | 63 | 1 | fluxo_reagendamento_frequente_e_venda_servicos_adicionais |
| 6 | Fabiana Oliveira | 5511960680441 | 103 | 5 | reagendamento_e_procedimento |
| 7 | Fernanda Carneiro | 5511987813119 | 113 | 13 | agendou_consulta_e_procedimento_recorrente |

## 8. Conversas analisadas (transcrição + síntese)

_5 leads com conversa analisada._


### Guilherme Santana — `5511940590620`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2025-11-24T10:30:00-03:00", "pagamento_confirmado": true}`

**Cenário:** `manutencao_administrativa_receita` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O contato foi feito por Guilherme em nome do paciente Pedro Luiz Barbosa para solicitar a renovação de diversas receitas de controle especial. A clínica processou o pedido, disponibilizou as receitas digitais via app e preparou as físicas (Venvanse e Zolpidem) para retirada na portaria. Ficou combinado que Guilherme retiraria os documentos no dia seguinte.


**Gatilhos:** continuidade do tratamento

<details><summary>Transcrição completa</summary>

- `2026-05-19 14:39` 👤 Boa tarde tudo bem ?
- `2026-05-19 14:39` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-19 14:40` 👤 O paciente Pedro Barbosa, gostaria de continuar o tratamento e precisa de novas receitas.
- `2026-05-19 14:40` 👤 Seguem os remédios necessários
- `2026-05-19 14:41` 👤 Desde já agradeço
- `2026-05-19 14:41` 👤 Venvanse 70mg Mirtazapina 45mg Rexulti 2m Venlafaxina 150mg Zolpidem 10mg Bromidrato de vortioxetina 20mg
- `2026-05-19 14:42` 🤖 Bom dia. Tudo bem?
- `2026-05-19 14:42` 🤖 Por favor, qual é o nome completo do Pedro?
- `2026-05-19 14:43` 👤 Pedro Luiz Barbosa
- `2026-05-19 14:43` 🤖 Certo. Iremos solicitar a pessoa responsável e assim que possível te retornamos. Seguimos à disposição.
- `2026-05-19 19:44` 🤖 Olá boa tarde  Pedro, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-05-19 19:45` 🤖 Assim que as receitas do Zolpidem e Venvanse estiverem prontas para retirada, nós informaremos.
- `2026-05-19 21:03` 👤 Ok aguardo
- `2026-05-20 19:15` 🤖 Olá boa tarde Pedro,  sua receita estará disponível  para retirada hoje na portaria a partir das 18h.  *O prazo para retirar são 7 dias úteis.*
- `2026-05-20 19:35` 👤 O Guilherme vai retirar amanhã às 6:30 ok
- `2026-05-20 19:35` 🤖 ok

</details>


### Adriana Machado — `5511984009456`

**Custom fields:** `{"origem": "Indicação de Médico", "interesse": "Infusão de Cetamina", "data_horario": "2023-11-06T14:00:00-03:00", "procedimentos": ["Infusão de cetamina"], "tipo_atendimento": "sessao_cetamina", "pagamento_confirmado": true}`

**Cenário:** `agendamento_procedimento_direto` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Adriana Machado entrou em contato para agendar uma sessão de infusão de cetamina por indicação médica. Houve uma breve negociação de horários devido ao rodízio de veículos e à necessidade de acompanhante. Após considerar terça-feira e até questionar sobre a disponibilidade para o dia seguinte, a paciente optou por manter o agendamento para segunda-feira, às 14h, que foi devidamente confirmado pela atendente.


**Objeções:** Logística (rodízio de veículos), Necessidade de acompanhante

**Gatilhos:** Indicação médica, Necessidade de tratamento urgente

<details><summary>Transcrição completa</summary>

- `2026-05-14 15:51` 👤 Oi Marisa
- `2026-05-14 15:52` 👤 Vou mesmo ter q fazer a cetamina
- `2026-05-14 15:58` 🤖 Bom dia, Adriana. Tudo bem?
- `2026-05-14 15:58` 🤖 Certo! Vamos agendar?
- `2026-05-14 15:58` 👤 Vamos
- `2026-05-14 15:59` 🤖 Você prefere de manhã ou a tarde? Não me recordo.
- `2026-05-14 15:59` 👤 Me dá uns horários que vou ver com quem vai me levar
- `2026-05-14 15:59` 🤖 Para segunda feira?
- `2026-05-14 16:00` 👤 Segunda é rodízio mas se for entre 11:30 e 15:30 é possível
- `2026-05-14 16:00` 🤖 Prefere na terça?
- `2026-05-14 16:00` 👤 Segunda teria que horas e terça?
- `2026-05-14 16:03` 🤖 Estes são os horários disponíveis neste momento, mas fazemos agendamento a todo instante ok?
- `2026-05-14 16:03` 👤 Segunda teria qq horário?
- `2026-05-14 16:03` 🤖 Segunda - 08:30 - 09:00 - 10:00 - 12:00 - 14:00
- `2026-05-14 16:04` 👤 Ok
- `2026-05-14 16:04` 🤖 Terça - 09:00 - 11:30 - 13:00 - 14:00
- `2026-05-14 16:11` 👤 Ok um momento
- `2026-05-14 16:57` 👤 Segunda às 14
- `2026-05-14 17:03` 🤖 Certo Adriana! Agendado
- `2026-05-14 17:11` 👤 Confirmado
- `2026-05-14 17:12` 👤 Marisa amanhã não teria né
- `2026-05-14 17:16` 🤖 Amanhã tem sim! 09:00 - 12:00 - 13:30
- `2026-05-14 17:17` 👤 Deixa marcado segunda mesmo
- `2026-05-14 17:19` 🤖 ok

</details>


### Douglas Willian — `5513974202633`

**Custom fields:** `{"interesse": "Psicoterapia", "data_horario": "2023-12-02T10:30:00-03:00", "pagamento_confirmado": true}`

**Cenário:** `fluxo_reagendamento_frequente_e_venda_servicos_adicionais` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** Lead já em acompanhamento, apresenta histórico recorrente de atrasos e pedidos de reagendamento devido ao deslocamento entre Praia Grande e São Paulo. Converteu uma sessão presencial em consulta online com o Dr. Ivan para evitar nova falta. Após a consulta, o bot ofertou novos tratamentos prescritos (EMT e TST/Hipnoterapia). O lead demonstrou interesse em saber valores de psicoterapia, mas ainda não confirmou o agendamento da avaliação com a psicóloga Maísa.


**Objeções:** Logística (trânsito entre PG e SP), Imprevistos de horário

**Gatilhos:** Psicoterapia, Remarcação facilitada, Atendimento Online, EMT (Estimulação Magnética Transcraniana), TST (Terapia de Superação de Traumas)

<details><summary>Transcrição completa</summary>

- `2026-05-07 11:34` 👤 Bom dia
- `2026-05-07 11:34` 👤 Eu devo me atrasar uns 10 minutos pra sessão de hj, tudo bem?
- `2026-05-07 11:36` 🤖 Bom dia, Douglas!
- `2026-05-07 11:37` 🤖 Você pode atrasar até 30 minutos.
- `2026-05-07 11:37` 👤 Blz obrigado
- `2026-05-13 10:49` 👤 Bom dia
- `2026-05-13 10:50` 👤 Poderia remarcar minha consulta de hj, por favor? Não vou conseguir ir hj
- `2026-05-13 11:11` 🤖 **[ÁUDIO]** Olá, bom dia Douglas, tudo bem? Sem problema, nós podemos reagendar sim o seu procedimento, aí você só sinaliza pra gente qual outro dia dessa semana que você gostaria de vir fazer sua infusão, tá bom? Obrigada por sinalizar pra gente.
- `2026-05-13 13:35` 👤 Pode ser amanhã se tiver horário. De manhã de preferência
- `2026-05-13 13:38` 👤 A partir das 10h
- `2026-05-13 14:22` 🤖 Pode ser as 10:30 hs?
- `2026-05-13 14:27` 👤 Sim
- `2026-05-13 14:29` 🤖 Agendado!
- `2026-05-19 12:06` 👤 Bom dia, pode me lembrar se meu horário hj é as 10h ou 10h30?
- `2026-05-19 12:07` 🤖 Bom dia, Douglas!
- `2026-05-19 12:07` 🤖 Agendado para as 10:30 hs.
- `2026-05-19 12:10` 👤 Blz, obrigado
- `2026-05-19 12:10` 🤖 Disponha!
- `2026-05-19 12:32` 👤 Desculpa eu não vou conseguir chegar a tempo hj
- `2026-05-19 12:32` 🤖 Douglas! Você tem até 30 minutos de tolerância.
- `2026-05-19 12:33` 👤 Mesmo assim rs, tá muito trânsito daqui da PG pra SP. Eu vou chegar depois das 11h
- `2026-05-19 12:36` 🤖 ok
- `2026-05-19 12:36` 🤖 Pode vir!
- `2026-05-19 12:36` 👤 Ta bom
- `2026-05-27 20:39` 👤 Boa tarde, poderia remarcar minha sessão de amanhã pra sexta feira, por favor?
- `2026-05-27 20:41` 🤖 Olá Douglas!
- `2026-05-27 20:41` 🤖 Pode ser as 10:00 hs na sexta?
- `2026-05-27 20:41` 👤 Sim
- `2026-05-27 20:44` 🤖 Agendado!
- `2026-05-27 20:45` 👤 Obrigado
- `2026-05-27 20:45` 🤖 Disponha!
- `2026-06-01 12:33` 🤖 Bom dia, Douglas. Tudo bem?
- `2026-06-01 12:34` 🤖 Podemos confirmar sua consulta hoje as 12:00 hs?
- `2026-06-01 14:00` 👤 Desculpa eu tive um imprevisto, poderia remarcar?
- `2026-06-01 14:01` 🤖 Douglas. Não podemos fazer online hoje?
- `2026-06-01 14:02` 👤 Pode ser
- `2026-06-01 14:04` 🤖 Ótimo. Já te envio o link]
- `2026-06-01 14:06` 🤖 Segue o link para consulta!
- `2026-06-01 14:06` 🤖 Douglas Willian Souza Gonçalves - Dr. Ivan Barenboim - 01/06/26 Segunda-feira, 1 de junho · 12:00 – 12:30pm Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/vci-pefc-pyw
- `2026-06-01 14:11` 👤 Obrigado
- `2026-06-01 14:13` 🤖 Disponha!
- `2026-06-01 15:20` 🤖 Oi Douglas!
- `2026-06-01 15:20` 🤖 segue o link do App da Clínica para que consiga *verificar suas prescrições* e fazer seus próprios agendamentos de consulta. *App IOS*: https://apps.apple.com/br/app/cl%C3%ADnica-%C3%B3r-psiquiatria/id6745094818 *App Android*: https://play.google.com/store/apps/details?id=br.com.clinicaorpsiquiatria.app  *WebApp*: https://orpsiquiatria.vsaudeapp.com.br/app Para acessar o App use seu e-mail de cadastro e a *senha: 010203*  As prescrições se encontram em *arquivos*.  Qualquer dúvida sigo a disposi
- `2026-06-01 15:20` 🤖 Segue vídeo do passo a passo
- `2026-06-01 15:21` 🤖 [Vídeo]
- `2026-06-01 15:22` 🤖 Douglas, O Dr. Ivan recomendou para você o tratamento de EMT 40 sessões e TST
- `2026-06-01 15:22` 🤖 Hipnoterapia/EMDR/TST
- `2026-06-01 15:22` 🤖 O que é a hipnoterapia/TST( terapia de superação de traumas)?
- `2026-06-01 15:22` 🤖 A terapia de superação de traumas( TST) consiste em utilizar técnicas como hipnose e EMDR que são comprovadamente eficazes para a neutralização do efeito dos traumas psicológicos no subconsciente do indivíduo.
- `2026-06-01 15:23` 🤖 Dessa forma, muitas vezes,  é possível quebrar padrões emocionais, cognitivos e comportamentais arraigados rapidamente.
- `2026-06-01 15:23` 🤖 Como funciona a hipnoterapia/TST?
- `2026-06-01 15:23` 🤖 A TST ou Terapia de Superação de Traumas é um processo terapêutico que envolve hipnoterapia, EMDR e outras técnicas que visam a diminuir ou neutralizar o efeito dos traumas sobre o funcionamento do indivíduo.
- `2026-06-01 15:23` 🤖 Primeiro, você faz uma sessão inicial de avaliação com a nossa psicóloga. Ao final da mesma, ela vai propor um protocolo de tratamento com o número mínimo de sessões estimado para obtenção de bons resultados. Normalmente, entre 6 e 12 sessões.
- `2026-06-01 15:23` 🤖 EMT
- `2026-06-01 15:26` 🤖 São 40 sessões, duas sessões por dia, durante 20 dias.
- `2026-06-01 15:26` 🤖 Você tem alguma dúvida?
- `2026-06-01 15:26` 🤖 Vamos agendar a parametrização?
- `2026-06-03 19:14` 👤 Bom dia, eu queria saber o valor das sessões com psicólogo, por favor
- `2026-06-03 19:16` 🤖 Boa tarde, Douglas. Tudo bem?
- `2026-06-03 19:18` 🤖 A sessão de terapia é R$ 600,00. Normalmente, a Dra. Maísa prescreve entre 6 e 12 sessões. Nós parcelamos o pagamento do pacote de sessões.
- `2026-06-03 19:19` 🤖 A Dra. faz atendimento presencial toda quinta feira. Você deseja agendar uma sessão de avaliação?

</details>


### Fabiana Oliveira — `5511960680441`

**Custom fields:** `{"interesse": "Infusão de Cetamina", "data_horario": "2023-10-06T17:00:00-03:00", "teleconsulta": "false", "procedimentos": ["Infusão de cetamina", "Primeira Consulta", "Sessão de terapia"], "tipo_atendimento": "sessao_cetamina", "pagamento_confirmado": true}`

**Cenário:** `reagendamento_e_procedimento` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Lead buscava atendimento de urgência para consulta e infusão de cetamina. Inicialmente reagendou devido a uma crise de enxaqueca e dificuldades logísticas (trabalha em São Caetano). Após negociação de horário extra com a equipe de enfermagem, compareceu para consulta e realizou a infusão no dia 18/05, efetuando o pagamento via link.


**Objeções:** Conflito de horário de trabalho, Deslocamento (São Caetano),  Crise de saúde (enxaqueca)

**Gatilhos:** Urgência no tratamento, Disponibilidade de horários tardios

<details><summary>Transcrição completa</summary>

- `2026-05-06 20:09` 🤖 [Áudio]
- `2026-05-06 20:09` 🤖 [Áudio]
- `2026-05-06 20:09` 👤 Eu já falei C ele q estou trabalhando em São Caetano e estou trabalhando das 7 às 16h segunda a sexta
- `2026-05-06 20:09` 👤 Sim gostaria
- `2026-05-06 20:19` 🤖 Oi Fabiana! rs
- `2026-05-06 20:32` 👤 Presencial
- `2026-05-06 20:35` 🤖 Pode ser no dia 13/05 as 18:00 hs?
- `2026-05-06 20:37` 👤 Não tem p amanhã ou sexta?
- `2026-05-06 20:38` 👤 Estou precisando C uma certa urgência até falei p o dr
- `2026-05-06 20:38` 👤 ja reforcei o pedido a ela
- `2026-05-06 20:38` 👤 Ele me mandou
- `2026-05-06 20:48` 🤖 **[ÁUDIO]** Oi Fabiana, tudo bem? Deixa eu te fazer uma pergunta. Você conseguiria amanhã às 16:30? O doutor não tem esse horário, porém, eu posso ver quando ele consegue te atender. Você me informa por favor, ai eu vou verificar com ele e já te retorno.
- `2026-05-06 21:09` 🤖 Oi Fabiana!
- `2026-05-06 21:10` 👤 Oi Fabiana
- `2026-05-06 21:11` 🤖 Você tem disponibilidade?
- `2026-05-06 21:11` 👤 Eu saio as 16h do serviço
- `2026-05-06 21:11` 👤 É em São Caetano
- `2026-05-06 21:12` 🤖 Você consegue chegar as 18:10 hs?
- `2026-05-06 21:12` 👤 Acho q sim
- `2026-05-06 21:12` 🤖 Pode agendar?
- `2026-05-06 21:12` 👤 P amanhã?
- `2026-05-06 21:12` 🤖 Sim
- `2026-05-06 21:12` 👤 Sim
- `2026-05-06 21:13` 🤖 ok confirmado
- `2026-05-06 21:13` 🤖 Qualquer imprevisto nos avise, ok?
- `2026-05-06 21:13` 👤 Sim pode deixar aviso sim
- `2026-05-06 21:13` 🤖 Muito obrigada!
- `2026-05-06 21:42` 👤 Eu q agradeço
- `2026-05-07 18:00` 👤 Oi
- `2026-05-07 18:00` 👤 Eu n vou conseguir ir hj
- `2026-05-07 18:00` 👤 Estou muito ruim da enxaqueca
- `2026-05-07 18:01` 🤖 Boa tarde!
- `2026-05-07 18:01` 🤖 Certo! Deseja reagendar?
- `2026-05-07 18:02` 🤖 Deseja fazer online?
- `2026-05-07 18:06` 👤 Não
- `2026-05-07 18:09` 🤖 Você deseja reagendar?
- `2026-05-07 18:10` 👤 Hj n
- `2026-05-07 18:12` 🤖 Deseja agendar para semana que vem?
- `2026-05-11 13:10` 👤 Obrigada
- `2026-05-11 13:10` 🤖 ok
- `2026-05-11 13:10` 👤 Assim q melhorar entro em contato C vc
- `2026-05-11 13:10` 👤 É q hj n tô legal
- `2026-05-11 13:10` 🤖 Disponha!
- `2026-05-11 13:10` 👤 Te mando msg
- `2026-05-13 15:46` 👤 Oi boa tarde!
- `2026-05-13 15:46` 👤 Hj teria o h das 18h p consulta?
- `2026-05-13 15:49` 🤖 Olá Fabiana!  Boa tarde!
- `2026-05-13 15:49` 🤖 Temos horário sim hoje as 18:00 hs. Podemos agendar?
- `2026-05-13 16:09` 👤 Sim
- `2026-05-13 17:08` 🤖 ok Fabiana! Consulta presencial?
- `2026-05-13 19:25` 🤖 Oi Fabiana! A consulta será presencial?
- `2026-05-13 19:32` 👤 Sim
- `2026-05-13 19:34` 🤖 ok obrigada
- `2026-05-13 19:44` 👤 Já estou a caminho
- `2026-05-13 19:45` 👤 Depois da consulta tem como fazer uma sessão de Cetamina?
- `2026-05-13 19:51` 🤖 O último horário da cetamina é as 15:30 hs.
- `2026-05-13 19:53` 👤 Eu descobri no trianom ?
- `2026-05-13 19:54` 👤 Desço
- `2026-05-13 19:54` 👤 Estação?
- `2026-05-13 19:55` 🤖 Sim Trianom
- `2026-05-13 19:55` 👤 Ok.Obrigada
- `2026-05-13 20:09` 👤 **[ÁUDIO]** Oi, eu já tô chegando. Você acha que vai dar para adiantar a consulta?
- `2026-05-13 20:10` 🤖 Não o Dr. tem outras consultas
- `2026-05-14 14:24` 🤖 Bom dia, Fabiana. Tudo bem?
- `2026-05-14 14:24` 🤖 É a Marisa.
- `2026-05-14 14:25` 🤖 Podemos agendar sua infusão as 16:30 hs na semana que vem?
- `2026-05-14 14:25` 🤖 Pode ser segunda, terça ou quinta.
- `2026-05-14 18:03` 👤 Boa tarde!
- `2026-05-14 18:03` 👤 Vou ver e te retorno
- `2026-05-14 18:04` 🤖 Ok!
- `2026-05-14 18:28` 👤 Obrigada pelo retorno
- `2026-05-14 18:30` 🤖 Disponha!
- `2026-05-18 09:02` 👤 Bom dia Marisa!
- `2026-05-18 09:02` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-18 09:02` 👤 Poderia agendar p hj,só q deixa p as 17h q é a h q consigo chegar ai
- `2026-05-18 09:03` 👤 Se conseguir sair mais cedo eu te aviso
- `2026-05-18 12:04` 🤖 **[ÁUDIO]** Olá, bom dia, Fabiana, tudo bem? Aqui quem fala é a Edilene da clínica ORT. Então, Fabiana, o horário das 4:30 foi um horário que o doutor combinou, né, com a nossa enfermeira para ela te atender esse horário. Por quê? Porque o nosso último horário de atendimento seria às 3:30, mas o doutor abriu uma exceção para você, conversando com essa enfermeira em especial, que pode te atender. Porém, às 17 horas, né, vai fugir um pouco do horário que ela tem compromisso após a infusão, né, após aqui a clínica. Se você conseguir chegar às 16:30, seria o melhor mesmo.
- `2026-05-18 12:27` 👤 **[ÁUDIO]** Oi, bom dia. Eu não consigo chegar a esse horário porque eu tô aqui em São Caetano, vou sair daqui às 16:00. Aí eu tenho que pegar o trem, o metrô e ir pra aí. Eu falei pro doutor que era pra ele colocar às 17:00, que às 17:00 eu consigo chegar.
- `2026-05-18 18:24` 👤 Oi
- `2026-05-18 18:24` 👤 Acho q vou conseguir chegar
- `2026-05-18 18:25` 👤 Oi boa tarde!
- `2026-05-18 18:26` 🤖 Oi!
- `2026-05-18 18:26` 🤖 Você vai conseguir chegar as 16:30 hs?
- `2026-05-18 18:27` 👤 Vou fazer de tudo
- `2026-05-18 18:27` 👤 Estou saindo mais cedo
- `2026-05-18 18:30` 🤖 ok
- `2026-05-18 18:32` 🤖 A enfermeira disse que consegue te aguardar até as 17h. Após isso não conseguirá te aguardar.
- `2026-05-18 18:33` 👤 Ok
- `2026-05-18 19:53` 👤 **[ÁUDIO]** Já tô chegando, tá?
- `2026-05-18 19:56` 👤 Cheguei
- `2026-05-18 19:56` 🤖 ok
- `2026-05-18 20:04` 🤖 Fabiana
- `2026-05-18 20:05` 🤖 No mês 10/2025 você já pagou R$ 900,00 na cetamina.
- `2026-05-18 20:14` 🤖 Fabiana1805.pdf
- `2026-05-18 21:21` 🤖 https://pay.sumup.com/b2c/XIT1OY4HUC
- `2026-05-18 23:32` 👤 *[imagem]*
- `2026-05-18 23:32` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-18 23:33` 👤 Oi Marisa boa noite!
- `2026-05-18 23:33` 👤 Segue o comprovante Obrigada
- `2026-05-18 23:33` 👤 Desculpa pelo transtorno
- `2026-05-19 11:34` 🤖 Bom dia! Muito obrigada!
- `2026-05-19 12:01` 👤 Eu q te agradeço

</details>


### Fernanda Carneiro — `5511987813119`

**Custom fields:** `{"origem": "Google - Orgânico", "interesse": "Infusão de Cetamina", "data_horario": "2024-06-18T08:30:00-03:00", "pagamento_confirmado": true}`

**Cenário:** `agendou_consulta_e_procedimento_recorrente` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Fernanda buscou a clínica em estado crítico (beira de internação) por depressão e dependência química, vindo de uma experiência traumática com um médico anterior. Agendou consulta de urgência com o Dr. Ivan e, após a primeira consulta, iniciou o protocolo de infusão de cetamina. A paciente realizou múltiplas sessões (agendamentos recorrentes) e solicitou as notas fiscais para reembolso. Tornou-se uma paciente regular da clínica.


**Objeções:** Negligência de médicos anteriores, Dependência química (benzodiazepínicos e cetamina subcutânea)

**Gatilhos:** Atenção humanizada, Disponibilidade de contato direto com médico, Urgência no tratamento, Experiência prévia negativa com outro profissional

**Erros do bot:** Mensagem de sistema/texto aleatório sobre IA enviado fora de contexto no dia 06/05 às 22:11.

<details><summary>Transcrição completa</summary>

- `2026-05-06 21:47` 👤 Olá
- `2026-05-06 21:47` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-06 21:47` 👤 Boa tarde td bem?
- `2026-05-06 21:47` 👤 Gostaria de agendar uma consulta com dr Ivan
- `2026-05-06 21:52` 🤖 **[ÁUDIO]** Olá, Fernanda, tudo bem? Aqui quem fala é Marisa, da Clínica Or. Seria a primeira consulta ou você já é paciente?
- `2026-05-06 21:52` 👤 Primeira consulta
- `2026-05-06 21:52` 👤 Eu to a beira de internação
- `2026-05-06 21:52` 👤 Tenho depressao e faço infusão de ketamina
- `2026-05-06 21:52` 👤 E sofro com dependência química
- `2026-05-06 21:52` 👤 Será que vcs tem um horário meio urgente?
- `2026-05-06 21:53` 👤 Vcs conseguiriam me ajudar?
- `2026-05-06 21:53` 🤖 **[ÁUDIO]** Oi, Fernanda. Imagino que não deve ser nada fácil pra você passar por isso. Imagino mesmo.
- `2026-05-06 21:53` 🤖 **[ÁUDIO]** Pelo que você está descrevendo, acredito que você esteja precisando de um tratamento especializado, né? E eu tenho certeza que nós podemos te ajudar nesse sentido.
- `2026-05-06 21:54` 🤖 [Áudio]
- `2026-05-06 21:54` 🤖 **[ÁUDIO]** E o único problema neste momento é em relação às datas disponíveis, porque o doutor Ivan tem data disponível agora... você conseguiria amanhã às 14 às 16 horas? Pode ser consulta online ou pode ser consulta presencial.
- `2026-05-06 21:54` 🤖 **[ÁUDIO]** Nós estamos na Alameda Campinas, uma travessa da Avenida Paulista, número 802.
- `2026-05-06 21:59` 👤 Siiim consigo
- `2026-05-06 21:59` 👤 Muito obrigada
- `2026-05-06 21:59` 👤 Pode ser presencial
- `2026-05-06 22:00` 🤖 Vou vrificar a disponibilidade do Dr. Ivan e já te retorno.
- `2026-05-06 22:01` 👤 Ok muito obg
- `2026-05-06 22:01` 👤 💖
- `2026-05-06 22:06` 🤖 **[ÁUDIO]** Olá, como já encerrou o horário de expediente, o doutor ainda não me respondeu. Assim que ele me responder, eu chego amanhã e já te respondo, tá? Porque quatro horas não é o horário que ele atende, eu tô pedindo uma exceção pra ele te atender. Então, assim que ele me responder a disponibilidade dele, eu te informo e pego os seus dados para poder fazer o seu cadastro, tá bom? Fica com Deus e até amanhã.
- `2026-05-06 22:10` 👤 **[ÁUDIO]** Olha, eu tô mudando de psiquiatra porque eu sou paciente de cetamina e meu psiquiatra simplesmente não me atende, não me responde e eu tô em uma situação crítica e ele não... e eu já fiz seis sessões e ele não me perguntou simplesmente como eu tô até agora, nunca passei em uma consulta presencial com ele e ele não dá a urgência que eu preciso. Então eu preciso de um médico 100% presente no meu tratamento.
- `2026-05-06 22:10` 👤 **[ÁUDIO]** Se você acha que o doutor Ivan consegue ser presente da forma que eu preciso, porque os meus remédios são totalmente desregulados, eu tomo benzo e eu sofro com a abstinência de benzo. Então eu preciso de um acompanhamento constante. Se você acha que ele consegue me dar, eu quero marcar para amanhã, por favor.
- `2026-05-06 22:11` 🤖 **[ÁUDIO]** A inteligência artificial transformou radicalmente a maneira como interagimos com a tecnologia, oferecendo soluções inovadoras que otimizam processos e expandem as possibilidades criativas em diversos setores da sociedade contemporânea.
- `2026-05-06 22:11` 👤 Eu sinto que meu atual psiquiatra simplesmente só quer saber do lucro com as minhas sessões de ketamina
- `2026-05-06 22:11` 👤 E não me manda uma mensagem sequer
- `2026-05-06 22:11` 👤 Não faz pergunta nenhuma
- `2026-05-06 22:12` 🤖 **[ÁUDIO]** Oi! Eu já tô indo embora. Ó, o doutor respondeu, ele disse que pode te atender amanhã às 16:00.
- `2026-05-06 22:12` 👤 Um total mercenario, desculpa o termo, eu preciso de alguém mais humano. Fiquei dependente de ketamina injetável subcutânea por um médico horrível, e além disso, to fazendo no centro de infusão pra desmame
- `2026-05-06 22:12` 👤 E a ketamina era do cavalo e ele mandava eu aplicar sozinha
- `2026-05-06 22:12` 🤖 **[ÁUDIO]** Você pode ficar tranquila que o doutor dá toda a assistência que você precisa. Inclusive ele disponibiliza o número do celular dele pra você enviar mensagens pra pedir respaldo. E é lógico, né, ele tem bastante atendimento, mas ele sempre responde e dá todo o atendimento que você precisa. Você vai gostar muito dele.
- `2026-05-06 22:12` 👤 Meu caso é sério e preciso de acompanhamento de perto
- `2026-05-06 22:12` 👤 Se puder passar essas informações para o dr, agradeço 💖
- `2026-05-06 22:13` 🤖 **[ÁUDIO]** Entendo, entendo sim, o seu caso é sério. Oh, para você ter uma noção, eu estava sofrendo há muitos anos com ansiedade e depressão. Nem... mudei de psiquiatra várias vezes, mas... nenhum conseguiu resolver o meu problema. Eu vim trabalhar aqui com o Dr. Ivan e ele acabou pegando o meu caso e graças a Deus, eu estou bem agora. Então, posso dizer que ele é um médico muito bom.
- `2026-05-06 22:13` 👤 Um caso absurdo eu sei
- `2026-05-06 22:14` 🤖 **[ÁUDIO]** "Eu preciso ir embora agora, tá bom? Mas eu vou te passar os dados para você... passar para nós... para fazer o seu cadastro e já está tudo certo. Eu vou te passar o endereço, o valor da consulta e, se você precisar de mais alguma coisa, é só me chamar. Amanhã eu te respondo, tá bom? Obrigada."
- `2026-05-06 22:14` 👤 Perfeito, vamos nos vemos amanhã ❤️ muito obrigada pela atenção
- `2026-05-06 22:14` 🤖 Combinado, por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento:  CPF: RG: Endereço completo com CEP:  Tel/Cel: E-mail: Profissão: Estado civil: Nacionalidade: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-05-06 22:14` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-06 22:16` 👤 Combinado, por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Data de nascimento: 12/08/1996 CPF: 43508833801 RG: 53243748-2 Endereço completo com CEP: rua dom Henrique 310 Tel/Cel: 11987813119 E-mail: fecarneiro96@gmail.com Profissão: DJ e produtora musical  Estado civil: Solteira Nacionalidade: brasileira  Contato de emergência: 11 984531641 Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indica
- `2026-05-07 11:31` 🤖 Bom dia, Fernanda. Tudo bem?
- `2026-05-07 11:31` 🤖 Está tudo certo para  sua consulta hoje as 16:00 hs.
- `2026-05-07 11:32` 🤖 Por favor, me confirme o seu nome completo.
- `2026-05-07 11:38` 👤 Oi, bom dia!
- `2026-05-07 11:39` 👤 Está sim
- `2026-05-07 11:39` 👤 Fernanda Gonçalves Carneiro
- `2026-05-07 11:39` 👤 Acha q a consulta acaba até 17h?
- `2026-05-07 11:39` 🤖 Obrigada!
- `2026-05-07 11:39` 🤖 Sim, creio que sim!
- `2026-05-11 13:57` 🤖 Olá! Fernanda!
- `2026-05-11 13:57` 🤖 O Dr. Ivan vai te receber as 12:30 hs.
- `2026-05-11 13:58` 👤 Ah ok obrigada!
- `2026-05-11 13:58` 👤 Qual o endereço?
- `2026-05-13 14:41` 👤 Olá boa tarde, td bem?
- `2026-05-13 14:41` 👤 Será q tem horário pra uma sessão de ketamina hoje as 18h
- `2026-05-13 14:41` 👤 Invés de amanhã
- `2026-05-13 14:50` 🤖 Olá Fernanda!
- `2026-05-13 14:50` 🤖 Nosso último horário de cetamina é as 15:30 hs.
- `2026-05-13 15:33` 👤 Ah ok pode deixar meu horário de amanhã então
- `2026-05-13 15:33` 👤 Obrigada
- `2026-05-13 15:35` 🤖 Disponha!
- `2026-05-14 19:18` 🤖 Olá boa tarde  Fernanda, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.
- `2026-05-15 20:42` 👤 Oi boa tarde td bem?
- `2026-05-15 20:42` 👤 Quetiapina de 50mg só tem de liberação lenta. Pra mim não pode ser liberação lenrta pois demoro muito pra dormir e acordo mt sonolenta.
- `2026-05-15 20:43` 👤 Vou precisar de outra receita, de 25mg, vc avisa o dr Ivan pf?
- `2026-05-15 20:46` 🤖 Olá Fernanda. Neste caso  é indicado você enviar mensagem diretamente para ele, para resolver seu problema.
- `2026-05-18 10:42` 👤 Oi bom dia!
- `2026-05-18 10:42` 👤 Eu agendei minha ketamina hj? Senão, gostaria de um horário pra hj!
- `2026-05-18 10:54` 🤖 Olá bom dia Fernanda, como vai? Qual horário seria conveniente para você?
- `2026-05-18 11:04` 👤 Já saí de casa
- `2026-05-18 11:04` 🤖 Certo, agendado para as 08h30
- `2026-05-20 11:20` 👤 Bom dia, td bem? Tem horário pra uma sessão de ketamina hj às 9h?
- `2026-05-20 11:29` 🤖 Olá bom dia Fernanda, como vai? Sim temos as 09h disponível. Podemos agendar?
- `2026-05-20 11:29` 👤 Pode sim, vou sair
- `2026-05-20 11:31` 🤖 Certo, agendado.
- `2026-05-20 11:56` 👤 Oi, acabei me atrasando um pouco, vou chegar até as 9:30, td bem?
- `2026-05-20 11:57` 🤖 Bom dia. Fernanda. Tudo bem?
- `2026-05-20 11:58` 🤖 Sem problemas. Você tem 30 minutos de tolerância.
- `2026-05-21 21:08` 👤 Oi boa tard
- `2026-05-21 21:08` 👤 Gostaria de marcar ketamina pra amanhã
- `2026-05-21 21:08` 🤖 Olá Fernanda.
- `2026-05-21 21:08` 🤖 Pode ser as 10:00 hs?
- `2026-05-21 21:12` 👤 Pode sim
- `2026-05-21 21:12` 👤 Obrigada
- `2026-05-21 21:12` 🤖 Agendado!
- `2026-05-22 00:19` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-27 16:42` 👤 Olá boa tarde td bem?
- `2026-05-27 16:42` 👤 Queria agendar ketamina amanhã às 9
- `2026-05-27 16:43` 🤖 Boa tarde, Fernanda!
- `2026-05-27 16:43` 🤖 Pode ser as 09:30 hs?
- `2026-05-27 16:44` 👤 Pode sim
- `2026-05-27 16:44` 🤖 Agendado!
- `2026-06-01 13:36` 👤 Oi bom dia!
- `2026-06-01 13:36` 👤 Só confirmando, minha ketamina hj eh as 14:30 né?
- `2026-06-01 13:37` 🤖 Bom dia, Fernanda!
- `2026-06-01 13:37` 🤖 A infusão está agendada para as 14:00 hs.
- `2026-06-01 13:42` 👤 Isso 14h
- `2026-06-01 13:42` 👤 Obrigada!
- `2026-06-01 13:42` 👤 Não vai ter obra essa hora né? Kkk
- `2026-06-01 13:59` 🤖 Não! rs
- `2026-06-10 11:01` 👤 Olá, bom dia, td bem? Preciso do recibo das sessões de ketamina, pf! Conseguem me enviar por aqui?
- `2026-06-10 11:09` 🤖 Bom dia Fernanda, como vai? Segue as notas fiscais, conforme solicitado. Seguimos a disposição.
- `2026-06-10 12:08` 🤖 NFSe_52686124_15329.pdf
- `2026-06-10 12:08` 🤖 NFSe_52686124_15340.pdf

</details>
