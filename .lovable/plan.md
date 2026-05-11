## Busca de leads no Pipeline

Adicionar uma barra de busca no cabeçalho do pipeline (`src/pages/Kanban.tsx`) que filtra os cards por **nome** ou **telefone** em todas as colunas simultaneamente.

### Comportamento
- Input com ícone de lupa e placeholder "Buscar por nome ou telefone…", ao lado do switcher do funil.
- Filtro client-side, case-insensitive, debounce leve (já é instantâneo no array em memória).
- Telefone normalizado: ignora espaços, parênteses, traços e o "+" — `5511999…` casa com `(11) 99999-…`.
- Atalho `/` foca o input (ignora se digitando em outro campo).
- Botão "x" para limpar; ao limpar, mostra todos os leads novamente.
- Contador no subtítulo passa a refletir o resultado: `12 de 83 leads` quando há filtro ativo.
- As colunas continuam visíveis mesmo vazias (para o usuário ver onde **não** há resultado).

### Arquivos
- `src/pages/Kanban.tsx` — novo `useState("")` para query, normalização do telefone, aplicar `.filter()` antes de distribuir leads pelas colunas, input no header.

Sem mudanças de backend ou schema.