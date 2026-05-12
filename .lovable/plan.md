## Mudanças no board de Tarefas (`src/pages/Tasks.tsx`)

### 1. Dobrar a largura da coluna
- Trocar `w-72` (288px) por `w-[36rem]` (576px) em três lugares:
  - Container da `ColumnView`
  - Wrapper do botão "Adicionar coluna"
  - Wrapper do input "Nome da coluna"

### 2. Mostrar a descrição na capa do card
- Em `CardItem`, adicionar abaixo do título um trecho da `card.description` (quando existir):
  - 2 linhas no máximo (`line-clamp-2`)
  - Texto pequeno (`text-xs text-muted-foreground`)
  - Mantém o ícone `AlignLeft` na linha de metadados como hoje
- Sem mudanças de schema nem de comportamento — `description` já é carregada em `listTasks`.
