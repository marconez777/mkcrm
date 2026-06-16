---
title: "Estudo: Leads de entrada"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Leads de entrada' do funil Agendamentos Novo (Clínica ÓR): 7 leads."
---

# Estudo: Leads de entrada

**Coluna:** `Leads de entrada` (posição 0) — **7 leads** analisados.


## 1. Perfil típico

O lead de entrada nesta coluna é heterogêneo, variando de pessoas que realizaram testes de auto-diagnóstico online (PHQ-9) a profissionais de saúde (psicólogos) buscando tratamento especializado para si ou para terceiros. Há uma parcela significativa de ruído, incluindo contatos de representantes farmacêuticos ou resoluções de problemas logísticos da própria clínica. O lead qualificado geralmente possui uma dor latente específica (como alcoolismo ou depressão), já conhece ou busca um método de tratamento (ex: Sinclair) e está na fase de validar a logística presencial e a confiança no profissional (Dr. Ivan) antes de converter.


### Procedimentos mais mencionados

- Método Sinclair (Alcoolismo)
- Infusão (não especificada)
- Avaliação Psiquiátrica Inicial
- Psicoterapia

### Profissionais mais mencionados

- Dr. Ivan Baremboim
- Marisa (Atendente)
- Edilene (Atendente)

### Objeções mais comuns

- Receio de efeitos colaterais de medicações específicas (Naltrexona).
- Logística e localização da clínica para atendimentos presenciais.
- Frequência e duração do tratamento continuado.
- Instabilidades pontuais em links de pagamento (SumUp).

### Gatilhos de entrada na coluna

- Teste PHQ-9 (Depressão) preenchido no site.
- Busca por tratamentos específicos (Método Sinclair para alcoolismo).
- Indicação médica ou profissional (como o caso da psicóloga Valéria).
- Necessidade de pagamento de procedimentos previamente combinados.

## 2. Padrões observados (Top 10)

1. Mistura de leads B2C (pacientes) com B2B (representantes farmacêuticos).
2. Uso do atendimento humano para contornar falhas de interpretação da IA.
3. Leads vindos de ferramentas de auto-avaliação (PHQ-9) com alta intenção, mas dúvida na especialidade.
4. Solicitação imediata de Nota Fiscal e dados de faturamento após pagamentos.
5. Pacientes que são profissionais da saúde (psicólogos) buscando psiquiatras.
6. Interrupções de fluxo por questões administrativas externas (compras da clínica).
7. Expectativa de agendamento imediato após validação de preço.
8. Baixa tolerância a delays em links de pagamento.
9. Interesse em métodos específicos e modernos de tratamento.
10. Preferência por atendimento humano após mensagens automáticas de fora de horário.

## 3. Erros recorrentes do agente IA atual

- IA confundiu intenção de agendamento genuíno com proposta comercial.
- IA/Bot agiu como consumidor de suporte externo ao invés de canal de atendimento clínico.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Origem do Lead' (PHQ-9, Direto, Indicação).
- Implementar B-rule para marcar imediatamente como 'Desqualificado' contatos com a tag 'Representante'.
- Criar campo 'Paciente Profissional de Saúde' para atendimento personalizado.
- Mover leads de pagamento concluído para coluna de 'Pós-Venda' imediatamente para limpeza do funil de entrada.

## 5. Recomendações para o agente de **atendimento**

- Script PHQ-9: 'Vi que você fez o teste de depressão. O Dr. Ivan é especialista nessa área. Gostaria de agendar uma avaliação?'
- Repensar o tratamento de 'Propostas comerciais' para garantir que agendamentos não sejam descartados por engano.
- Handoff: Quando o lead for profissional de saúde, elevar o tom de autoridade técnica no atendimento.
- Cuidado com o 'Out of Office': Leads que chegam à noite precisam de retorno prioritário na abertura da clínica.

## 6. Alertas

- ⚠️ Erros graves de triagem: Leads de pacientes sendo confundidos com parcerias comerciais.
- ⚠️ Uso do WhatsApp da clínica para fins pessoais/logísticos (Mercado Livre) por funcionários.
- ⚠️ Perda de timing em leads vindos de testes de saúde (PHQ-9) que aguardam definição de especialista.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Edmara Schröder | 491784304965 | 3 | 0 | duvida_psicologo_psiquiatra |
| 2 | — | 5511926096906 | 2 | 0 |  |
| 3 | Andrea Mendes | 5511963436378 | 3 | 0 | erro_atendimento_venda_como_proposta |
| 4 | 5511911681948 | 5511994234501 | 23 | 0 | fora_escopo |
| 5 | Pedro Ellias BRACEPHARMA | 5519989742325 | 8 | 0 | admin_parceria |
| 6 | Valéria Godoy - Psicóloga | 5511995382707 | 45 | 2 | agendou_apos_duvidas_tratamento |
| 7 | Ricardo | 5511973690305 | 17 | 0 | pagamento_procedimento |

## 8. Conversas analisadas (transcrição + síntese)

_6 leads com conversa analisada._


### Edmara Schröder — `491784304965`

**Custom fields:** `{"mensagem": "Código de fila: ref=db4fa52006", "interesse": "Consulta com psiquiatria", "observacoes": "Código de fila: ref=db4fa52006", "procedimentos": ["Primeira Consulta"], "demonstrou_interesse": true, "procedimento_interesse": "primeira_consulta"}`

**Cenário:** `duvida_psicologo_psiquiatra` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** Edmara entrou em contato após realizar o teste de depressão PHQ-9, buscando uma avaliação inicial. O atendimento iniciou fora do horário comercial com mensagem automática. No retorno humano/IA, foi questionada se prefere psicólogo ou psiquiatra, apesar do interesse prévio em psiquiatria no cadastro. Aguarda definição para agendamento.


**Gatilhos:** teste_phq9_detectado, autoavaliacao_depressao

<details><summary>Transcrição completa</summary>

- `2026-06-15 10:43` 👤 Olá! Fiz o teste de depressão PHQ-9 e gostaria de agendar uma avaliação.  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=db4fa52006)
- `2026-06-15 10:44` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-15 14:48` 🤖 Bom dia, Edmara. Você deseja avaliação de psicólogo ou psiquiatra?

</details>


### Andrea Mendes — `5511963436378`

**Custom fields:** `{"mensagem": "ref=163123eaf9", "observacoes": "ref=163123eaf9", "demonstrou_interesse": true}`

**Cenário:** `erro_atendimento_venda_como_proposta` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A paciente Andrea Mendes entrou em contato com a intenção clara de agendar uma consulta na clínica. No entanto, o bot/atendente interpretou erroneamente a mensagem como uma oferta de serviços ou parceria comercial, direcionando a paciente para um e-mail de propostas. Não houve agendamento devido a essa falha na triagem inicial.


**Gatilhos:** Agendamento de consulta

**Erros do bot:** A IA/Bot confundiu um pedido de agendamento de paciente com uma proposta comercial/parceria.

<details><summary>Transcrição completa</summary>

- `2026-06-15 15:56` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=163123eaf9)
- `2026-06-15 16:21` 🤖 Olá Andrea como vai? Para propostas e apresentações de serviços solicitamos que envie por e-mail para o responsável, caso haja interesse ele te retornará via e-mail, segue o contato ivanbaren@gmail.com
- `2026-06-15 16:21` 🤖 Seguimos a disposição.

</details>


### 5511911681948 — `5511994234501`

**Cenário:** `fora_escopo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** A conversa não é um atendimento clínico. O atendente da clínica (Edilene) utilizou o número para tratar de uma reclamação de compra de chá no Mercado Livre. O representante do marketplace resolveu o problema oferecendo reembolso parcial, que foi aceito. Não houve interesse em serviços de psiquiatria.


**Erros do bot:** o bot da clínica agiu como comprador/consumidor interagindo com um suporte externo (Mercado Livre) em vez de realizar atendimento clínico

<details><summary>Transcrição completa</summary>

- `2026-06-16 11:34` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-16 11:34` 🤖 Certo, aguardo retorno.
- `2026-06-16 11:38` 👤 Olá! Bom dia! Tudo bem com você? Me chamo Gustavo, sou representante do Mercado Livre e estou aqui para te auxiliar neste atendimento hoje. 💛
- `2026-06-16 11:38` 👤 Com quem eu falo nesse atendimento?
- `2026-06-16 11:38` 🤖 Edilene
- `2026-06-16 11:39` 🤖 Fiz a compra de um kit chá e só foi entregue uma caixinha com 10 unidades.
- `2026-06-16 11:40` 🤖 Mas como o mercado livre tem feito muitos reagendamentos de compras, achei que seria entregue o restante posteriormente.
- `2026-06-16 11:40` 👤 Compreendi, seria essa compra *"Chá Twinings 10 Caixas 100 Sachês Embalados Individualmente"* https://produto.mercadolivre.com.br/MLB-5373245338-cha-twinings-10-caixas-100-sachs-embalados-individualmente-_JM, correto?
- `2026-06-16 11:41` 👤 Entendo, mas não se preocupe Edilene que irei te ajudar a resolver esse transtorno, tudo certo
- `2026-06-16 11:42` 🤖 Isso mesmo.
- `2026-06-16 11:44` 👤 Eu tenho 2 opções para você escolher a que mais te atende nesse momento Edilene:  1\. devolver a sua compra toda que chegou e receber o reembolso total;  2 receber um reembolso parcial de 155,70 referente as que faltaram e ficar com a que chegou
- `2026-06-16 11:44` 🤖 2
- `2026-06-16 11:45` 👤 Entendido, vou seguir aqui com essa sua escolha no sistema peço so um momento por gentileza Edilene 😃
- `2026-06-16 11:45` 🤖 Receber o reembolso parcial
- `2026-06-16 11:46` 🤖 Certo.
- `2026-06-16 11:51` 👤 Prontinho Edilene, seu reembolso já está disponível em sua conta Mercado Pago, você pode visualizar por 2 valores de  R$ 8,05 e R$ 147,65. E localizar pelos ID:  id:164345666812  id:164345291848
- `2026-06-16 11:52` 🤖 Agradeço o retorno.
- `2026-06-16 11:52` 👤 De nada, te auxilio em algo mais?
- `2026-06-16 11:53` 🤖 Não, somente isso. Muito obrigada.
- `2026-06-16 11:54` 👤 Entendido, sendo assim, foi um prazer te atender hoje Edilene. Precisando de qualquer ajuda ou tiver outras dúvidas pode entrar em contato novamente, estaremos aqui para te auxiliar da melhor forma, tenha um ótimo dia 💛
- `2026-06-16 11:55` 🤖 Tenha um ótimo dia.

</details>


### Pedro Ellias BRACEPHARMA — `5519989742325`

**Custom fields:** `{"mensagem": "lead de BracePharma apresentando portfólio (pitch B2B)", "observacoes": "lead de BracePharma apresentando portfólio (pitch B2B)", "qualificacao": "desqualificado", "motivo_desqualificacao": "spam_propaganda"}`

**Cenário:** `admin_parceria` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=True


**Síntese:** O contato foi realizado por Pedro, representante da BracePharma, com o objetivo comercial de apresentar um portfólio de medicamentos e entregar amostras ao Dr. Ivan. A atendente Marisa informou prontamente que o médico não recebe representantes e que a clínica não aceita amostras. A conversa foi encerrada sem agendamento ou interesse por parte da clínica.


**Objeções:** Política da clínica de não receber representantes, Não aceitação de amostras grátis

**Gatilhos:** Apresentação de portfólio farmacêutico, Entrega de amostras grátis

<details><summary>Transcrição completa</summary>

- `2026-06-16 12:51` 👤 Bom dia. Tudo bem ? Pedro da BracePharma
- `2026-06-16 12:52` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-16 13:03` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-16 13:03` 🤖 Como posso ajudá-lo Pedro?
- `2026-06-16 13:04` 👤 Ola Marisa. Consigo agendar uma visita com o dr Ivan para apresentar meu portifólio?
- `2026-06-16 13:13` 🤖 Olá Pedro! O Dr. Ivan não recebe representantes.
- `2026-06-16 13:17` 👤 Ah sim. O dr permite deu até amostras?
- `2026-06-16 13:18` 🤖 Não recebemos amostras.

</details>


### Valéria Godoy - Psicóloga — `5511995382707`

**Custom fields:** `{"demonstrou_interesse": true}`

**Cenário:** `agendou_apos_duvidas_tratamento` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A lead Valéria, psicóloga de 62 anos, buscou tratamento para alcoolismo via Método Sinclair. Questionou sobre convênio, precificação e o 'todo' do tratamento (frequência de consultas). Demonstrou receio quanto a efeitos colaterais que teve anteriormente com Naltrexona. Após esclarecimentos da equipe sobre a dinâmica das consultas e localização da clínica, agendou consulta presencial para o dia 22/06 às 11:30.


**Objeções:** Efeitos colaterais da medicação (Naltrexona), Logística (localização/horário), Preço (mencionado no fluxo, mas aceito)

**Gatilhos:** Método Sinclair, Experiência do especialista, Controle de danos (álcool)

<details><summary>Transcrição completa</summary>

- `2026-06-16 15:40` 👤 Olá! Gostaria de saber informações sobre a consulta on-line ou presencial com o Dr. Ivan Baremboim (alcoolismo).   Ele atende algum convênio?   (ref=43d194b3c1)
- `2026-06-16 15:40` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-16 15:42` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-16 15:43` 🤖 Claro, já te passo nossa precificação/como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-16 15:44` 👤 Quero diminuir ou parar o consumo de álcool pois tenho 62 anos e percebo que não me faz bem.
- `2026-06-16 15:48` 🤖 Entendi, Valéria. De fato, o alcoolismo é uma doença que gera muito sofrimento e prejuízo em todas as áreas da vida
- `2026-06-16 15:48` 🤖 Acredito que você  esteja buscando ajuda no lugar certo, pois o Dr. Ivan tem vasta experiência com esse tipo de problema, tendo sido o pioneiro no Brasil a utilizar o Método Sinclair.
- `2026-06-16 15:48` 🤖 Ele já ajudou centenas de pessoas na mesma situação a voltar a ter controle sobre o consumo de álcool e, com isso, a retomar o controle sobre a vida de modo geral.
- `2026-06-16 15:48` 🤖 Veja depoimentos dos nossos pacientes que já transformaram suas vidas com este tratamento
- `2026-06-16 15:48` 🤖 *[imagem]*
- `2026-06-16 15:48` 👤 Eu já vi.
- `2026-06-16 15:49` 🤖 *[imagem]*
- `2026-06-16 15:49` 👤 Agora gostaria de saber como funciona o tratamento, prazos e valores.
- `2026-06-16 15:50` 🤖 Certo! Nosso atendimento é diferenciado, por isso só atendermos de forma particular.
- `2026-06-16 15:50` 🤖 Temos horário hoje as 17:00 hs. Você tem disponibilidade?
- `2026-06-16 15:50` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-06-16 15:53` 👤 A partir da 1a consulta, como é o tratamento?? Consultas semanais? Mensais? Qual o valor?  Quero saber o “todo” e não só a 1a consulta.
- `2026-06-16 15:54` 🤖 Como funciona
- `2026-06-16 15:54` 🤖 Na primeira consulta ou teleconsulta, o Dr. irá  avaliar o caso de maneira abrangente e indicará o melhor tratamento tanto para o problema com o álcool quanto prescrever quanto para outros problemas de saúde mental, se houver.
- `2026-06-16 15:54` 🤖 Ele também vai explicar como fazer o Método Sinclair da maneira mais correta e otimizada para aumentar a chance de o paciente voltar a ter controle sobre o álcool e, por consequência, sobre a própria vida.
- `2026-06-16 15:54` 🤖 Além disso, ele vai tirar todas as suas dúvidas sobre o assunto.
- `2026-06-16 15:55` 🤖 Perguntas técnicas O que é e como funciona o Método Sinclair? - Um dos mecanismos que explicam o alcoolismo é a conexão disfuncional feita pelo cérebro do paciente entre o uso do álcool e a recompensa/prazer. - O Método Sinclair tem uma taxa de sucesso alta (80%) justamente por ser capaz de enfraquecer este pareamento entre álcool e recompensa. - Utiliza-se uma medicação capaz de bloquear o Sistema de Recompensa Cerebral de forma a impedir que o cérebro continue associando álcool com recompensa.
- `2026-06-16 15:55` 🤖 Como é o acompanhamento? Em média, a segunda consulta é feita dois meses após a primeira. Se tudo estiver correndo bem, a terceira consulta se dá quatro meses após a segunda. Mas, há casos em que o acompanhamento tem que ser mais próximo. Isso é algo que só o Dr. Ivan poderá definir.
- `2026-06-16 15:56` 🤖 Posso te ajudar esclarecendo mais alguma dúvida?
- `2026-06-16 16:05` 👤 Sim. Eu já tomei Naltrexona antes ( não no método seguinte sinclair) e tive dor de cabeça, enjoo, mal estar… é comum?
- `2026-06-16 16:11` 🤖 **[ÁUDIO]** Oi, Valéria! Boa tarde. Tudo bem? Aqui quem fala é Edirlane, da clínica OR. Então, referente à sua dúvida, cada caso é um caso, né? Por isso que a gente sempre sinaliza para os pacientes que têm interesse tanto em consulta com o Dr. Ivan, quanto no método Sinclair, que agende uma consulta. Converse com ele sobre todos os sintomas que teve com relação ao tratamento, no seu caso a medicação, né? A naltrexona. E aí o doutor vai te orientar da melhor forma possível, se realmente foi ele que te causou esses sintomas ou se foi uma outra coisa atrelada à medicação.
- `2026-06-16 16:12` 🤖 **[ÁUDIO]** Nós temos atendimento no modo online e no modo presencial. Qual desses seria mais interessante para você?
- `2026-06-16 16:20` 👤 Que dias / horários ele atende presencial?
- `2026-06-16 16:22` 🤖 O Dr faz atendimento de segunda a sexta feira, período da manhã das 09h30 as 12h30 e no período da tarde das 17h as 18h.
- `2026-06-16 16:28` 🤖 Temos horário quinta feira as 18h, esse horário funciona para você?
- `2026-06-16 16:31` 👤 Qual o endereço e horário Presencial?   Como moro em Santana de Parnaíba, o melhor horário presencial seria segunda ou sexta-feira 9:30 ou por volta das 11ou 12h.
- `2026-06-16 16:32` 🤖 Certo, compreendi, estamos localizados próximos a Av paulista.
- `2026-06-16 16:33` 🤖 Temos sexta feira dia 19/06 as 10h30, esse horário seria conveniente para você?
- `2026-06-16 16:37` 👤 Essa sexta não consigo. Vc teria 22/06, segunda por volta de 10:30/11:30?
- `2026-06-16 16:38` 🤖 Na segunda feira dia 22 temos horário as 10h30 e as 11h30. Qual horário seria melhor para você?
- `2026-06-16 16:39` 👤 Qual o endereço certinho?
- `2026-06-16 16:40` 🤖 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: CPF: Data de nascimento: RG: Profissão: E-mail: Tel/Cel: CEP: Endereço completo : Profissão: Contato de emergência:  Através de qual canal chegou até nós (Google, Instagram, Facebook, Youtube, Indicação):
- `2026-06-16 16:40` 🤖 Segue nosso endereço.
- `2026-06-16 16:45` 👤 Por favor, me passe as seguintes informações para que eu possa fazer o seu cadastro no sistema: Nome completo do paciente: Valéria Corrêa de Godoy CPF: 06538516858 Data de nascimento: 14.04.1964 RG: 12.966.173-9 Profissão: Psicóloga  E-mail:valgodoy.psico@gmail.com Tel/Cel: 11. 995382707 CEP: 06543-315 Endereço completo : Al América, 101 apto ECO 104- Tambore- Santana de Parnaíba Profissão: Contato de emergência:  11999.555.093 Vagner de Moraes  Através de qual canal chegou até nós (Google, Inst
- `2026-06-16 16:45` 👤 Prefiro 11:30.
- `2026-06-16 16:58` 🤖 Muito obrigada pelas informações! Consulta presencial agendada para o dia 22/06 as 11:30 hs.
- `2026-06-16 16:58` 👤 Obrigada.
- `2026-06-16 17:00` 🤖 Disponha!

</details>


### Ricardo — `5511973690305`

**Cenário:** `pagamento_procedimento` · agendou_consulta=False · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** O lead (Ricardo) realizou o pagamento de uma infusão para a paciente Rosemary. Houve uma breve dificuldade técnica com a finalização do link da SumUp, mas o pagamento foi concluído e o comprovante enviado. A clínica solicitou os dados para NF, que foi emitida e enviada logo em seguida via PDF.


**Objeções:** instabilidade técnica no link de pagamento

**Gatilhos:** facilidade de link de pagamento

<details><summary>Transcrição completa</summary>

- `2026-06-16 16:23` 🤖 Olá boa tarde Mario ricardo, como vai?
- `2026-06-16 16:24` 🤖 Segue o link de pagamento referente a infusão da Rosemary
- `2026-06-16 16:25` 🤖 https://pay.sumup.com/b2c/XJ6KU7MKH6
- `2026-06-16 16:25` 🤖 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento.
- `2026-06-16 16:36` 👤 Oi, já estou realizando o Pagto, mas está demorando para finalizar,
- `2026-06-16 16:37` 🤖 Certo, compreendi.
- `2026-06-16 16:38` 👤 *[imagem]*
- `2026-06-16 16:39` 🤖 Estranho, não sabemos te explicar o motivo.
- `2026-06-16 16:42` 👤 https://pay.sumup.com/b2c/XJ6KU7MKH6
- `2026-06-16 16:42` 👤 Pagto realizado
- `2026-06-16 16:43` 🤖 Agradecemos o envio do comprovante.
- `2026-06-16 16:43` 🤖 A Nf será emitida no CPF da paciente?
- `2026-06-16 16:43` 👤 Sim, envia para mim, blz
- `2026-06-16 16:44` 🤖 certo, combinado. Seguimos a disposição.
- `2026-06-16 16:51` 🤖 NFSe_52686124_15484.pdf

</details>
