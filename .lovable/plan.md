## Objetivo

Unificar a experiência de conversa do card do Pipeline (kanban) com a da aba de Conversas (Inbox), trazendo anexos (imagem/áudio/vídeo/documento), sincronização de histórico, IA, agendamento, respostas rápidas, encaminhamento etc.

## Diagnóstico

Hoje, ao clicar num card do kanban, abre o `src/pages/LeadDrawer.tsx`, que possui um chat **simplificado** próprio:
- só mostra `m.content || [tipo]` — sem renderizar mídia
- composer básico (Textarea + botão Enviar) sem anexos, áudio, emoji, quick replies, agendamento
- sem painel de IA, sem encaminhamento, sem reply
- já tem botão "Sincronizar histórico", mas só isso

A aba Inbox usa `ChatPane` (`src/components/inbox/ChatPane.tsx`), que já encapsula tudo: virtualização, `MediaBubble`, `Composer` (com upload, áudio, agenda, quick replies), sincronização, IA, etc. Assinatura: `<ChatPane lead={lead} />`.

## Plano

1. **Refatorar `src/pages/LeadDrawer.tsx`** para reutilizar `ChatPane` na aba "Chat":
   - Remover estado/efeitos locais de `messages`, `send`, `resend`, `deleteMessage`, `syncHistory` e a UI manual de bolhas e composer.
   - Manter o `Sheet` com header (avatar, nome, telefone, botão excluir lead) e as Tabs `Chat | Detalhes`.
   - Na Tab "Chat", renderizar `<ChatPane lead={lead} />` ocupando toda a altura (`flex min-h-0 flex-1`).
   - Na Tab "Detalhes", manter o `<ContextRail …/>` atual.
   - O botão "Sincronizar histórico" no header pode ser mantido (já há equivalente dentro do ChatPane, mas é útil no header para acesso rápido).

2. **Garantir layout** do `SheetContent` (max-w-2xl) para que a virtualização do `ChatPane` funcione (já tem `ResizeObserver` no scroller — testado na correção anterior).

3. **Sem mudanças** em Kanban, ChatPane, Composer, MediaBubbles, RLS de storage, ou backend. É puramente uma refatoração de UI no LeadDrawer.

## Fora de escopo

- Mudanças no kanban em si (cards, drag, colunas).
- Mudanças no ChatPane/Composer.
- Backend, storage, edge functions.

## Resultado esperado

Ao clicar em qualquer card do pipeline, a aba "Chat" do drawer fica idêntica à aba de Conversas: anexos visíveis, áudio reproduzindo, documentos baixáveis, composer completo (upload, áudio, quick replies, agendamento, IA), reply, encaminhamento e sincronização.
