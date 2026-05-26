## Objetivo

Permitir editar o nome do lead direto pelo cabeçalho do chat (onde hoje aparece "Eliza", "Priscila Dezena Vergal" etc.), além do campo já existente em Detalhes.

## Mudança

Tudo isolado em `src/components/inbox/ChatPane.tsx`, no header (linhas ~504-516):

- Substituir o `<div>` estático do nome por um botão (ícone de lápis aparece no hover) que, ao clicar, troca para um `<input>` inline pré-preenchido com o nome atual.
- Commit no Enter ou blur → `supabase.from("leads").update({ name: trimmed || null }).eq("id", lead.id)` + toast de erro em caso de falha. O realtime do `useLeads` já reflete a mudança na lista, no Kanban e em todos os outros lugares.
- Esc cancela e restaura.
- Mantém o telefone abaixo intacto.

Sem alterações de schema, edge function ou rota.

## Validação

Abrir uma conversa, clicar no nome no cabeçalho, digitar, Enter → o nome muda imediatamente no header, na lista de conversas e nos cards do Kanban.
