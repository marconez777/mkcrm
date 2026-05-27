## Mudança

No `src/pages/email/EmailTemplateEditor.tsx`, o botão "Enviar" do dialog "Enviar teste" hoje chama `sendTest()` sem feedback visual — o usuário não sabe se a ação está em andamento.

## Implementação

1. Adicionar estado `sendingTest` (boolean) no componente.
2. Em `sendTest()`: `setSendingTest(true)` no início e `setSendingTest(false)` no `finally`.
3. No botão "Enviar" do dialog:
   - `disabled={sendingTest}`
   - Trocar ícone `<Send />` por `<Loader2 className="animate-spin" />` quando `sendingTest`
   - Texto muda de "Enviar" para "Enviando…"
4. Também desabilitar o botão "Cancelar" e o input enquanto envia, para evitar fechar no meio.

Sem mudanças de lógica de negócio — apenas feedback visual.