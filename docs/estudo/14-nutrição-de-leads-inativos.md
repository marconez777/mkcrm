---
title: "Estudo: Nutrição de Leads Inativos"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Análise da coluna 'Nutrição de Leads Inativos' do funil Agendamentos Novo (Clínica ÓR): 300 leads."
---

# Estudo: Nutrição de Leads Inativos

**Coluna:** `Nutrição de Leads Inativos` (posição 14) — **300 leads** analisados.


## 1. Perfil típico

O lead nesta coluna é heterogêneo, variando de pacientes crônicos que precisam de manutenção (como Geane) a pacientes em fase de vácuo comercial por motivos externos (decisões judiciais ou resistência familiar). Frequentemente, não é o paciente quem fala, mas um cuidador ou parceiro operacional (enfermeira). É um perfil que já conhece a clínica, mas está 'travado' por pendências financeiras, burocráticas ou logísticas, necessitando de um contato mais consultivo e menos transacional para ser reativado. Inclui também ruídos de cadastro, como fornecedores e representantes comerciais que deveriam estar em listas apartadas.


### Procedimentos mais mencionados

- Aplicação de Escetamina
- Estimulação Magnética Transcraniana (EMT)
- Consultas Psiquiátricas de Reavaliação
- Emissão de Receitas Controladas (Venvanse, Rivotril) e Relatórios Judiciais.

### Profissionais mais mencionados

- Dr. Ivan Barenboim (Psiquiatria)
- Marisa (Atendimento/Financeiro)
- Enfermeira Paula (Operacional)

### Objeções mais comuns

- Recusa do paciente em aderir ao tratamento ou comparecer à clínica.
- Dificuldade logística de deslocamento (trânsito/distância para pacientes de cidades vizinhas).
- Divergências técnicas em orçamentos para fins judiciais.
- Inexistência de insumos/medicamentos específicos no portfólio (para fornecedores).

### Gatilhos de entrada na coluna

- Retorno de contato para atualização de documentos judiciais.
- Solicitação de renovação de receitas por suporte clínico externo.
- Tentativa de reagendamento após longo período de ausência.
- Dúvida inicial sobre 'primeira consulta ou retorno' não finalizada.

## 2. Padrões observados (Top 10)

1. Dependência de decisões judiciais/liminares para início de tratamentos de alto custo (Escetamina/EMT).
2. Uso do canal por terceiros (enfermeiras, familiares, representantes) em vez do próprio paciente.
3. Preferência por horários específicos próximos ao meio-dia para evitar trânsito.
4. Solicitação frequente de Notas Fiscais e relatórios médicos detalhados.
5. Abandono de triagem logo após a primeira saudação da atendente.
6. Questionamento sobre abatimento do valor da consulta no pacote de procedimentos.
7. Interrupção de tratamento por falta de 'rede de apoio' ou logística familiar.
8. Necessidade de teleconsulta para pacientes de reavaliação.
9. Contatos administrativos de fornecedores sendo tratados no funil de leads.
10. Conversas focadas em burocracia de receitas controladas.

## 3. Erros recorrentes do agente IA atual

- Dificuldade em distinguir 'agente de saúde parceiro' de 'paciente lead'.
- Interpretação de orçamentos de tratamento complexo como simples consultas.

## 4. Recomendações para o agente de **pipeline**

- Criar campo 'Tipo de Contato' (Paciente, Fornecedor, Parceiro Clínico) para filtrar a nutrição.
- Implementar B-rule para mover contatos 'Fora de Escopo' (vendedores) automaticamente para uma lista de arquivados.
- Novos status: 'Aguardando Decisão Judicial' e 'Recusa de Tratamento (Familiar)'.
- Extrair 'Data de Expiração da Receita' para gatilhos automáticos de ltv.

## 5. Recomendações para o agente de **atendimento**

- Scripts de Acolhimento Familiar: Quando um familiar relata recusa do paciente, oferecer uma consulta de orientação para a família sobre manejo de crise.
- Confirmar autonomia de prescrição: Validar com enfermeiros parceiros quais receitas podem ser emitidas via sistema para agilizar o fluxo.
- Follow-up Ativo Judicial: Criar régua de contato a cada 15 dias para leads com processos contra convênios (Amil, etc).
- Perguntas-chave: 'Houve alguma mudança na rede de apoio que facilite sua vinda?' ou 'A medicação atual ainda está sendo tolerada?'

## 6. Alertas

- ⚠️ Mistura de contatos operacionais (fornecedores/enfermeiros) com leads de pacientes no mesmo funil.
- ⚠️ Risco clínico detectado: pacientes interrompendo medicação sem suporte/acolhimento imediato (Caso Estela/Maurício).
- ⚠️ Leads aguardando liberação judicial (Caso George) que podem esquecer do tratamento se não houver monitoramento ativo.

## 7. Lista de leads

| # | Nome | Telefone | Msgs | Áudios | Cenário |
|---|------|----------|------|--------|---------|
| 1 | Enfermeira Paula | 5511960595748 | 49 | 0 | admin_operacional_receitas |
| 2 | Lead #4366878 | 5511983239678 | 0 | 0 |  |
| 3 | Lead #5388840 | 5511980971516 | 0 | 0 |  |
| 4 | Lead #6513768 | 5511996239927 | 0 | 0 |  |
| 5 | Lead #6628942 | 5511998073232 | 1 | 0 |  |
| 6 | Cassia Gabriela Santana Alves | 5511995522815 | 0 | 0 |  |
| 7 | Lead #7174110 | 5511976256989 | 0 | 0 |  |
| 8 | Lead #7246202 | 5519981024128 | 0 | 0 |  |
| 9 | Sabrina Filha Kátia Alves | 5511941582551 | 1 | 0 |  |
| 10 | Lead #7951062 | 972586915252 | 0 | 0 |  |
| 11 | Lead #8342298 | 556589212059 | 0 | 0 |  |
| 12 | Lead #9256586 | 5514996585524 | 0 | 0 |  |
| 13 | Lead #9263716 | 553598181154 | 0 | 0 |  |
| 14 | Lead #9389116 | 5511995741184 | 0 | 0 |  |
| 15 | Lead #9452080 | 553299774676 | 0 | 0 |  |
| 16 | Lead #9580818 | 553391935651 | 0 | 0 |  |
| 17 | Lead #9611658 | 5511993788507 | 0 | 0 |  |
| 18 | Lead #9875664 | 5511970618953 | 0 | 0 |  |
| 19 | Lead #9916110 | 555599093001 | 0 | 0 |  |
| 20 | Lead #9920808 | 5511985219468 | 0 | 0 |  |
| 21 | Lead #10078684 | 5511952201984 | 0 | 0 |  |
| 22 | Lead #10095574 | 557199187089 | 0 | 0 |  |
| 23 | Lead #10158026 | 5513996097087 | 0 | 0 |  |
| 24 | Alexandre Paula Aquino | 5511944662559 | 2 | 0 |  |
| 25 | Lead #10502643 | 5511975059318 | 0 | 0 |  |
| 26 | Lead #10552957 | 5511991656607 | 0 | 0 |  |
| 27 | Lead #10734647 | 5511940665727 | 0 | 0 |  |
| 28 | Lead #10866687 | 559491544504 | 0 | 0 |  |
| 29 | Lead #10977653 | 5511998726584 | 0 | 0 |  |
| 30 | Lead #11056479 | 5511999530616 | 0 | 0 |  |
| 31 | Lead #11082675 | 5511989758571 | 0 | 0 |  |
| 32 | Lead #11086603 | 5511949501366 | 0 | 0 |  |
| 33 | Lead #11311999 | 5511988996560 | 0 | 0 |  |
| 34 | Lead #11353785 | 5511966304724 | 0 | 0 |  |
| 35 | Lead #11354465 | 5511913024047 | 0 | 0 |  |
| 36 | Lead #11458553 | 5556939221811 | 0 | 0 |  |
| 37 | Lead #11496105 | 5511987006679 | 0 | 0 |  |
| 38 | Lead #11522545 | 5531621355470 | 0 | 0 |  |
| 39 | Lead #11948910 | 5511973663315 | 0 | 0 |  |
| 40 | Lead #12002720 | 5511976611798 | 0 | 0 |  |
| 41 | Lead #12174686 | 554298529107 | 0 | 0 |  |
| 42 | Lead #12323381 | 5511941665542 | 0 | 0 |  |
| 43 | Lead #12337788 | 5511994372722 | 0 | 0 |  |
| 44 | Lead #12341940 | 5511973113639 | 0 | 0 |  |
| 45 | Lead #12363400 | 5511991521946 | 0 | 0 |  |
| 46 | Lead #12363446 | 5511993827906 | 0 | 0 |  |
| 47 | Lead #12372408 | 5511954246355 | 4 | 0 | aguardando_resposta_triagem |
| 48 | Lead #12388588 | 5519983148303 | 0 | 0 |  |
| 49 | Lead #12433924 | 5511994848714 | 0 | 0 |  |
| 50 | Lead #12439618 | 5511983832888 | 0 | 0 |  |
| 51 | Lead #12599892 | 5527999891747 | 0 | 0 |  |
| 52 | Lead #12650428 | 5511985305208 | 0 | 0 |  |
| 53 | Lead #12909666 | 5511999207831 | 0 | 0 |  |
| 54 | Lead #12915684 | 5511989667882 | 0 | 0 |  |
| 55 | Lead #12930774 | 5511995450707 | 0 | 0 |  |
| 56 | Lead #12930944 | 5511996215826 | 0 | 0 |  |
| 57 | Lead #12938558 | 5511995029731 | 0 | 0 |  |
| 58 | Lead #12988880 | 5511987778015 | 0 | 0 |  |
| 59 | Lead #13020498 | 5511988123250 | 0 | 0 |  |
| 60 | Rosana | 5511999607094 | 0 | 0 |  |
| 61 | Lead #13157170 | 5511984906577 | 0 | 0 |  |
| 62 | Lead #13172088 | 5511991098516 | 0 | 0 |  |
| 63 | Lead #13180346 | 5511982859823 | 0 | 0 |  |
| 64 | Lead #13182544 | 5511961273708 | 0 | 0 |  |
| 65 | Lead #13276208 | 5511987082243 | 0 | 0 |  |
| 66 | Lead #13276484 | 5511997198152 | 0 | 0 |  |
| 67 | Lead #13324292 | 5511981892953 | 0 | 0 |  |
| 68 | Lead #13333612 | 5511974573557 | 0 | 0 |  |
| 69 | Lead #13392300 | 5511976827202 | 0 | 0 |  |
| 70 | Lead #13433656 | 5511958464325 | 0 | 0 |  |
| 71 | Ruth Mara | 5511966399598 | 0 | 0 |  |
| 72 | Lead #13464038 | 5517788754075 | 0 | 0 |  |
| 73 | Lead #13503384 | 5511974054740 | 0 | 0 |  |
| 74 | Geane Barbosa | 5511991182375 | 49 | 0 | reagendamento_e_manutencao |
| 75 | Lead #13549544 | 972538237756 | 0 | 0 |  |
| 76 | André | 011975869601 | 0 | 0 |  |
| 77 | Lead #13633678 | 5515613510827 | 0 | 0 |  |
| 78 | Lead #13641336 | 5511940147029 | 0 | 0 |  |
| 79 | Lead #13666302 | 5521970568989 | 0 | 0 |  |
| 80 | Lead #13669686 | 5511997350468 | 0 | 0 |  |
| 81 | Lead #13871280 | 5514982324783 | 0 | 0 |  |
| 82 | Lead #13900196 | 5511915767815 | 0 | 0 |  |
| 83 | Lead #13941906 | 447746553227 | 0 | 0 |  |
| 84 | Lead #14024456 | 5511985460507 | 0 | 0 |  |
| 85 | Lead #14222768 | 5511973357227 | 0 | 0 |  |
| 86 | Lead #14262716 | 5511987453376 | 0 | 0 |  |
| 87 | Roseli | 5511970426508 | 0 | 0 |  |
| 88 | Lead #14298820 | 5511954566059 | 0 | 0 |  |
| 89 | Lead #14392202 | 351916086594 | 0 | 0 |  |
| 90 | Maria Aparecida | 5511989067995 | 0 | 0 |  |
| 91 | Lead #14401590 | 5511956631620 | 0 | 0 |  |
| 92 | Lead #14619648 | 351919176512 | 0 | 0 |  |
| 93 | Lead #14708138 | 553183224957 | 0 | 0 |  |
| 94 | Lead #14743056 | 554391040706 | 0 | 0 |  |
| 95 | Lead #15078628 | 5511975909311 | 0 | 0 |  |
| 96 | Lead #15089310 | 5511973369358 | 0 | 0 |  |
| 97 | Lead #15121880 | 5511947447695 | 0 | 0 |  |
| 98 | Lead #15136574 | 556899352704 | 0 | 0 |  |
| 99 | Lead #15254194 | 553598111680 | 0 | 0 |  |
| 100 | Lead #15292366 | 5512976004045 | 0 | 0 |  |
| 101 | Lead #15450874 | 5511980998476 | 0 | 0 |  |
| 102 | Lead #15723706 | 5511949598916 | 0 | 0 |  |
| 103 | Lead #16755752 | 5511959214726 | 0 | 0 |  |
| 104 | Lead #16778114 | 5511962494425 | 0 | 0 |  |
| 105 | Lead #16778870 | 5511998461583 | 0 | 0 |  |
| 106 | Mariana Kaori Yasuda | 556792076596 | 0 | 0 |  |
| 107 | Lead #16822474 | 5511985845321 | 0 | 0 |  |
| 108 | Lead #16839885 | 5511964773921 | 0 | 0 |  |
| 109 | Lead #16888210 | 5519994968138 | 0 | 0 |  |
| 110 | Lead #17022868 | 5511964193226 | 0 | 0 |  |
| 111 | Lead #17048310 | 5511947004514 | 0 | 0 |  |
| 112 | Lead #17049982 | 5511975008022 | 0 | 0 |  |
| 113 | Laura Dzazio | 554298333817 | 0 | 0 |  |
| 114 | Lead #17053480 | 5511981779054 | 0 | 0 |  |
| 115 | karen Monique | 553298241135 | 0 | 0 |  |
| 116 | Lead #17075954 | 5511995721306 | 0 | 0 |  |
| 117 | Lead #17084178 | 555596671035 | 0 | 0 |  |
| 118 | Eliana aparecida t M momma | 5511996519264 | 0 | 0 |  |
| 119 | Leticia Tavares | 5511947870305 | 0 | 0 |  |
| 120 | Lead #17150038 | 554196382844 | 0 | 0 |  |
| 121 | Lead #17150592 | 5511970169791 | 0 | 0 |  |
| 122 | Lead #17165764 | 5511971199010 | 0 | 0 |  |
| 123 | Lead #17173344 | 5511969367842 | 0 | 0 |  |
| 124 | Lead #17202766 | 5511969695803 | 0 | 0 |  |
| 125 | Beatriz Alves | 5511970116566 | 0 | 0 |  |
| 126 | Lead #17232608 | 5519982340789 | 0 | 0 |  |
| 127 | Helena | 5511989917893 | 0 | 0 |  |
| 128 | Lead #17238932 | 5511983670234 | 0 | 0 |  |
| 129 | Lead #17246746 | 5511953049383 | 0 | 0 |  |
| 130 | Lead #17259722 | 557199584490 | 0 | 0 |  |
| 131 | Lead #17267066 | 555581219354 | 0 | 0 |  |
| 132 | Regina Angélica | 556599609602 | 0 | 0 |  |
| 133 | Andressa da Silva Gomes | 5511995296025 | 0 | 0 |  |
| 134 | Marya Efygenia | 556183484991 | 0 | 0 |  |
| 135 | Lead #17310130 | 5519983558511 | 0 | 0 |  |
| 136 | Lucia | 556599734662 | 0 | 0 |  |
| 137 | João Victor Xila | 5511930535127 | 0 | 0 |  |
| 138 | Lucia Rodrigues | 558791356446 | 0 | 0 |  |
| 139 | Pietro | 555531922192 | 0 | 0 |  |
| 140 | Mila | 5511987451094 | 0 | 0 |  |
| 141 | Talita Lacorte | 5512991911557 | 0 | 0 |  |
| 142 | Cida Borges | 5514996846020 | 0 | 0 |  |
| 143 | Joyce | 5521964387664 | 0 | 0 |  |
| 144 | Lead #17383444 | 5511971265381 | 0 | 0 |  |
| 145 | Murilo Souza | 553195585482 | 0 | 0 |  |
| 146 | Patricia | 5512992275905 | 0 | 0 |  |
| 147 | Lead #17404650 | 557193048521 | 0 | 0 |  |
| 148 | Lead #17473564 | 553287121716 | 0 | 0 |  |
| 149 | Greiciane | 5511964621267 | 0 | 0 |  |
| 150 | Izabela Brito | 5511951965211 | 0 | 0 |  |
| 151 | Lead #17551724 | 556699130151 | 0 | 0 |  |
| 152 | Lead #17553316 | 5511968705403 | 0 | 0 |  |
| 153 | Bruno Pereira Lopes | 5528999359490 | 0 | 0 |  |
| 154 | Lead #17584098 | 556295407313 | 0 | 0 |  |
| 155 | Rebeca Gabriel Salzberg | 5511987070104 | 0 | 0 |  |
| 156 | Guilherme | 5511982264400 | 0 | 0 |  |
| 157 | Lead #17595070 | 558896382000 | 0 | 0 |  |
| 158 | Belly | 5511945888347 | 0 | 0 |  |
| 159 | Matt | 5511939462613 | 0 | 0 |  |
| 160 | Sthephany Chateaubriand | 558198816897 | 0 | 0 |  |
| 161 | Barb Castelli | 5519988029958 | 0 | 0 |  |
| 162 | Fabiana Galoni | 5511933359245 | 0 | 0 |  |
| 163 | Lead #17750314 | 5511996844993 | 0 | 0 |  |
| 164 | Lead #17764424 | 5511918203266 | 0 | 0 |  |
| 165 | Josiene | 553399093484 | 0 | 0 |  |
| 166 | Luiza Klassmann | 555193975325 | 0 | 0 |  |
| 167 | Giselle Vasconcellos | 5511994684620 | 0 | 0 |  |
| 168 | Inove Cobrança | 5511930551833 | 0 | 0 |  |
| 169 | Mariana Sabio | 5511969166553 | 0 | 0 |  |
| 170 | Iang Figueredo | 557798712530 | 0 | 0 |  |
| 171 | Daniel Olazabal Cristalia | 5511996738332 | 3 | 0 | fora_escopo_comercial_reverso |
| 172 | Lead alcoolismo - leon | 556196619612 | 0 | 0 |  |
| 173 | Bia | 5511983199558 | 0 | 0 |  |
| 174 | Zbigneiw Kubinski | 5531683855867 | 0 | 0 |  |
| 175 | Maurício Campos de Jesus | 556798669099 | 0 | 0 |  |
| 176 | George | 5512997823752 | 72 | 6 | agendou_consulta_documentacao_judicial |
| 177 | Cris | 5511999564929 | 0 | 0 |  |
| 178 | Lead #17937362 | 5511973517093 | 0 | 0 |  |
| 179 | Malu | 447415673597 | 0 | 0 |  |
| 180 | Lead #17952948 | 558195012117 | 0 | 0 |  |
| 181 | H | 5521997514433 | 0 | 0 |  |
| 182 | Janaina Andrade | 553291513555 | 0 | 0 |  |
| 183 | Franciane Carneiro | 5511977209724 | 0 | 0 |  |
| 184 | Alan | 5511980400492 | 0 | 0 |  |
| 185 | Lead #18028634 | 5519991339756 | 0 | 0 |  |
| 186 | Bianca Ferreira | 556186286158 | 0 | 0 |  |
| 187 | Yanni | 5513996907322 | 0 | 0 |  |
| 188 | Daniela Oliveira | 5511959022335 | 0 | 0 |  |
| 189 | Giovanni Beraldo | 5511995613820 | 0 | 0 |  |
| 190 | Lead #18089096 | 5511981312778 | 0 | 0 |  |
| 191 | Cys | 556296687676 | 0 | 0 |  |
| 192 | Edson | 5511972542249 | 1 | 0 |  |
| 193 | Lead #18099594 | 5511996168831 | 0 | 0 |  |
| 194 | Luucas | 5511967035616 | 0 | 0 |  |
| 195 | Lead #18123538 | 5511991762520 | 0 | 0 |  |
| 196 | Jean | 5521992071413 | 0 | 0 |  |
| 197 | Lead #18136360 | 558198844817 | 0 | 0 |  |
| 198 | Lead #18141404 | 5512981690674 | 0 | 0 |  |
| 199 | Luciana | 555496381245 | 0 | 0 |  |
| 200 | Lead #18158860 | 5511912988507 | 0 | 0 |  |
| 201 | Lead #18163268 | 5521984102172 | 0 | 0 |  |
| 202 | Adauto | 5519991150107 | 0 | 0 |  |
| 203 | Eduarda Duarte Melzer - Fernanda | 5511975451580 | 0 | 0 |  |
| 204 | Michele | 5511947310710 | 1 | 0 |  |
| 205 | Tay | 5511915611417 | 0 | 0 |  |
| 206 | Lead #18246426 | 5511990268038 | 0 | 0 |  |
| 207 | Nilson | 558698279437 | 0 | 0 |  |
| 208 | Lead #18256564 | 5514981617522 | 0 | 0 |  |
| 209 | André Cardoso | 5511976088003 | 0 | 0 |  |
| 210 | Lead #18264200 | 554192233361 | 1 | 0 |  |
| 211 | Fabricio | 556191643622 | 0 | 0 |  |
| 212 | Lead #18275228 | 5511980774114 | 0 | 0 |  |
| 213 | Lead #18280966 | 551148632915 | 0 | 0 |  |
| 214 | Lead #18287286 | 556492940506 | 0 | 0 |  |
| 215 | Lead #18302777 | 556381330182 | 0 | 0 |  |
| 216 | Luis Otavio Vieira | 5511997912010 | 0 | 0 |  |
| 217 | Vera Lucia Medeiros | 555199627764 | 0 | 0 |  |
| 218 | Lead #18338457 | 5511941036492 | 0 | 0 |  |
| 219 | Lead #18348063 | 5511998169074 | 0 | 0 |  |
| 220 | Angela-Fabricio | 556186196013 | 0 | 0 |  |
| 221 | Lead #18373362 | 5511995314760 | 0 | 0 |  |
| 222 | Lead #18377496 | 558198291990 | 0 | 0 |  |
| 223 | Lead #18385430 | 5511962711634 | 0 | 0 |  |
| 224 | Lead #18389632 | 551135763250 | 0 | 0 |  |
| 225 | Lead #18393324 | 5512988016873 | 0 | 0 |  |
| 226 | Raphael | 5512997502646 | 0 | 0 |  |
| 227 | Charbel El Khouri | 5511972871985 | 0 | 0 |  |
| 228 | Manlio | 5519997973341 | 0 | 0 |  |
| 229 | Lead #18425836 | 5519989863278 | 0 | 0 |  |
| 230 | Lead #18434134 | 5511932368551 | 0 | 0 |  |
| 231 | Lead #18452824 | 5511985679457 | 0 | 0 |  |
| 232 | Tassiane | 5511981351871 | 0 | 0 |  |
| 233 | Lead #18454124 | 5511987129490 | 0 | 0 |  |
| 234 | Bruno Aiello | 5511943011001 | 0 | 0 |  |
| 235 | Lead #18472186 | 5511992003575 | 0 | 0 |  |
| 236 | Lead #18476036 | 5511981414052 | 0 | 0 |  |
| 237 | Carla | 5511945264048 | 0 | 0 |  |
| 238 | Lead #18484978 | 351910158943 | 0 | 0 |  |
| 239 | Lead #18505866 | 558182202618 | 0 | 0 |  |
| 240 | Ju | 5511910312212 | 0 | 0 |  |
| 241 | Ana | 5511992585848 | 0 | 0 |  |
| 242 | Eldes | 553598588166 | 0 | 0 |  |
| 243 | Caio Silva | 5511971012807 | 0 | 0 |  |
| 244 | Lead #18579692 | 5511980445483 | 0 | 0 |  |
| 245 | Ana Maria | 5511920655944 | 0 | 0 |  |
| 246 | Meire | 5511972994917 | 0 | 0 |  |
| 247 | Lead #18610618 | 559281251640 | 0 | 0 |  |
| 248 | Daniel Erlich | 5511976658066 | 0 | 0 |  |
| 249 | Lead #18636576 | 5519982793503 | 0 | 0 |  |
| 250 | Lead #18645582 | 5511962780470 | 0 | 0 |  |
| 251 | Lead #18652006 | 5512252896710 | 0 | 0 |  |
| 252 | Lead #18653944 | 5511970386631 | 0 | 0 |  |
| 253 | Lead #18654948 | 5511995563242 | 0 | 0 |  |
| 254 | Tainara | 353830708151 | 0 | 0 |  |
| 255 | Adriana Lima | 5511987608371 | 0 | 0 |  |
| 256 | Lead #18668490 | 557598814014 | 0 | 0 |  |
| 257 | Lead #18674982 | 5519999484055 | 0 | 0 |  |
| 258 | Lead #18678114 | 554899276519 | 0 | 0 |  |
| 259 | Tatiana | 5511993068568 | 0 | 0 |  |
| 260 | Elisângela | 5516992028230 | 0 | 0 |  |
| 261 | Soul Center | 5521998340808 | 0 | 0 |  |
| 262 | Lead #18697142 | 5512138725295 | 0 | 0 |  |
| 263 | Loma | 5511956557141 | 0 | 0 |  |
| 264 | Lead #18714792 | 553398232647 | 0 | 0 |  |
| 265 | Rodrigo Gomes | 5511978284180 | 0 | 0 |  |
| 266 | Maria Campus | 5511999166453 | 0 | 0 |  |
| 267 | Lead #18718316 | 5511931400366 | 0 | 0 |  |
| 268 | Estela | 5511994857822 | 0 | 0 |  |
| 269 | Lead #18737418 | 5511996553416 | 0 | 0 |  |
| 270 | Ana | 5511982899868 | 0 | 0 |  |
| 271 | Lead #18743682 | 5511996651198 | 0 | 0 |  |
| 272 | Lead #18748056 | 5521998543399 | 0 | 0 |  |
| 273 | Estela | 5511951596427 | 6 | 0 | reagendamento_cancelamento_por_recusa_paciente |
| 274 | Lead #18750858 | 5511992450455 | 0 | 0 |  |
| 275 | Victor | 5521993555967 | 0 | 0 |  |
| 276 | Mari | 5521968955962 | 0 | 0 |  |
| 277 | Lead #18781125 | 5519982442109 | 0 | 0 |  |
| 278 | Lead #18783972 | 5511966530585 | 0 | 0 |  |
| 279 | Lead #18785490 | 5511982843169 | 0 | 0 |  |
| 280 | Lead #18796788 | 5511985528724 | 0 | 0 |  |
| 281 | Lead #18802344 | 5511994972199 | 0 | 0 |  |
| 282 | Lead #18804016 | 5511913405497 | 0 | 0 |  |
| 283 | Mario | 5511952930021 | 0 | 0 |  |
| 284 | Lead #18809800 | 5511963375101 | 0 | 0 |  |
| 285 | Nanda | 5511985342883 | 0 | 0 |  |
| 286 | Lead #18813034 | 5511942895754 | 0 | 0 |  |
| 287 | Juninho Leão | 553598121720 | 0 | 0 |  |
| 288 | Lead #18820722 | 553388809688 | 0 | 0 |  |
| 289 | Michele | 5511982624567 | 0 | 0 |  |
| 290 | Alessandra | 5511942193872 | 0 | 0 |  |
| 291 | Salete Monteiro | 554599191668 | 0 | 0 |  |
| 292 | Cecilia | 553799473187 | 0 | 0 |  |
| 293 | Carla Stresser | 5511970276176 | 0 | 0 |  |
| 294 | Adriana | 5511999160508 | 0 | 0 |  |
| 295 | Lead #18855846 | 5511973542253 | 0 | 0 |  |
| 296 | Lead #18860952 | 5519795990896 | 0 | 0 |  |
| 297 | Edilaine | 5511989966116 | 0 | 0 |  |
| 298 | Lead #18866658 | 5521970417571 | 0 | 0 |  |
| 299 | Fatima | 554498104574 | 0 | 0 |  |
| 300 | Lead #18879724 | 5511942852393 | 0 | 0 |  |

## 8. Conversas analisadas (transcrição + síntese)

_6 leads com conversa analisada._


### Enfermeira Paula — `5511960595748`

**Cenário:** `admin_operacional_receitas` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** Conversa estritamente operacional entre a clínica e a Enfermeira Paula para emissão de receitas controladas (Venvanse, Rivotril, Alprazolam, etc.) para diversos pacientes. O atendimento consiste em solicitações contínuas da clínica e confirmações/envios por parte da Paula. Não se trata de uma jornada de paciente (lead), mas de um fluxo de apoio administrativo/clínico.


**Objeções:** Medicamento específico (Brintillex) não realizado pela enfermeira

**Gatilhos:** Parceria operacional, Agilidade na emissão de receitas

<details><summary>Transcrição completa</summary>

- `2026-05-11 15:37` 🤖 Oi Paulinha por gentileza assim que possível poderia fazer  uma receita para Sergio Magalhães Palácios Junior - venvanse 50mg
- `2026-05-11 15:39` 👤 Blz Edi
- `2026-05-12 18:26` 🤖 Paulinha por gentileza, assim que possível poderia fazer  uma receita para - Alexandre Monteiro Giglio - Rivotril - 4 frascos
- `2026-05-12 19:15` 🤖 Paulinha por gentileza, assim que possível poderia fazer  uma receita para -  Amanda Panzenboeck Araujo - Venvanse 70 mg 1 caixa e Alprazolam 2mg duas caixas
- `2026-05-18 11:51` 🤖 Paulinha assim que possível  por gentileza faz uma receita de  Venvance 70mg - Rafael Savassi. Obrigada.
- `2026-05-18 18:03` 🤖 Oi Paulinha! Desculpe, o Rafael falou agora que são duas caixas do Venvanse. Por gentileza, você pode fazer mais uma receita?
- `2026-05-18 18:12` 👤 Blz faço sim
- `2026-05-19 13:10` 🤖 Bom dia Paulinha, por gentileza assim que tiver um tempinho faz uma receita de rivotril para Maria Neuza, dr autorizou.
- `2026-05-19 19:43` 🤖 Bom dia Paulinha, por gentileza assim que tiver um tempinho faz uma receita para Pedro Luiz Barbosa - Venvanse 70mg e Zolpidem 10mg
- `2026-05-20 12:17` 🤖 Bom dia Paulinha, por gentileza assim que tiver um tempinho faz uma receita para Willian de Lima - Venvanse 70mg
- `2026-05-20 13:47` 🤖 Paulinha, por gentileza assim que tiver um tempinho faz uma receita para Hiram Santiago - frontal 2mg - 4cx - 2cp por dia
- `2026-05-20 21:39` 🤖 Paulinha, por gentileza, assim que tiver um tempinho faz uma receita para Lívia Zolandeck Schmidt Bacelar - patz de 5mg e outra de patz de 10mg
- `2026-05-21 12:34` 🤖 Paulinha, por gentileza, assim que tiver um tempinho faz uma receita para Sandra Ekstein de Santana Azevedo -  zolpidem 10 mg - 2 caixas
- `2026-05-21 15:43` 🤖 Paulinha por gentileza faz uma receita de ritalina la 20mg 1cx 1cp por dia + clonazepam gotas 1cx 12 gotas para a Anatalia
- `2026-05-21 15:44` 🤖 O motoboy já esta chegando. o Dr esqueceu de fazer
- `2026-05-22 13:47` 👤 prescricao-83fc71a0-addc-4122-9d58-48b5d1bbb0ed.pdf
- `2026-05-27 12:30` 🤖 Paulinha, por gentileza, assim que tiver um tempinho faz uma receita para Jose Jeova Bezerra - Alprazolam 1mg
- `2026-05-27 12:31` 👤 Bom dia blz
- `2026-05-27 14:52` 🤖 Paulinha, por gentileza, assim que tiver um tempinho poderia fazer a receita:  Aaron Yoseff Torres - venvanse 70mg;
- `2026-05-27 17:47` 🤖 21040300216_18-07-2025.PDF
- `2026-05-27 17:47` 🤖 21040300056_18-07-2025.PDF
- `2026-05-27 17:47` 🤖 21070100029_18-07-2025.PDF
- `2026-05-27 17:47` 🤖 21070100032_18-07-2025.PDF
- `2026-05-27 17:47` 🤖 21070100036_18-07-2025.PDF
- `2026-05-27 17:47` 🤖 Paulinha esses foram os certificados que nos mandaram
- `2026-05-27 17:47` 🤖 mas realmente foi feito em julho de 2025
- `2026-05-27 17:48` 👤 Blz Edi obrigado
- `2026-05-27 17:53` 👤 *[imagem]*
- `2026-05-28 17:38` 🤖 Manhã:  Litio 300  Synthroid 50mg  Noite: 50mg donarem normal  150mg donarem retard  1 trileptal 300mg 1 carbolitio 450  2 cps de 100 mg clorpromazina 5mg diazepam 5mg de diazepam caso seja necessario
- `2026-05-28 18:43` 🤖 Paulinha, por gentileza, assim que tiver um tempinho faz uma receita para Gabriela Di Pillo -
- `2026-05-28 18:44` 🤖 - Venvanse - 70 mg -  2 comprimidos ao dia  - ⁠Alprazolan - 2 mg -  1 comprimido ao dia
- `2026-06-02 15:52` 🤖 Paulinha! Por favor, quando for possível fazer as recitas para:  Michelle Kartychak: Rivotril 4mg - Brintillex 30mg  Fernanda Lusnick Sabbag Cury: Rivotril gotas - 2 frascos - Paroxetina
- `2026-06-02 15:53` 👤 Brintillex não sou eu que faço
- `2026-06-02 15:53` 🤖 ok
- `2026-06-02 15:53` 👤 Paroxetina receita branca
- `2026-06-03 13:53` 🤖 Paulinha! Por favor, quando for possível fazer a receita para: Oliver de Paula Jimenez - alprazolam 2mg 1cx
- `2026-06-08 13:18` 👤 *[imagem]*
- `2026-06-08 14:44` 🤖 Paulinha. Por favor, quando possível fazer a receita para: Rosalia Adriene Sandoval - Rivotril gotas
- `2026-06-12 11:10` 👤 *[imagem]*
- `2026-06-16 17:45` 🤖 Paulinha. Por favor, quando possível fazer a receita para: Rafael França Savassi Longo - Venvanse 70mg - 2 (duas) caixas com 28 comp. 2 comp. por dia.
- `2026-06-16 17:46` 👤 Acabei de fazer
- `2026-06-16 17:46` 👤 Entreguei pra vc
- `2026-06-16 17:46` 🤖 kkk não vi que era do mesmo paciente
- `2026-06-16 17:46` 🤖 Sorry!
- `2026-06-16 17:46` 👤 Imagina

</details>


### Lead #12372408 — `5511954246355`

**Cenário:** `aguardando_resposta_triagem` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=False


**Síntese:** A lead Priscilla entrou em contato demonstrando interesse explícito em agendar uma consulta na Clínica Ór. A atendente Marisa iniciou o atendimento prontamente, identificando-se e questionando se se tratava de uma primeira consulta ou retorno. O contato parou após a pergunta da atendente, aguardando resposta da lead.


**Gatilhos:** agendamento_consulta

<details><summary>Transcrição completa</summary>

- `2026-05-14 12:59` 👤 Olá! Gostaria de agendar uma consulta na Clínica Ór
- `2026-05-14 12:59` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-14 13:03` 🤖 Olá, Priscilla, sou a Marisa, consultora da Clínica Ór.
- `2026-05-14 13:04` 🤖 Você já é paciente ou seria a primeira vez?

</details>


### Geane Barbosa — `5511991182375`

**Custom fields:** `{"data_horario": "2024-06-??T12:00:00-03:00"}`

**Cenário:** `reagendamento_e_manutencao` · agendou_consulta=True · agendou_procedimento=True · teleconsulta=nao · fora_escopo=False


**Síntese:** A paciente Geane Barbosa utiliza o canal para recorrentes ajustes de agenda e solicitações administrativas. Ela demonstra preferência por horários próximos ao meio-dia para facilitar o deslocamento de São Roque e a logística familiar. Teve sucesso em múltiplos agendamentos e solicitou notas fiscais de aplicações realizadas, sendo prontamente atendida pela equipe.


**Objeções:** Dificuldade de locomoção (mora em São Roque, trânsito), Necessidade de cuidados com o filho/rede de apoio

**Gatilhos:** Disponibilidade de horário específico, Flexibilidade de agenda, Atendimento administrativo funcional (NF)

<details><summary>Transcrição completa</summary>

- `2026-05-14 12:50` 👤 Olá bom dia!
- `2026-05-14 12:51` 👤 Posso marcar o horário
- `2026-05-14 12:51` 👤 A partir das 10:00
- `2026-05-14 12:52` 👤 Até o 12:00
- `2026-05-14 12:53` 🤖 Oi Geane. Bom dia!
- `2026-05-14 12:54` 🤖 Você deseja alterar o horário para as 10:00 hs? Seria isso?
- `2026-05-14 12:54` 👤 Isso
- `2026-05-14 12:54` 👤 Ou as 11:00
- `2026-05-14 12:55` 🤖 Temos horário as 11:00 hs
- `2026-05-14 12:55` 🤖 Agendado!
- `2026-05-14 12:55` 👤 Perfeito
- `2026-05-14 12:55` 👤 Obrigada 🙏🏻
- `2026-05-14 12:55` 🤖 Disponha
- `2026-05-27 17:35` 👤 Olá, boa tarde!!!  Vcs tem horário para sexta 29/05 às 11:00 da manhã ?
- `2026-05-27 17:40` 🤖 Boa tarde, Geane!
- `2026-05-27 17:40` 🤖 Pode ser sexta feira as 09:30 hs?
- `2026-05-27 17:42` 👤 Esse horário é bem complicado, pois tenho que sair de São Roque muito cedo, devido ao trânsito, e não tenho com quem deixar meu filho tão cedo
- `2026-05-27 17:43` 👤 Qual outro horário vc tem?
- `2026-05-27 17:45` 🤖 Pode ser as 11:30 hs ou 12:00 hs?
- `2026-05-27 18:14` 👤 11:30
- `2026-05-27 18:16` 🤖 Agendado!
- `2026-05-27 18:17` 👤 Obrigada 🙏🏻
- `2026-05-27 18:18` 🤖 Disponha!
- `2026-06-11 12:11` 👤 Olá bom dia!
- `2026-06-11 12:11` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-06-11 12:14` 👤 Tudo bem?
- `2026-06-11 12:14` 👤 Tem horário para amanhã às 11:00?
- `2026-06-11 12:14` 🤖 Bom dia, Tudo bem?
- `2026-06-11 12:15` 🤖 Agendado!
- `2026-06-11 12:16` 👤 Sem querer abusar rs
- `2026-06-11 12:16` 👤 Vc tem ao meio dia?
- `2026-06-11 12:17` 🤖 Sim!
- `2026-06-11 12:17` 👤 Marca esse pra mim por favor 🙏🏻
- `2026-06-11 12:19` 🤖 Agendado!
- `2026-06-11 12:20` 👤 Obrigada
- `2026-06-11 12:20` 🤖 Disponha
- `2026-06-16 15:08` 👤 Olá meninas, bom dia
- `2026-06-16 15:08` 👤 Vcs conseguem enviar a NF das aplicações por favor
- `2026-06-16 15:09` 🤖 Olá boa tarde Geane, como vai?
- `2026-06-16 15:10` 🤖 As NFs foram emitidas e encaminhadas para o e-mail de cadastro.
- `2026-06-16 17:19` 👤 Geane.barbosa@live.com
- `2026-06-16 17:19` 👤 ?
- `2026-06-16 17:22` 🤖 Sim!
- `2026-06-16 17:33` 🤖 Oi Geane. Tudo bem? É a Marisa!
- `2026-06-16 17:33` 🤖 Seguem as notas.
- `2026-06-16 17:33` 🤖 Geane2.pdf
- `2026-06-16 17:33` 🤖 Geane.pdf
- `2026-06-16 18:02` 👤 Obrigada Marisa 🙏🏻
- `2026-06-16 20:03` 🤖 Disponha!

</details>


### Daniel Olazabal Cristalia — `5511996738332`

**Cenário:** `fora_escopo_comercial_reverso` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=indefinido · fora_escopo=True


**Síntese:** O atendente da clínica entrou em contato com o Daniel (representante da Cristália) para verificar a disponibilidade do medicamento Amidarona. O interlocutor informou que o item não faz parte do portfólio da empresa. A conversa foi encerrada cordialmente, sem gerar nenhuma oportunidade de atendimento clínico.


<details><summary>Transcrição completa</summary>

- `2026-05-12 14:35` 🤖 Olá bom dia Daniel, como vai? Vocês trabalham com Amidarona 3 mg/ml?
- `2026-05-12 14:35` 👤 Bom dia  Estou bem e vc?  Não temos esse item em portfólio 😕
- `2026-05-12 14:39` 🤖 Estou bem também, agradeço o retorno.

</details>


### George — `5512997823752`

**Cenário:** `agendou_consulta_documentacao_judicial` · agendou_consulta=True · agendou_procedimento=False · teleconsulta=sim · fora_escopo=False


**Síntese:** George, paciente antigo, retornou para atualizar documentação de um processo judicial contra a Amil. Ele agendou uma teleconsulta de reavaliação (R$ 750) com o Dr. Ivan para ajustar o protocolo de EMT e Escetamina. Houve ajustes nos orçamentos e relatórios após a consulta. Em 03/06, o lead informou que a juíza deu decisão favorável para custeio integral e aguarda a liberação do valor para iniciar o tratamento.


**Objeções:** Divergência na quantidade de sessões do orçamento, Dúvida sobre abatimento do valor da consulta no futuro

**Gatilhos:** Necessidade de documentação judicial, Reembolso/Nota Fiscal, Desconto da consulta no tratamento

<details><summary>Transcrição completa</summary>

- `2026-05-22 11:21` 👤 Bom dia, Edilene. Tudo bem?  Aqui é o George. Fiz consulta com o Dr. Ivan em janeiro para os tratamentos de EMT e escetamina, e depois falei com vocês em fevereiro sobre o contato da Amil por conta do processo judicial que estou movendo contra eles. Está lembrada?  *Estou entrando em contato porque houve uma boa evolução no processo.*   A Amil depositou judicialmente o valor do tratamento, mas ontem saiu uma nova decisão em que a juíza determinou que eu informe, em até 5 dias, com documentos, o 
- `2026-05-22 11:21` 🤖 Olá, obrigada pelo contato! Somos da Clínica Ór Psiquiatria. Por favor, aguarde alguns instantes, pois já iremos te atender.
- `2026-05-22 11:28` 🤖 **[ÁUDIO]** Olá, Jorge, tudo bem? Aqui é a Edilaine, da Clínica Or. Então, referente à sua dúvida, o que seria interessante é que você agendasse, sim, uma consulta com Dr. Ivan, porque são muitos detalhes que o documento tá sendo exigido, né? Então seria interessante que nesse período você consiga sinalizar pro doutor todos os detalhes necessários no documento, já que é uma ação judicial e você precisa que o documento seja feito da maneira correta. Eu tenho horário na segunda-feira, que é a data mais próxima, porque hoje o doutor, ele não vai fazer atendimento, tá bom? Eu tenho horário na segunda-feira às 10:30 da manhã. Esse horário funciona para você? A consulta, ela pode ser online, como você fez da outra vez, tá? E só que o pagamento, ele é feito antecipadamente.
- `2026-05-22 11:46` 👤 Bom dia, Edilene. Entendi.  Em todo caso, você consegue emitir um documento com o valor atualizado do tratamento para mim?  Quanto ao agendamento da consulta, o horário de segunda-feira às 10h30 funciona para mim, sim. Poderia agendar, por favor, e me passar o valor da consulta e a forma de pagamento?
- `2026-05-22 12:08` 🤖 Olá, George!
- `2026-05-22 12:08` 🤖 Sou Marisa e vou dar continuidade ao seu atendimento
- `2026-05-22 12:09` 🤖 A consulta será presencial ou online?
- `2026-05-22 12:09` 🤖 A consulta custa 750 reais. Aceitamos pagamento no pix e cartões de débito e crédito. Parcelamos no cartão em até 3x sem juros e emitimos nota para reembolso.
- `2026-05-22 12:09` 🤖 Por favor, me informe o número do seu CPF para localizar o seu cadastro.
- `2026-05-22 12:43` 👤 Meu CPF é 01133285163.   Seria consulta online.  Quanto ao documento com o valor atualizado do tratamento, vocês conseguem me fornecer?
- `2026-05-22 12:46` 👤 Só me confirma uma informação, antes, por gentileza.   Essa consulta que irei passar já faz parte do tratamento? Ou é uma consulta isolada pré-tratamento?
- `2026-05-22 12:48` 🤖 Oi George! Segue o orçamento.
- `2026-05-22 12:49` 🤖 George.pdf
- `2026-05-22 12:50` 🤖 **[ÁUDIO]** Oi, Jorge. Bom dia, tudo bem? Marisa. Jorge, é assim, deixa eu te explicar: A consulta, se você fizer o tratamento, ela não é cobrada, tá bom? Então assim, você vai fazer o pagamento porque é consulta online, mas aí você fazendo o tratamento, o valor é descontado do tratamento.
- `2026-05-22 12:51` 🤖 As teleconsultas são agendadas mediante pagamento. Qual forma de pagamento prefere cartão de crédito ou pix?
- `2026-05-22 12:52` 👤 Obrigado pelo envio do orçamento.   Percebi que ele se refere apenas às infusões de escetamina. Poderia me enviar o orçamento referente às sessões de EMT, também?
- `2026-05-22 12:54` 🤖 George1.pdf
- `2026-05-22 12:55` 🤖 Segue o orçamento do EMT
- `2026-05-22 13:00` 👤 Marisa, obrigado pelos orçamentos.  Só fiquei com uma dúvida: no pedido médico de janeiro, o Dr. Ivan havia indicado 20 sessões de EMT. Nesse orçamento atualizado constam 40 sessões.  Você consegue confirmar, por gentileza, se são 40 sessões mesmo?
- `2026-05-22 13:05` 🤖 Normalmente quando você faz EMT e cetamina ao mesmo tempo são 20 sessões de EMT.
- `2026-05-22 13:06` 🤖 Segue orçamento com 20 sessões
- `2026-05-22 13:06` 🤖 George1.pdf
- `2026-05-22 13:34` 🤖 Oi George!
- `2026-05-22 13:35` 🤖 Qual a forma de pagamento você prefere?
- `2026-05-22 13:49` 👤 Prefiro que seja pix.   Vou só te pedir para aguardar um momento que já volto a falar com você, Marisa.   Vou entrar em uma consulta agora.
- `2026-05-22 13:59` 🤖 Sem problemas.
- `2026-05-22 13:59` 🤖 Segue *Dados* de pagamento *Chave PIX* 22685339000101 *NOME* CLÍNICA OHR PSIQUIATRIA EIRELI *TIPO DE CHAVE* CNPJ *VALOR* R$ 750,00 Por gentileza, assim que possível, nos encaminhe o comprovante de pagamento. Para finalizarmos o seu agendamento.
- `2026-05-22 16:16` 👤 Boa tarde, Marisa.  Só confirmando, antes de eu efetuar o pagamento: o horário das 10:30, na segunda-feira, continua disponível, correto?
- `2026-05-22 16:17` 🤖 Sim está disponível.
- `2026-05-22 16:19` 👤 *[imagem]*
- `2026-05-22 16:29` 🤖 Agradecemos o envio do comprovante, teleconsulta agendada para dia 25/05 as 10h30. Seguimos a disposição.
- `2026-05-22 16:34` 👤 Você me envia o link para a consulta na própria segunda-feira?   E aproveitando, quando possível, poderia emitir a nota fiscal e me enviar? Obrigado.
- `2026-05-22 16:36` 🤖 Sim, vamos encaminhar o link para a teleconsulta no primeiro horário na segunda feira. Sobre a nota iremos solicitar ao setor responsável e assim que possível será encaminhado para o e-mail de cadastro. Seguimos a disposição.
- `2026-05-22 16:37` 👤 Muito obrigado. Tenha um bom final de semana.
- `2026-05-22 16:47` 🤖 **[ÁUDIO]** Olá, boa tarde, tudo bem? Por favor, tira uma dúvida para mim. Nós podemos emitir a nota fiscal da consulta ou, se você preferir, nós podemos emitir a nota fiscal do tratamento no valor de R$ 6.400,00. É que como havia lhe dito, esse valor vai ser descontado do valor do tratamento, certo? O que você prefere?
- `2026-05-22 16:47` 🤖 **[ÁUDIO]** Olá, tudo bem? Deixa eu só tirar uma dúvida, você prefere que nós emitamos essa nota fiscal da consulta ou você prefere que nós emitamos a nota fiscal do tratamento completo?
- `2026-05-22 17:05` 👤 Marisa, obrigado.  Acho que o ideal seria emitir apenas a nota fiscal da consulta de R$ 750,00, agora.  Podemos deixar para emitir a nota fiscal do tratamento completo somente quando o tratamento for efetivamente contratado/iniciado? Como não sei quanto tempo ainda vai levar para a liberação judicial do valor, acho melhor aguardarmos.   Daí essa segunda nota fiscal viria abatendo o valor da consulta do montante total.  Pode ser dessa forma?
- `2026-05-22 17:09` 🤖 **[ÁUDIO]** Olá, Jorge, tudo bem? Então, vamos lá... referente a sua dúvida: sim, eu posso emitir a nota só da consulta, tá? Mas para abater o valor, é... esse valor do tratamento total, eu não sei se é possível, porque como você disse é uma liberação judicial e normalmente a gente abate o valor da consulta no ato da contratação, quando já é de imediato, né? Você fez a consulta e aí fala: "Pronto, pode gerar meu contrato, emitir meu contrato, que eu vou fazer o pagamento do valor restante". Dessa forma que a gente não tem uma estimativa de quando vai ser aprovado o seu... o valor judicial, a liberação judicial... aí eu acho que eu não consigo fazer esse abatimento de R$ 750, tá bom?
- `2026-05-22 17:12` 🤖 Nesse caso posso emitir sua nota da consulta?
- `2026-05-22 17:22` 👤 Entendi que não seria possível abater o valor do montante sem fechar o tratamento completo. Neste caso, nem teria como emitir a nota fiscal do tratamento completo agora, já que eu ainda não estou com o valor em mãos para efetuar o pagamento.  Acho que o jeito vai ser fazer dessa forma, mesmo, então. Considerar consulta avulsa, sem abatimento posterior do montante total e agora fazer a nota fiscal somente da consulta.
- `2026-05-22 17:23` 🤖 Certo, combinado.
- `2026-05-25 10:54` 🤖 Olá bom dia George, como vai? Segue link para sua teleconsulta hoje. *Por favor, use este link que te mandei agora por whatsapp que é diferente do link que você recebeu por email.*
- `2026-05-25 10:55` 🤖 George Henrique Antunes Figueiredo - Dr Ivan Barenboim - 25/05/2026 Segunda-feira, 25 de maio · 10:30 – 11:00am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/sri-pzpk-kfi
- `2026-05-25 13:27` 👤 Bom dia. Obrigado. Irei acessar o link, agora.
- `2026-05-25 13:31` 🤖 Olá! O Dr. Ivan te aguarda no meet.
- `2026-05-25 13:32` 👤 Estou entrando, assim que conseguir corrigir um erro de configuração que está dando na chamada.
- `2026-05-25 13:34` 🤖 Você quer que envie um outro link?
- `2026-05-25 13:34` 👤 Por favor.
- `2026-05-25 13:36` 🤖 George Henrique Antunes - Dr. Ivan Barenboim Segunda-feira, 25 de maio · 10:45 – 11:15am Fuso horário: America/Sao_Paulo Como participar do Google Meet Link da videochamada: https://meet.google.com/zao-pnmy-mbr
- `2026-05-25 13:36` 🤖 Veja se consegue neste link. Assim avisarei o Dr. para entrar neste
- `2026-05-25 13:37` 👤 Obrigado.
- `2026-05-25 13:37` 🤖 Consegiu?
- `2026-05-25 13:38` 👤 Neste novo link, sim.
- `2026-05-25 13:38` 🤖 ok vou pedir para o Dr. entrar
- `2026-05-25 13:43` 👤 Acho que para ele que não deu certo, agora.
- `2026-05-25 13:44` 🤖 Vou verificar! Só um momento
- `2026-05-25 14:53` 👤 20260522 Orçamento Atualizado Clinica Ohr EMT 20 sessões George Figueiredo.pdf
- `2026-05-25 14:53` 👤 20260522 Orçamento Atualizado Clinica Ohr Escetamina George Figueiredo.pdf
- `2026-05-25 14:59` 👤 Aproveitando, o Dr. Ivan também me enviou um relatório junto com as prescrições. Mas ele acabou não atualizando a quantidade de sessões no relatório; o texto permaneceu com a quantidade indicada em janeiro.   Poderia verificar com ele a possibilidade de revisar o relatório para: 1. corrigir a quantidade de sessões prescritas para o protocolo prescrito hoje: 24 sessões de EMT + 12 de escetamina. 2. incluir trecho explicitando que o protocolo prescrito em janeiro era de 20 sessões de EMT + 8 de es
- `2026-05-25 15:04` 🤖 Olá George. Fiquei na dúvida, são 24 ou 30 sessões de EMT?
- `2026-05-25 15:04` 🤖 Georgeemt.pdf
- `2026-05-25 15:05` 🤖 George2505cetamina.pdf
- `2026-05-25 15:05` 🤖 Vou falar com o DR. Ivan a respeito do relatório
- `2026-05-25 15:06` 👤 São 24, mesmo. Eu que falei 30 e acabei confundindo. Corrigi a mensagem para não criar ruído. Desculpe.
- `2026-05-25 15:08` 🤖 Georgeemt.pdf
- `2026-05-25 15:28` 🤖 George, o Dr. já atualizou o relatório no App.
- `2026-05-25 15:28` 🤖 Estamos a disposição
- `2026-05-25 15:28` 👤 Muito obrigado!
- `2026-05-25 15:28` 🤖 Disponha!
- `2026-06-03 15:43` 👤 Boa tarde. Tudo bem?  Aqui é o George, paciente do Dr. Ivan.  Vim apenas atualizá-los sobre a questão judicial para o início do tratamento. Após anexar as prescrições e os orçamentos atualizados no processo, a juíza foi favorável ao custeio integral do valor atualizado.   O processo para a liberação do valor já está em andamento e assim que o montante estiver disponível, entrarei em contato imediatamente para agendarmos o início das sessões.   Agradeço novamente pelo suporte com a documentação.
- `2026-06-03 15:56` 🤖 **[ÁUDIO]** Olá, Jorge, boa tarde, tudo bem? Edilene aqui da Clínica Or. Que ótimo que você conseguiu, né, o custeio do seu tratamento. E a gente segue aqui à disposição para quando você quiser dar início ao seu tratamento, tá bom? E qualquer dúvida ou qualquer outra coisa que você precisar, também estamos à disposição.

</details>


### Estela — `5511951596427`

**Cenário:** `reagendamento_cancelamento_por_recusa_paciente` · agendou_consulta=False · agendou_procedimento=False · teleconsulta=nao · fora_escopo=False


**Síntese:** A responsável pelo paciente Mauricio cancelou a consulta confirmada para o dia. Ela relatou que o paciente não está aderindo ao tratamento medicamentoso e se recusa a comparecer/tomar o remédio. O atendimento ofereceu a opção online, que foi negada, e encerrou o contato sem oferecer suporte adicional para a resistência do paciente.


**Objeções:** paciente_recusa_tratamento, nao_adesao_medicamentosa

<details><summary>Transcrição completa</summary>

- `2026-06-01 12:30` 🤖 Bom dia! Podemos confirmar a consulta do Mauricio hoje as 10:00 hs?
- `2026-06-01 13:01` 👤 Bom dia .... Nao
- `2026-06-01 13:02` 🤖 Não deseja fazer online?
- `2026-06-01 13:03` 👤 Ele não anda tomando o remédio e não quer tomar
- `2026-06-01 13:03` 🤖 Entendo! Estamos a disposição!

</details>
