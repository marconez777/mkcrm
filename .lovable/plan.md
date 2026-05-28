Objetivo: fazer a campanha considerar todos os destinatários do segmento, não só os primeiros 1000.

Plano

1. Corrigir a resolução de destinatários no envio da campanha
- Ajustar o fluxo de `dispatch-campaign` para buscar o segmento completo de forma paginada, em vez de depender de uma chamada RPC única que hoje fica sujeita ao limite padrão de resposta.
- Manter deduplicação por e-mail e o restante da fila em lotes como já está.

2. Alinhar a prévia de destinatários com a mesma lógica
- Atualizar o componente de prévia da campanha para contar todos os destinatários do segmento com paginação real.
- Garantir que o badge “enviáveis” mostre o total correto acima de 1000 e continue descontando descadastros.

3. Revisar os pontos de UI que ainda induzem ao limite
- Verificar os lugares que usam `resolve_email_segment` com `.range(0, 99999)` para evitar contagem inconsistente ou truncada.
- Se necessário, centralizar a leitura paginada usando o helper já existente `fetchAllPaged` para evitar regressões.

4. Validar ponta a ponta
- Conferir se o modal “Nova campanha” passa a mostrar mais de 1000 enviáveis.
- Conferir se o disparo enfileira acima de 1000 quando o segmento tiver volume maior.

Detalhes técnicos
- O gargalo principal está no branch `campaign.segment_id` da edge function `dispatch-campaign`: ele chama `resolve_email_segment` sem paginação.
- A UI da prévia também usa a RPC com `.range(0, 99999)`, que não é uma solução confiável para esse caso.
- A correção deve manter o comportamento atual para “todos os leads” sem segmento, que já está paginado em blocos de 1000.