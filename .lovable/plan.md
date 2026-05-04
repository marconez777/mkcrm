Aplicar **Fase 1 — UX rápido** (5 itens, todos frontend, zero schema). Fases 2 e 3 ficam documentadas como tarefas pra rodadas seguintes.

## Itens da Fase 1

### 1. Cor SLA na lista de conversas
Em `src/components/inbox/ConversationList.tsx`: nova função `ageColor(iso, isUnread)` retorna `text-emerald-500` (<1h), `text-amber-500` (<24h), `text-destructive` (>24h). Aplicar no `timeAgo` exibido por conversa quando o lead estiver não-lido.

### 2. Badge de não-lidas no `<title>` (já existe, ativar)
O hook `useUnreadTitle` em `src/hooks/useUnreadTitle.ts` já está implementado mas o import em `src/App.tsx` foi minificado (`n`). Confirmar nome correto e garantir que `<TitleSync />` está montado dentro do `ProtectedRoute` para sincronizar `(N) Zappy CRM` no título da aba. Se já funciona, validar; caso contrário, corrigir export name.

### 3. Notas internas (mensagem amarela) — versão localStorage
Sem schema agora. Criar `src/lib/internal-notes.ts` com `getNotes(leadId)`, `addNote(leadId, text)`, `removeNote(leadId, id)` persistindo em `localStorage` por lead. Em `ChatPane.tsx`, mesclar notas no `grouped` como item `{ kind: "note", ... }` renderizado como bolha amarela centralizada com botão de remover. Botão "Nota interna" no header do chat ao lado de "Sugerir".

> Quando rodarmos a Fase 2 com migrations, migra pra coluna `messages.is_internal boolean` e sincroniza entre dispositivos.

### 4. Encaminhar mensagem
Em `MessageRow` (ChatPane.tsx): ao hover, além do botão "Responder", adicionar botão "Encaminhar" (ícone `Forward`). Abre um `Dialog` com:
- Lista de leads (busca por nome/telefone, reusa `useLeadsPaginated`)
- Seleção única
- Botão "Encaminhar" → chama `evolution-send` com `lead_id` destino e `text` da mensagem original (prefixo "↪ Encaminhada:" opcional)
Novo componente: `src/components/inbox/ForwardDialog.tsx`.

### 5. Cheatsheet de atalhos
Novo componente `src/components/ShortcutsDialog.tsx`. Lista atalhos (`/` busca, `j/k` navegar, `Esc` voltar, `Enter` enviar, `Shift+Enter` quebra, `/` no composer abre quick replies). Tecla `?` abre o dialog (registrar listener global em `App.tsx` ou `AppShell.tsx`). Botão `?` discreto no rodapé do AppShell ao lado do status.

## Arquivos tocados
- `src/components/inbox/ConversationList.tsx` (cor SLA)
- `src/App.tsx` (validar TitleSync, registrar atalho `?`)
- `src/lib/internal-notes.ts` (novo)
- `src/components/inbox/ChatPane.tsx` (notas internas + botão encaminhar)
- `src/components/inbox/ForwardDialog.tsx` (novo)
- `src/components/ShortcutsDialog.tsx` (novo)
- `src/components/AppShell.tsx` (botão `?`)

## Fora desta fase (próximas)
- **Fase 2** (precisa migrations): `messages.is_internal`, tabela `lead_tasks`, tabela `scheduled_messages` + cron, edge function de transcrição de áudio, bulk actions DB, fetch de avatar do WhatsApp.
- **Fase 3**: tabela `user_views`, timeline de eventos no chat, página de métricas operacionais (TMR), command palette, wizard de onboarding.