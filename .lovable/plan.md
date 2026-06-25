## Ajuste no `CustomFieldsPanel.tsx`

Largura da coluna de labels passa a se adaptar ao conteúdo (sem alinhamento à direita).

### Mudança única no grid de cada linha

- Trocar `grid-cols-[60%_40%]` por `grid-cols-[auto_1fr]` — coluna esquerda cresce conforme o maior label.
- Trocar `truncate` por `line-clamp-2 max-w-[180px]` no `<span>` do label — textos longos quebram em até 2 linhas em vez de empurrar a coluna indefinidamente.
- `gap-2` → `gap-x-3` para respiro horizontal.
- Manter `title={f.label}` (tooltip completo) e alinhamento padrão à esquerda.

Sem mudanças em lógica/negócio nem em outros componentes.
