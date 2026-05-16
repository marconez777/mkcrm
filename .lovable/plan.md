## Reorganização do menu lateral — agrupador "IA"

### O que muda no menu (todas as clínicas)

Substitui o item atual **Agentes IA** (que já tinha submenu Memórias IA / Custos IA) por um único pai chamado **IA** apontando para `/ai`, sem submenu lateral. Dentro da página `/ai` aparecem abas no topo (mesmo padrão de `/email`):

1. Dashboard (`/ai`)
2. Agentes IA (`/ai/agents`)
3. Memórias IA (`/ai/memories`)
4. Custos IA (`/ai/usage`)
5. Automações (`/ai/automations`)
6. Templates (`/ai/templates`)

Itens removidos do menu lateral:

- **Métricas** (operação) — removido
- **Métricas IA** — removido (redundante com Dashboard / Custos IA)
- **Agentes IA** (com submenu) — substituído pelo novo pai **IA**
- **Automações** (item de topo) — passa a viver dentro de IA
- **Templates** (item de topo) — passa a viver dentro de IA

Os itens **Sequências**, **Tarefas**, **Conversas**, **Pipeline**, **Email**, **Equipe**, **Configurações** continuam como estão.

### Comportamento das abas

A aba só aparece se a clínica tiver a feature correspondente habilitada (`agents`, `metrics_ai_usage`, `automations`, `templates`). A aba **Dashboard** aparece sempre. Se uma feature estiver desligada, a aba some e a rota correspondente cai num estado vazio (mensagem "recurso indisponível").

A rota `/agents`, `/agents/memories`, `/metrics/ai-usage`, `/automations`, `/templates` continuam funcionando como aliases (redirecionam para a nova URL com aba certa) para não quebrar links antigos.

### Conteúdo do Dashboard

Página simples de visão geral, mesmo estilo do EmailDashboard:

- Cards: mensagens IA nos últimos 7 dias, custo estimado no mês, agentes ativos, automações ativas.
- Mini-gráfico de barras de mensagens IA por dia (últimos 7 dias).
- Lista das 5 últimas execuções de agente.

Tudo lê das tabelas que já existem (`ai_usage_logs`, `agents`, `automations`). Sem mudança de schema.

### Arquivos afetados

```text
src/pages/ai/AiHub.tsx          (novo — host das abas)
src/pages/ai/AiDashboard.tsx    (novo — dashboard de IA)
src/App.tsx                     (rotas /ai, /ai/*, remove /metrics e /metrics/ai, mantém aliases)
src/components/AppShell.tsx     (remove Métricas, Métricas IA, Agentes IA, Automações, Templates; adiciona IA)
```

### Perguntas antes de implementar

1. O **Dashboard de IA** pode começar simples (4 cards + 1 gráfico + lista) ou você quer algo mais elaborado já de cara?
2. Posso **deletar de fato os arquivos** `src/pages/Metrics.tsx` e `src/pages/MetricsOps.tsx`, ou prefere apenas remover do menu e manter o código?
3. As rotas antigas (`/agents`, `/automations`, `/templates`, etc.) devem **redirecionar** para `/ai/...` ou apenas continuar renderizando a página solta (sem aba)?
