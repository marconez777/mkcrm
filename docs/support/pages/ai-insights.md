---
title: AI Insights — `/ai/insights`
topic: ai
kind: support
audience: user
updated: 2026-06-07
---
# AI Insights — `/ai/insights`

## Para que serve
Análises automáticas das conversas com leads geradas pelo "Analista de Conversas" (agente interno de IA). Mostra resumo, sentimento, objeções, dúvidas, interesses, motivos de sumiço e recomendações por conversa/lead.

## Quem acessa
Owner / Admin. Requer feature de IA habilitada no plano.

## Layout
- **Cabeçalho:** ícone 💡 + título *"Insights de conversas"* + badge com contagem filtrada.
- **Botões à direita:**
  - **Atualizar** (refresh da listagem)
  - **Rodar analista agora** — invoca `ai-analyst-run` com `hours: 24`. Toast: *"Análise iniciada: N leads"*.
- **Barra de filtros:**
  - Busca (ícone 🔍) — busca em resumo, objeções, dúvidas, interesses, motivos de sumiço e recomendações
  - Select **Agente** (Todos os agentes / agente específico)
  - Select **Sentimento** (Todos / Positivo / Neutro / Negativo / Ambivalente)
- **Lista de cards** (até 200 insights mais recentes):
  - Header: badge de sentimento + badge do agente + link para o lead (abre `/inbox/:lead_id`) + tempo relativo (ex.: "há 2 horas")
  - Título: **Resumo** da conversa
  - Body: até 5 seções (mostradas apenas se houver itens):
    - **Objeções** (badge destructive)
    - **Dúvidas** (badge secondary)
    - **Interesses** (badge default)
    - **Motivos de sumiço** (badge outline)
    - **Recomendações** (badge default, destacado em negrito)

## Sentimentos

| Valor | Cor badge |
|---|---|
| `positivo` | default (azul) |
| `neutro` | secondary (cinza) |
| `negativo` | destructive (vermelho) |
| `ambivalente` | outline |

## Ações

| Botão | Comportamento |
|---|---|
| **Atualizar** | Recarrega últimos 200 insights de `ai_insights` |
| **Rodar analista agora** | Invoca `ai-analyst-run`. Recarrega após 1.5s. |
| Link do lead | Navega para `/inbox/:lead_id` |

## Mensagens de toast

| Situação | Mensagem |
|---|---|
| Analista iniciado | *"Análise iniciada: N leads"* |
| Erro ao rodar | *"Falha ao executar analista"* ou mensagem da edge function |

## Estado vazio
*"Nenhum insight ainda. O agente 'Analista de Conversas' roda diariamente — ou clique em 'Rodar analista agora'."*

## Pegadinhas
- O analista **roda diariamente** em background (cron) — botão manual é para forçar.
- Cada insight tem `period_start` e `period_end` (janela analisada).
- A análise consome **créditos de IA** do plano da clínica.
- Lista é cap em 200 — para histórico completo, consultar diretamente o banco.
- Se nenhum lead teve conversa nas últimas 24h, o run retorna 0 leads processados.

## Relacionado
- Páginas: `pages/ai-agents.md`, `pages/ai-hub.md`, `pages/agent-memories.md`
- Conceitos: `00-conceitos.md#ai-insights`
