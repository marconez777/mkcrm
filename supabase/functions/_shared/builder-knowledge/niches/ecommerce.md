# E-commerce

## Vocabulário do nicho
- Cliente final: cliente, comprador, consumidor
- Profissional/empresa: loja, marca, e-commerce, operação, time de atendimento
- Termos que devem aparecer: pedido, entrega, frete, rastreio, troca, devolução, SKU, estoque, carrinho, cupom, pagamento, prazo
- Termos a evitar: "consulta", "agendamento", "visita", "sessão"

## Ofertas típicas
- Produto físico (moda, eletrônicos, casa): venda direta com entrega. Ticket médio varia muito por categoria — R$ 50–800.
- Assinatura / clube de produtos: entrega recorrente mensal de caixas ou itens selecionados. Faixa R$ 60–300/mês.
- Kit ou bundle: agrupamento de produtos com desconto. Ticket R$ 100–600.
- Produto digital (e-book, template, arquivo): entrega imediata após pagamento. Faixa R$ 20–200.
- Marketplace own brand: produto da própria marca com posicionamento premium. Ticket médio acima da categoria.

## Perguntas obrigatórias de qualificação
- O cliente já comprou ou está com dúvida antes de comprar? → Define se é suporte ou vendas.
- Qual o número do pedido (se for pós-compra)? → Permite acesso ao histórico sem perguntas desnecessárias.
- Qual o produto ou categoria de interesse (pré-compra)? → Direciona para o produto certo ou recomendação.
- Qual a dúvida principal — estoque, frete, tamanho, prazo de entrega? → Responde de forma direta.
- O produto é para presente? Tem data específica? → Ajusta expectativa de prazo e oferece embalagem especial.
- Qual CEP para cálculo de frete? → Informação técnica necessária para qualificar prazo e custo.

## Objeções mais comuns + resposta-modelo
- "O frete tá caro."
  Entendo. Para compras acima de R$ X o frete é grátis — falta pouco no seu carrinho. Quer que eu te mostre o que combina com o que você já escolheu?

- "Tenho medo de não receber."
  Trabalhamos com rastreio em tempo real e nossos pedidos têm garantia de entrega — se não chegar, a gente resolve. Posso te mandar o link de rastreio assim que sair.

- "Vi mais barato em outro site."
  Pode ser. Mas vale checar se é a mesma versão do produto, se tem nota fiscal e qual a política de troca. Nossa garantia de [X dias] cobre [detalhe]. Isso faz diferença?

- "Não sei se o tamanho serve."
  Temos um guia de medidas detalhado — posso te mandar agora. E se não servir, a troca é grátis em até 30 dias.

- "Quero trocar o produto que recebi."
  Sem problema. Me passa o número do pedido e o motivo da troca que eu já abro o processo pra você.

## Sinais de lead quente vs lead frio
- Lead quente:
  - Pergunta sobre prazo de entrega para uma data específica
  - Já está com produto no carrinho e tem dúvida pontual
  - Pergunta sobre formas de pagamento ou parcelamento
- Lead frio:
  - Só "curtindo" ou pedindo catálogo sem intenção clara
  - Pergunta sobre produto sem saber o que quer
  - Compara preço com outros sites sem mostrar preferência pela marca

## Métricas que importam
- Taxa de conversão de carrinho abandonado
- Ticket médio por pedido
- Taxa de recompra (LTV)
- Tempo médio de resolução de suporte (TMA)
- Taxa de troca e devolução

## Tools recomendadas
- `move_lead_stage`: mover de "carrinho abandonado" para "pedido realizado" ou "suporte resolvido"
- `add_note`: registrar produto de interesse, dúvida ou reclamação
- `create_task`: follow-up de carrinho abandonado após 1h sem compra
- `schedule_message`: envio de rastreio após despacho e follow-up pós-entrega
- `transfer_to_human`: quando há reclamação grave, fraude suspeita ou troca complexa
- `tag_lead`: marcar por categoria de interesse, tipo de contato ("suporte", "pré-venda", "reclamação")
- `remember_fact`: guardar tamanho, preferências de produto e histórico de compras
- `set_custom_field`: número do último pedido, status de entrega, data da última compra

## Armadilhas comuns
- Pedir número do pedido antes de perguntar se é pré ou pós-compra — no caso de pré-venda, não faz sentido.
- Responder dúvida de frete sem perguntar o CEP — dá informação incorreta.
- Não oferecer alternativa quando produto está sem estoque — perde venda que poderia ser redirecionada.
- Não usar o contexto de "é presente com data" para criar urgência legítima.
- Deixar reclamação de entrega sem resposta rápida — o cliente vai para o Reclame Aqui.

## Exemplo de abertura (1 mensagem)
"Oi! Aqui é da [Loja]. Posso te ajudar?
Você tem uma dúvida sobre algum produto, quer acompanhar um pedido ou precisa de outra coisa?"

## Exemplo de qualificação (mini-diálogo)
Lead: Quero comprar uma jaqueta de couro.
Agente: Ótimo. Você tem preferência de cor ou modelo?
Lead: Preta, masculina, tamanho G.
Agente: Deixa eu verificar o estoque no G... Temos disponível. É pra você ou pra presente?
Lead: Pra mim mesmo.
Agente: Ótimo. Qual o seu CEP pra eu calcular o frete e o prazo de entrega?
Lead: 04538-133
Agente: Frete R$ 18, prazo de 3 dias úteis. Se quiser frete grátis, falta R$ 30 no carrinho — temos luvas que combinam com essa jaqueta. Quer ver?
