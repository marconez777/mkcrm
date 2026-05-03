# Plano — Estabilizar Conversas (sem piscar / sem instabilidade de não lidas)

## Diagnóstico

Hoje toda mudança no realtime dispara um **refetch completo** da tabela inteira:

- `useLeads()` → a cada INSERT/UPDATE/DELETE em `leads` rebusca **todos** os leads. Como `evolution-send`, `increment_unread`, `evolution-webhook` e `ChatPane` (zera `unread_count`) atualizam `leads` várias vezes por mensagem, a lista é reconstruída 3-5x por mensagem → pisca.
- `useStages()` idem.
- `ChatPane` faz a mesma coisa em `messages` (refetch completo a cada evento).
- `useUnreadTitle` também escuta `leads` inteiro e refaz a soma a cada evento.
- `Inbox` recalcula `filtered` (sort + filter) a cada uma dessas reconstruções, e o efeito de `messages.length` dispara `setStickToBottom` que mexe no DOM mid-render.
- `unread_count = 0` é gravado **toda vez** que o `ChatPane` recarrega — mesmo quando já era 0 — gerando UPDATE → realtime → refetch → loop visível.

Resultado: lista pisca, contador de não lidas oscila entre 0 e N, scroll do chat trava.

## Solução — patches incrementais + gate de "carregado"

### 1. `useCrm.ts` — hook genérico `useRealtimeList`

- Carrega 1x via `select`.
- Para INSERT: adiciona o row se ainda não existir, ordena.
- Para UPDATE: faz merge no row existente; **se nada mudou (deep-equal raso por chave), não chama `setState`** → zero re-render.
- Para DELETE: filtra.
- Expõe `loaded: boolean`. UI só mostra "vazio" depois de `loaded`.
- Substitui `useStages` e `useLeads`.

### 2. `ChatPane.tsx` — mensagens incrementais

- Carrega histórico 1x; gate `loaded` antes de renderizar a área (evita flash de "Sem mensagens" e do auto-scroll).
- Realtime: aplica INSERT/UPDATE/DELETE no array local em vez de refetch.
- Dedupe por `id` e por `client_message_id` (mensagem otimista vinda do `evolution-send` é substituída pela definitiva sem piscar).
- `unread_count = 0` só é gravado quando `lead.unread_count > 0` (evita UPDATE inútil → realtime ping-pong).
- Auto-scroll: só dispara depois de `loaded`; usa `behavior: "auto"` na primeira renderização e `"smooth"` nas seguintes.
- `evolution-sync-lead` continua, mas com `setSyncing` controlado para não competir com a renderização inicial.

### 3. `useUnreadTitle` — soma incremental

- Carrega total 1x.
- Em INSERT/DELETE de lead: soma/subtrai o `unread_count` do row.
- Em UPDATE: aplica `delta = new.unread_count - old.unread_count` (payload já traz `old`).
- Sem refetch a cada evento → título não pisca.

### 4. `Inbox.tsx` — render estável

- Usa `loaded` dos hooks para mostrar skeleton em vez de "nenhuma conversa" durante o boot.
- `filtered` já está em `useMemo`; ele continua, mas como o array `leads` agora só muda quando algo realmente mudou, o memo vira eficaz de verdade.
- Ping de áudio: filtra eventos cujo `lead_id` é o atualmente aberto (não toca som no chat aberto).

### 5. Pequenos ajustes correlatos

- `ConversationList`: garantir que items usem `key={l.id}` (já usa) e remover `style` inline volátil — ok.
- `ContextRail`: `useEffect([form.notes, ...])` que dispara save mesmo no primeiro render quando trocamos de lead. Adicionar guard para não salvar até o usuário editar (compara com `lead.notes` inicial via ref).
- `LeadDrawer.tsx` (Kanban): aplicar a mesma lógica incremental para mensagens, mantendo paridade.

## Resultado esperado

- Lista de conversas não pisca mais ao receber/enviar mensagem.
- Contador de não lidas estabiliza (sem 0→N→0).
- Chat abre sem flash; auto-scroll só acontece depois do histórico estar carregado.
- Carga no banco cai (sem refetch full a cada evento).

## Fora de escopo agora

- Migrar para `@tanstack/react-query` com cache compartilhado (seria a evolução natural — fica para uma próxima se ainda houver instabilidade).