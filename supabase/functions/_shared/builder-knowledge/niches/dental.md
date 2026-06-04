# Odontologia

## Vocabulário do nicho
- Cliente final: paciente (nunca "cliente" em contato direto)
- Profissional/empresa: dentista, cirurgião-dentista, clínica odontológica, consultório
- Termos que devem aparecer: avaliação, orçamento, plano de tratamento, procedimento, manutenção, aparelho, clareamento, implante, retorno
- Termos a evitar: "comprar tratamento", "produto dental", "pacote promocional" (soa barato demais), "lead"

## Ofertas típicas
- Avaliação inicial: consulta para diagnóstico, levantamento de necessidades e apresentação de orçamento. Faixa R$ 0–150 (muitas clínicas oferecem gratuita como entrada).
- Tratamento ortodôntico (aparelho): aparelho metálico, estético ou alinhador invisível. Faixa R$ 2.500–12.000.
- Implante dentário: substituição de dente ausente com implante de titânio + coroa. Faixa R$ 2.500–6.000 por unidade.
- Clareamento: a laser ou com moldeira. Faixa R$ 500–1.800.
- Manutenção / limpeza profissional: profilaxia periódica, raspagem. Faixa R$ 150–400.

## Perguntas obrigatórias de qualificação
- Tem algum desconforto, dor ou urgência no momento? → Determina se é emergência ou eletivo.
- É primeira vez na clínica ou é paciente de retorno? → Define se precisa de avaliação completa.
- Tem plano odontológico? Se sim, qual? → Filtra cobertura e fluxo de atendimento.
- Qual procedimento tem em mente ou qual o principal incômodo? → Direciona para o especialista certo.
- Já fez avaliação em outro lugar e tem orçamento anterior? → Ajuda a entender o estágio de decisão.
- Tem preferência de horário (manhã, tarde, fim de semana)? → Agenda correta desde o início.

## Objeções mais comuns + resposta-modelo
- "Tá muito caro, vi mais barato em outro lugar."
  Pode ser. Mas o preço muda bastante dependendo do material usado e do profissional. Posso explicar o que está incluso no nosso orçamento pra você comparar igual por igual?

- "Vou pensar e te falo."
  Claro. Só avisando que a avaliação é gratuita e sem compromisso — você vem, vê o plano de tratamento e decide com calma. Quer já reservar um horário?

- "Tenho medo de dentista."
  Isso é muito comum. Nosso protocolo para pacientes com ansiedade é diferenciado — o doutor explica tudo antes de fazer qualquer coisa. Posso te contar como funciona?

- "Preciso falar com minha esposa/marido."
  Faz sentido, é uma decisão importante. Posso te mandar o orçamento por escrito pra você mostrar?

- "O plano não cobre esse procedimento."
  Entendo. Trabalhamos com parcelamento sem juros em até X vezes. Quer que eu calcule como ficaria por mês?

## Sinais de lead quente vs lead frio
- Lead quente:
  - Menciona dor ou desconforto atual
  - Pergunta sobre formas de parcelamento
  - Já veio de indicação de outro paciente
- Lead frio:
  - Só pede preço sem dar nenhum contexto
  - Menciona que "tá pesquisando vários lugares"
  - Não responde sobre urgência ou procedimento desejado

## Métricas que importam
- Taxa de conversão avaliação → início de tratamento
- Ticket médio de tratamento completo
- Taxa de no-show em avaliações
- Taxa de reativação de pacientes inativos (+ de 6 meses sem contato)
- Taxa de indicação (quantos novos pacientes vieram por indicação)

## Tools recomendadas
- `move_lead_stage`: mover de "contato" para "avaliação agendada" e depois para "em tratamento"
- `add_note`: registrar procedimento de interesse, plano odontológico e urgência
- `create_task`: criar tarefa para envio de orçamento após avaliação
- `schedule_message`: lembrete 24h antes da avaliação e follow-up pós-consulta
- `transfer_to_human`: quando paciente relata dor aguda ou caso cirúrgico complexo
- `tag_lead`: marcar por procedimento ("implante", "ortodontia", "clareamento", "urgência")
- `remember_fact`: guardar plano odontológico e histórico de procedimentos
- `set_custom_field`: salvar data da última consulta e status do plano de tratamento

## Armadilhas comuns
- Mandar tabela de preços antes de fazer qualquer qualificação — assusta sem contexto.
- Não perguntar sobre dor ou urgência e agendar avaliação eletiva quando o paciente precisava de emergência.
- Usar linguagem muito técnica ("periodontia", "endodontia") antes de saber o nível de conhecimento do paciente.
- Não confirmar se a clínica aceita o plano antes de avançar na conversa.
- Deixar o lead esfriar após envio de orçamento sem follow-up estruturado.

## Exemplo de abertura (1 mensagem)
"Oi, aqui é da [Nome da Clínica]. Tudo certo?
Vi que você entrou em contato. Tem algum desconforto ou dor agora, ou é mais um procedimento eletivo que você está planejando?"

## Exemplo de qualificação (mini-diálogo)
Lead: Quero fazer um clareamento.
Agente: Ótimo. Já fez clareamento antes ou seria a primeira vez?
Lead: Primeira vez.
Agente: Entendido. Tem plano odontológico ou prefere particular?
Lead: Particular mesmo.
Agente: Perfeito. Antes do clareamento a gente faz uma avaliação rápida pra garantir que a gengiva está saudável. A avaliação aqui é gratuita. Você teria disponibilidade essa semana?
Lead: Tenho sim, prefiro à tarde.
Agente: Tenho terça às 14h ou sexta às 15h. Qual fica melhor pra você?
