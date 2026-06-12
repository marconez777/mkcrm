# Refinar TabsList em Configurações — Glass Pills com destaque verde

## Escopo
Substituir apenas as classes da `TabsList` e dos `TabsTrigger` na página `src/pages/Settings.tsx`. Sem mexer em outras tabs do app nem no componente shadcn `src/components/ui/tabs.tsx`.

## Mudanças

**`src/pages/Settings.tsx`** — sobrescrever via `className` na `TabsList` e `TabsTrigger`:

- **Container (`TabsList`)**: `inline-flex items-center gap-1 rounded-2xl bg-white/60 p-1.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.02)] backdrop-blur-md h-auto`
- **Item inativo (`TabsTrigger` base)**: altura `h-10`, `rounded-xl px-5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95`
- **Item ativo (`data-[state=active]:`)**: `bg-background text-emerald-700 font-semibold shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] ring-1 ring-emerald-500/10`, com pseudo-overlay de gradiente `from-emerald-500/5` e um dot `bg-emerald-500` (1.5×1.5) à direita do label apenas na aba ativa.

Como o `TabsTrigger` não aceita filhos condicionais ao estado ativo no shadcn padrão, o dot verde será injetado via classe usando `after:` (pseudo-elemento) que aparece só com `data-[state=active]`. Isso evita refatorar o componente base.

## Tokens
Usar `bg-background`, `text-muted-foreground`, `text-foreground`, `hover:bg-muted` (já definidos em `index.css`). O verde acento usa `emerald-*` do Tailwind — a paleta atual do app já usa verde do mesmo tom em botões de "Salvar" (visível no print), então fica consistente. Caso prefira, posso promover esse verde para um token `--accent-success` no `index.css`.

## Fora de escopo
- Outras instâncias de `<Tabs>` no app
- Conteúdo dos cards abaixo das tabs
- Comportamento/lógica de troca de abas

Sigo?
