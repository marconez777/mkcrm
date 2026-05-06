## Problema

Ao abrir um card no Pipeline e ir na aba **Detalhes**, há um grande espaço em branco no topo (entre as tabs e os campos) e os campos exibidos são muito limitados — faltam informações que já existem no painel do Inbox (Resumo IA, Atendente, Tags, Notas, Tarefas, Mensagens agendadas, Auto-resposta IA, Campos personalizados, Linha do tempo, etc.).

## Causa

`src/pages/LeadDrawer.tsx` (usado no Kanban) tem uma aba **Detalhes** própria, simplificada, com poucos campos e um padding grande que cria o espaço vazio. Já o painel do Inbox usa `src/components/inbox/ContextRail.tsx`, que é completo.

## Solução

Reaproveitar o `ContextRail` na aba **Detalhes** do `LeadDrawer`, garantindo paridade total com o painel do Inbox.

### Mudanças em `src/pages/LeadDrawer.tsx`

1. Importar `ContextRail` e o hook `useAttendants`.
2. Substituir todo o conteúdo da `<TabsContent value="details">` por `<ContextRail lead={lead} stages={stages} attendants={attendants} />`.
3. Remover o padding `p-5` e o `space-y-4` da TabsContent — o ContextRail já tem seu próprio scroll/spacing internos, o que elimina o espaço em branco.
4. Limpar imports e estado não mais usados (`form`, `saveDetails`, campos de Input/Select/Label específicos da aba removida).
5. Manter Chat tab intacta.

Resultado: a aba **Detalhes** no card do pipeline passa a ter exatamente as mesmas informações do painel das conversas (Resumo IA, Etapa, Atendente, Valor, Email, Empresa, Tags, Notas, Campos personalizados, Tarefas, Agendamentos, Auto-resposta IA, Linha do tempo) — sem espaço em branco.
