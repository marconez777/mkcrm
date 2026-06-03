# ✨ IA Hub — `/ai`

## Para que serve
Central de navegação para **tudo relacionado a IA e mensagens** da clínica. Funciona como um contêiner com abas horizontais que carregam módulos diferentes sem mudar de página.

## Quem acessa
Todos os membros. **Abas aparecem ou desaparecem conforme as features do plano** — se a clínica não tem `email_marketing`, a aba some sem mensagem de erro.

## Layout
Barra de abas horizontal (rótulo *"Seções de IA"*, max 1200px centralizada). Cada aba tem ícone + label + cor. Conteúdo renderiza abaixo.

## Abas

| Aba | Rota | Ícone | Feature requerida |
|---|---|---|---|
| **Dashboard** | `/ai` | 📊 | sempre visível |
| **Agentes IA** | `/ai/agents` | 🤖 | `agents` |
| **Mensagens** | `/ai/messages` | 💬 | `sequences` OU `automations` OU `templates` |
| **Disparo em massa** | `/ai/broadcasts` | 📣 | `broadcasts` |
| **Relatórios** | `/ai/reports` | 📑 | sempre visível |
| **Memórias IA** | `/ai/memories` | 🧠 | `agents` |
| **Insights** | `/ai/insights` | ✨ | `agents` |
| **Custos** | `/ai/usage` | 💰 | `metrics_ai_usage` |

## O que cada aba mostra
- **Dashboard** — métricas gerais de IA (uso, custo, conversas atendidas).
- **Agentes IA** — listagem + edição completa de agentes (ver `pages/ai-agents.md`).
- **Mensagens** — sequências, automações e templates de mensagem.
- **Disparo em massa** — campanhas/broadcasts.
- **Relatórios** — agendamento e histórico.
- **Memórias IA** — fatos memorizados pelo agente sobre leads.
- **Insights** — análises e sugestões geradas pela IA.
- **Custos** — gasto por agente, modelo e período.

## Comportamento
- Clicar na aba navega pela rota.
- Rotas alternativas (`/agents`, `/automations`, `/sequences`…) carregam o Hub e destacam a aba correta automaticamente.
- O Hub em si **não mostra toasts** — cada módulo interno tem os seus.

## Relacionado
- `pages/ai-agents.md` · `pages/ai-insights.md` (Fase 3) · `pages/ai-memories.md` (Fase 3)
- `00-conceitos.md` (Agente, Memória, Insight)
