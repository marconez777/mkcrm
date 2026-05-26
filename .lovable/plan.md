# Plano

Sim — dá para usar **a mesma fonte/lógica do Tracking**, e esse é o caminho certo.

## O que vou fazer

1. **Centralizar o cálculo das métricas do Tracking**
   - Extrair a lógica hoje espalhada no dashboard para uma fonte única de métricas.
   - O relatório agendado vai consumir essa mesma fonte, em vez de manter regras paralelas.

2. **Fazer o relatório usar exatamente os mesmos filtros do dashboard**
   - Mesmo recorte de período.
   - Mesmo escopo por clínica.
   - Mesmos eventos para WhatsApp, formulário, visitantes e sessões.

3. **Corrigir a separação de leads por origem**
   - Manter no relatório o total coerente com o card **Leads identificados = 3**.
   - Separar corretamente em **2 formulário** e **1 WhatsApp** com a mesma regra de origem usada no Tracking.

4. **Eliminar divergência futura**
   - Deixar dashboard e relatório dependentes da mesma implementação, para não “descasarem” de novo.

## O que encontrei

- O dashboard de **Tracking** calcula os cards direto no frontend em `src/pages/Tracking.tsx`.
- Ele usa estas fontes:
  - **Visitantes únicos** → `tracking_visitors` por `last_seen_at`
  - **Sessões** → `tracking_sessions` por `started_at`
  - **Eventos / pageviews / clique WhatsApp / formulário** → `tracking_events`
  - **Leads identificados** → `tracking_identity_links`
- O relatório diário hoje replica essa lógica separadamente em `supabase/functions/scheduled-report-tick/index.ts`, e foi aí que nasceu a divergência.

## Detalhe importante

O dashboard atual mostra claramente o total de leads (**3**), mas a quebra **formulário vs WhatsApp** não vem de um card pronto; ela é inferida pela origem do vínculo (`link_source`) na tabela de leads/origem. Então o certo não é “ler o número da tela”, e sim **reusar a mesma regra-base que alimenta o Tracking**.

## Resultado esperado

Depois da implementação, o relatório deve bater com o Tracking para o período “Hoje”, incluindo:
- **Visitantes únicos:** 29
- **Cliques WhatsApp:** 7
- **Leads identificados:** 3
- **Leads formulário:** 2
- **Leads WhatsApp:** 1

## Detalhes técnicos

- Vou tirar a regra duplicada de `scheduled-report-tick`.
- Vou criar uma função compartilhada/consulta canônica de métricas de Tracking.
- O dashboard e o relatório vão consumir essa mesma base para evitar discrepância entre frontend e backend.