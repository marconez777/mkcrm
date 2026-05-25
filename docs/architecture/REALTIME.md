# Realtime

> **Quando ler:** ao habilitar/subscribir em mudanças ao vivo (inbox, kanban, tarefas, fila de email).
> **Última atualização:** 2026-05-25

---

## Tabelas na publication `supabase_realtime`

Verificadas em `supabase/migrations`:

- `messages` — chat WhatsApp
- `leads` — pipeline e inbox
- `pipelines`, `pipeline_stages`
- `lead_internal_notes`
- `lead_tasks`
- `scheduled_messages`
- `tasks`, `task_boards`, `task_columns`, `task_assignees`, `task_attachments`, `task_checklist_items`, `task_labels`, `task_label_links`
- `email_queue`, `email_logs`
- `webhook_events`

> Para adicionar tabela à realtime:
> ```sql
> ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabela>;
> ```
> E, **importante**, garantir `REPLICA IDENTITY FULL` se precisar do payload antigo (deletes):
> ```sql
> ALTER TABLE public.<tabela> REPLICA IDENTITY FULL;
> ```

---

## Padrão de uso no frontend

```ts
useEffect(() => {
  const channel = supabase
    .channel(`messages-${leadId}`) // canal único por contexto
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
      (payload) => {
        // Aplicar mudança no cache do React Query
        queryClient.setQueryData([...], (old) => merge(old, payload));
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [leadId]);
```

**Regras:**
- Sempre um **canal por contexto** (lead, board, clinic) — nome único.
- Sempre **cleanup** com `removeChannel` no unmount.
- Atualizar **cache React Query** em vez de re-fetch sempre que possível.
- **RLS aplica também em realtime** — usuário só recebe linhas que enxergaria no SELECT.

---

## Hooks que já usam realtime

Ver `src/hooks/`:
- `useCrm.ts` — leads + messages
- `useLeadsPaginated.ts`
- `usePipelines.ts`
- `useQuickReplies.ts`
- `useAttendants.ts`
- `useUnreadTitle.ts` — título do tab piscando com não-lidos
- `useHealth.ts`

E nos componentes:
- `Inbox.tsx`, `ChatPane.tsx`, `ContextRail.tsx`
- `Tasks.tsx`, `Broadcasts.tsx`
- `EmailQueue.tsx`, `EmailDashboard.tsx`

---

## Pegadinhas

| Sintoma | Causa |
|---|---|
| Subscribe não dispara | Tabela não está na publication. Rodar `ALTER PUBLICATION ... ADD TABLE`. |
| Payload `old` vem vazio em DELETE | Falta `REPLICA IDENTITY FULL`. |
| Muitos canais abertos / memória cresce | Cleanup faltando — usar `return () => removeChannel(...)` no useEffect. |
| Mensagem chega em duplicidade | Mais de um subscribe ativo para mesmo evento. Centralizar em hook ou usar canal nomeado. |
| Realtime para após inatividade | Conexão WS pode cair. O cliente Supabase reconecta sozinho; verificar console. |
| Não recebe linhas de outra clínica | RLS está correto — comportamento esperado. |

---

## Custos / performance

- Realtime é cobrado por conexão WS e por linha entregue. Evite subscrever tabelas grandes (ex.: `ai_chunks`, `webhook_events` em produção).
- `webhook_events` está em realtime mas só usado em debug — considerar tirar.
- Use `filter:` no canal para limitar entrega ao servidor (mais barato que filtrar no cliente).
