## Objetivo

Repaginar a sidebar mantendo o tema dark e a largura de 240px, mas elevando a hierarquia e a identidade visual. Hoje todos os itens parecem iguais — o ativo só muda de fundo, sem cor de acento nem agrupamento. Vamos para um padrão "premium dark" tipo Linear/Height.

## Direção visual

### Header (logo + marca)
- Logo `mk-logo` num quadrado 36×36 com leve borda `sidebar-border/30` e sombra interna sutil.
- Título "MK-CRM" + subtítulo "WhatsApp Pipeline" ganha kerning mais apertado e cor `foreground` + `foreground/55`.
- Divisor hairline (`border-sidebar-border/40`) abaixo do header.

### Navegação por grupos
Quebra o menu plano em 3 grupos com label uppercase pequena (`text-[10px] tracking-wider text-sidebar-foreground/40 px-3 mb-1.5`):

```text
TRABALHO
  Pipeline, Conversas (badge não lidas), Tarefas
MARKETING
  IA, Email
ADMIN
  Tracking, Tracking Debug, Equipe, Configurações, Super Admin
```

Espaçamento entre grupos: `mt-4` no header do grupo, sem divisor visível.

### Item de navegação
Cada `NavLink` ganha 3 estados claros:

- **Inativo**: ícone `sidebar-foreground/55`, label `sidebar-foreground/75`, sem fundo.
- **Hover**: bg `sidebar-accent/40`, ícone e label `sidebar-foreground`, transição 150ms.
- **Ativo**:
  - Barra esquerda vertical de 3px na cor da categoria (acento) — posicionada absoluta dentro do item, com `rounded-r-full`.
  - Fundo `sidebar-accent` com tint da categoria (`[hsl(var(--tab-X)/0.12)]`).
  - Ícone na cor da categoria (`text-[hsl(var(--tab-X))]`).
  - Label `font-medium text-sidebar-foreground` (full white).
  - Glow sutil: `shadow-[inset_0_1px_0_0_hsl(var(--tab-X)/0.15)]`.

Cor por item (reaproveita tokens `--tab-*` já criados):
```text
Pipeline      → primary (verde)
Conversas     → info (azul)
Tarefas       → violet
IA            → primary (verde)  ou amber? → primary
Email         → cyan
Tracking      → fuchsia
Tracking Debug→ fuchsia
Equipe        → teal
Configurações → slate
Super Admin   → destructive
```

### Badges de contagem
- Item de Conversas (`/inbox`) recebe badge com não lidas se > 0.
- Hook: tentar reaproveitar `useUnreadTitle` ou ler de `useCrm`; se custar muito, deixar placeholder e seguir só com o slot visual pronto (sem disparar a query) — investigar no momento da build.
- Badge: `ml-auto inline-flex min-w-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums`, fundo `[hsl(var(--tab-info)/0.20)]` + texto `[hsl(var(--tab-info))]` quando ativo; fundo `sidebar-accent/60` + `sidebar-foreground/70` quando inativo.

### Footer: status WhatsApp
Vira um "card de saúde" mais destacado, mas compacto:

- Container `rounded-lg bg-sidebar-accent/30 border border-sidebar-border/40 p-2.5`.
- Linha 1: dot animado (`animate-pulse` só quando warn/down) + label + chevron pequeno.
- Linha 2 (só se down): "Clique para conectar" em destaque amber.
- Hover destaca a borda na cor do estado (emerald/amber/destructive).
- Botão de atalhos vira ícone fantasma ao lado do status, mais discreto.

### Footer: perfil
- Mantém estrutura (Avatar + nome + email + chevron), mas:
  - Container ganha `bg-sidebar-accent/20` no estado neutro e `bg-sidebar-accent/50` no hover, com transição.
  - Borda mais sutil (`border-sidebar-border/30`).
  - Dot de presença muda de tamanho para `h-2 w-2` com `ring-[3px] ring-sidebar`.
  - Nome em `text-[13px] font-semibold`, email em `text-[11px]`.

### Microinterações
- `transition-all duration-150` em items.
- Acento e barra esquerda animam via `transition-[background,box-shadow,color]`.
- `prefers-reduced-motion`: desativa `animate-pulse` do dot.

## Mudanças por arquivo

1. **`src/components/AppShell.tsx`**
   - Refatora `navItems` para incluir `group: "work" | "marketing" | "admin"` e `accent: TabAccent` em cada item.
   - Renderiza nav por grupos (filtra itens visíveis e oculta header de grupo vazio).
   - Item recebe novo componente interno `<SidebarItem>` com a lógica de estado/cor.
   - Footer (status + perfil) reorganizado conforme acima.
   - Sem mudança de rotas, sem mudança de permissões.

2. **`src/index.css`** (se necessário)
   - Reaproveita tokens `--tab-*` existentes. Pode precisar de um `--sidebar-accent-soft` (slate 222/47/14) se o `sidebar-accent` atual ficar forte demais; decidir no momento da build após inspecionar visualmente.

3. **Badge de não lidas** (opcional, esforço baixo)
   - Investigar `src/hooks/useUnreadTitle.ts` para reaproveitar o total. Se exposto, plugar em `Conversas`. Caso contrário, deixar a estrutura pronta sem o número e seguir.

## Fora de escopo

- Não colapsar a sidebar (descartado na pergunta).
- Não mudar para tema claro (descartado).
- Não reorganizar rotas/menus além do agrupamento visual.
- Não mexer no `AiHub`/`EmailHub` (já refeitos).
- Não criar novo componente `ui/sidebar` shadcn — segue o `aside` artesanal atual, só refinado.

## Critérios de aceite

- Item ativo distinguível à distância: barra colorida + tint + ícone colorido + label branco.
- Grupos visíveis com labels uppercase, sem poluir.
- Status do WhatsApp claramente identificável (e em "down" chama atenção).
- Perfil mais polido, sem mudar fluxo.
- Zero regressão funcional: todos os links navegam como antes, mesmas permissões.
