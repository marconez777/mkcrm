# Plano — Sidebar Agentes (Minimalista SaaS) + Logo Header Home

Sequência: primeiro concluo o redesign da sidebar de `/agents`, depois aumento o logo do header da home.

---

## Parte 1 — Redesign da Sidebar Agentes (Minimalista SaaS)

Arquivos afetados:
- `src/pages/Agents.tsx` (sidebar interna)
- `src/components/agents/BuilderSetupCard.tsx` (status do builder)

### Fase 1 — BuilderSetupCard como status row compacto
Transformar o card atual em uma linha de status discreta no topo da sidebar:
- Dot pulsante (verde = conectado, âmbar = configurando, vermelho = erro)
- Label uppercase 11px `text-muted-foreground tracking-wider`
- Botão "Testar conexão" em variant `ghost` size `sm`
- Remover bordas pesadas; usar apenas `border-b border-border/50`

### Fase 2 — Header "Agentes" refinado
- Label uppercase 11px `tracking-wider text-muted-foreground`
- Contador de agentes ao lado (ex: "Agentes · 4")
- Botão "Assistente" em variant `secondary` size `sm` com ícone Sparkles
- Spacing vertical reduzido (py-2 em vez de py-4)

### Fase 3 — Lista de agentes redesenhada
Cada item da lista:
- Avatar circular 28px com iniciais e cor derivada do nome (hash → hsl)
- Nome em `text-sm font-medium`
- Subline: status dot 6px + label do modelo (ex: "● gemini-2.5-flash") em `text-xs text-muted-foreground`
- Hover: `bg-muted/40` com transição suave
- Ativo: `bg-muted` + barra lateral 2px na cor primary (left border)
- Padding compacto (px-2 py-1.5), gap-2

### Fase 4 — "Novo agente" como item dashed
- Item da lista com `border border-dashed border-border/60`
- Ícone Plus 14px + label "Novo agente"
- Hover: borda sólida na cor primary + texto primary
- Mesma altura dos itens normais para alinhamento visual

### Tokens semânticos
Tudo via `bg-muted`, `border-border`, `text-muted-foreground`, `text-primary` — zero cores hardcoded. Cores de avatar derivadas via função utilitária `getAvatarColor(name)` usando HSL.

---

## Parte 2 — Aumentar logo do header da home

Arquivo: `src/components/site/SiteNav.tsx`

Aumentar a altura do lockup da marca de `h-10` (40px) para `h-14` (56px), mantendo proporção. Ajustar padding vertical do header se necessário para evitar corte.

---

## Ordem de execução
1. Parte 1 completa (Fases 1→4) — sidebar `/agents`
2. Parte 2 — logo do header home
3. Build check após cada parte

Sem mudanças de lógica/backend — apenas apresentação.
