---
title: "Estudo: Qualificação"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Qualificação' do funil Agendamentos Novo (Clínica ÓR): 3 leads."
---

# Estudo: Qualificação

**Coluna:** `Qualificação` (posição 2) — **3 leads** analisados.


## 1. Perfil típico

O lead nesta fase é caracterizado por pacientes ou familiares (como secretárias/financeiro) que buscam tratamentos psiquiátricos de segunda linha, como EMT ou Cetamina, geralmente após a falha de medicamentos convencionais. Apresentam uma dualidade entre a urgência clínica e a limitação financeira severa, questionando formas de parcelamento, migração de créditos entre procedimentos ou suporte jurídico para cobertura via convênio. São leads que valorizam a personalização e a flexibilidade da clínica, mas que podem 'sumir' ou adiar o início se a barreira financeira não for sanada ou se a logística de deslocamento for complexa.


### Procedimentos mais mencionados

- EMT (Estimulação Magnética Transcraniana)
- Infusão de S-Cetamina
- Consulta Psiquiátrica de Acompanhamento
- Judicialização de Tratamentos (Suporte Jurídico)

### Profissionais mais mencionados

- Dr. Ivan
- Marisa (Consultora/Financeiro)

### Objeções mais comuns

- Alto custo do pacote de EMT (ex: R$ 10.000,00).
- Restrição orçamentária por desemprego ou rescisão.
- Falta de cobertura direta por convênio médico.
- Conflitos de agenda com compromissos pessoais/profissionais.

### Gatilhos de entrada na coluna

- Busca por tratamentos de alta complexidade (EMT/Cetamina) após falha terapêutica anterior.
- Necessidade de suporte administrativo para reembolso ou judicialização.
- Ajuste de agenda por conveniência logística/geográfica.

## 2. Padrões observados (Top 10)

1. Pacientes em estado de vulnerabilidade emocional extrema (desesperança).
2. Proposta de abatimento de valores/estorno para novos tratamentos.
3. Interesse por judicialização como forma de viabilizar o tratamento.
4. Reagendamentos frequentes por questões de saúde (imunidade baixa).
5. Busca por horários que coincidam com outras atividades na região da clínica.
6. Reconhecimento da autoridade acadêmica/clínica do Dr. Ivan.
7. Interesse em pacotes fechados para redução do valor por sessão.
8. Uso de provas de afeto (presentes/avaliações positivas) como gratidão pelo acolhimento.
9. Demanda por retorno rápido do médico em casos de crise.
10. Triagem de preços antes da consulta presencial.

## 3. Erros recorrentes do agente IA atual

- Confusão entre nomes similares em áudio.
- Registro impreciso de saldo de tratamentos migrados (Cetamina para EMT).

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Crédito Remanescente' para evitar atritos financeiros na migração de tratamentos.
- Regra de Handoff: Mover para coluna 'Follow-up Jurídico' leads que dependem de liminar.
- Tag de Alerta: Adicionar tag 'Prioridade Clínica' para leads que expressam desesperança severa.
- Extração de Profissional: Identificar se o lead prefere Dr. Ivan pela autoridade ou Marisa para negociação.

## 5. Recomendações para o agente de **atendimento**

- Tom de voz ultra-empático em casos de menção a ideação suicida: 'Entendo perfeitamente sua urgência'.
- Personalização rigorosa: Conferir o nome no cadastro antes de enviar áudios (evitar chamar Marcio de Mário).
- Script de Handoff Jurídico: Ter o contato da advogada parceira em mãos para leads que travam no preço.
- Validação de saldo: Sempre confirmar verbalmente que créditos de sessões anteriores serão honrados.

## 6. Alertas

- ⚠️ Risco de saúde mental crítico: Lead menciona ideação suicida vinculada a questões financeiras.
- ⚠️ Erro de humanização: Atendente trocando nomes de pacientes (ex: Marcio chamado de Mário).
- ⚠️ Perda de tração por barreira de convênio (necessidade de suporte jurídico imediato).

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Rosangela | 5511999593172 | 89 | 28 | migracao_tratamento_por_insucesso_e_preco |
| 2 | Marcio | 5511976090218 | 21 | 3 | reagendamento |
| 3 | Monique Pontes - Financeiro | 5511971114239 | 14 | 1 | sumiu_apos_cotacao_ou_informacao_pagamento |

## 8. Conversas analisadas (transcrição + síntese)

_3 leads com conversa analisada._


### Rosangela — `5511999593172`

**Custom fields:** `{"origem": "Google - Orgânico", "mensagem": "Após seis sessões de infusão de cetamina, infelizmente não senti melhora significativa no meu quadro de depressão. Senti melhora apenas na primeira sessão, quando, como o senhor sabe, diminui muito uma angústia que sentia no peito. Porém, a falta de prazer, de vontade, e a procrastinacao não melhoram e têm me preocupado muito mesmo! Eu não posso perder `

**Cenário:** `migracao_tratamento_por_insucesso_e_preco` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** Rosangela realizou 6 sessões de Cetamina sem melhora na depressão e solicitou desesperadamente a migração para EMT devido ao custo e falta de eficácia. Demonstrou forte restrição financeira (rescisão/seguro desemprego) e propôs usar o saldo de 2 sessões não realizadas de Cetamina para abater o novo pacote. O Dr. Ivan aceitou a proposta, a paciente iniciou a EMT em 14/05 e tem mantido sessões com frequentes reagendamentos por motivos de saúde (gripe/virose) e atrasos logísticos, mas demonstra boa relação com a clínica (enviou perfumes/avaliou no Google).


**Objeções:** Alto custo da EMT (R$ 10.000), Incapacidade financeira (desempregada), Falta de resposta imediata do médico

**Gatilhos:** Troca de tratamento para EMT, Redução de custos (pacote), Parcelamento/Acordo financeiro

<details><summary>Transcrição completa</summary>

- `2026-05-11 16:05` 🤖 Receita 11_05_2026 150010.pdf
- `2026-05-11 16:05` 🤖 Receita 11_05_2026 150110.pdf
- `2026-05-11 16:06` 👤 **[ÁUDIO]** Oi, não é essa receita, é outra. Foram duas. Essa aqui eu paguei no posto. É a outra receita que eu preciso.
- `2026-05-11 16:10` 🤖 rosangela.pdf
- `2026-05-11 16:11` 👤 [Áudio]
- `2026-05-11 16:11` 🤖 Disponha!
- `2026-05-13 13:15` 👤 Bom dia meninas! Infelizmente n
- `2026-05-13 13:17` 👤 **[ÁUDIO]** Claro, aqui está a transcrição de áudio:

Oi, meninas. Bom dia. É, deixa eu falar uma coisa para vocês. Eu tenho duas sessões ainda, né? E assim, não comenta com o doutor não. Eu conversei até com ele já, né? Eu, nossa, eu estou me sentindo no fundo do poço, porque infelizmente essa cetamina não fez efeito para mim. Infelizmente. Se vocês soubessem assim a tristeza que eu estou, não dá para falar. É, são muitos anos sofrendo com isso, mas eu olhei ontem no, mas não comenta com ele não, ele sabe. Aí eu vi no aplicativo de vocês que vocês fazem ECT, né? Estimulação eletromagnética, né? É, aí eu estava vendo, pesquisando, vi que são cinco sessões por semana, né? Vocês podem me passar o valor desse tipo de tratamento? Imagino que seja bem mais caro, né? Não sei. Deixa eu só ver quanto é, por curiosidade, porque, meu deus, se vocês soubessem como o fato de não fazer efeito essa cetamina para mim me deixou triste. Gente do céu, são muitos anos de sofrimento. É, mas vocês podem me passar o valor desse tratamento com ECT? É, só sem compromisso, tá? Por curiosidade que eu estou desempregada, não nem tenho como fazer isso. Mas só para eu saber, entendeu? Se vocês puderem me falar.
- `2026-05-13 13:18` 👤 **[ÁUDIO]** Ah, e outra coisa: os perfumes... Vocês não perguntaram nada, ninguém teve dúvida... Vocês não gostaram? Se não gostaram, não tem problema não. É só uma curiosidade, porque eu vou mais só duas vezes, né? Amanhã e semana que vem. Então, se vocês gostassem de algum que eu não levei aí, eu já levaria amanhã, né? Mas me dá um toque se vocês resolveram não comprar, não tem problema não. Nem todo mundo gosta, né? Nem todo mundo é obrigado. Tá bom? Beijo, obrigada viu?
- `2026-05-13 13:26` 🤖 **[ÁUDIO]** Olá, Rosângela. Bom dia. A Marisa, tudo bem? Eu sinto muito, viu, Rosângela? Entendo o seu problema. Sei que não deve ser nada fácil passar pelo que você está passando. E eu vou te explicar como é que funciona.
- `2026-05-13 13:27` 🤖 **[ÁUDIO]** Quanto à EMT, estimulação magnética transcraniana, o protocolo normalmente que o doutor passa são de 40 sessões, mas você precisa passar com ele para saber se ele faz essa quantidade ou menos, tá? O valor por sessão é duzentos e cinquenta reais no pacote. Nós também parcelamos em seis vezes sem juros, no seu caso, se precisasse de mais a gente poderia falar com o doutor. E é também um tratamento voltado para depressão. Tem bastante resultado também. Mas realmente seria importante você conversar com o doutor a respeito, tá? Se você decidir fazer.
- `2026-05-13 13:28` 🤖 **[ÁUDIO]** "Em relação aos perfumes, a qualidade é maravilhosa, não... não é esse o problema não, o problema tá sendo dinheiro mesmo, da minha parte. Das meninas eu mostrei, elas gostaram, mas... é... uma tem alergia, a outra não é o momento, então... e a Edilene quer conversar com você porque ela vai fazer uma festa da filhinha dela de 15 anos e ela precisa conversar contigo pra ver uma possibilidade, tá bom? Um beijo!"
- `2026-05-13 13:31` 👤 **[ÁUDIO]** "Oi amiga. Meu Deus, é... Só quem tem dinheiro mesmo pode se tratar. Meu Deus, dá R$ 10 mil. Eu não tenho esse dinheiro não, nem entendo de onde tirar. Ai, sei mais nem o que fazer, tô perdidinha assim sabe, tô desorientada. Pra mim foi um choque, foi um choque mesmo o fato desse paracetam- não fazer efeito. Eu acho que eu... Eu pus muita expectativa, sabe? E é isso, e o tratamento é muito caro, muito. Meu Deus do céu. Tá bom, tá bom, quanto aos perfumes não tem problema não, tá? Não se incomoda não. Beijo então, obrigada aí pela ajuda viu?"
- `2026-05-13 13:37` 🤖 Entendo! Talvez seja interessante você falar com o Dr. Ivan. Em muitos casos ele prescreve 20 sessões.
- `2026-05-13 13:37` 🤖 Estamos a disposição
- `2026-05-13 17:56` 👤 **[ÁUDIO]** Oi Marilsa, boa tarde. Eu, dentro daquilo que você me falou das sessões de EMT, eu até vou te passar o que eu passei pro Doutor Ivan. Ele não me respondeu ainda, eu tô preocupada porque amanhã é a data da sessão de cetamina. Só que assim, a cetamina não tá fazendo efeito nenhum pra mim, nenhum. 

Aí eu sugeri pra ele vinte sessões, mas aí as duas últimas de cetamina eu não pago, inteiro mais três mil e pouco, porque assim, Marilsa, sério mesmo, amiga, eu fiquei três anos ganhando um salário mínimo. Esse dinheiro é o dinheiro da minha rescisão. Eu não posso pagar a mais do que isso.

E eu tô apavorada, eu tô apavorada, você entendeu? Porque eu não sei se continuar com a cetamina, eu não sei o que que vai acontecer comigo, porque eu tô parada. Eu não consigo me mexer, eu não tenho motivação, nada, nada, nada. Pergunta pra ele se ele já viu, por gentileza. Me ajuda, Marilsa, porque eu realmente não tenho mais onde tirar dinheiro. É um dinheiro que eu vou tirar e aí depois eu vou ficar com as parcelas do seguro desemprego, você entendeu? É porque eu não tenho mais, não tenho mesmo. 

Me ajuda aí, amiga, se realmente for uma coisa válida, se ele achou que é bom pro meu caso. Me ajuda porque eu tô muito perdida, eu não posso comentar, eu não tenho o que comentar e com quem eu comento, fala: "Rôsa, você é louca, você tá pagando, não tá fazendo efeito, você tá continuando". Mas eu já paguei, né? É fogo. É fogo, Marilsa. Tenta me ajudar aí, ver o que que ele responde, que eu sei que vocês disparam assim, né?
- `2026-05-13 17:56` 👤 Bom dia dr. Ivan! Após seis sessões de infusão de cetamina, infelizmente não senti melhora significativa no meu quadro de depressão. Senti melhora apenas na primeira sessão,  quando, como o senhor sabe, diminui muito uma angústia que sentia no peito. Porém,  a falta de prazer, de vontade, e a procrastinacao não melhoram e têm me preocupado muito mesmo! Eu não posso perder de vez a esperança 🙏! Enfim, gostaria que o senhor visse a possibilidade de troca de tratamento para EMT (se achar que vale a
- `2026-05-13 17:56` 👤 Passei ess mensagem pra ele☝️
- `2026-05-13 17:59` 🤖 **[ÁUDIO]** Oi, Rosângela. Eu fico aqui até as 19:00, tá bom? Normalmente o doutor fica até as 18:00, 18:30. Entendo o seu problema, eu vou conversar, vou passar mensagem para ele também reforçando o seu pedido, tá bom? Fica tranquila, vai dar tudo certo. Beijo.
- `2026-05-13 18:36` 👤 **[ÁUDIO]** Oi Marilsa, nossa, te agradeço muito, viu? É, mas eu estou chegando em casa agora e vi que ele aceitou. Se ele aceitou, nossa, porque eu falei "meu Deus", até pedi para Deus na hora, né? Se for para o meu bem, se for realmente fazer efeito, que ele aceite a minha proposta, né? Porque é o máximo que eu posso pagar. E assim, é duro a gente ganhar pouco, você sabe, dar um valor tão grande sem ter resultado, né? E meu problema é grave, as pessoas não entendem, quem não tem não entende, né? Mas só para você entender, ele deu o acordo dele agora. Então amanhã seria a sessão de cetamina, não vai ser mais. Como que a gente faz?
- `2026-05-13 18:41` 🤖 **[ÁUDIO]** Oi Rosângela, sem problema. Agora é só agendar. Vai deixar para amanhã mesmo? Aí quando você vier aqui, você informa aqui para nós em relação... eu e a Edileine já estamos sabendo, mas só nos recorda que é preciso converter o valor da cetamina para o tratamento de MT e pagar o restante, tá bom?
- `2026-05-13 18:55` 👤 **[ÁUDIO]** Ô Marisa, que coisa boa! Se ele aceitou... eu ainda conversando com Deus, né? Falei: "Se ele aceitar é porque vai ser bom pra mim", porque a s-cetamina realmente não funcionou pra mim, entendeu? E eu, assim, tô apavorada... da questão financeira, lógico, né? Porque eu tô desempregada, mas assim, apavorada... eu falei: "Meu Deus do céu, eu não tenho cura!". A gente pensa até coisa ruim, né? Suicídio mesmo, a gente pensa nisso, você entendeu? Falei: "Eu não tenho mais saída", né? É... então... ai... Mas a gente não pode marcar pra amanhã, tipo, sei lá, entre dez, onze horas?
- `2026-05-13 18:57` 👤 **[ÁUDIO]** E eu acerto a diferença aí na hora, tá?
- `2026-05-13 19:02` 🤖 Te entendo sim! Imagino que não deve ser nada fácil passar por isso.
- `2026-05-13 19:02` 🤖 Agendado para amanha as 10:00 hs
- `2026-05-13 19:02` 👤 Ok! Muito obrigada!
- `2026-05-14 11:09` 🤖 **[ÁUDIO]** Olá, bom dia Rosângela, tudo bem? Edilene aqui da Clínica Or. Rosângela, a gente teve uma intercorrência aqui na agenda e aí a gente está remanejando alguns pacientes. Teria como você vir no período da tarde? Porque antes de você iniciar o EMT, é necessário fazer uma parametrização. O que seria essa parametrização? A parametrização é o mapeamento de qual ponto precisa ser estimulado e aí precisa estar presente a enfermeira e o doutor. E como esse horário que a Mariza agendou você às 10 horas, o doutor vai estar em atendimento, ele não vai poder acompanhar. Então queria saber se você consegue chegar aqui às 14:30.
- `2026-05-14 16:43` 🤖 Rosangela aguarda para parametrização.
- `2026-05-14 18:12` 👤 *[imagem]*
- `2026-05-14 18:12` 👤 **[ÁUDIO]** Bom dia. É o seguinte, ontem eu recebi um e-mail com as diretrizes da nova campanha. Eu vou passar para vocês agora quais são os principais pontos que a gente tem que focar. Vou compartilhar minha tela, tá bom? Só um minutinho.
- `2026-05-14 19:38` 🤖 Próxima sessão de EMT amanhã as 10:00 hs
- `2026-05-14 19:46` 👤 Ok! Muito obrigada!
- `2026-05-14 19:48` 🤖 Disponha
- `2026-05-16 08:11` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-19 11:28` 👤 **[ÁUDIO]** Oi meninas, bom dia. É, desculpa eu falar só agora, eu tava, eu estava deitado, achei que ia melhorar, mas eu não consegui melhorar. É, eu tô com uma gripe danada. Eu saí daí ontem, peguei garoa até o metrô, né, e eu percebi que eu não tava boa já ontem de noite, mas eu imaginei que ia acordar melhor, mas não acordei. É, eu falei, melhor eu não ir, porque aí é muito fechado, acho que o doutor nem vai gostar, né. É, peço desculpa, tá? Porque realmente eu não tô boa. Tá aquela dor no corpo, meu Deus do céu. É, mas amanhã eu vou certinho, tá? Eu não falo que eu vou hoje à tarde, porque do jeito que eu tô, eu não vou melhorar hoje à tarde, tá bom? Amanhã no mesmo horário, tá? Só me dá um alô depois pra falar que tá tudo bem. Obrigada, viu.
- `2026-05-19 11:30` 🤖 **[ÁUDIO]** Olá Rosângela, tudo bem? É Edilene, aqui da clínica Ortho. Sem problema, tá bom? A gente vai reagendar pra amanhã no mesmo horário e aí qualquer coisa, se você ainda não se sentir bem, é só sinalizar pra gente, tá? Fica tranquila, tenha um bom dia e melhoras.
- `2026-05-19 11:32` 👤 **[ÁUDIO]** Tá, não, tá, eu vou... É, se Deus quiser, durante o dia eu vou ter que melhorar. Eh, eu até tomei aquele Chá Vick, sabe? Que te dá um sono danado, né? Eh, suei ontem. Eu não tô com febre. Com febre eu não tô, tava ontem. Mas, eh, eu não tô bem. Eh, percebo que eu não tô bem. É, o corpo ainda dói, aquele mal-estar. Não adianta. Mas amanhã eu vou, com certeza, sim, tá? Obrigada, viu!
- `2026-05-19 11:37` 🤖 Ok sem problemas
- `2026-05-19 11:37` 🤖 Te desejo melhoras
- `2026-05-19 11:38` 👤 Muito obrigada! Amanhã estarei aí.
- `2026-05-26 11:51` 👤 Bom dia meninas
- `2026-05-26 11:52` 👤 Hoje tô tendo3 um pouco de trabalho com meu pai
- `2026-05-26 11:53` 👤 Posso chegar ao entre 11 e 11:30?
- `2026-05-26 11:54` 🤖 Bom dia, Rosangela. Tudo bem?
- `2026-05-26 11:55` 👤 Sim
- `2026-05-26 11:55` 🤖 Você pode chegar até as 11:00 hs
- `2026-05-26 11:55` 🤖 Ou então as 13:30 hs
- `2026-05-26 11:56` 🤖 O que você prefere?
- `2026-05-26 11:57` 👤 Vou tentar chegar as 11
- `2026-05-26 11:58` 🤖 Não prefere vir as 13:30 hs? Não é mais certo?
- `2026-05-26 11:58` 🤖 Este horário das 11:00 hs, não pode ter atrasos.
- `2026-05-26 11:58` 👤 Então tá bom
- `2026-05-26 11:59` 👤 Fica para as 13:30
- `2026-05-26 11:59` 🤖 Combinado! Bjs
- `2026-05-26 11:59` 👤 Bjs
- `2026-05-28 12:00` 👤 Bom dia meninas!! Meu ônibus tá demorando muito! Posso atrasar um pouco?
- `2026-05-28 12:03` 🤖 Oi Rodangela. Bom dia!
- `2026-05-28 12:03` 🤖 Você tem 30 mtos de tolerancia! ok? bjsinu
- `2026-05-28 12:03` 👤 Mas já tô na rua
- `2026-05-28 12:03` 🤖 ok
- `2026-05-28 12:04` 👤 **[ÁUDIO]** Oi meninas, eu acho que em 30 minutos, ou antes de 30 minutos eu não atraso, é que o ônibus está demorando muito, está me dando agonia já. Se eu ver que eu vou atrasar mais de 30 minutos, aí eu chamo vocês de novo, tá? Se eu não ligar é porque eu vou chegar no horário. Ah, já está chegando o ônibus ali, graças a Deus.
- `2026-05-28 12:05` 🤖 Fique tranquila
- `2026-05-28 12:52` 👤 **[ÁUDIO]** Oi, meninas, acabei de descer no Trianon-Masp, tá? Já tô descendo a Alameda Campinas, tá bom? Desculpa, gente, hoje o ônibus demorou demais. Tô chegando, beijo.
- `2026-05-28 12:53` 🤖 Ok fique tranquila
- `2026-06-01 10:16` 👤 **[ÁUDIO]** Bom dia, meninas. Eu acordei... não, desde ontem eu estou muito ruim. Eu fui no médico e tudo, não adiantou nada. Falou que era uma virose... e eu tô que... ontem eu fiquei péssima. E eu sabia que eu não ia conseguir hoje. Já acordei, acordei mal. Vou ter que voltar no pronto-socorro. Eh, eu peço desculpas, tá? Vamos ver o que ele passa durante o dia, porque, na verdade, passou só paracetamol, como se paracetamol fizesse milagre. Então, eu não vou ter como ir hoje, viu? Eh, eu peço desculpas e amanhã eu vou... quer dizer, se eu melhorar, se Deus quiser, eu tenho que melhorar, porque eu vou voltar lá hoje. Desculpa mais uma vez, meninas.
- `2026-06-01 10:16` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-01 10:48` 🤖 **[ÁUDIO]** Bom dia, Rosângela, tudo bem? Nossa, é tão ruim ficar doente, né? Mas tá bom, sem problema, a gente vai tirar você aqui da agenda e estimamos que você fique bem, tá bom? Qualquer coisa estamos à disposição. Melhoras, se cuida.
- `2026-06-01 10:50` 👤 **[ÁUDIO]** Oi, Tiledi, obrigada, obrigada, mas eu acho que eu vou ter que voltar no UPA aqui perto da minha casa, né, porque, minha filha, eu tô péssima, meu Deus, parece que eu tô mal, e diz que é uma virose... Que virose? Não é isso não, imagina. Sei que eu tô péssima, fazendo xixi nas calças, sabe? Você chega a uma idade, você não chegou ainda, que você fica com incontinência, então não consigo nem sair na rua. Ai, tá um horror, tá um horror. Eu sei que eu não tô tendo febre, né? Febre melhorou, mas o resto tá horrível, horrível, não consigo fazer nada. Meu Deus do céu, peço desculpas, viu? Eu não gosto de faltar assim, mas tem dia que não dá, não dá, eu não consigo sair da cama. Não consigo. Bom, infelizmente é isso. Bom dia pra vocês e obrigada por compreender, tá? E eu levo sua amostra amanhã, pode ficar tranquila porque eu tinha separado já, né? Então é isso, tá? Beijo, fica com Deus.
- `2026-06-01 10:58` 🤖 Tranquilo. Melhoras
- `2026-06-02 12:45` 🤖 Olá bom dia Rosangela, como vai?
- `2026-06-02 12:45` 🤖 Esta melhor para fazer sua sessão de EMT hoje?
- `2026-06-02 12:46` 👤 Sim
- `2026-06-02 12:46` 👤 Já tô chegando
- `2026-06-02 12:46` 🤖 Que bom que esta melhor.
- `2026-06-02 12:46` 👤 🙏🏼
- `2026-06-09 15:03` 👤 Oi Meninas! Estou indo pra casa somente agora.  Infelizmente hoje não vou para o tratamento.  Peço que vcs agendem pra amanhã,  às 10h. Bjs e muito obrigada!
- `2026-06-09 15:04` 🤖 Bom dia, Ro!
- `2026-06-09 15:04` 🤖 Combinado.
- `2026-06-11 20:58` 🤖 Ro, caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr
- `2026-06-11 21:06` 👤 Oi!  Eu já avaliei. Foi hoje mesmo. Sei da importância dessas avaliações.  Pode contar comigo!
- `2026-06-11 21:08` 🤖 **[ÁUDIO]** Rô, tudo bem? O que nós tínhamos te mandado antes era uma pesquisa. Aí, o doutor gostou tanto da sua resposta que ele pediu pra você avaliar a clínica pro site. Se você puder fazer essa gentileza, mais uma vez. Muito obrigada, beijão.
- `2026-06-12 12:44` 👤 **[ÁUDIO]** Sim, eu tenho toda a certeza absoluta que se não houver um comprometimento rápido do agronegócio, dos produtores rurais brasileiros para conter o desmatamento, vai faltar água para a irrigação no Brasil. Eu não tenho dúvida nenhuma sobre isso. Porque o volume de água que a Amazônia bombeia para a atmosfera é gigantesco. E os modelos climáticos estão mostrando que esse volume de humidade, ele é jogado para o leste, desce ali ao lado dos Andes, e irriga toda a região central do Brasil, o sul do Brasil, chega até no Uruguai e na Argentina. E se desmatar a floresta, o ciclo de chuvas muda. Ele passa a ser um ciclo de chuvas torrenciais, concentrados em poucos meses. E o agronegócio no Brasil precisa de água. Sem água não se colhe soja, milho ou cana-de-açúcar. Então eles mesmos são os maiores prejudicados pela destruição da floresta amazônica.
- `2026-06-12 12:47` 🤖 **[ÁUDIO]** Oi, bom dia, tudo bem, Rosângela? Então, a gente não conseguiu ouvir o seu áudio, ele saiu mudo.
- `2026-06-12 16:18` 👤 **[ÁUDIO]** Oi, meninas, depois me manda o link pra pesquisa que eu tenho que fazer? Eu não sei onde entrar. Eu só preenchi essa pesquisa que vocês me mandaram o link aí, tá vendo? Ó: "No caso de ainda não ter feito a avaliação, solicitamos a gentileza de avaliar..." nã nã nã... É esse aí que eu fiz. Agora, se tem algum outro, manda o link pra mim, tá? Obrigada, viu, gente?
- `2026-06-12 16:51` 🤖 Ro, caso ainda não tenha feito a avaliação, solicitamos a gentileza de avaliar a Clínica Ór, ficaremos felizes em ver sua avaliação.  Segue o link https://shre.ink/avaliacaoclinicaohr
- `2026-06-12 16:51` 🤖 **[ÁUDIO]** Oi, Rô, é essa mesmo. Você já fez, então ótimo, tá bom? Muito obrigada, bom final de semana.
- `2026-06-16 14:19` 🤖 Agendado para dia 23/06 próxima terça feira as 10h retorno Dr Ivan
- `2026-06-16 17:42` 🤖 Olá boa tarde  Ro, fui informada que sua solicitação de prescrição médica, já está  disponível no App. Estimo melhoras no seu tratamento e seguimos à disposição.

</details>


### Marcio — `5511976090218`

**Custom fields:** `{"mensagem": "Lead pediu marcação de consulta presencial com Dr Ivan; provável primeira consulta.", "interesse": "Consulta com psiquiatria", "observacoes": "Lead pediu marcação de consulta presencial com Dr Ivan; provável primeira consulta.", "qualificacao": "interessado", "procedimentos": ["Primeira Consulta"], "demonstrou_interesse": true, "procedimento_interesse": "primeira_consulta"}`

**Cenário:** `reagendamento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** O paciente Marcio, que já faz acompanhamento, solicitou inicialmente uma consulta presencial com o Dr. Ivan. Chegou a agendar para o mesmo dia às 17h30, mas logo depois solicitou a mudança para o dia seguinte por conveniência logística. Após verificar a disponibilidade, o atendimento foi reagendado para quinta-feira às 10h30, conforme preferência do lead.


**Objeções:** Conflito de agenda (preferência por realizar consulta em dia que já estaria na região)

**Gatilhos:** Praticidade (conciliar compromissos na região), Disponibilidade de horário matutino

<details><summary>Transcrição completa</summary>

- `2026-06-16 17:05` 👤 Boa tarde
- `2026-06-16 17:05` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-16 17:05` 👤 Gostaria de marcar uma consulta presencial com o Dr Ivan
- `2026-06-16 17:11` 🤖 **[ÁUDIO]** Olá, Márcio. Boa tarde, tudo bem? Quem fala é a Marisa. Você já é paciente ou seria a primeira vez?
- `2026-06-16 17:13` 👤 Sou paciente
- `2026-06-16 17:18` 🤖 Temos horário hoje as 17:30 hs. Você tem disponibilidade?
- `2026-06-16 17:48` 👤 Ok
- `2026-06-16 17:48` 👤 Hj 17:30
- `2026-06-16 17:49` 🤖 A consulta será presencial ou online?
- `2026-06-16 17:49` 👤 Presencial
- `2026-06-16 17:51` 🤖 Certo Márcio! Agendado! Hoje as 17:30 hs.
- `2026-06-16 17:52` 👤 👍🏻
- `2026-06-16 18:01` 👤 **[ÁUDIO]** Oi, boa tarde. Deixa eu te fazer uma pergunta. Por acaso, amanhã de manhã você teria horário com o Dr. Ivan presencial também? Porque eu vou estar aí do lado e, para não ter que ir hoje e voltar amanhã, se fosse possível, eu já gostaria de fazer tudo numa única ida, né? Então me fala que horários que você tem amanhã. Eu acredito que amanhã entre 10 e 11 seria o ideal, se tiver. Valeu!
- `2026-06-16 18:04` 🤖 **[ÁUDIO]** Oi Mário, tudo bem? Edilene aqui da Clínica Or. Mário, a gente tem horário na quinta de manhã, funciona pra você? De repente você consegue vir aqui por volta das onze e meia, que que você acha?
- `2026-06-16 18:07` 🤖 Quinta feira as 11h30 funciona para você ou prefere manter hoje as 17h30?
- `2026-06-16 18:07` 👤 Mais cedo vc teria?
- `2026-06-16 18:08` 🤖 Quinta temos horário as 10h30, seria melhor para você?
- `2026-06-16 18:16` 🤖 Marcio, podemos manter seu agendamento de hoje ou gostaria de mudar para quinta?
- `2026-06-16 18:16` 👤 Melhor
- `2026-06-16 18:17` 👤 5a 10:30
- `2026-06-16 18:17` 🤖 Certo, agradecemos o retorno. Seguimos a disposição.

</details>


### Monique Pontes - Financeiro — `5511971114239`

**Custom fields:** `{"mensagem": "Lead perguntou se cetamina é coberta pelo plano de saude. Template do site recebido: ref=fba5fc4c9d", "interesse": "Infusão de Cetamina", "observacoes": "Lead perguntou se cetamina é coberta pelo plano de saude. Template do site recebido: ref=fba5fc4c9d", "qualificacao": "interessado", "procedimentos": ["Infusão de cetamina"], "demonstrou_interesse": true, "procedimento_interesse": "`

**Cenário:** `sumiu_apos_cotacao_ou_informacao_pagamento` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** Monique entrou em contato buscando aplicação de cetamina para a filha de sua chefe via convênio. A atendente informou que a clínica é particular, mas ofereceu o suporte de uma advogada parceira para judicialização contra o plano. A lead ficou de consultar a chefe sobre essa possibilidade e solicitar o contato da advogada se houver interesse. Sem agendamento imediato.


**Objeções:** Pagamento via convênio (não aceita direto)

**Gatilhos:** Parceria jurídica para reembolso/liminar, Especialidade em cetamina

<details><summary>Transcrição completa</summary>

- `2026-06-16 19:24` 👤 Olá! Gostaria de agendar uma consulta.  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=fba5fc4c9d)
- `2026-06-16 19:24` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-16 19:25` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-16 19:25` 🤖 Você já é paciente ou seria a primeira vez?
- `2026-06-16 19:25` 👤 vcs fazem aplicação de cetamina pelo plano de saude?
- `2026-06-16 19:26` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-16 19:26` 👤 é para filha da minha chefe
- `2026-06-16 19:27` 👤 ela está procurando algum lugar para fazer pelo convênio
- `2026-06-16 19:27` 🤖 Entendi!
- `2026-06-16 19:28` 🤖 **[ÁUDIO]** Olá, Monique! Quem fala é Marisa. Boa tarde, tudo bem? Monique, nós somos uma clínica que trabalhamos de forma particular. Mas existe a possibilidade de você, caso o convênio não aprove as solicitações em relação à cetamina, solicitar uma ação judicial. E nós temos parceria com uma advogada que faz todo esse trâmite, é especialista nesses casos. Ajudaria vocês?
- `2026-06-16 19:29` 👤 entendiii
- `2026-06-16 19:29` 👤 vou falar com ela
- `2026-06-16 19:30` 👤 e ai te peço o contato da advogada
- `2026-06-16 19:30` 🤖 Combinado!

</details>
