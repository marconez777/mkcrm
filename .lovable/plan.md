## Objetivo

Reabilitar a aba **Páginas** em `src/pages/Tracking.tsx`, agora focada em 3 colunas alinhadas com as KPIs novas: **Visitas**, **Leads** e **Conversão**.

## O que vai mostrar

Tabela agrupada por `page_path` (com `page_url` completo no tooltip), com:

| Coluna | Definição |
|---|---|
| Página | `page_path` (encurtado) com tooltip do URL completo |
| Visitas | nº de `visitor_id` únicos que tiveram pelo menos 1 `page_view` naquela página, dentro do período |
| Leads | nº de `lead_id` únicos (via `tracking_identity_links`) cujo visitante passou por aquela página |
| Conversão | `Leads / Visitas` em % (— quando Visitas = 0) |

Ordenação padrão: maior nº de Visitas. Paginação reutilizando o componente `Pagination` já existente (50/página).

## Como será calculado (técnico)

- Reusa os dados que `load()` já busca: `events` (até 5000 no período) + `links` (map `visitor_id → lead`).
- Novo `useMemo` `pageReport`:
  1. Filtra `events` onde `event_name === "page_view"` e `page_path` não nulo.
  2. Para cada path acumula um `Set<visitor_id>` e um `Set<lead_id>` (consultando `links[visitor_id]?.lead_id`).
  3. Gera linhas `{ path, sampleUrl, visits, leads, rate }` ordenadas desc por `visits`.
- Sem nova query no banco e sem mudança de schema.

## UI

- Adiciona `<TabsTrigger value="pages">Páginas</TabsTrigger>` entre "Visitantes" e "Eventos".
- Novo `<TabsContent value="pages">` com `Card` + `Table` (Página / Visitas / Leads / Conversão) e `Pagination`.
- Estado local `pagesPage` (igual aos outros) e respeita o filtro global `pageUrlFilter` já existente.

## Fora do escopo

- Não mexe nas KPIs do topo, nem nos cards de configuração de fechamento.
- Não reabre as abas "WhatsApp" e "Atribuição" — só "Páginas".

## Arquivos

- `src/pages/Tracking.tsx` (única edição).
