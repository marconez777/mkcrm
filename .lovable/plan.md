
## Objetivo

Aplicar o mesmo padrão de sidebar usado em **Agentes IA** (`src/pages/Agents.tsx`) aos três sidebars das abas de Mensagens: **Templates**, **Automações** e **Sequências** — mantendo todas as funcionalidades existentes (toggles, ações de play, atalhos, badges de status).

## Padrão visual a replicar

Extraído do `Agents.tsx` (já em produção):

- Container `<aside className="w-72 shrink-0 border-r bg-muted/10">` (era `bg-muted/20`).
- Header compacto: `flex items-center justify-between px-4 py-2.5` com label **uppercase** de 10px:
  `text-[10px] font-medium uppercase tracking-wider text-muted-foreground` + contador `· N` em foreground/60.
- Botões de ação no header: `size="sm" variant="ghost"` em `h-7 w-7 p-0` (ícone Play / Plus).
- Itens da lista: botão `relative mb-0.5 px-2 py-1.5 rounded-md` com `bg-muted` quando ativo (não `bg-accent`) e barra primária `absolute left-0 w-0.5 rounded-r bg-primary` no estado ativo.
- Avatar circular `h-7 w-7 rounded-full` com iniciais (2 letras), cor de fundo HSL derivada do hash do nome (saturação 55%, lum 28%) — substitui o ícone genérico (`FileText`, `Zap`, `Mail`).
- Texto: `text-sm font-medium` no título; linha secundária `text-[11px] text-muted-foreground` com **status dot** colorido (`h-1.5 w-1.5 rounded-full`) + metadado (atalho, gatilho ou contagem de passos).
- Item "novo" final com **borda tracejada**: `border border-dashed border-border/60` + hover `hover:border-primary/60 hover:text-primary`.

## Mudanças por arquivo

### 1. `src/pages/Templates.tsx` (linhas 77-101)
- Trocar header para padrão uppercase + contador `· N`.
- Ícone `FileText` → avatar com iniciais.
- Linha secundária mostra: status dot neutro + atalho `//alta` (quando existir) ou "sem atalho".
- Botão "+" do header vira ícone compacto `h-7 w-7`.
- "Novo template" como item dashed no final da lista (em vez do "+" só no header) — mantém o "+" header também.

### 2. `src/pages/Automations.tsx` (linhas 167-195)
- Mesmo header uppercase + contador.
- Ícone `Zap` → avatar iniciais coloridas.
- Status dot: verde (`bg-emerald-500`) quando `enabled`, cinza quando off — remove badge "off".
- Linha secundária: label do gatilho (`Sem resposta`, `Estágio parado`, `Antes da consulta`) abreviado.
- Botões header (`Play` + `Plus`) ficam `h-7 w-7 ghost`.
- Item dashed "Nova automação" no final.

### 3. `src/pages/Sequences.tsx` (linhas 217-253)
- Mesmo header. Título atual "Automação de mensagens" → "Sequências" (uppercase 10px).
- Ícone `Mail` → avatar iniciais.
- Mantém o `Switch` lateral (`scale-75`) — única diferença permitida porque já existe esse controle inline.
- Substitui badge "Ativa/Pausada" por status dot (verde/cinza) + texto curto `Ativa`/`Pausada` em `text-[11px] text-muted-foreground` ao lado do dot.
- Item dashed "Nova sequência" no final.

## Detalhes técnicos

- Função helper de avatar (initials + hue) será inlineada em cada arquivo (mesmo padrão de Agents.tsx, ~10 linhas). Sem refator para componente compartilhado — escopo da tarefa é só replicar visual.
- Nenhuma mudança em lógica: `setSelected`, `create`, `runNow`, `toggleEnabled`, `remove` permanecem intactos.
- Sem mudança nos editores/main panels à direita.
- Sem mudanças em `index.css` ou tokens — usa tokens semânticos já existentes (`muted`, `primary`, `border`, `foreground`).

## Validação

- Build TypeScript passa.
- Visualmente: os 3 sidebars ficam idênticos ao de Agentes IA (header uppercase, avatares circulares com iniciais, status dot, item dashed no final).
- Funcionalidades preservadas: toggle de sequência, play de automation tick, criar template, badges de atalho.
