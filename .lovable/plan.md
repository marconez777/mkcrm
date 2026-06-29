## Objetivo
Remover a opção "Todas" (mostrar todas as instâncias ao mesmo tempo) na tela de Conversas. O usuário sempre verá apenas 1 instância por vez.

## Mudanças

### 1. `src/components/inbox/ConversationList.tsx`
- Remover o botão "Todas" (linhas ~183-193) da barra de abas de instâncias.
- Manter apenas os botões por instância.

### 2. `src/pages/Inbox.tsx`
- Garantir que `instanceId` nunca fique `null` quando existir ao menos 1 instância:
  - No `useEffect` de validação, se o `instanceId` atual for `null` (qualquer motivo) e existirem instâncias, selecionar a `defaultInstance` ou a primeira da lista.
  - Em `setInstanceId`, ignorar chamadas com `null` quando houver instâncias (defensivo).
- Limpar `localStorage` legacy: se o valor salvo era ausente/null, cair na default automaticamente (já é o comportamento — só remover a condição extra que dependia de `localStorage` vazio).

### 3. Sem mudanças em backend, hooks ou outras telas
- `useLeadsPaginated(instanceId)` continua suportando `null` (caso de zero instâncias cadastradas), mas a UI não vai mais expor essa opção.

## Verificação
- Abrir `/inbox` com várias instâncias: deve abrir já filtrado por uma; abas mostram só as instâncias, sem "Todas".
- Clicar entre instâncias troca normalmente; recarregar mantém a última escolhida.
- Com 0 ou 1 instância: barra de abas continua oculta (condição `instances.length > 1`).
