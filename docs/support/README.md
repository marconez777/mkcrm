# 🆘 Suporte — KB de Interface e Usabilidade

> **Para quê:** base de conhecimento usada para **treinar um agente de IA de suporte** ao cliente (admin/operador de clínica). Diferente de `docs/features/*` (conceitual) e `docs/maps/*` (onde editar código), este diretório responde **"como o usuário faz X na tela"** em PT-BR claro, sem jargão técnico.
>
> **Público:** admin/operador da clínica. Não é versão para usuário final.
>
> **Última atualização:** 2026-06-03 (Fase 1 — esqueleto + templates).

---

## Como o agente deve usar esta KB

Ordem de prioridade ao responder uma dúvida:

1. **Usuário citou uma tela/rota** (`/inbox`, "Kanban", "página de campanhas") → abrir `pages/<rota>.md`.
2. **Usuário pergunta "como faço X"** (criar agente, enviar campanha, conectar WhatsApp) → abrir `journeys/<tema>.md`.
3. **Usuário descreve um erro ou mensagem** ("convite expirado", "campanha pausou", "QR não aparece") → abrir `troubleshooting/<área>.md`.
4. **Pergunta curta de vocabulário** ("o que é lead?", "o que é stage?") → `00-conceitos.md`.
5. **Pergunta direta e frequente** → `faq.md`.

Sempre responder em **português do Brasil**, frases curtas, sem termos como "RLS", "edge function", "RPC", "migration". Falar como o usuário fala: "tela", "botão", "menu", "lista", "cartão".

Quando o usuário descreve um problema cuja causa pode ser limite de plano, sempre verificar se há link para `troubleshooting/limites-planos.md`.

---

## Estrutura

```text
docs/support/
├── README.md                   # você está aqui
├── 00-conceitos.md             # glossário de usuário
├── 01-primeiros-passos.md      # login, onboarding, equipe
├── faq.md                      # perguntas curtas e frequentes
├── _templates/                 # gabaritos para novas páginas/jornadas
│   ├── page.md
│   └── journey.md
├── pages/                      # 1 arquivo por rota (Fases 2 e 3)
├── journeys/                   # jornadas transversais (Fase 4)
└── troubleshooting/            # mensagens de erro e como resolver (Fase 4)
```

## Status de entrega

| Fase | Conteúdo | Status |
|---|---|---|
| 1 | Esqueleto, conceitos, primeiros-passos, FAQ, templates | ✅ |
| 2 | `pages/` — Inbox, Kanban, Lead Drawer, Tasks, Settings, Team, Admin, AI Agents/Wizard, AI Hub | ✅ |
| 3 | `pages/` — Email completo, Tracking, Metrics | ✅ |
| 4 | `pages/` — Automations, Sequences, Broadcasts, Templates, AI Insights, Agent Memories | ✅ |
| 5 | `journeys/`, `troubleshooting/`, regra em `COMMIT_PR.md` | ⏳ |

## Regra de manutenção

PR que altera **texto visível, label de botão, fluxo de tela, ou adiciona/remove uma rota** DEVE atualizar o `docs/support/pages/<rota>.md` correspondente no mesmo PR. KB desatualizada = agente que mente para o cliente.

(A regra formal será adicionada em `docs/conventions/COMMIT_PR.md` na Fase 4.)
