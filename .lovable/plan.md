# Bloco #4 — Timeline Unificada do Lead

## Objetivo
Uma única linha do tempo cronológica por lead que mescla **todas** as fontes de atividade hoje espalhadas, com filtros por tipo. Substitui a aba "Jornada" atual (que só mostra tracking) por uma visão completa pré-conversão + pós-conversão.

## Fontes mescladas

| Fonte | Tabela | Categoria | Ícone |
|---|---|---|---|
| Visita ao site / clique WA / form / teste | `tracking_events` | site | globe |
| Mensagens WhatsApp (in/out) | `messages` | whatsapp | message-circle |
| Mudanças de etapa no pipeline | `lead_stage_history` | stage | git-branch |
| Notas internas da equipe | `lead_internal_notes` | note | sticky-note |
| Eventos de CRM (atribuição, tags, etc.) | `lead_events` | crm | activity |
| Tarefas criadas/concluídas | `lead_tasks` (created_at / completed_at) | task | check-square |

Cada item é normalizado para:
```ts
{ id, at: ISO, category, title, subtitle?, meta?, raw }
```

## UI

Substituir `LeadJourneyTab.tsx` por um novo componente `LeadTimelineTab.tsx`:

- **Cabeçalho de filtros** (chips multi-select): Tudo · Site · WhatsApp · Etapas · Notas · Tarefas · CRM
- **Resumo enxuto no topo** (mantém parte da aba Jornada atual): primeiro source, primeira página, total de sessões/eventos, último visitor_id vinculado
- **Lista cronológica** (DESC por padrão, toggle ASC) — cada item é uma linha compacta com:
  - ícone da categoria + badge colorido
  - timestamp relativo ("há 2h") com tooltip ISO completo
  - título curto + subtítulo opcional (ex: "page_view — /agendar" ou "Etapa: Novo → Qualificado")
  - expansão clicável mostrando `meta` em JSON ou conteúdo da mensagem/nota
- **Paginação por janela**: carrega últimos 100; botão "Carregar mais" busca página anterior por `at < lastAt`
- **Empty state** amigável quando não há atividade

## Implementação (somente frontend)

1. **`src/components/lead/LeadTimelineTab.tsx`** (novo)
   - Hook `useLeadTimeline(leadId, clinicId, { categories, limit })` que faz `Promise.all` em paralelo nas 6 fontes, depois `merge + sort + slice`
   - Para `tracking_events`: mantém a lógica atual de buscar visitor_ids via `tracking_identity_links` e OR `lead_id.eq` + `visitor_id.in`
   - Para `messages`: select id, timestamp, from_me, message_type, content
   - Para `lead_stage_history`: join nomes de `pipeline_stages` (from/to) — uma query separada por ids
   - Demais: select direto filtrado por `lead_id` + `clinic_id`

2. **`src/components/lead/timeline/TimelineItem.tsx`** — apresenta uma linha por categoria (renderers por tipo)

3. **`src/components/lead/timeline/TimelineFilters.tsx`** — chips de filtro

4. **`src/pages/LeadDrawer.tsx`** — renomear aba `journey` para `timeline` (label "Linha do tempo") e trocar componente. Mantém grid `grid-cols-3`.

5. **Sem mudanças no banco** — todas as tabelas já existem e têm RLS por clinic.

## Detalhes técnicos

- Ordenação final: pelo campo `at` desc; itens com mesmo timestamp ordenam por categoria (stage > note > message > event).
- Performance: cada fonte limitada a 200 inicialmente; merge in-memory.
- `lead_tasks` aparece como **dois** itens quando aplicável: criação (`created_at`) e conclusão (`completed_at` quando não-nulo).
- `tracking_events.event_name` mapeado para títulos PT-BR (page_view → "Visitou página", whatsapp_click → "Clicou no WhatsApp", etc.).
- Filtros persistem em `localStorage` por `lead_timeline_filters`.

## Fora do escopo (próximos blocos)
- Bloco #3 (trackable redirects /r/:token) e bloco #5 (deals/revenue) — não tocados aqui.
- Sem write actions na timeline (adicionar nota etc.); usa as UIs existentes.
