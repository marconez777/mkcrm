## Problemas

1. **Filtros cortados** no topo da lista de conversas (ex.: "Em atendimento" aparece cortado).
2. **Não há como fechar** o painel de perfil (direita) nem a lista de conversas (esquerda).
3. Painel direito poderia recolher por seção, mas o usuário quer principalmente um botão de fechar o painel inteiro.

## Mudanças

### 1. `src/pages/Inbox.tsx` — três painéis colapsáveis
- Adicionar estado `showList` (default true) além do já existente `showContext`.
- No header da área de chat, adicionar um botão à esquerda (`PanelLeftClose` / `PanelLeftOpen`) para esconder/mostrar a lista de conversas.
- O botão à direita já existe (`PanelRightClose`) — manter.
- Quando `showList` for false, ocultar o `<aside>` da lista no desktop.
- Passar `onClose` para o `ContextRail` para permitir fechar o painel pelo próprio cabeçalho dele também.

### 2. `src/components/inbox/ContextRail.tsx` — botão fechar
- Aceitar prop `onClose?: () => void`.
- Adicionar um header sticky no topo do rail com título "Perfil" e um botão `X` que chama `onClose`.
- (Os campos fixos — etapa, atendente, valor, e-mail, empresa, tags, notas — e os campos personalizados continuam visíveis abaixo.)

### 3. `src/components/inbox/ConversationList.tsx` — corrigir filtros cortados + colapsar
- A linha de filtros de etapa/tags está com `overflow-x-auto` mas o último botão fica colado na borda direita; ajustar `pr-3` extra e garantir que o scroll funcione visualmente (já está, mas faltam dicas visuais — adicionar `mask`/fade opcional). O essencial: tornar a barra realmente rolável e adicionar `shrink-0` em todos os botões (já tem).
- Aceitar prop `onCollapse?: () => void` e mostrar um botão `PanelLeftClose` ao lado de "Conversas" para esconder a própria lista (atalho redundante com o botão da chat header).

## Resultado
- Usuário pode esconder a lista (esquerda) e/ou o perfil (direita) independentemente, expandindo o chat.
- Filtros longos rolam horizontalmente sem cortar conteúdo importante.
- Ainda mantém os campos personalizados que adicionamos antes.

## Fora de escopo
- Reestruturar a lista em abas dentro do perfil (Principal / Mensagem Pro / Mídia / Estatísticas) como na imagem de referência — pode ser uma fase futura.
