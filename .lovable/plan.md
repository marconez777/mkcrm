## O que está acontecendo

O "99" no header da inbox **não é um limite** — é só a contagem de leads já carregados na tela. O total de leads no banco é **1407**.

A inbox usa paginação infinita (50 por vez, ordenado por `last_message_at desc`) com scroll. Quando você faz scroll para baixo ela carrega mais.

### Por que não aparecem novas mensagens

Confirmei no banco: estão chegando mensagens normalmente (143 na última hora — o backfill funcionou). O problema é no **handler de realtime** do `useLeadsPaginated.ts`:

```
.on("UPDATE", ..., (p) => {
  const idx = prev.findIndex((x) => x.id === row.id);
  if (idx === -1) return prev; // <-- IGNORA se lead não está na janela carregada
  ...
})
```

Quando uma mensagem nova chega para um lead que **não está nos 99 carregados**, o lead recebe UPDATE em `last_message_at` mas o handler ignora porque ele não está na lista. Resultado: leads que estavam "dormentes" e voltaram a conversar não sobem para o topo até dar refresh manual (F5).

E não existe botão de refresh — você adivinhou certo.

## Plano

### 1. Botão de refresh no header da inbox
Adicionar ícone de refresh ao lado do "Conversas 99" em `ConversationList.tsx`, que chama uma função `refresh()` exposta pelo hook `useLeadsPaginated` — recarrega a primeira página resetando o cursor.

### 2. Corrigir o handler de UPDATE para puxar leads que entram na janela
Em `useLeadsPaginated.ts`, quando chega UPDATE de um lead que não está na lista:
- Se o `last_message_at` novo é mais recente que o cursor (ou seja, deveria estar na janela carregada), **inserir** o lead na lista em vez de ignorar.
- Mantém ordenação correta sem precisar refresh manual.

### 3. (Opcional) Auto-refresh leve quando a aba volta a ficar visível
Listener de `visibilitychange`: se a aba ficou >2min em background, dispara `refresh()` automático ao voltar.

## Arquivos afetados

- `src/hooks/useLeadsPaginated.ts` — adicionar `refresh()`, corrigir UPDATE handler, opcional visibility listener
- `src/components/inbox/ConversationList.tsx` — botão de refresh no header
- `src/pages/Inbox.tsx` — passar `refresh` como prop
