## Objetivo

Transformar o chip 🔒 **"Lock manual"** dos cards do Kanban num botão clicável que remove imediatamente o lock (`leads.manual_lock_until = null`), liberando o card para automações novamente.

## Comportamento

1. **Chip vira botão.** Cursor pointer, hover destaca, ícone do cadeado vira "cadeado aberto" no hover. Tooltip: *"Lead travado para automações até DD/MM HH:mm. Clique para destravar."*
2. **Clique abre confirmação** (AlertDialog do shadcn):
   - Título: *"Destravar este lead?"*
   - Descrição: *"As automações (classifier, auditores, B2B move) voltarão a poder mover este card. Continuar?"*
   - Botões: **Cancelar** / **Destravar**.
3. **Ao confirmar:**
   - `UPDATE leads SET manual_lock_until = NULL WHERE id = :leadId`.
   - Insert em `lead_events` com `type = 'manual:unlock'` e payload `{ previous_lock_until, by_user_id }` — fica na timeline.
   - Toast de sucesso + refetch do card (o chip some sozinho porque `locked` recalcula).
   - Em caso de erro: toast destrutivo, lock permanece.
4. **Permissão.** Só quem pode mover leads no Kanban pode destravar (mesma regra do drag — RLS atual da tabela `leads` já cobre isso; nenhuma policy nova).
5. **Propagação de clique.** `stopPropagation` no botão pra não abrir o LeadDrawer ao clicar no chip.

## Onde mexer

- **`src/pages/Kanban.tsx`** (linha ~305): substituir o `<Chip>` do Lock manual por um novo componente `<LockManualChip lead={lead} onUnlocked={refetch}/>`. Manter visual idêntico quando não-hover.
- **`src/lib/manual-stage-move.ts`**: adicionar helper `unlockLeadManually(supabase, leadId): Promise<void>` que faz o UPDATE + insert do evento numa única chamada (evento best-effort, não bloqueia o unlock).
- **Nenhuma migration** — campo `manual_lock_until` já existe; `lead_events` já aceita `type` arbitrário.

## Fora de escopo

- Botão equivalente no LeadDrawer/Detalhes (pode ser próximo passo se você quiser).
- Mudar a duração padrão de 7 dias do lock.
- Bulk unlock (destravar a coluna inteira).

## Validação

- Arrastar um card → chip "Lock manual" aparece.
- Clicar no chip → modal → confirmar → chip some, toast OK.
- Conferir `lead_events` do lead: deve ter linha `manual:unlock`.
- Rodar o classifier naquele lead em seguida → deve conseguir mover stage (se confidence ≥ threshold).
