---
title: "Estudo Geral — Conversas Clínica ÓR"
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: "Hub consolidado do estudo profundo de 441 leads / 3.973 mensagens / 306 áudios do funil Agendamentos Novo da Clínica ÓR. Base para treinar agente de pipeline e agente de atendimento."
related_docs:
  - docs/estudo/README.md
---

# Estudo Geral — Conversas Clínica ÓR

> Consolidado gerado a partir do estudo em [`docs/estudo/`](./estudo/README.md). **103 leads analisados em profundidade**, 14 colunas, 306 áudios transcritos via Gemini multimodal.

## 1. Visão executiva

O funil da Clínica ÓR revela uma operação de alto ticket (ticket médio consulta R$ 750) com forte dependência da autoridade técnica do Dr. Ivan. Existe uma dualidade clara: pacientes recorrentes/familiares com altíssima fidelidade e novos leads que travam na barreira financeira ou logística. O ponto crítico de conversão é a 'logística do reembolso' (NF/Relatórios), que atua como moeda de troca para o fechamento de tratamentos complexos (Cetamina/EMT). Notou-se uma mistura ineficiente de comunicações administrativas (fornecedores) com o funil comercial, além de falhas técnicas graves em automações (spam e troca de nomes) que ameaçam a percepção de acolhimento humanizado, pilar central da clínica. O foco deve ser limpar o funil de ruídos B2B e garantir que a jornada de reembolso seja impecável.

## 2. Números-chave

- **Leads analisados em profundidade:** 103 (de 441 totais no funil)
- **Agendaram consulta (≥1 confirmação):** 48  ·  **Agendaram procedimento:** 32
- **Fora do escopo da clínica:** 13
- **Teleconsulta:** {'indefinido': 26, 'nao': 49, 'sim': 28}
- **Psicólogo vs Psiquiatra:** {'indefinido': 6, 'nao_aplicavel': 15, 'psiquiatra': 74, 'ambos': 7, 'psicologo': 1}

### Top cenários canônicos (rótulos brutos das sínteses)

| Cenário | Ocorrências |
|---|---:|
| admin_parceria | 4 |
| agendou_procedimento_pos_consulta | 3 |
| agendou_procedimento_direto | 2 |
| pos_venda_administrativo | 2 |
| duvida_psicologo_psiquiatra | 1 |
| erro_atendimento_venda_como_proposta | 1 |
| fora_escopo | 1 |
| agendou_apos_duvidas_tratamento | 1 |
| pagamento_procedimento | 1 |
| agendou_primeira_msg | 1 |
| renovacao_receita_sem_consulta | 1 |
| lead_sumiu_apos_cotacao_pacote | 1 |
| reagendamento_por_imprevisto_medico | 1 |
| reagendamento_frequente_e_nova_consulta_especialista | 1 |
| agendou_consulta_direta | 1 |

### Top objeções

| Objeção | Ocorrências |
|---|---:|
| conflito de agenda | 2 |
| preço alto | 2 |
| política da clínica de não receber representantes | 1 |
| não aceitação de amostras grátis | 1 |
| efeitos colaterais da medicação (naltrexona) | 1 |
| logística (localização/horário) | 1 |
| preço (mencionado no fluxo, mas aceito) | 1 |
| instabilidade técnica no link de pagamento | 1 |
| verificar disponibilidade financeira/pessoal | 1 |
| preferência por atendimento presencial invés de online | 1 |
| conflito de agenda (trânsito) | 1 |
| conflito de agenda (outros médicos) | 1 |
| política de cancelamento em cima da hora | 1 |
| indisponibilidade de horário (ajustado rapidamente) | 1 |
| nota fiscal com data retroativa/nominal para reembolso plana de saúde | 1 |

### Top gatilhos de interesse

| Gatilho | Ocorrências |
|---|---:|
| continuidade do tratamento | 7 |
| teleconsulta | 5 |
| método sinclair | 3 |
| reembolso_plano_saude | 3 |
| parcelamento sem juros | 3 |
| agilidade no atendimento | 3 |
| reembolso convênio | 3 |
| atendimento humanizado | 3 |
| atendimento presencial | 2 |
| atendimento_humanizado | 2 |
| nota fiscal para reembolso | 2 |
| infusão de cetamina | 2 |
| experiência do profissional (15 anos) | 2 |
| conveniência de horário | 2 |
| reembolso via nota fiscal | 2 |

### Top procedimentos mencionados

| Procedimento | Ocorrências |
|---|---:|
| Infusão de Cetamina | 18 |
| Consulta de seguimento | 7 |
| Primeira Consulta | 4 |
| EMT (Estimulação Magnética Transcraniana) | 4 |
| Consulta Psiquiátrica | 3 |
| Cetamina e EMT (Estimulação Magnética Transcraniana) | 2 |
| cetamina | 2 |
| Infusão de cetamina | 2 |
| infusão de cetamina | 2 |
| Avaliação / Primeira Consulta | 1 |
| Consulta não especificada | 1 |
| Apresentação de portfólio / Visita de representante | 1 |
| Método Sinclair | 1 |
| Infusão | 1 |
| Renovação de receita (Rivotril) | 1 |

### Top profissionais mencionados

| Profissional | Ocorrências |
|---|---:|
| Dr. Ivan | 32 |
| Dr. Ivan Barenboim | 18 |
| Marisa (Consultora) | 3 |
| Marisa (atendente) | 3 |
| nenhum | 2 |
| Dr. Ivan Baremboim | 2 |
| Dr. Ivan, Dra. Maísa | 2 |
| Dra. Maísa | 2 |
| Marisa (Atendente) | 2 |
| Dr. Ivan Barenboim, Dra. Maísa | 2 |
| Psiquiatra (no interesse original) | 1 |
| Dr. Marcelo (implícito) | 1 |
| Dra. Maisa | 1 |
| Dra. Maísa e Dr. Ivan | 1 |
| nao_especificado | 1 |

### Top erros do agente IA atual

| Erro | Ocorrências |
|---|---:|
| A IA/Bot confundiu um pedido de agendamento de paciente com uma proposta comercial/parceria. | 1 |
| o bot da clínica agiu como comprador/consumidor interagindo com um suporte externo (Mercado Livre) em vez de realizar at | 1 |
| Confusão de nomes (atendente chama o cliente de Gilberto e depois de Gabriel, enquanto o cadastro inicial diz Leônidas) | 1 |
| O bot enviou uma mensagem motivacional desconexa do contexto (hallucination ou script errado) às 20:38:21 após dúvida co | 1 |
| Spam de lembretes (enviou a mesma mensagem 5 vezes em intervalos de 5 minutos no dia da consulta) | 1 |
| Conflito de agenda: o bot confirmou o horário das 10:30 mesmo após a paciente dizer que não conseguiria naquele horário | 1 |
| Envio de template de endereço físico para consulta confirmada como online | 1 |
| Confusão de horário (citou 15h em vez de 18h) na mensagem de confirmação | 1 |
| Loop de mensagens automáticas (11 mensagens repetidas sobre o início da consulta em um curto intervalo) | 1 |
| Mensagem de sistema/texto aleatório sobre IA enviado fora de contexto no dia 06/05 às 22:11. | 1 |

## 3. Cenários canônicos cross-coluna

_Cada cenário inclui: descrição, como o agente detecta, resposta ideal e ação no pipeline._

### 3.1 Crise de Saúde Mental (Urgência)

Paciente ou familiar em crise aguda buscando suporte imediato.

- **Colunas:** Leads de entrada, Qualificação
- **Como detectar:** Lead menciona ideação suicida ou depressão severa no primeiro contato.
- **Resposta ideal (atendimento):** Acolhimento imediato, validação da dor e oferta de horário priorizado ou orientação de pronto-atendimento se necessário.
- **Ação (pipeline):** Mover para 'Qualificação' com Tag 'Urgência Clínica'

### 3.2 Fluxo de Reembolso Obrigatório

Foco total na logística administrativa para viabilizar o fluxo financeiro do paciente.

- **Colunas:** Consulta finalizada, Fechamento pendente procedimento
- **Como detectar:** Paciente solicita NF ou relatório logo após finalizar a consulta para reembolso.
- **Resposta ideal (atendimento):** Confirmação dos dados cadastrais e promessa de envio em até 24h úteis.
- **Ação (pipeline):** Mover para 'Pendência Procedimento' e criar tarefa 'Emissão NF'

### 3.3 Aguardando Decisão Judicial

Pacientes que querem o tratamento mas dependem de terceiros (liminares).

- **Colunas:** Nutrição de Leads Inativos
- **Como detectar:** Lead afirma que está aguardando liberação do convênio ou decisão judicial.
- **Resposta ideal (atendimento):** Follow-up quinzenal empático para monitorar o status do processo e manter o lead engajado.
- **Ação (pipeline):** Mover para 'Nutrição de Leads Inativos' com Tag 'Judicialização'

## 4. Fluxos-chave

### Agendamento de Protocolo de Cetamina

1. Validar necessidade clínica/consulta prévia
2. Explicar logística (acomhante obrigatório + jejum)
3. Apresentar opções de pacote (abatimento da consulta)
4. Confirmar pagamento (PIX/Link) e agendar datas fixas

### Renovação de Receita de Paciente Antigo

1. Verificar data da última consulta
2. Se > 4-6 meses, direcionar para consulta de retorno
3. Se recente, validar local de retirada (App ou Portaria)
4. Confirmar assinatura digital válida

## 5. Objeções consolidadas + respostas recomendadas

| Objeção | Frequência | Resposta recomendada |
|---|---|---|
| Valor da consulta (R$ 750) em comparação ao mercado. | Alta | Focar no reembolso do convênio, autoridade do Dr. Ivan e abatimento do valor se fechar tratamento. |
| Distância geográfica (Moro em outro estado/cidade). | Média | Oferecer a teleconsulta como triagem inicial facilitada. |
| Medo de efeitos colaterais (dissociação/Naltrexona). | Baixa | Explicação técnica simplificada sobre supervisão médica constante durante o procedimento. |

## 6. Erros do agente IA atual (priorizados)

1. IA confundindo proposta comercial de representantes com agendamento de pacientes.
2. Loop de confirmação (spam) enviando mensagens repetidas em curto intervalo.
3. Confusão de nomes (chamar paciente por nomes diferentes na mesma conversa).
4. Envio de endereço físico para consultas confirmadas como Online.
5. Mensagens de sistema ou scripts motivacionais 'alucinados' sem contexto.

## 7. Specs do agente de **Pipeline**

### Campos de extração obrigatórios

- nome_paciente
- nome_responsavel_financeiro
- procedimento_interesse
- profissional_preferencia
- modalidade_atendimento (Presencial/Online)
- possui_liminar_judicial (Sim/Não)
- status_nf_reembolso (Pendente/Enviada)
- saldo_sessoes_pacote

### Regras de movimentação (B-rules)

- B-Rule: Se mencionar 'liminar' ou 'processo contra convênio', mover para Follow-up Jurídico.
- B-Rule: Se o lead parou de responder após preço da consulta, disparar régua de nutrição em 48h.
- B-Rule: Se pagamento via PIX for confirmado, mover para 'Procedimento Pago' e notificar enfermagem.

### Regras de desqualificação

- Contatos de representantes farmacêuticos ou vendas B2B (Mover para Stakeholders)
- Necessidade exclusiva de internação ou hospitalização (Fora de escopo ambulatorial)
- Pacientes fora de SP que exigem atendimento presencial local

### Sinais para handoff humano

- Palavras-chave: 'emergência', 'morte', 'não aguento mais', 'advogado', 'erro médico'

## 8. Specs do agente de **Atendimento**

### Persona e tom

Acolhedora, técnica e altamente organizada. Deve transparecer a autoridade médica da Clínica ÓR (referência em Cetamina e Método Sinclair) com um tom de voz ultra-empático, especialmente ao lidar com familiares exaustos ou pacientes em vulnerabilidade extrema. Deve ser resolutiva quanto a burocracias de reembolso.

### Scripts por cenário


**Triagem PHQ-9 (Auto-diagnóstico)**

> Vi que você realizou nosso teste de saúde mental. O resultado indica que este é um momento importante para buscar apoio especializado. O Dr. Ivan é referência nessas queixas. Gostaria de agendar uma avaliação para conversarmos melhor?

**Objeção de Preço (R$ 750) + Reembolso**

> Entendo que o investimento é relevante. Na Clínica ÓR, fornecemos toda a documentação (Nota Fiscal e Relatórios) para que você solicite o reembolso junto ao seu convênio. Além disso, se você optar por fechar um protocolo de tratamento (Cetamina/EMT) após a consulta, este valor é abatido do pacote. Como fica sua agenda para esta semana?

**Renovação de Receita Pendente**

> Olá! Para sua segurança clínica, a renovação de receitas controladas precisa de uma reavaliação periódica. Verifiquei que sua última consulta foi há X meses. Vamos agendar um breve retorno online com o Dr. Ivan para garantir a continuidade do seu tratamento?

### Perguntas obrigatórias na qualificação

- Qual o seu nome completo e o do paciente (caso não seja você)?
- Qual a sua queixa principal ou procedimento de interesse? (Ex: Depressão, Alcoolismo, Cetamina, EMT)
- Você possui indicação de algum profissional externo ou já conhece o Dr. Ivan/Dra. Maísa?
- Prefere atendimento presencial em SP ou Teleconsulta?

### Regras de NÃO fazer

- ❌ Não prometer cura imediata para quadros graves
- ❌ Não enviar áudios longos sem autorização prévia
- ❌ Não garantir cobertura de convênio (atuamos apenas com reembolso via NF)
- ❌ Não confirmar horários de infusão sem validar a presença de acompanhante obrigatório

### Quando passar para humano

- Menção a ideação suicida ou crise severa de saúde mental
- Dúvida jurídica específica sobre liminar/judicialização contra convênio
- Erro em assinatura digital de receita que impede compra em farmácia
- Reclamação sobre atraso médico superior a 30 minutos
- Solicitação de edição de Nota Fiscal (datas retroativas ou nomes de dependentes)

## 9. Roadmap priorizado

| Prio | Alvo | Item | Impacto |
|---|---|---|---|
| P0 | atendimento | Correção imediata de automações de confirmação para evitar spam de mensagens. | Alto - Redução de churn e irritação do paciente |
| P0 | pipeline | Criação de filtros e tags para separar Leads Assistenciais de contatos B2B/Fornecedores. | Médio - Organização do funil |
| P1 | atendimento | Implementação de checklist automático de pré-procedimento (Jejum/Acompanhante). | Alto - Segurança do paciente e profissional |
| P2 | produto | Estabilização da API de receitas digitais para evitar erros de assinatura citados pelos leads. | Médio - Redução de demanda manual |

## 10. Como navegar o estudo

- Arquivos por coluna: [`docs/estudo/`](./estudo/README.md) — cada um contém **lista de leads, transcrições completas (com áudios transcritos), sínteses individuais e padrões da coluna**.
- Cache persistente: bucket privado `estudo-cache` (lead/, audio/, column/, global/).
- Scripts: `/tmp/estudo-or/0[1-6]_*.py` (dump, transcrição, síntese-lead, síntese-coluna, render, hub).
