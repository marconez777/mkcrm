## Objetivo

Transformar a lista de accordions da tela do Agente (Provedor, Base de conhecimento, Co-piloto, Personas, Estágios, Aprender, Testar, Custos, Auditoria, Insights, Histórico, MCP, Evals, Ferramentas) em **cards categorizados por cor**, no mesmo idioma visual das tabs (`category-tabs.tsx`) e da sidebar premium. Hoje todos são genéricos, com borda cinza e ícone pequeno — fica difícil bater o olho e identificar cada seção.

## Princípios de design

- **Cor por categoria** (reaproveita `--tab-*` que já existem em `index.css`).
- **Placa de ícone** 32×32 com fundo `hsl(var(--accent)/0.12)` e ícone colorido — substitui o ícone solto atual.
- **Borda esquerda colorida** de 3px (apenas no card, não no expand) para identificação periférica.
- **Estado expandido**: fundo `hsl(var(--accent)/0.04)`, borda `hsl(var(--accent)/0.40)`, leve sombra colorida (`shadow-[0_4px_14px_-8px_hsl(var(--accent)/0.45)]`).
- **Estado hover (fechado)**: borda sobe para `hsl(var(--accent)/0.30)`, placa de ícone fica mais saturada.
- **Hierarquia tipográfica**: título `text-sm font-semibold` + uma linha secundária `text-[11px] text-muted-foreground` descrevendo a seção (ex.: "10 documentos indexados", "5 mensagens analisadas"). Hoje só tem o badge — vamos adicionar contexto.
- **Badge** continua, mas com cor da categoria (`bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]`) em vez do cinza atual.
- **Chevron** colorido na cor da categoria quando expandido, neutro quando fechado.
- **Animação**: `transition-all duration-200`, `aria-expanded` puxa a borda lateral de opaca → cheia.

## Paleta por seção

| Seção                     | Accent      | Token            |
|---------------------------|-------------|------------------|
| Provedor & API key        | slate       | `--tab-slate`    |
| Base de conhecimento      | info        | `--tab-info`     |
| Co-piloto do agente       | primary     | `--tab-primary`  |
| Personas para teste       | violet      | `--tab-violet`   |
| Estágios da conversa      | cyan        | `--tab-cyan`     |
| Aprender com produção     | fuchsia     | `--tab-fuchsia`  |
| Servidores MCP            | teal        | `--tab-teal`     |
| Ferramentas               | emerald     | `--tab-emerald`  |
| Evals                     | amber       | `--tab-amber`    |
| Testar agente             | amber       | `--tab-amber`    |
| Custos & limites          | emerald     | `--tab-emerald`  |
| Auditoria de mudanças     | slate       | `--tab-slate`    |
| Insights & recomendações  | fuchsia     | `--tab-fuchsia`  |
| Histórico de versões      | slate       | `--tab-slate`    |

## Implementação

1. **Criar `src/components/ui/section-accordion.tsx`**
   - Componentes `SectionAccordion`, `SectionAccordionItem` (wrappers finos sobre o `Accordion` do shadcn).
   - Props no item: `value`, `icon`, `title`, `accent` (mesmo `TabAccent` de `category-tabs.tsx`), `badge?`, `subtitle?`, `flagship?` (extra glow para "Co-piloto"), `children`.
   - Mesma técnica de CSS var por item (`--accent: var(--tab-X)`) usada em `CategoryTabs` — sem JIT dinâmico de classes.
   - Render do header: placa de ícone + (título com badge inline) + subtítulo + chevron à direita.

2. **Trocar todos os `AccordionItem` da Tela do Agente** em `src/pages/Agents.tsx` (linhas ~890–1210) pelo novo `SectionAccordionItem`, mapeando cada seção à paleta acima.
   - Remover `border-2 border-primary/30` do "Co-piloto" — agora vira `flagship` do componente.
   - Aproveitar para incluir `subtitle` curto onde fizer sentido (ex.: `${docs.length} documentos`, `${selected.tools.length} ferramentas ativas`).

3. **CSS**: nada novo em `index.css` — os tokens `--tab-*` já existem dos cards anteriores.

4. **Acessibilidade**: manter o `AccordionTrigger` do shadcn (que já cuida de `aria-expanded`, foco, keyboard). Adicionar `focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]`.

## Fora de escopo

- Não mexer no conteúdo interno dos painéis (CopilotPanel, KbAssistant, etc.).
- Não mudar a ordem dos accordions.
- Não tocar nas tabs do AiHub/EmailHub nem na sidebar (já feitos).
- Sem mudanças em rotas, dados ou edge functions.

## Arquivos

- novo: `src/components/ui/section-accordion.tsx`
- edita: `src/pages/Agents.tsx` (apenas o bloco de accordions)
