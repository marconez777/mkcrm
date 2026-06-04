# Advocacia

## Vocabulário do nicho
- Cliente final: cliente, parte, assistido (em contexto de defensoria)
- Profissional/empresa: advogado(a), escritório, banca, sócio, especialista em [área]
- Termos que devem aparecer: consulta, caso, processo, área do direito, honorários, contrato de prestação de serviços, procuração, prazo, instância, acordo
- Termos a evitar: "produto jurídico", "pacote de serviços" (soa inadequado), "venda", "promoção de consulta" (ética OAB limita publicidade)

## Ofertas típicas
- Consulta jurídica inicial: análise do caso, orientação sobre direitos e estratégia. Faixa R$ 200–600 (muitos escritórios cobram ou oferecem gratuita para captar).
- Representação em processo (honorários de êxito): advogado representa no processo e recebe % do ganho. Faixa 20–30% do valor da causa.
- Honorários fixos mensais (contencioso ou preventivo): empresas que precisam de assessoria contínua. Faixa R$ 1.500–15.000/mês.
- Elaboração de contratos / documentos: redação ou revisão pontual. Faixa R$ 500–5.000 por documento.
- Planejamento jurídico preventivo: organização societária, sucessão, proteção patrimonial. Faixa R$ 3.000–20.000.

## Perguntas obrigatórias de qualificação
- Qual é a área do direito envolvida (trabalhista, família, cível, empresarial, criminal)? → Define qual advogado ou área do escritório pode atender.
- O caso já tem processo aberto ou ainda é preventivo/consultivo? → Muda urgência e tipo de serviço.
- Tem prazo urgente (audiência, prazo processual, notificação)? → Prioriza atendimento e define velocidade de resposta.
- É pessoa física ou jurídica (empresa)? → Altera tipo de contrato e honorários.
- Já teve representação jurídica anterior nesse caso? → Avalia complexidade e possíveis conflitos de interesse.
- Tem documentos disponíveis (contrato, notificação, processo)? → Permite análise prévia mais qualificada.

## Objeções mais comuns + resposta-modelo
- "Tá caro, advogado cobra demais."
  Entendo. O valor depende muito da complexidade do caso. Na consulta inicial a gente analisa tudo e apresenta um honorário transparente — sem surpresa depois. Quer que a gente comece por aí?

- "Vou pensar, é muita coisa."
  Faz sentido, é uma decisão importante. Só uma coisa: se houver prazo processual no seu caso, deixar passar pode comprometer muito o resultado. Você sabe se tem algum prazo em andamento?

- "Um amigo advogado pode me ajudar."
  Pode sim. Só vale garantir que ele atua na área certa. Se quiser uma segunda opinião ou se ele não for da especialidade, estamos à disposição.

- "Quero só saber se tenho chance."
  Isso é exatamente o que fazemos na consulta. Em 30–40 minutos consigo te dar uma análise real do caso e das suas chances. Posso agendar?

- "Prefiro resolver por conta."
  Entendo. Em casos simples isso funciona. Mas se envolver prazo, contrato ou processo, um erro pode custar muito mais que o honorário. Posso pelo menos te orientar numa consulta rápida?

## Sinais de lead quente vs lead frio
- Lead quente:
  - Tem prazo processual iminente ou foi notificado recentemente
  - Já tentou resolver sozinho e não conseguiu
  - Pergunta sobre honorários e como funciona o contrato
- Lead frio:
  - Só quer "saber se tem direito" sem intenção de contratar
  - Diz que "tem um amigo advogado" sem precisar de nada agora
  - Não tem processo, contrato ou documento concreto para analisar

## Métricas que importam
- Taxa de conversão consulta → contratação
- Ticket médio por caso / por cliente
- Tempo médio de fechamento de contrato
- Taxa de renovação de clientes empresariais (mensalistas)
- NPS pós-encerramento de caso

## Tools recomendadas
- `move_lead_stage`: mover de "contato" para "consulta agendada", "proposta de honorários", "contratado"
- `add_note`: registrar área do direito, resumo do caso, urgência e documentos disponíveis
- `create_task`: follow-up 24h após consulta com proposta de honorários
- `schedule_message`: lembrete de consulta agendada e follow-up pós-consulta
- `transfer_to_human`: quando há prazo processual urgente ou caso exige avaliação imediata do advogado
- `tag_lead`: marcar por área do direito ("trabalhista", "família", "empresarial", "cível")
- `remember_fact`: guardar área do caso, urgência e histórico de atendimento
- `set_custom_field`: área do direito, status do processo, data de prazo se houver

## Armadilhas comuns
- Dar orientação jurídica detalhada antes da consulta paga — desvaloriza o serviço e gera responsabilidade sem contrato.
- Não perguntar sobre prazo logo no início — perde caso urgente por demora no atendimento.
- Usar linguagem muito técnica antes de entender o nível do cliente — intimida e gera abandono.
- Não perguntar se já há processo aberto — pode haver conflito de interesse com outro escritório.
- Não qualificar a área antes de transferir para humano — gera atendimento errado e retrabalho.

## Exemplo de abertura (1 mensagem)
"Oi, aqui é do escritório [Nome].
Vi que você entrou em contato. Me conta brevemente: qual é a situação que você precisa resolver?"

## Exemplo de qualificação (mini-diálogo)
Lead: Fui demitido e quero saber se tenho direito a alguma coisa.
Agente: Entendido. Foi demissão sem justa causa ou com alguma alegação da empresa?
Lead: Sem justa causa, mas não recebi tudo que era pra receber.
Agente: Você recebeu o FGTS, aviso prévio e as verbas rescisórias? Ou ficou faltando algo específico?
Lead: Não recebi o seguro-desemprego e acho que o saldo de FGTS tá errado.
Agente: Certo, isso é bem comum e tem solução. Há quanto tempo você foi demitido?
Lead: Umas 3 semanas.
Agente: Ainda dá tempo de regularizar. Posso agendar uma consulta rápida pra analisar seu caso — leva uns 30 minutos. Você tem disponibilidade essa semana?
