## Objetivo

No menu de 3 pontos do card do Kanban, adicionar a opção **"Mover para coluna"** com submenu listando as outras colunas do pipeline atual, ao lado da já existente "Mover para outro funil".

## Mudanças

Tudo isolado em `src/pages/Kanban.tsx`:

1. **`LeadCard`** — passar duas novas props: `stages: Stage[]` (do pipeline atual) e `onMoveToStage: (lead, stageId) => void`.
2. **Menu do card** — adicionar `DropdownMenuSub` com trigger "Mover para coluna" (ícone `Columns3` do lucide). O submenu lista `stages.filter(s => s.id !== lead.stage_id)`, cada item mostra o nome (com a bolinha de cor da coluna). Manter "Mover para outro funil" como segundo item.
3. **Handler `moveLeadToStage`** — definido no componente `Kanban`, mesma lógica do drag-and-drop existente (linhas ~373-389): atualização otimista do estado, `update` em `leads` com novo `stage_id` e `position` (final da coluna alvo), toast de sucesso com nome da coluna. Reaproveita o mesmo padrão para que triggers de banco (stage_changed_at, eventos) disparem normalmente.
4. **Onde o `LeadCard` é renderizado** (dentro de `Column` em ~266 e overlay em ~540) — repassar as novas props.

## Fora de escopo

- Não mexer no diálogo `MoveLeadDialog` (entre funis).
- Não alterar lógica de automações, posições nem realtime.
- Não adicionar atalhos de teclado.

## Validação

Abrir o Kanban, clicar nos 3 pontos de um card → "Mover para coluna" → escolher outra etapa → card aparece na coluna escolhida imediatamente e persiste após reload.
