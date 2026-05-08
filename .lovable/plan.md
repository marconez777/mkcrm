## Diagnóstico (revisão completa)

A captura confirma o sintoma clássico: bolhas se sobrepondo (texto, áudio, PDF e a transcrição de áudio caem em cima das mensagens vizinhas). Revisei `src/components/inbox/ChatPane.tsx` (1053 linhas), `src/components/inbox/MediaBubbles.tsx` e `src/components/inbox/Composer.tsx`.

A causa raiz é estrutural, não pontual: o `ChatPane` usa **`@tanstack/react-virtual`** com itens posicionados em `position: absolute; transform: translateY(...)`, calculando o offset de cada item via `measureElement`. Esse modelo entra em conflito com o conteúdo do nosso chat porque a altura final só é conhecida **depois** que vários eventos acontecem:

1. Imagens / vídeos / PDFs assinam URL via `useSignedMediaUrl` (1 round-trip ao Storage), depois carregam (`onLoad`), depois trocam de placeholder para conteúdo real → 3 mudanças de altura por mídia.
2. `AudioTranscript` muda de "Transcrever áudio" para um bloco multi-linha quando o usuário clica.
3. Notas internas (`InternalNote`) são adicionadas no meio do array e re-mesclam o `grouped` por timestamp.
4. A largura do container muda quando o `ContextRail` ou o `ConversationList` colapsam — bolhas com `max-w-[78%]` mudam de altura.
5. Mensagens prepended (paginação infinita para cima) recalculam o `scrollTop` manualmente.
6. Timestamps "Hoje/Ontem", agrupamento por autor e mensagens citadas (`replied`) introduzem alturas variáveis dentro do mesmo `key`.

Tentamos contornar isso com `ResizeObserver` no scroller + `requestAnimationFrame` duplo + listener `msg-media-loaded`. Já é um sintoma de modelo errado: estamos lutando contra a virtualização ao invés de usá-la.

Pesquisa confirma: a [Discussion #195](https://github.com/TanStack/virtual/discussions/195) e a [#1013](https://github.com/TanStack/virtual/discussions/1013) do próprio TanStack Virtual reconhecem que listas de chat com itens dinâmicos / scroll reverso / mídia assíncrona são um caso particularmente frágil para essa biblioteca. A recomendação prática é trocar de abordagem.

## Nova abordagem (proposta)

**Remover a virtualização das mensagens** e renderizar o `ChatPane` como um scroller nativo com flexbox vertical. Isso elimina, por construção, qualquer possibilidade de sobreposição: o navegador é quem faz o layout do fluxo, não nós.

Por que isso é viável aqui:

- O `PAGE_SIZE` é 50 e a paginação é *on demand* (sentinel no topo). Mesmo com vários "carregar mais", chegamos a algumas centenas de nós no DOM — totalmente dentro do orçamento do React/Chrome (testes do Slack, Linear e WhatsApp Web mostram que <2k nós de mensagem rodam fluidos sem virtualização).
- Já temos `useWaAvatar`, `useSignedMediaUrl` e `MediaBubble` com `loading="lazy"` em imagens, então a memória de mídia continua controlada.
- Reduz ~250 linhas do `ChatPane`, remove o componente interno `VirtualizedMessages`, todos os `ResizeObserver`/rAF/`measureElement` e o evento global `msg-media-loaded`.

### Mudanças concretas

1. **`src/components/inbox/ChatPane.tsx`**
   - Excluir o componente `VirtualizedMessages` e o import `useVirtualizer`.
   - Substituir por um scroller simples:
     ```tsx
     <div ref={scrollerRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4" style={{ background: "hsl(var(--chat-bg))" }}>
       <div ref={topSentinelRef} />
       {/* loaders */}
       <div className="flex flex-col">
         {grouped.map((g) => (g.kind === "date" ? <DateChip … /> : g.kind === "note" ? <NoteRow … /> : <MessageRow … />))}
       </div>
     </div>
     ```
   - Manter `IntersectionObserver` no `topSentinelRef` para paginar para cima.
   - Trocar a preservação de scroll na paginação por uma versão simples e correta: medir `scrollHeight - scrollTop` antes do prepend e restaurar depois (já é o padrão; só precisa do `useLayoutEffect` em vez de `requestAnimationFrame` para evitar flash).
   - `pulseAndScroll` passa a usar `document.querySelector('[data-msg-id="…"]').scrollIntoView({ block: "center", behavior: "smooth" })`.
   - Remover listeners `msg-media-loaded` e o `ResizeObserver` de width.

2. **`src/components/inbox/MediaBubbles.tsx`**
   - Remover os `window.dispatchEvent(new Event("msg-media-loaded"))` em `onLoad`/`onError`/`onLoadedMetadata` — não são mais necessários.
   - Aplicar `aspect-ratio` baseado em `width`/`height` do `raw.message.imageMessage` quando disponível, com `min-h-[120px]` enquanto carrega, para reduzir CLS visual (puramente cosmético).

3. **`src/components/inbox/ChatPane.tsx` (auto-scroll)**
   - Manter `stickToBottom` + botão "novas mensagens", igual hoje, mas usando `el.scrollHeight` direto após o React commit (`useLayoutEffect` no `messages.length`).

4. **Sem mudanças** em backend, RLS de Storage, edge functions, `Composer`, `ContextRail`, `LeadDrawer` ou qualquer outro componente.

### Plano B (caso a performance caia em conversas com 2k+ mensagens)

Trocar `@tanstack/react-virtual` por **`react-virtuoso`** — a única biblioteca de virtualização React projetada especificamente para chats: alturas dinâmicas medidas automaticamente, `followOutput`, `initialTopMostItemIndex` e `firstItemIndex` para scroll reverso/prepend nativos. Adicionaríamos `react-virtuoso` como dependência e substituiríamos a lista por `<Virtuoso data={grouped} itemContent={…} followOutput="smooth" />`. Mantemos isso fora do escopo desta entrega — só implementaremos se houver lentidão real depois da migração.

## Validação

- Abrir a conversa da Viviane Lutz (mesma do print) e rolar todo o histórico.
- Pausar e retomar áudios, abrir o lightbox de imagem, baixar PDF.
- Alternar `ContextRail` (P) e `ConversationList` para mudar a largura.
- Adicionar nota interna no meio do histórico.
- Carregar histórico antigo (scroll até o topo) e confirmar que a posição é preservada sem saltos.
- Testar no LeadDrawer (kanban) também, já que reusa o `ChatPane`.

## Fora de escopo

- Mudanças visuais (cores, tipografia, espaçamentos das bolhas).
- Backend, mídia, RLS, transcrição, IA.
- Trocar a lib de virtualização (Plano B só se necessário).
