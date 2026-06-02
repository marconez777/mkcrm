## Objetivo

Resolver a "cegueira visual" das tabs nos hubs `/ai/*` e `/email/*`: hoje todas têm a mesma forma, tamanho e cor, sem âncora visual. A solução é dar a cada tab uma **identidade própria de categoria** (ícone + cor de acento), mantendo o layout horizontal e o resto do app intacto.

## Direção visual

Cada tab vira um mini-card com:

- **Ícone dedicado** (Lucide) à esquerda, dentro de um quadrado arredondado com o tom da categoria.
- **Label** ao lado, peso `medium`.
- **Estado inativo**: fundo `card`, borda sutil `border/60`, ícone tingido com a cor da categoria em baixa opacidade — já distingue, sem poluir.
- **Estado ativo**: borda da cor da categoria, leve tint de fundo (`color/8`), ícone em cor cheia, sombra suave e barrinha inferior de 2px na cor da categoria (ancora a hierarquia).
- **Hover**: tint mais leve + lift de 1px.

Inspirações: Linear (ícone tonal), Vercel (chip pill), Raycast (acento por categoria), Height (barra inferior por seção).

### Paleta por categoria (tokens HSL semânticos, sem hex direto)

Hub IA (`/ai`):
```text
Dashboard       → slate/foreground    LayoutDashboard
Agentes IA      → primary (verde)      Bot
Mensagens       → info (azul)          MessageSquare
Disparo em massa→ violet 262           Megaphone
Relatórios      → cyan 190             FileBarChart
Memórias IA     → fuchsia 290          BrainCircuit
Insights        → amber/warning        Sparkles
Custos          → emerald escuro 160   Wallet
```

Hub Email (`/email`):
```text
Dashboard      → slate         LayoutDashboard
Templates      → primary        FileText
Automações     → violet 262     Workflow
Campanhas      → info azul      Send
Relatórios     → cyan 190       BarChart3
Segmentos      → fuchsia 290    Users
Contatos       → teal 175       Contact
Fila           → amber          ListOrdered
Logs           → slate          ScrollText
Descadastros   → destructive    UserMinus
```

As cores entram como **novos tokens semânticos** em `src/index.css` (`--tab-violet`, `--tab-cyan`, `--tab-fuchsia`, `--tab-teal`, `--tab-amber`) usando HSL, com versões `light/dark`. Reaproveita `--primary`, `--info`, `--warning`, `--destructive` já existentes onde couber.

## Componente compartilhado

Criar `src/components/ui/category-tabs.tsx` (não substitui `ui/tabs.tsx`):

```ts
type CategoryTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  accent: "primary" | "info" | "violet" | "cyan" | "fuchsia"
        | "amber" | "emerald" | "teal" | "slate" | "destructive";
  badge?: ReactNode;
};

<CategoryTabs
  tabs={tabs}
  value={current}
  onChange={(v) => navigate(...)}
  ariaLabel="Seções de IA"
/>
```

Internamente um `<nav role="tablist">` com `<button role="tab">`, mapeando `accent` → classes via objeto (`bg-[hsl(var(--tab-violet)/0.08)]` etc.), sem string concat dinâmica para o Tailwind purgar bem. Suporta wrap em telas menores (`flex-wrap`).

## Mudanças por arquivo

1. **`src/index.css`** — adicionar bloco de tokens `--tab-*` (light + dark).
2. **`src/components/ui/category-tabs.tsx`** — novo componente.
3. **`src/pages/ai/AiHub.tsx`** — trocar `Tabs/TabsList/TabsTrigger` por `<CategoryTabs>`; manter `TABS[]`, `visible`, `current`, e renderizar a view ativa direto (sem `TabsContent`, já que navegação é por rota).
4. **`src/pages/email/EmailHub.tsx`** — mesma troca, com as 10 tabs e suas cores.

Sem alterações de rota, sem mudanças de lógica, sem tocar nas páginas internas.

## Critérios de aceite

- Cada tab é distinguível em < 1s pelo ícone + cor, mesmo desfocando os olhos.
- Tab ativa tem 3 sinais simultâneos: cor da borda, tint de fundo, barra inferior.
- Funciona com 8 tabs (IA) e 10 tabs (Email) no viewport atual (1074px) sem cortar.
- Mantém acessibilidade: `role=tablist/tab`, `aria-selected`, `focus-visible` ring.
- Zero regressão funcional: clique navega como antes; tab detectada pela rota igual ao código atual.

## Fora de escopo

- Não mexer no `AppShell` (sidebar global).
- Não criar variante "sidebar vertical" — descartada na sua resposta.
- Não substituir `ui/tabs.tsx` (continua usado em dialogs/configurações).
