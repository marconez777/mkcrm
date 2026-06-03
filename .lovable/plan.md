## Objetivo

Criar uma base de conhecimento em `docs/support/` cobrindo **interface e usabilidade** de todo o produto, voltada para **admin/operador da clínica**, no formato **híbrido** (por página + jornadas + FAQ). Conteúdo extraído do código (rotas, componentes, hooks, edge functions) e dos docs existentes em `docs/features/`, `docs/maps/` e `docs/flows/`.

Diferente de `docs/features` (conceitual) e `docs/maps` (onde editar código), `docs/support/` responde **"como o usuário faz X na tela"** — linguagem PT-BR clara, sem jargão técnico de implementação.

## Estrutura proposta

```text
docs/support/
├── README.md                    # índice + como o agente deve usar
├── 00-conceitos.md              # glossário do usuário (lead, pipeline, stage, agente, clínica…)
├── 01-primeiros-passos.md       # login, onboarding, convites, equipe
├── pages/                       # 1 arquivo por rota principal
│   ├── inbox.md
│   ├── kanban.md
│   ├── lead-drawer.md
│   ├── tasks.md
│   ├── automations.md
│   ├── sequences.md
│   ├── broadcasts.md
│   ├── ai-hub.md
│   ├── ai-agents.md             # listagem + wizard /ai/agents/new
│   ├── ai-insights.md
│   ├── ai-memories.md
│   ├── email-hub.md             # dashboard, campanhas, automações, templates, contatos, segmentos, fila, logs, relatórios, unsubscribes, domínio
│   ├── tracking.md              # /tracking + forms + debug + attribution
│   ├── metrics.md               # Metrics, AI usage, Engagement, Ops, Scheduled reports
│   ├── settings.md              # Settings + custom-fields + forms
│   ├── team.md
│   ├── templates.md
│   └── admin.md                 # painel super_admin: planos, limites, usuários, financeiro, integrações, auditoria, observabilidade
├── journeys/                    # fluxos transversais (passo-a-passo)
│   ├── criar-primeiro-agente-ia.md
│   ├── conectar-whatsapp.md
│   ├── importar-leads.md
│   ├── enviar-campanha-email.md
│   ├── configurar-dominio-email.md
│   ├── criar-automacao.md
│   ├── criar-sequencia.md
│   ├── publicar-formulario.md
│   ├── instalar-pixel-tracking.md
│   ├── convidar-membro-equipe.md
│   ├── aplicar-plano-cliente.md  # admin
│   └── pausar-ia-em-lead.md
├── troubleshooting/
│   ├── whatsapp.md               # QR não aparece, mensagens não enviam, mídia falha
│   ├── email.md                  # campanha pausada, bounce, domínio não verifica, fila travada
│   ├── ia.md                     # erro de provider, quota, agente não responde, custo alto
│   ├── tracking-formularios.md   # CORS, lead não chega, atribuição errada
│   ├── auth-convites.md          # convite expirado, login não funciona, role errada
│   └── limites-planos.md         # bloqueios por limite, como aumentar
└── faq.md                       # perguntas curtas frequentes
```

## Template de cada arquivo `pages/*.md`

Para o agente extrair respostas determinísticas:

```text
# [Nome da página] — `/rota`

## Para que serve
1-2 linhas em linguagem de usuário.

## Quem acessa
Roles e permissões (owner/admin/operador/super_admin).

## Layout da tela
- Cabeçalho: …
- Barra lateral / filtros: …
- Conteúdo principal: …
- Ações primárias: botão X faz Y.

## O que dá para fazer aqui
Lista de ações com: nome do botão/menu → o que acontece → onde aparece o resultado.

## Campos e seus significados
Tabela campo → o que é → exemplo → validações visíveis.

## Atalhos e dicas
Atalhos de teclado, drag-and-drop, multi-seleção.

## Erros comuns nesta tela
Mensagem exibida → causa provável → como resolver (link p/ troubleshooting).

## Relacionado
Links para journeys e outras pages.
```

## Template de cada `journeys/*.md`

```text
# [Jornada]

## Quando usar
…

## Pré-requisitos
…

## Passo a passo
1. Vá em `/rota` …
2. Clique em "…"
3. Preencha … (campos obrigatórios em negrito)
4. Confirme em "…"

## Como saber que deu certo
Sinais visuais (toast, badge, item na lista…).

## Se algo der errado
Link para troubleshooting.
```

## Fonte por arquivo

Cada doc é gerada cruzando:

- **Rotas** em `src/App.tsx`
- **Páginas** em `src/pages/**`
- **Componentes** da feature (`src/components/<area>/*`)
- **Hooks** relevantes (para entender o que cada botão chama)
- **Docs existentes**: `docs/features/*`, `docs/maps/*`, `docs/flows/*`, `docs/integracao/*`
- **Mensagens de erro PT-BR** já no código (busca por `toast(`, `setError(`, mensagens em forms)

Sem inventar comportamento — só descrever o que existe.

## Como o agente vai consumir

Adiciono em `docs/support/README.md` uma seção **"Como usar esta KB"** com:
- Instrução de priorizar `pages/<rota>.md` quando o usuário citar uma tela
- Usar `journeys/*` para perguntas "como eu faço X"
- Cair em `troubleshooting/*` para mensagens de erro
- `faq.md` para perguntas curtas
- Glossário em `00-conceitos.md` para vocabulário

Ingestão automática no `ai_documents` fica **fora desta entrega** (você pediu só markdown em `docs/support/`). Posso adicionar depois se quiser.

## Entrega em fases

Volume grande (~35 arquivos). Sugiro entregar em 4 fases para revisão incremental:

| Fase | Entrega |
|---|---|
| 1 | `README.md`, `00-conceitos.md`, `01-primeiros-passos.md`, `faq.md` (esqueleto) + templates |
| 2 | `pages/` — Inbox, Kanban, Lead Drawer, Tasks, Settings, Team, Admin, AI Agents/Wizard, AI Hub |
| 3 | `pages/` — Email (todas), Tracking, Metrics, Automations, Sequences, Broadcasts, Templates, AI Insights/Memories |
| 4 | `journeys/` (12 jornadas) + `troubleshooting/` (6 áreas) + revisão final do `README.md` + atualizar `docs/MAP.md` referenciando `docs/support/` |

Cada fase fecha com commit próprio e você pode pedir ajustes antes de eu seguir.

## Manutenção

Adicionar regra em `docs/conventions/COMMIT_PR.md`: PR que muda texto visível, label de botão, ou adiciona/remove rota **deve** atualizar o `docs/support/pages/<rota>.md` correspondente — mesmo padrão dos mapas. Atualizo essa convenção na Fase 4.

## Fora de escopo (confirme se quer incluir)

- Ingestão automática em `ai_documents` (criar agente "suporte" + edge function de sync)
- Screenshots/GIFs das telas
- Versão para cliente final (não-operador)
- Tradução EN