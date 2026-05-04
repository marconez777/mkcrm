Vou corrigir o arraste lateral do pipeline com uma abordagem mais robusta, porque a solução atual no hook não está vencendo todos os pontos de interceptação do drag-and-drop.

Plano

1. Reforçar a arquitetura do gesto de pan horizontal
- Substituir a dependência exclusiva de `pointermove` no container por um fluxo de arraste global mais resiliente.
- Iniciar o pan apenas em áreas permitidas do board e manter o movimento no `window/document` até o fim do gesto.
- Garantir cleanup confiável do estado de drag mesmo se houver perda de captura, cancelamento ou interceptação por outro listener.

2. Marcar explicitamente as zonas onde o pipeline pode ser arrastado
- Adicionar atributos de intenção no Kanban, como áreas de fundo, header da coluna e espaços vazios da coluna.
- Diferenciar claramente:
  - card = arrasta lead
  - fundo/header/espaço vazio = arrasta pipeline horizontalmente
- Evitar heurísticas frágeis baseadas só em `closest(button, input, ...)`.

3. Evitar conflito com o drag-and-drop dos cards
- Ajustar a ativação do DnD para que ele só reaja quando o ponteiro nascer em um card de lead.
- Impedir que áreas vazias de coluna ou fundo do board entrem no fluxo do `PointerSensor`.
- Se necessário, trocar a configuração do sensor/ativador para respeitar os novos marcadores `data-*` do board.

4. Melhorar a UX do gesto
- Manter threshold pequeno para evitar clique acidental virar pan.
- Aplicar `cursor: grab/grabbing` apenas nas zonas corretas.
- Desabilitar seleção de texto enquanto o pan estiver ativo.
- Preservar o scroll vertical interno dos cards/colunas quando o usuário estiver usando a lista da coluna, sem quebrar o arraste horizontal do board.

5. Validar no preview
- Testar estes cenários:
  - arrastar no fundo entre colunas
  - arrastar no header da coluna
  - arrastar em coluna vazia
  - arrastar em card continua movendo card, não o pipeline
  - setas laterais e scrollbar superior continuam sincronizados

Detalhes técnicos
- Arquivos principais:
  - `src/hooks/useHorizontalScroll.ts`
  - `src/pages/Kanban.tsx`
- Ajustes previstos:
  - introduzir zonas `data-kanban-pan-area`
  - revisar os listeners de início/movimento/fim do gesto
  - restringir a ativação do DnD às superfícies dos cards
  - manter compatibilidade com `TopScrollbar` e `PipelineOverview`

Resultado esperado
- O usuário volta a conseguir “pegar” o pipeline e arrastar para os lados nas áreas do board, sem desativar o drag dos cards.
- O comportamento fica estável e não volta a quebrar quando houver mudanças pequenas no layout.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>
<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>