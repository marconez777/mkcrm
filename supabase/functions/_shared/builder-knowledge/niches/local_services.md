# Serviços Locais

## Vocabulário do nicho
- Cliente final: cliente, morador, responsável, dono (em contexto de pet shop)
- Profissional/empresa: prestador, técnico, profissional, loja, estabelecimento, instrutor (autoescola)
- Termos que devem aparecer: visita técnica, orçamento, agendamento, endereço, disponibilidade, deslocamento, urgência, serviço, avaliação
- Termos a evitar: "lead", "funil", "ticket" (em contato direto), "demo", "trial"

## Ofertas típicas
- Serviço técnico de urgência (encanador, eletricista, chaveiro): atendimento emergencial. Faixa R$ 150–600 por visita.
- Serviço agendado (manutenção, limpeza, instalação): visita programada sem urgência. Faixa R$ 100–400.
- Pacote de aulas (autoescola, academia, escola de idiomas): plano por período. Faixa R$ 200–1.200/mês ou por pacote.
- Serviço de pet (banho, tosa, consulta veterinária): serviço recorrente mensal ou por demanda. Faixa R$ 60–400.
- Assinatura / plano mensal (academia, dedetização recorrente): receita recorrente. Faixa R$ 80–300/mês.

## Perguntas obrigatórias de qualificação
- Qual o serviço que você precisa? → Define se tem o serviço disponível e quem atende.
- É urgente ou pode ser agendado? → Prioriza fila de atendimento correta.
- Qual o endereço? (para serviços presenciais) → Verifica área de cobertura antes de qualquer compromisso.
- Tem alguma informação sobre o problema (fotos, medidas, modelo do equipamento)? → Agiliza o orçamento.
- Qual o melhor horário para você? → Evita ciclo de mensagens para encontrar vaga.
- Já tentou resolver antes ou é a primeira vez? → Mede complexidade do caso.

## Objeções mais comuns + resposta-modelo
- "Quanto custa?"
  Depende do que for encontrar no local. Posso te dar uma faixa, mas o valor exato sai depois da visita técnica. A visita custa R$ X e esse valor é abatido se fechar o serviço.

- "Tá caro."
  Entendo. Mas um serviço mal feito custa mais no conserto depois. Nosso trabalho tem garantia de X dias — se der problema, a gente volta sem custo.

- "Vou pegar mais orçamento."
  Faz sentido. Só pra adiantar: nossa agenda dessa semana tem horários limitados. Posso reservar um horário pra você enquanto pesquisa?

- "Precisa vir hoje?"
  Não precisa ser hoje se não for urgência. Me fala o melhor horário pra você e eu encaixo no agendamento.

- "Não sei se é esse o problema."
  Sem problema, pra isso existe a visita técnica — o profissional vai identificar o que está acontecendo antes de qualquer serviço.

## Sinais de lead quente vs lead frio
- Lead quente:
  - Descreve urgência real (vazamento, sem água, sem luz, animal doente)
  - Dá endereço sem ser pedido
  - Pergunta se tem disponibilidade hoje ou amanhã
- Lead frio:
  - Só quer saber preço sem dar contexto do problema
  - Diz que "tá só pesquisando"
  - Não responde sobre endereço ou disponibilidade

## Métricas que importam
- Taxa de conversão contato → visita realizada
- Taxa de conversão visita → serviço fechado
- Taxa de retorno / recompra (clientes que voltam)
- Tempo médio de resposta ao primeiro contato
- Avaliação média online (Google Maps, iFood para delivery de pet food, etc.)

## Tools recomendadas
- `move_lead_stage`: mover de "interesse" para "visita agendada" e "serviço realizado"
- `add_note`: registrar endereço, tipo de serviço, urgência e informações do problema
- `create_task`: follow-up pós-serviço para colher avaliação ou vender manutenção futura
- `schedule_message`: confirmação de agendamento e lembrete 2h antes da visita
- `transfer_to_human`: quando o caso é complexo demais para orçar remotamente ou é urgência real
- `tag_lead`: marcar por tipo de serviço ("urgência", "agendado", "recorrente") e área de cobertura
- `remember_fact`: guardar endereço, histórico de serviços e preferências de horário
- `set_custom_field`: endereço completo, tipo de serviço, data e horário do agendamento

## Armadilhas comuns
- Dar orçamento por mensagem sem visita técnica — gera retrabalho e surpresa negativa no local.
- Não confirmar área de cobertura antes de avançar na conversa — compromete atendimento que não conseguirá realizar.
- Não perguntar sobre urgência — trata emergência como agendamento normal e perde cliente.
- Pedir fotos e informações técnicas antes de qualificar interesse — assusta o cliente com burocracia.
- Não fazer follow-up pós-serviço — perde oportunidade de recompra e avaliação positiva.

## Exemplo de abertura (1 mensagem)
"Oi! Aqui é do [Nome do Serviço].
Qual serviço você precisa e é urgente ou pode ser agendado?"

## Exemplo de qualificação (mini-diálogo)
Lead: Preciso de um encanador.
Agente: Certo. É urgência — como um vazamento ativo — ou pode agendar?
Lead: Tem um vazamento no banheiro, mas não tá muito sério.
Agente: Entendido. Qual o seu endereço pra eu confirmar que atendemos sua região?
Lead: Rua das Flores, 120, Vila Mariana, SP.
Agente: Perfeito, atendemos sua região. Qual o melhor horário pra você — manhã ou tarde?
Lead: Tarde, depois das 14h.
Agente: Tenho disponibilidade amanhã às 15h. Confirmo pra você?
