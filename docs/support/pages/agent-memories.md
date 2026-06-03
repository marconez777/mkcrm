# Memórias dos Agentes — `/ai/memories`

## Para que serve
Banco de memórias persistentes que os agentes de IA salvam sobre leads — fatos, preferências, contexto. É o que faz o agente "lembrar" do lead em conversas futuras.

## Quem acessa
Owner / Admin. Requer feature de IA habilitada no plano.

## Layout
- **Cabeçalho:** ícone 🧠 + título *"Memórias dos Agentes"* + subtítulo *"Tudo que os agentes aprenderam e salvaram sobre os leads (fatos, preferências, contexto)."*
- Botão **Atualizar** à direita.
- **Card de Filtros** (3 colunas):
  - **Busca** — pesquisa textual no conteúdo da memória
  - **Agente** — Todos os agentes / agente específico
  - **Tipo** — Todos os tipos / tipo específico (kinds detectados dinamicamente)
- Contador: *"X de Y memórias"*.
- **Lista de cards** (até 500 mais recentes):
  - Linha de badges (topo): tipo (badge default para `preference`, secondary para outros) + 🤖 agente + 👤 lead (link para `/inbox/:lead_id`) + tempo relativo
  - Conteúdo: texto livre (whitespace-pre-wrap)
  - Botão **Apagar** (lixeira vermelha) com confirmação AlertDialog

## Tipos comuns de memória (`kind`)

| Kind | O que costuma armazenar |
|---|---|
| `preference` | Preferências explícitas do lead (horário, contato, produto) |
| `fact` | Fatos objetivos (idade, profissão, localização) |
| `context` | Contexto de conversa (interesse demonstrado, dor mencionada) |

> Os tipos disponíveis no filtro são detectados dinamicamente do que já foi salvo — não são uma lista fixa.

## Ações

| Botão | Comportamento |
|---|---|
| **Atualizar** | Recarrega últimas 500 memórias |
| Link 👤 do lead | Navega para `/inbox/:lead_id` |
| **Apagar** | AlertDialog: *"Apagar esta memória? O agente vai esquecer permanentemente esta informação. Não pode ser desfeito."* → DELETE |

## Mensagens de toast

| Situação | Mensagem |
|---|---|
| Memória apagada | *"Memória apagada"* |
| Erro ao apagar | mensagem original do banco |

## Estado vazio
- Sem memórias: *"Nenhuma memória salva ainda. Os agentes vão registrar fatos importantes conforme conversam com os leads."*
- Sem resultado: *"Nenhuma memória corresponde aos filtros."*

## Pegadinhas
- **Memórias são consultadas pelo agente toda conversa** — apagar uma pode causar o agente "esquecer" e perguntar de novo.
- **Limite de 500 na visualização** — para auditoria completa, consultar banco direto.
- Memórias podem ser criadas pelos agentes via **tool** `save_memory` (ver builder dos agentes).
- Diferente de **AI Insights** (análises agregadas), aqui são **fatos pontuais** sobre um lead.
- Não há edição inline — para corrigir uma memória errada, apagar e deixar o agente recriar.

## Relacionado
- Páginas: `pages/ai-insights.md`, `pages/ai-agents.md`, `pages/lead-drawer.md`
- Conceitos: `00-conceitos.md#memorias`
