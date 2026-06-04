
# Plano: Super Admin Premium Whitelabel — 10 Fases

Inspirado nas referências enviadas (Paces/Coderthemes): sidebar densa com agrupamento (MAIN/APPS), topbar com quick-search + comandos, KPIs em cards limpos, tabelas com filtros e bulk actions, gráficos suaves, badges discretas, mini-trends, donuts e progresso linear.

Hoje o `/admin` é **uma única página com 10 abas horizontais**, todas dentro de `src/pages/Admin.tsx`. Vamos quebrar em um sub-app com layout próprio, design tokens dedicados e componentes reaproveitáveis.

---

## Fase 1 — Design system whitelabel

- Adicionar tokens `--admin-*` (bg, surface, surface-elevated, border-subtle, kpi-positive/negative, chart-1..6) em `index.css`, herdando do tema. Tudo HSL.
- Definir tipografia da área admin (display + sans), raio padrão `xl`, sombras `shadow-elevated` e `shadow-card`.
- Criar `tailwind.config.ts` extensions para `admin` palette, mantendo compatibilidade com light/dark.
- Whitelabel: ler `clinics.settings.branding` (logo, primary, accent) e aplicar via CSS vars no `<AdminShell>` para que parceiros possam rebrandar sem fork.

## Fase 2 — AdminShell (layout dedicado)

- Novo `src/layouts/AdminShell.tsx` com:
  - **Sidebar fixa** agrupada (Visão Geral, Clientes, Receita, Operações, Plataforma, Sistema) usando `NavLink` ativos, colapsável.
  - **Topbar**: command palette (`⌘K`), seletor de período global (7/30/90/Custom), seletor de clínica (impersonation visual), notificações de alertas críticos, avatar.
  - **Breadcrumbs** automáticos por rota.
- Migrar `/admin` para rotas filhas: `/admin`, `/admin/clinics`, `/admin/users`, `/admin/plans`, `/admin/usage`, `/admin/finance`, `/admin/observability`, `/admin/support`, `/admin/integrations`, `/admin/audit`, `/admin/builder-manual`. Cada aba vira página com URL própria (deep-link + back/forward).

## Fase 3 — Dashboard executivo (home `/admin`)

- Reescrever `DashboardPanel` com grid responsivo:
  - **Hero KPIs** (8 cards): MRR, ARR, Clínicas ativas, Novos signups, Mensagens, Custo IA, E-mails enviados, Churn — cada um com sparkline + delta vs período anterior.
  - **Gráfico principal** (área): Receita vs Custo IA por dia.
  - **Heatmap** de atividade por hora/dia da semana (engagement plataforma).
  - **Top clínicas** (tabela compacta com avatar, plano, MRR, msgs, custo IA, status).
  - **Saúde do sistema** (mini cards): DB, edge functions, fila de e-mail, Evolution.
  - **Alertas** (lista priorizada de inadimplência/limites/erros).
- Recharts já existe — padronizar `ChartContainer` com tooltip estilizado igual à referência.

## Fase 4 — Clínicas 2.0

- Página `/admin/clinics` com:
  - **Filtros sticky** (status, plano, MRR range, último login, search).
  - **Tabela densa** com colunas: Clínica (avatar+nome+slug), Plano (badge), MRR, Uso (3 mini-barras: msgs/IA/email), Status, Health (dot), Criada.
  - **Drawer lateral** (substituir dialog) com abas: Visão, Plano & Assinatura, Uso & Limites, Membros, Auditoria, Features, Branding.
  - **Bulk actions** mantidas, com toolbar contextual flutuante.
- Vista alternativa **cards/grid** para visão executiva.

## Fase 5 — Receita & Financeiro

- `/admin/finance` reformulado:
  - KPIs: MRR, ARR, LTV médio, Churn rate, ARPU, Inadimplência %.
  - Gráfico de **MRR waterfall** (new/expansion/contraction/churn) — estilo SaaS metrics.
  - **Cohort retention** (heatmap) — opcional fase 5b.
  - Tabela de faturas com filtros + ações inline (marcar paga/anular/reenviar).
  - Distribuição por plano (donut) + previsão simples (média móvel 3m).

## Fase 6 — Usuários & Acesso

- `/admin/users`: tabela com avatar, clínica, papel, último login (relative time), MFA on/off, status.
- Detalhe lateral com: sessões ativas, dispositivos, histórico de login, ações sensíveis (reset, force logout, promover, banir).
- `/admin/team-roles`: editor de papéis customizados (preparar p/ whitelabel).

## Fase 7 — Observabilidade & Suporte

- `/admin/observability`: KPIs + uso por feature (barras + sparkline 30d), dead features, top erros (lista com modal stack), latência p50/p95 das edges.
- `/admin/support` reorganizado em 3 colunas: Monitor live (esquerda), Thread selecionada (centro), Contexto do lead/clínica (direita) — estilo Inbox.
- Status da KB com botão **Ressincronizar** destacado.

## Fase 8 — Plataforma (Planos, Limites, Integrações, Builder Manual)

- `/admin/plans`: cards de plano estilo pricing + editor lateral.
- `/admin/usage`: matriz clínica × limite com heat-coloring e exportar.
- `/admin/integrations`: 3 cards (Resend, Evolution, Lovable AI) com status, chaves, último ping, botão "Testar conexão".
- `/admin/builder-manual`: split editor (markdown) + preview render + histórico em timeline.

## Fase 9 — Command Palette & Atalhos

- Extender `CommandPalette` para super_admin: navegar entre abas, abrir clínica por nome, aplicar plano, suspender, ir para fatura.
- Atalhos: `g d`/`g c`/`g f`/`g u` (Gmail style), `?` para help.
- Toast/feedback consistente (sonner) + skeleton loaders em todas as tabelas.

## Fase 10 — Performance, Polish & Whitelabel final

- Code-split por rota (`React.lazy` em cada painel) → reduzir bundle inicial do admin.
- `react-query` (já no projeto) para todas as queries admin com `staleTime` razoável + invalidation por mutation.
- Virtualização (`@tanstack/react-virtual`) em tabelas >200 linhas.
- Dark mode polido (paleta admin específica).
- **Whitelabel**: tela `/admin/branding` (super_admin global) para definir logo/cores padrão da instalação + override por clínica.
- QA visual: revisar cada rota em desktop/tablet, garantir contraste AA, estados vazios ilustrados, loading skeletons.

---

## Detalhes técnicos

- **Sem mudanças de schema** nas fases 1-9. Fase 10 adiciona `platform_branding` (1 linha) e coluna `clinics.settings.branding` (jsonb) se ainda não existir.
- Componentes novos vão em `src/components/admin/` (subpastas por área: `clinics/`, `finance/`, `shell/`, `charts/`).
- Hooks de dados em `src/hooks/admin/` (`useAdminMetrics`, `useClinicsList`, etc).
- Roteamento: adicionar rotas filhas em `src/App.tsx` sob `<ProtectedRoute requireSuperAdmin>`.
- Sem alterações em edges nesta fase — apenas consumir o que já existe; novos endpoints só se uma fase específica precisar (ex: MRR waterfall pode precisar de `admin-metrics-mrr`).

## Entregáveis por fase

Cada fase termina com: (a) PRs pequenos focados, (b) screenshots antes/depois, (c) atualização de `docs/maps/ADMIN_SUPER_ADMIN.md`.

## O que NÃO faz parte

- Não muda regras de negócio (planos, RLS, billing).
- Não troca stack (continua React+Vite+Tailwind+shadcn+Recharts).
- Não mexe na área de clínica (operador) — escopo é exclusivo `/admin`.

Posso começar pela **Fase 1 + 2** (design tokens + AdminShell com rotas filhas), que destrava todo o resto. Confirma?
