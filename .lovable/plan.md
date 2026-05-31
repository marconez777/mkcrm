## Objetivo

Revisar a página institucional (`src/components/site/*`) usando a documentação real do produto (`docs/`) para:
1. Remover menções à marca **"Resend"** no site (o usuário final não configura Resend — é detalhe de infra interno). **Não mexer** em "sua API" do Pricing (refere-se a OpenAI/Gemini e WhatsApp do próprio cliente — modelo de cobrança).
2. Incluir capacidades de IA hoje invisíveis no site: agente que **move cards no pipeline**, agente que **resume conversas**, agente **classificador silencioso (watcher)**, **memória do agente**, **RAG**, **transferência para humano**, **controle de custo de IA**.
3. Enriquecer descrições das features existentes (Inbox, Kanban, Sequences, Automations, Broadcasts, Email, Tracking, Tasks, Forms, Engajamento) com elementos concretos puxados dos docs.
4. Preparar um **documento-base** (`docs/site/FEATURE_PAGES.md`) que servirá de fonte única para gerar páginas `/features/*` dedicadas depois.

Trabalho dividido em 4 etapas incrementais.

---

## Etapa 1 — Limpeza "Resend" (escopo restrito)

Alvo: tirar a marca "Resend" do site público. **Pricing fica intocado** — "sua API" no Starter refere-se a OpenAI/Gemini/WhatsApp do próprio cliente, e os limites (ex.: 1.000 emails/dia) ficam porque refletem custo real.

- `src/components/site/Integrations.tsx`
  - Remover o card **"Resend"**.
  - Substituir por card **"Email marketing nativo"** (entregabilidade gerenciada, domínio próprio, opt-out automático, métricas de abertura/clique/bounce).
- `src/components/site/Services.tsx`
  - Card **04 "Disparos em massa responsáveis"**: trocar a tag `Resend` por `Entregabilidade gerenciada`. Resto do texto continua igual.
- **`src/components/site/Pricing.tsx`**: **sem mudanças**.

---

## Etapa 2 — Reescrever copy das features de IA (`About.tsx` + `Features.tsx`)

Hoje o site fala "Agentes de IA" de forma genérica. Os docs (`docs/edge-functions/AI.md`, `docs/flows/AI_AGENT_LOOP.md`) mostram 3 papéis distintos que precisam aparecer:

1. **Agente vendedor (vocal)** — responde no WhatsApp 24/7, usa RAG sobre a base de conhecimento da clínica, executa tools (criar agendamento, taggear, anotar nota, enviar mídia, **transferir para humano**).
2. **Agente classificador / watcher (silencioso)** — observa cada conversa (inclusive as do atendente humano) e **move o lead de estágio no Kanban automaticamente**, adiciona tags, cria tarefas, anota fatos. Não responde ao lead.
3. **Agente de resumo** — gera resumo curto (status, interesse, próximo passo) de cada conversa, exibido no LeadDrawer/Inbox. Vem **habilitado por padrão**.

Mudanças:

- `src/components/site/About.tsx`
  - Pilar "Inteligência embarcada" passa a citar explicitamente: "agentes que **respondem**, agentes que **organizam o funil** e agentes que **resumem** cada conversa para você abrir o lead já sabendo o contexto".
- `src/components/site/Features.tsx`
  - Card "IA" (`featureIa`): atualizar título e body para citar "move cards no Kanban", "resumo automático de cada conversa", "controle de orçamento mensal".
  - Manter 3 cards no total, só refinar texto.

---

## Etapa 3 — Nova seção de capacidades + revisão Services/Integrations

Adicionar uma **seção nova** entre `Features` e `Services` chamada **"Tudo o que vem dentro"** (`src/components/site/Capabilities.tsx`), em grid denso de 8–12 itens curtos, cobrindo o que hoje não é mencionado:

- **Inbox unificado** (multi-atendente, áudios, mídias, encaminhar, agendar mensagem, respostas rápidas)
- **Pipeline Kanban** com múltiplos funis e filtros por origem/UTM/atendente
- **Tarefas estilo Trello** (colunas, labels, checklists, anexos)
- **Sequências (drip)** com janelas de envio e parada automática ao receber resposta
- **Automações** event-driven (`no_reply_after`, `stage_idle`, `before_appointment`)
- **Disparos em massa** com janela, rotação e opt-out
- **Email marketing** (templates, segmentos, campanhas, automações) — entregabilidade incluída
- **Tracking** de visitantes (UTM, gclid, fbclid, landing) ligado ao lead
- **Formulários externos** com atribuição automática
- **Campos personalizados** por clínica
- **Métricas de engajamento** (taxas de resposta por sequência/broadcast)
- **Controle de custo de IA** (orçamento mensal por clínica, alerta automático)

Integrar no `src/pages/site/MarketingSite.tsx`.

Refinos paralelos:
- `Services.tsx`: ajustar texto dos 6 cards usando vocabulário dos docs (ex.: "Automação de funil" → mencionar `stage_change`, `pipeline_enter`, `no_reply_after`).
- `Integrations.tsx`: além da troca do Resend (etapa 1), revisar lista — manter WhatsApp (Evolution + Cloud API), modelos de IA (Gemini, GPT, Claude), Webhooks/API, Google Calendar, pagamentos, Ads. Considerar adicionar **MCP servers** (extensão de tools por clínica).

---

## Etapa 4 — Documento-base para páginas de features futuras

Criar `docs/site/FEATURE_PAGES.md` (fonte única para gerar páginas `/features/<slug>` numa iteração futura — fora deste plano).

Estrutura do doc:

```text
docs/site/
└── FEATURE_PAGES.md      índice + template
```

Cada feature segue o mesmo template:

```text
## <Nome da feature>
- slug: /features/<slug>
- hero_title:
- hero_subtitle:
- bullets (3-5):
- como_funciona (parágrafo curto):
- diferenciais:
- prints_sugeridos:
- faq (3 perguntas):
- cta:
- fontes_doc: links para docs/* usados
```

Features cobertas no doc inicial (1 bloco cada):

1. Inbox WhatsApp multi-atendente
2. Pipeline Kanban inteligente
3. Agente IA vendedor
4. Agente IA classificador (move funil)
5. Resumo automático de conversa
6. Sequências (drip)
7. Automações event-driven
8. Disparos em massa WhatsApp
9. Email marketing (entregabilidade incluída)
10. Tracking de visitantes e atribuição
11. Formulários externos
12. Tarefas (board)
13. Métricas de engajamento
14. Controle de custo de IA

Cada bloco preenchido com base em:
`docs/OVERVIEW.md`, `docs/edge-functions/AI.md`, `docs/flows/AI_AGENT_LOOP.md`, `docs/features/SEQUENCES_AUTOMATIONS.md`, `docs/features/BROADCASTS.md`, `docs/features/ENGAGEMENT.md`, `docs/features/EMAIL_CAMPAIGNS.md`, `docs/features/FORMS.md`, `docs/edge-functions/TRACKING.md`, `docs/integrations/EVOLUTION_API.md`, `docs/integrations/LOVABLE_AI.md`, `docs/operations/COSTS_LIMITS.md`.

Sem criar as páginas `/features/*` ainda — só o doc.

---

## Detalhes técnicos

- Apenas edições de UI/copy em `src/components/site/*` + `src/pages/site/MarketingSite.tsx` + novo `src/components/site/Capabilities.tsx` (Etapa 3).
- Novo doc: `docs/site/FEATURE_PAGES.md`.
- Sem mudanças em backend, schema, edge functions ou design tokens. Estilo segue `_anim.tsx` + tokens `site-*`.
- Cada etapa é um commit lógico independente — dá para parar entre etapas e revisar.

## Fora de escopo

- Construir as páginas `/features/<slug>` (próxima iteração, baseada em `FEATURE_PAGES.md`).
- Qualquer mudança em `Pricing.tsx` (incluindo textos "sua API" e limites).
- Tradução / i18n.
- Novos assets/imagens.