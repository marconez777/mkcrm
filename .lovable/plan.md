## Problema

No `LeadDrawer` (card do pipeline) há áreas brancas extras: abaixo da aba Detalhes (antes do Perfil) e abaixo do composer no Chat. O `ContextRail` aparece aninhado com altura própria além do conteúdo da tab.

## Causa

- `SheetContent` tem `p-6` por padrão, criando padding interno.
- `Tabs`/`TabsContent` não estão controlando altura corretamente: falta `min-h-0` no Tabs e `data-[state=inactive]:hidden` nas TabsContent. Resultado: ambas as tabs renderizam empilhadas, e o ContextRail (que tem seu próprio `flex-1 overflow-y-auto`) cresce abaixo do chat.

## Solução em `src/pages/LeadDrawer.tsx`

1. No `<SheetContent>`: já tem `p-0`, ok. Confirmar `flex-col h-full`.
2. No `<Tabs>`: trocar `flex flex-1 flex-col overflow-hidden` por `flex min-h-0 flex-1 flex-col overflow-hidden`.
3. Em `<TabsList>`: adicionar `shrink-0`.
4. Em ambas `<TabsContent>`: adicionar `min-h-0` e `data-[state=inactive]:hidden` para garantir que a inativa não ocupe espaço.
5. `TabsContent value="details"`: manter wrapper `flex min-h-0 flex-1 flex-col overflow-hidden` para que o ContextRail (que já é `flex-1 overflow-y-auto`) preencha exatamente o espaço.
