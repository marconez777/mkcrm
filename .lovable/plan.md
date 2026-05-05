## Problema

No Kanban, ao clicar nos 3 pontinhos de uma coluna e escolher **Editar etapa** (ou Excluir etapa), nada acontece. O `EditStageDialog` existe e está montado em `src/pages/Kanban.tsx`, mas o clique não abre.

Causa: bug clássico do Radix UI quando um `DropdownMenuItem` abre um `Dialog`. O menu fecha logo após o clique e deixa `pointer-events: none` no `<body>`, bloqueando a abertura do dialog. O handler `onClick` roda, mas o dialog que tenta montar fica inutilizável.

## Correção

Em `src/pages/Kanban.tsx`, no menu da coluna (linhas 148–155), trocar `onClick` por `onSelect` com `e.preventDefault()` e disparar a ação no próximo tick (`setTimeout(..., 0)`), para o menu fechar antes de o dialog abrir:

```tsx
<DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onEdit(stage), 0); }}>
  <Pencil className="mr-2 h-3.5 w-3.5" />Editar etapa
</DropdownMenuItem>
<DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onDelete(stage), 0); }} className="text-destructive focus:text-destructive">
  <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir etapa
</DropdownMenuItem>
```

Mesma correção aplicada ao "Excluir etapa", que sofre do mesmo problema (o `confirm` também é um dialog).

## Arquivos alterados

- `src/pages/Kanban.tsx` (apenas o bloco do `DropdownMenuContent` da coluna)
