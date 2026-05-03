# Melhorar histórico das conversas

Hoje o `ChatPane` já agrupa por data (Hoje/Ontem/...) mas falta navegação, busca dentro da conversa, paginação eficiente e visão de timeline com eventos do CRM. Proposta dividida em 3 pacotes — você escolhe ou aprova tudo.

## Pacote 1 — Navegação por data (alto impacto, baixo esforço)

- **Separadores de data "sticky"**: o chip de data (Hoje, Ontem, 12 mar) gruda no topo enquanto rola, igual WhatsApp.
- **Date jumper**: botão de calendário no header do chat → popover com `Calendar` (shadcn) marcando apenas dias que têm mensagem; clicar pula direto pro primeiro msg daquele dia com highlight.
- **Atalhos rápidos**: chips "Hoje · Ontem · 7 dias · 30 dias · Tudo" no topo do scroll.
- **Scroll-to-original em respostas**: clicar na citação (`reply_to_external_id`) rola até a mensagem original e dá pulse highlight.

## Pacote 2 — Busca + paginação (médio esforço)

- **Busca dentro da conversa**: ícone de lupa no header abre input; filtra mensagens com match destacado (highlight amarelo no termo) e navegação ↑↓ entre ocorrências (contador "3 de 12").
- **Paginação reversa (lazy load)**: hoje carregamos todo histórico de uma vez. Trocar para carregar últimas 50 e fazer fetch de 50 anteriores ao chegar perto do topo (`IntersectionObserver` no primeiro item). Mantém realtime intacto.
- **Indicador de "carregando histórico antigo"** no topo enquanto busca a página anterior.

## Pacote 3 — Timeline unificada (alto impacto)

- **Mesclar `lead_events` ao histórico**: stage_changed, attendant_changed aparecem como divisores discretos entre mensagens ("Movido para Qualificação · 14:32 · por Ana"). Já temos a tabela e o trigger gravando.
- **Resumo do dia (IA)**: ao expandir um separador de data, opção "Resumir este dia" usando a edge `ai-assist` (modo novo `summary_day`) — útil em conversas longas.
- **Filtros de tipo**: toggle no header pra mostrar só "mídia", "links", "respostas suas", "eventos CRM".

## Detalhes técnicos

**Componentes/arquivos afetados:**
- `src/components/inbox/ChatPane.tsx` — sticky headers, date jumper, busca, paginação, scroll-to-msg, render de eventos.
- `src/components/inbox/ConversationDateJumper.tsx` (novo) — popover com Calendar.
- `src/components/inbox/ConversationSearch.tsx` (novo) — input + navegação.
- `src/hooks/useMessages.ts` (novo) — extrair lógica de fetch/realtime/paginação do ChatPane.
- `src/hooks/useLeadEvents.ts` (novo) — assinar `lead_events` filtrado por `lead_id`.
- `supabase/functions/ai-assist/index.ts` — adicionar modo `summary_day` (intervalo de timestamps).

**Paginação:**
```ts
// fetch últimas 50
.select("*").eq("lead_id", id).order("timestamp", { ascending: false }).limit(50)
// próximas, ao scrollar topo
.lt("timestamp", oldestLoaded).limit(50)
```

**Realtime + DB:**
- Não precisa de migrações novas. `lead_events` já existe; adicionar `ALTER PUBLICATION supabase_realtime ADD TABLE lead_events` se ainda não estiver publicado.
- Índice sugerido pra busca textual (opcional, fase 2): `CREATE INDEX ON messages USING gin (to_tsvector('portuguese', content))`.

**Date jumper — dias com mensagem:**
```ts
// derivar do `messages` já carregado; quando precisar de dias antigos não-carregados,
// query agregada: select date_trunc('day', timestamp) from messages where lead_id=...
```

## Recomendação

Implementar **Pacote 1 + 2 juntos** primeiro — é o que muda mais a percepção de qualidade. Pacote 3 (timeline + resumo do dia) numa rodada seguinte. Posso fazer tudo em sequência se preferir.