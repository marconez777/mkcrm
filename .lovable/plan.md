## Objetivo
Na lista de visitantes em `/tracking` (coluna **Página**), paths muito longos (ex.: `/meu-resultado/751d26dd554924c0a1569e06a5b36c1bf84fa0b59aa471662f6fb5e812f6ad76`) estouram a linha. Abreviar visualmente mantendo o link clicável e o valor completo no tooltip.

## Mudança
Arquivo: `src/pages/Tracking.tsx`

1. Adicionar helper `shortenPath(path, max=40)` que:
   - Mantém o primeiro segmento intacto (ex.: `/meu-resultado/`).
   - Substitui o restante por `início…fim` (ex.: `751d26…f6ad76`), preservando caracteres do começo e fim.
   - Se o path inteiro for ≤ `max`, retorna como está.
2. No render da linha (~linha 671), trocar `{pagePath}` por `{shortenPath(pagePath)}`, e adicionar `title={v.first_landing_page ?? pagePath}` no `<a>` para mostrar o valor completo no hover.
3. Remover `whitespace-nowrap` não é necessário — a abreviação já evita quebra.

## Fora de escopo
- Tabela de eventos (linha ~735) já usa `truncate(..., 40)`; não mexer.
- Backend, dados ou outras telas.
