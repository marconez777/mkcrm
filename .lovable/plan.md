## Objetivo
Eliminar a sobreposição ocasional entre imagens e mensagens no chat do inbox, especialmente quando a largura da área de conversa muda ao abrir/fechar o painel lateral de detalhes.

## O que vou fazer
1. Ajustar a virtualização em `src/components/inbox/ChatPane.tsx` para forçar re-medição também quando a largura do contêiner do chat mudar, não só quando a mídia terminar de carregar.
2. Trocar o gatilho global atual por uma estratégia mais robusta de reflow/re-measure, usando observação do contêiner visível da lista e re-medição em `requestAnimationFrame` duplo quando necessário.
3. Garantir que bolhas com mídia disparem nova medição não apenas no `onLoad`, mas também em casos de mudança de layout após resize/abertura do contexto.
4. Validar que a correção fica restrita ao inbox e não altera comportamento do drawer antigo (`LeadDrawer`) nem outras telas.

## Arquivos envolvidos
- `src/components/inbox/ChatPane.tsx`
- `src/components/inbox/MediaBubbles.tsx`
- `src/pages/Inbox.tsx` apenas se eu precisar observar explicitamente a abertura/fechamento do painel lateral

## Resultado esperado
- Imagens não ficam mais por cima de mensagens adjacentes.
- Abrir/fechar o painel de contexto não quebra o posicionamento das linhas virtualizadas.
- Mensagens com imagem, vídeo e áudio continuam ocupando altura correta após carregamento.

## Detalhes técnicos
- Hoje o `useVirtualizer` mede os itens com base na altura inicial e faz `measure()` quando a mídia carrega.
- O problema aparece porque a largura útil do chat muda quando o painel lateral entra/sai, alterando a altura real das bolhas e invalidando os `translateY(...)` já calculados.
- A correção vai focar em re-medição sincronizada da lista quando houver resize do contêiner e quando a mídia terminar de estabilizar o layout.

## Fora de escopo
- Não vou refazer o layout geral do inbox.
- Não vou mexer nas regras de storage, download ou reprodução de mídia além do que for necessário para corrigir a sobreposição visual.