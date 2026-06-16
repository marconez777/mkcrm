---
title: "Estudo: Lead não qualificado"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Lead não qualificado' do funil Agendamentos Novo (Clínica ÓR): 8 leads."
---

# Estudo: Lead não qualificado

**Coluna:** `Lead não qualificado` (posição 8) — **8 leads** analisados.


## 1. Perfil típico

O lead desqualificado na Clínica ÓR divide-se em três perfis: 1) Pacientes com quadros que exigem internação ou reabilitação física (AVC), fugindo do escopo ambulatorial/psiquiátrico; 2) Pessoas residentes fora de São Paulo que desconhecem a unidade única, buscando atendimento presencial; 3) Representantes comerciais e fornecedores prospectando a clínica. Geralmente são contatos educados que encerram a conversa rapidamente ao entenderem que a clínica não atende sua necessidade específica ou localização.


### Procedimentos mais mencionados

- Infusão de Cetamina (fora de SP)
- EMT para AVC (não realizado)
- Internação Psiquiátrica
- Envio de Receitas Físicas
- Consultoria de Gestão B2B

### Profissionais mais mencionados

- Edilene (Consultora)
- Marisa (Atendente)
- Ivan Baren (Gestão)

### Objeções mais comuns

- Localização geográfica (clínica apenas em SP).
- Incompatibilidade de serviço (não oferece internação ou reabilitação pós-AVC).
- Lead é fornecedor, não paciente.

### Gatilhos de entrada na coluna

- Busca por tratamentos específicos (Cetamina, EMT) sem conhecimento do escopo geográfico ou clínico.
- Prospecção ativa de empresas de consultoria e gestão (Jornada 360).
- Necessidade administrativa (envio de receitas).

## 2. Padrões observados (Top 10)

1. Agradecimento cordial após negativa de serviço.
2. Busca por tratamentos de 'última linha' (Cetamina/EMT).
3. Interesse em serviços B2B de 'experiência do paciente'.
4. Dúvida sobre filiais em outros estados (Foz do Iguaçu).
5. Residência em cidades distantes ou países vizinhos (Paraguai).
6. Necessidade de encaminhamento para internação hospitalar.
7. Uso do canal para logística de documentos (correios).
8. Interrupção da conversa logo após saber que a clínica é ambulatorial.
9. Pedido de contato do gestor ou responsável administrativo.
10. Menção a urgência clínica que excede o suporte ambulatorial.

## 3. Erros recorrentes do agente IA atual

- Confusão ocasional entre prestadores de serviço terceirizados e pacientes reais em fluxos automáticos.

## 4. Recomendações para o agente de **pipeline**

- Criar campos de 'Motivo da Desqualificação' (Logística, Fora de Escopo Clínico, Fornecedor).
- Implementar automação de 'Perdido' para leads que mencionem palavras-chave como 'Internação'.
- Mover contatos de fornecedores para uma lista separada de 'Stakeholders' ou 'Networking' fora do funil comercial.

## 5. Recomendações para o agente de **atendimento**

- Criar um script padrão de 'Indicação Externa' para casos de internação e AVC, mantendo o acolhimento.
- Para fornecedores, direcionar imediatamente para o e-mail corporativo, liberando o WhatsApp para pacientes.
- Em casos de distância geográfica, enfatizar a teleconsulta como primeira etapa antes de qualquer deslocamento para SP.
- Validar a possibilidade de assinaturas digitais (ICP-Brasil) para evitar logística física de receitas.

## 6. Alertas

- ⚠️ Alta incidência de contatos B2B (representantes comerciais) ocupando o tempo da equipe de recepção no WhatsApp.
- ⚠️ Solicitação de tratamentos de alta complexidade (Internação e Pós-AVC) que não são cobertos pela clínica.
- ⚠️ Leads de outras cidades/estados com expectativa de atendimento local.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | 🕶 | 5524974015192 | 5 | 0 | fora_escopo_clinica |
| 2 | Serene | 5511930143908 | 2 | 0 |  |
| 3 | Beatriz Farias | 557788623619 | 7 | 0 | fora_escopo_comercial_b2b |
| 4 | Helton Rene | 558391392284 | 8 | 2 | fora_escopo_geografico |
| 5 | Podcast Executivo Atendimento | 5511911217948 | 2 | 0 |  |
| 6 | Beatriz Gioia | 5511956514341 | 8 | 0 | parceria_comercial_b2b |
| 7 | Rafael Menezes | 5511945767533 | 5 | 1 | fora_escopo_administrativo |
| 8 | Sofia Rossini | 5511969603333 | 5 | 1 | fora_escopo_internacao |

## 8. Conversas analisadas (transcrição + síntese)

_6 leads com conversa analisada._


### 🕶 — `5524974015192`

**Custom fields:** `{"mensagem": "Cliente interessado em EMT para recuperação pós-AVC.", "interesse": "EMT"}`

**Cenário:** `fora_escopo_clinica` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** O lead entrou em contato buscando tratamento de Estimulação Magnética Transcraniana (EMT) especificamente para recuperação pós-AVC. A atendente informou que a clínica não realiza o procedimento para essa finalidade específica. O lead agradeceu a informação e a conversa foi encerrada sem agendamento por incompatibilidade de escopo clínico.


**Objeções:** Indicação clínica não atendida pela instituição

**Gatilhos:** Recuperação funcional pós-AVC

<details><summary>Transcrição completa</summary>

- `2026-05-15 23:17` 👤 Boa noite. Queria saber sobre emt p recuperação pós avc
- `2026-05-15 23:18` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-05-15 23:18` 👤 Ok. Fico no aguardo
- `2026-05-18 10:40` 🤖 Olá bom dia, como vai? Sou Edilene, consultora da Clínica Ór. É um prazer te atender, respondendo a sua pergunta, nosso tratamento de EMT não são para recuperação pós AVC.
- `2026-05-18 10:52` 👤 Bom dia. Ah sim, obg Edilene

</details>


### Beatriz Farias — `557788623619`

**Cenário:** `fora_escopo_comercial_b2b` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** A lead entrou em contato inicialmente simulando interesse em uma consulta, mas logo revelou ser representante da empresa 'Jornada 360 do Paciente'. O objetivo real é oferecer serviços de otimização operacional e gestão para a clínica. Não houve interesse em serviços médicos, tratando-se de uma abordagem comercial B2B. A conversa foi encerrada com a solicitação do contato do responsável pela gestão.


**Objeções:** Lead não é paciente, é um fornecedor de serviços

<details><summary>Transcrição completa</summary>

- `2026-06-08 12:58` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=9667330d42)
- `2026-06-08 12:59` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-08 13:03` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-08 13:03` 🤖 Você já é paciente ou seria a primeira consulta?
- `2026-06-08 16:09` 👤 Olá Marisa, tudo bem!?
- `2026-06-08 16:57` 🤖 Boa tarde, Beatriz!
- `2026-06-08 17:17` 👤 Marisa, sou da Jornada 360 do Pasciente. Nós desenvolvemos estratégias de otimização operacional para clínicas de grande porte. Por favor, quem é o responsável pela área de gestão ou novos projetos na clínica para que eu possa direcionar uma proposta exclusiva?

</details>


### Helton Rene — `558391392284`

**Custom fields:** `{"mensagem": "Lead expressou interesse e pediu mais informações sobre cetamina.", "interesse": "Infusão de Cetamina", "observacoes": "Lead expressou interesse e pediu mais informações sobre cetamina.", "qualificacao": "desqualificado", "procedimentos": ["Infusão de cetamina"], "tipo_atendimento": "sessao_cetamina", "demonstrou_interesse": true, "motivo_desqualificacao": "outro", "procedimento_inte`

**Cenário:** `fora_escopo_geografico` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=True


**Síntese:** O lead Helton entrou em contato buscando tratamento de cetamina para a esposa, que já possui encaminhamento. Demonstrou urgência, porém reside em Ciudad del Este e acreditava que a clínica possuía unidade em Foz do Iguaçu. Ao ser informado de que a clínica atende exclusivamente em São Paulo (SP), o lead desanimou devido à distância. O atendimento foi encerrado sem agendamento.


**Objeções:** distancia_geografica, localizacao_unica_sp

**Gatilhos:** urgencia_no_tratamento, encaminhamento_medico_ja_existente

<details><summary>Transcrição completa</summary>

- `2026-06-08 13:31` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-08 13:31` 👤 Olá, estou interessado no tratamento com cetamina e gostaria de saber mais.  --- *Mantenha esse código na sua mensagem para entrar na fila de atendimento:* (ref=6ceeda1d08)
- `2026-06-08 13:35` 🤖 Olá, obrigado pelo contato! Aqui é a Marisa, consultora da Clínica Ór Psiquiatria.
- `2026-06-08 13:36` 🤖 Já vou te passar a nossa precificação e como funciona o tratamento. Mas antes, por gentileza, me conte um pouco sobre seu problema para eu entender no que realmente podemos te ajudar.
- `2026-06-08 13:42` 👤 **[ÁUDIO]** Olha, na realidade é pra minha esposa, né? Ela já tem o encaminhamento. A gente queria saber quais seriam os procedimentos. A gente mora aqui em Ciudad del Este e se a clínica, eu penso que essa clínica, ela atende em Foz, né? E nós queríamos saber qual seria os procedimentos pra gente poder, a gente tem plano de saúde, não sei se vocês aceitam o plano de saúde da Unimed, é a Nacional. E a gente queria saber se aceita, se não aceitar saber quanto é que seria o valor, né? E uma consulta bem próxima, porque a gente tem uma certa urgência.
- `2026-06-08 14:22` 🤖 **[ÁUDIO]** Olá, tudo bem? É a Marisa quem está falando. Então, nós estamos em São Paulo, e nós não temos nenhuma outra unidade no Brasil. Aqui em São Paulo mesmo. Normalmente nós atendemos pessoas do Brasil todo e as pessoas se hospedam, né, aqui em São Paulo para poder fazer o tratamento. Mas nós não temos clínicas fora de São Paulo.
- `2026-06-08 14:40` 👤 Ooww q pena
- `2026-06-08 14:41` 🤖 Estamos a disposição!

</details>


### Beatriz Gioia — `5511956514341`

**Cenário:** `parceria_comercial_b2b` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** A lead Beatriz entrou em contato solicitando falar com o responsável pela clínica. Ao ser questionada sobre o assunto, identificou-se como prestadora de serviços interessada em oferecer soluções da sua empresa para a Clínica Ór. A atendente forneceu o e-mail corporativo para envio de propostas e encerrou o atendimento.


<details><summary>Transcrição completa</summary>

- `2026-06-09 22:46` 👤 Olá, tudo bem?
- `2026-06-09 22:46` 🤖 Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria.   Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem.
- `2026-06-10 10:49` 🤖 Olá, bom dia, somos Edilene e Marisa, consultoras da Clínica Ór.  Em que podemos te ajudar?
- `2026-06-10 15:34` 👤 Olá, consigo falar com o responsável pela clínica?
- `2026-06-10 15:37` 🤖 Por gentileza poderia informar qual seria o assunto, para direcionarmos ao responsável.
- `2026-06-10 15:38` 👤 Prestação de serviços da minha empresa para a clínica de vocês
- `2026-06-10 15:40` 🤖 Para apresentações de serviços, favor enviar a proposta para o email: ivanbaren@gmail.com
- `2026-06-10 15:41` 👤 Obrigada!

</details>


### Rafael Menezes — `5511945767533`

**Custom fields:** `{"mensagem": "Lead pediu envio de receita por correios hoje; disponibilidade à tarde.", "observacoes": "Lead pediu envio de receita por correios hoje; disponibilidade à tarde.", "qualificacao": "desqualificado", "desqualificacao_motivo": "Pedido de envio de receita não oferecido pela clínica"}`

**Cenário:** `fora_escopo_administrativo` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=True


**Síntese:** O lead (Rafael) foi contatado para realizar o favor/serviço de postar uma receita médica nos correios. Ele inicialmente afirmou que conseguiria fazer à tarde, porém, ao final do dia, enviou um áudio informando que não teve tempo devido a compromissos pessoais. Ele sugeriu realizar a postagem na segunda-feira, pedindo para deixarem o documento na portaria.


**Objeções:** falta de tempo, esquecimento

**Gatilhos:** logística de receita

<details><summary>Transcrição completa</summary>

- `2026-06-12 12:17` 🤖 Bom dia Rafael, como vai? Edilene da clinica Ór, poderia por gentileza postar uma receita nos correios hoje, aguardo retorno.
- `2026-06-12 12:32` 👤 Oi bom dia  agora na parte da manhã está corrido acho que na parte da tarde eu consigo sim
- `2026-06-12 12:37` 🤖 Combinado, vou deixar na portaria.
- `2026-06-12 19:32` 👤 **[ÁUDIO]** Ô, desculpa, esqueci de te avisar, putz, não tive tempo hoje, eu saí com a, com a Dona Sandra indo na rua aqui. E não sei que horas que eu vou voltar pro prédio, se puder ser na segunda-feira, eu faço. Aí você já deixa na portaria amanhã de manhã aí, e aí eu pego pra levar lá no correio.

</details>


### Sofia Rossini — `5511969603333`

**Custom fields:** `{"observacoes": "Lead perguntou sobre internação psiquiátrica. Não oferecido pela clínica.", "qualificacao": "desqualificado", "demonstrou_interesse": true, "desqualificacao_motivo": "Não oferecido: internação psiquiátrica"}`

**Cenário:** `fora_escopo_internacao` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** A lead Sofia entrou em contato buscando informações sobre internação psiquiátrica. A atendente Edilene explicou prontamente que a clínica não oferece esse serviço, focando apenas em tratamentos ambulatoriais e endovenosos com retorno para casa. A lead agradeceu e a conversa foi encerrada por incompatibilidade de serviço.


**Objeções:** necessidade_de_internacao

**Gatilhos:** internacao_psiquiatrica

<details><summary>Transcrição completa</summary>

- `2026-06-12 15:56` 👤 Bom dia, tudo bem? Gostaria de saber mais informações sobre uma possível internação psiquiátrica. Obrigada
- `2026-06-12 15:57` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-12 15:57` 👤 Ok, obrigada!
- `2026-06-12 16:00` 🤖 **[ÁUDIO]** Olá, bom dia, Sofia, tudo bem? Aqui quem fala é Edilene da clínica OR. Sofia, nós não trabalhamos com internação, né? Nós trabalhamos com tratamentos aqui na clínica, onde elas são por endovenosa ou algum outro tratamento, mas o paciente volta para casa para se recuperar, né, e para dar continuidade no tratamento.
- `2026-06-12 16:01` 👤 Certo! Obrigada

</details>
