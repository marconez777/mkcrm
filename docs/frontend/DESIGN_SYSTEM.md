# Frontend — Design System

> Tokens, tipografia, espaçamento, dark mode e regras visuais.
>
> Última atualização: 2026-05-25
> Fontes: `src/index.css`, `tailwind.config.ts`, `components/ui/*`.

---

## 1. Tokens semânticos (HSL)

Definidos em `src/index.css` no `:root` e `.dark`. Sempre HSL sem
unidade (`142 71% 45%`), aplicados em Tailwind via `hsl(var(--token))`
no `tailwind.config.ts`.

### Cores base

| Token                    | Light                 | Dark                | Uso                                       |
|--------------------------|-----------------------|---------------------|-------------------------------------------|
| `background`             | `210 20% 98%`         | `222 47% 8%`        | fundo da página                           |
| `foreground`             | `222 47% 11%`         | `210 20% 95%`       | texto principal                           |
| `card` / `card-foreground` | `0 0% 100%` / fg    | `222 47% 11%` / fg  | cards, paineis elevados                   |
| `popover`                | igual card            | igual card          | popovers, dropdowns                       |
| `primary`                | `142 71% 45%` (verde) | igual               | CTAs, botões principais, links            |
| `primary-foreground`     | `0 0% 100%`           | `0 0% 100%`         | texto sobre primary                       |
| `primary-glow`           | `142 71% 55%`         | —                   | gradientes premium                        |
| `secondary`              | `210 20% 94%`         | `222 47% 16%`       | botões secundários, badges neutras        |
| `muted` / `muted-foreground` | `210 20% 94%` / `215 16% 47%` | `222 47% 16%` / `215 20% 65%` | superfícies suaves, texto auxiliar |
| `accent`                 | `142 71% 95%`         | `142 71% 20%`       | tags, highlights ligados ao primary       |
| `destructive`            | `0 84% 60%`           | `0 62% 50%`         | erros, delete                             |
| `success` / `warning` / `info` | hsl vars dedicadas | (idem)            | badges de status                          |
| `border` / `input`       | `214 32% 91%`         | `222 47% 18%`       | bordas e inputs                           |
| `ring`                   | primary               | primary             | focus ring                                |

### Sidebar (escura mesmo em light mode)

| Token                          | Valor                |
|--------------------------------|----------------------|
| `sidebar-background`           | `222 47% 11%` (azul-noite) |
| `sidebar-foreground`           | `210 20% 90%`         |
| `sidebar-accent`               | `222 47% 16%`         |
| `sidebar-accent-foreground`    | `0 0% 100%`           |
| `sidebar-border`               | `222 47% 18%`         |
| `sidebar-primary` / `sidebar-ring` | primary           |

### Chat (Inbox)
- `chat-bubble-me` — verde claro (mensagem própria).
- `chat-bubble-them` — branco / card escuro.
- `chat-bg` — superfície de fundo do thread.

---

## 2. Raio, espaçamento, tipografia

- **`--radius: 0.625rem`** (~10px). `lg = var(--radius)`,
  `md = calc(var(--radius) - 2px)`, `sm = calc(var(--radius) - 4px)`.
- **Tipografia**: stack default do Tailwind (`-apple-system, ...`) com
  `font-feature-settings: "cv02","cv03","cv04","cv11"` para inter.
- **Tamanho mínimo de fonte: 15px.** Tudo em `html`, `body` e elementos
  textuais é forçado para `max(15px, 1em)`. `text-xs`, `text-sm` e
  classes arbitrárias menores são **reescritas** para 15px / line-height
  1.4 via `!important`. **Não tente** criar texto menor — visual fica
  inconsistente.
- **Container**: `container` centralizado, padding `2rem`, `2xl: 1400px`.

---

## 3. Dark mode

Estratégia: `class="dark"` no `<html>`. Toggle não está exposto no UI
hoje (light é default), mas os tokens estão definidos — adicionar um
switch via `next-themes` ou estado próprio é trivial.

Cuidado: sidebar é **sempre escura**; redefinir `sidebar-*` para dark
quebra contraste em light mode.

---

## 4. Scrollbars

- **Genérica fina**: `.scrollbar-thin` — 6px, thumb `border`.
- **Kanban**: `.kanban-scroll` — 14px (cresce para 18px em hover),
  thumb `muted-foreground/55` (hover: `primary/85`). Combinado com
  `.kanban-snap` para scroll snap-to-column.

---

## 5. Animações

`tailwindcss-animate` habilitado. Keyframes custom: `accordion-down`,
`accordion-up` (usadas pelos Radix Accordion/Collapsible).

Para animações novas, **adicione `@keyframes` em `index.css`** dentro
de `@layer utilities` e registre em `tailwind.config.ts > theme.extend.animation`.

---

## 6. Regras de uso (inegociáveis)

1. **NUNCA** use cores cruas (`text-white`, `bg-slate-900`, `#fff`,
   `rgb(...)`). Sempre token semântico.
2. **NUNCA** introduza novo HSL sem nomear como token em `index.css` e
   adicionar em `tailwind.config.ts`.
3. **NUNCA** edite arquivos `ui/*` para mudar cor — passe variantes.
4. **NUNCA** crie texto < 15px (a CSS força para 15px, mas o intent
   fica errado e o layout pode quebrar). Use `text-base` ou superior.
5. **Botão primário** = `<Button>` (variante default). Variantes
   secundárias/ghost/outline já existem no `ui/button.tsx`.
6. **Espaçamento padrão**: gaps em múltiplos de 4 (`gap-2`, `gap-4`,
   `gap-6`). Padding de card padrão: `p-4` ou `p-6`.
7. **Bordas**: sempre `border-border` (tokenizada). Evitar `border-input`
   exceto em inputs.

---

## 7. Pegadinhas

- O **min-font-size 15px** é forçado por utility com `!important` — se
  você precisa de um número/badge menor por design, faça o caso a caso
  via inline style ou refute o requisito. Não desabilite globalmente.
- Mudar `--primary` afeta sidebar (`sidebar-primary`) por default. Se
  quiser cor distinta na sidebar, redefinir os tokens `sidebar-*`.
- `accent` light é verde muito claro; em backgrounds brancos pode dar
  pouco contraste para texto preto. Usar `accent-foreground`.
- Não há tokens para `chat-bubble-*` no `tailwind.config.ts` — use
  inline `style={{ background: 'hsl(var(--chat-bubble-me))' }}` ou
  adicione no config se forem usados em mais de 2 lugares.

---

## 8. Melhorias sugeridas

- Adicionar toggle de dark mode (next-themes), com cookie por usuário.
- Tokens para `chat-bubble-*` e `chat-bg` no `tailwind.config.ts`.
- Documentar variantes de `Button`, `Badge`, `Card` em um Storybook.
- Auditar uso de cores cruas com `rg "text-(white|black|slate|gray)-"`
  no CI.
