# Imobiliária

## Vocabulário do nicho
- Cliente final: cliente, comprador, locatário, interessado
- Profissional/empresa: corretor, imobiliária, consultor imobiliário, incorporadora
- Termos que devem aparecer: visita, imóvel, metragem, condomínio, financiamento, entrada, FGTS, escritura, laudo, proposta, planta
- Termos a evitar: "produto imobiliário", "item", "comprar pacote", "consulta" (é visita, não consulta)

## Ofertas típicas
- Imóvel residencial para compra: apartamento ou casa para aquisição, nova ou usada. Faixa R$ 200 mil–2 milhões+.
- Imóvel na planta: lançamento de incorporadora, entrada parcelada durante obra. Faixa R$ 250 mil–1,5 milhão.
- Locação residencial: aluguel de apartamento ou casa. Faixa R$ 1.200–8.000/mês dependendo da cidade e padrão.
- Imóvel comercial: sala, loja ou galpão para compra ou locação. Faixa bastante variável por localização.
- Terreno: para construção própria ou incorporação. Faixa R$ 80 mil–500 mil+.

## Perguntas obrigatórias de qualificação
- Está buscando para comprar ou alugar? → Define produto e funil completamente diferentes.
- Qual a faixa de valor que faz sentido pra você (compra ou aluguel)? → Evita mostrar imóvel fora do alcance.
- Tem FGTS disponível ou já conversou com banco sobre crédito imobiliário? → Mede capacidade financeira real.
- Quantas pessoas vão morar? Precisa de quantos quartos? → Filtra metragem e tipologia.
- Qual bairro ou região é prioritária? Tem flexibilidade? → Direciona portfólio correto.
- É para moradia imediata ou pode esperar entrega (planta)? → Separa pronto de lançamento.

## Objeções mais comuns + resposta-modelo
- "Tá caro, vi imóvel parecido mais barato."
  Faz sentido comparar. Me manda o link ou me conta mais sobre o que viu — às vezes a diferença está em acabamento, condomínio ou localização. Posso analisar juntos.

- "Ainda estou pesquisando, não decidi nada."
  Tranquilo. Posso te mostrar opções que se encaixam no que você descreveu, sem compromisso. Uma visita já ajuda a definir o que realmente faz sentido pra você.

- "Preciso falar com minha esposa/marido."
  Com certeza, é decisão de casal. Posso marcar uma visita pra vocês dois? Assim tomam a decisão juntos com o imóvel na frente.

- "Não sei se consigo financiamento."
  Podemos ajudar com isso. Trabalhamos com correspondente bancário e fazemos a simulação sem custo. Você sabe qual seu renda mensal aproximada? Com isso já consigo te dar uma ideia real.

- "Vou esperar o mercado baixar."
  Entendo a lógica. Posso te mostrar o histórico de valorização dessa região? Às vezes esperar tem custo maior do que parece.

## Sinais de lead quente vs lead frio
- Lead quente:
  - Já tem carta de crédito aprovada ou FGTS separado
  - Menciona prazo ("preciso mudar até julho")
  - Pergunta sobre proposta ou documentação necessária
- Lead frio:
  - Diz que "tá só olhando" sem faixa de preço definida
  - Não tem certeza se quer comprar ou alugar
  - Não responde sobre orçamento mesmo após perguntas diretas

## Métricas que importam
- Taxa de conversão contato → visita agendada
- Taxa de conversão visita → proposta
- Tempo médio de ciclo de vendas (primeiro contato → assinatura)
- Taxa de churn de locatários (renovação de contrato)
- Ticket médio das transações fechadas

## Tools recomendadas
- `move_lead_stage`: mover de "interesse" → "visita agendada" → "proposta enviada" → "contrato"
- `add_note`: registrar faixa de preço, tipologia desejada, bairros e capacidade de financiamento
- `create_task`: follow-up após visita realizada para coletar feedback
- `schedule_message`: lembrete de visita agendada e envio de documentação pós-proposta
- `transfer_to_human`: quando cliente está pronto para proposta ou tem dúvida jurídica/financeira
- `tag_lead`: marcar por intenção ("compra", "locação", "planta", "pronto") e faixa de preço
- `remember_fact`: guardar bairros preferidos, tipologia, capacidade financeira e urgência
- `set_custom_field`: faixa de valor, número de quartos, data-limite para mudança

## Armadilhas comuns
- Mandar link de imóvel sem antes saber faixa de preço — gera rejeição imediata ou comparação errada.
- Não perguntar se é compra ou locação antes de qualquer coisa — os funis são completamente distintos.
- Perguntar sobre financiamento muito cedo sem criar rapport — intimida antes de criar vínculo.
- Não agendar visita e apenas enviar fotos — o imóvel vende na visita, não na foto.
- Não fazer follow-up estruturado após visita — o lead esquece ou vai para outro corretor.

## Exemplo de abertura (1 mensagem)
"Oi, tudo certo? Aqui é [Nome], da [Imobiliária].
Vi que você demonstrou interesse em imóveis na nossa carteira.
É para compra ou locação? E qual região você está buscando?"

## Exemplo de qualificação (mini-diálogo)
Lead: Quero comprar um apartamento.
Agente: Ótimo. Você tem uma faixa de valor em mente?
Lead: Até uns 500 mil.
Agente: Perfeito. Quantos quartos você precisa?
Lead: Dois quartos, com vaga.
Agente: Entendido. Tem alguma região ou bairro prioritário?
Lead: Prefiro zona sul, mas tenho alguma flexibilidade.
Agente: Ótimo. Você já tem crédito aprovado ou FGTS disponível?
Lead: Tenho FGTS e vou financiar o restante.
Agente: Perfeito, isso já facilita bastante. Tenho algumas opções que se encaixam bem. Posso agendar uma visita essa semana?
