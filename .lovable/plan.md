## Ajustes no painel "Principal" (CustomFieldsPanel)

### 1. Mais espaço para os valores
Em `src/components/inbox/CustomFieldsPanel.tsx`:
- Trocar grid de `grid-cols-[110px_1fr]` para `grid-cols-[84px_1fr]`.
- Adicionar `title={f.label}` na label (mostra nome completo no hover quando truncar).

### 2. Textarea redimensionável (campo "Mensagem")
Substituir o `case "textarea"` por uma textarea com visual melhor e handle de resize vertical com o mouse:

- Container com `border rounded-md bg-background px-2 py-1.5` (sai do estilo "nu" atual, fica claro que é editável).
- `<Textarea>` com:
  - `resize-y` (handle nativo do navegador para arrastar e expandir verticalmente)
  - `min-h-[64px] max-h-[480px]` (limites razoáveis)
  - Altura inicial salva em `localStorage` por `field_key` (`cf-textarea-h:<key>`), restaurada no mount, persistida via `ResizeObserver` no `onMouseUp`/blur — assim o tamanho escolhido pelo usuário persiste entre leads.
  - Texto `text-sm leading-relaxed`, scroll interno quando ultrapassar o tamanho.
  - `onBlur` salva (mantém comportamento atual).
- Pequena dica visual: o canto inferior direito do textarea já mostra o grip nativo de resize do browser; nada de modal/dialog.

### Arquivos
- `src/components/inbox/CustomFieldsPanel.tsx` — único arquivo alterado.

Sem mudanças em backend/schema.
