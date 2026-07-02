---
title: "Agente Atendimento Febracis — Documentação viva"
topic: ai
kind: feature
audience: agent
updated: 2026-06-30
summary: "Documentação completa do agente de atendimento Febracis: identidade, configuração, fluxo, comportamento observado em produção, métricas e pontos de melhoria."
code_refs:
  - supabase/functions/ai-auto-reply/
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/clinic-gemini.ts
  - src/components/agents/
related_docs:
  - docs/agents/FEBRACIS_PRI.md
  - docs/agents/FEBRACIS_ROADMAP.md
  - docs/agents/TRAINING_FRAMEWORK.md
---

# Agente "Atendimento Febracis" — Documentação Viva

> Doc complementar à `FEBRACIS_PRI.md` (configuração técnica) e à `FEBRACIS_ROADMAP.md` (próximos passos). Este arquivo é o **estado vivo** do agente: como ele se comporta hoje, o que aprendemos observando conversas reais, e onde estão as alavancas de refinamento.

---

## 1. Identidade

| | |
|---|---|
| **Nome** | Atendimento Febracis |
| **Persona** | Vendedor WhatsApp do Paulo Vieira (Febracis) |
| **Produto** | Evento presencial "O Poder da Ação — Edição EUA", 25/jul/2026, Orlando |
| **Ofertas ativas** | Black VIP US$ 497 · Bronze US$ 197 |
| **Canal** | WhatsApp (Evolution API) |
| **Objetivo único** | Conduzir o lead até clicar no link Stripe correto |
| **Linguagem** | PT-BR informal-profissional |

## 2. Stack técnica (resumo)

| | |
|---|---|
| Agent ID | `907eb5e2-cb19-4d54-a9d3-97821374cd84` |
| Tenant | `febracis-pri` (`ab2f4484-886c-48f2-bfc6-0651d062c575`) |
| Provider | Google Gemini BYOK (`google/gemini-2.5-flash`) |
| Temperature | 0.7 |
| Debounce | 4s |
| Max iterations / tool calls | 6 / 12 |
| Memória | `agent_memory` (use_memory=true) |
| RAG | desligado (corpus cabe inteiro no prompt — 4,2k tokens) |
| Tools | nenhuma (`tools=[]`) |
| Stage move | desabilitado (`stages_enabled=false`) |
| Binding | `stage_ai_defaults` — definido por estágio via Kanban → Editar etapa → IA |

Configuração canônica e racional do "por que sem RAG", "por que Gemini" etc. → `FEBRACIS_PRI.md`.

## 3. Fluxo da mensagem em produção

```text
Lead manda msg WhatsApp
  ↓
Evolution → whatsapp-webhook → tabela messages
  ↓ (debounce 4s para agrupar rajada)
ai-auto-reply é acionado
  ├─ checa stage_ai_defaults (binding ativo? agente desse stage?)
  ├─ checa clinics.settings.ai_target_pipeline_ids (pipeline permitido?)
  ├─ monta contexto: histórico + custom_fields + memória + system_prompt
  ├─ chama Gemini BYOK
  │     └─ fallback OpenAI em 429/timeout
  ├─ valida resposta (Fase 2 do roadmap, ainda não ativo)
  └─ send-message → Evolution → WhatsApp
  ↓
Telemetria: ai_usage + agent_traces + pipeline_run_items
```

## 4. Comportamento observado (smoke test 30/06)

Conversa real do Marco MK testando como lead frio — prints anexados na thread.

### 4.1 O que está funcionando

- **Abertura proativa.** Quando o lead pediu "saber mais sobre o evento", o agente já entregou: o que é, quando, onde, oferta principal (VIP), valor, link, e fechou com pergunta de avanço. Cumpre a §1 e §8 do playbook (não esperar o lead pedir detalhes).
- **Roteamento de objeção.** "Tem outro setor mais barato?" → o agente acolheu, apresentou Bronze com entregáveis, valor, garantia e link, fechou com pergunta. Cumpre a §15 (objeção de preço → Bronze).
- **Roteamento sem objeção.** Manteve VIP como oferta default no primeiro contato. Não jogou Bronze cedo.
- **Garantia usada como redução de risco.** Quando o lead disse "vou pensar", o agente trouxe a garantia de 7 dias sem pressão alta.
- **Endereço entregue na hora.** "Onde é?" → "3750 W Colonial Dr, FL 32808". Sem enrolar.

### 4.2 O que precisa melhorar (gera trabalho na Fase 2/3)

1. **Mensagens longas demais.** Cada turn em 3–5 balões, vários com 2+ frases. Em WhatsApp comercial isso cansa. Meta: 1–2 frases por balão, no máximo 3 balões por turn.
2. **Emoticons fora de tom.** 🙌 😊 aparecem em quase todo turn. Pedido do dono: zero emoticons.
3. **Pouca técnica de copy.** O agente é informativo mas não usa gatilhos de copy bem afiados (escassez quantificada além do "50 cadeiras", urgência por data, prova social, contraste preço-valor, ancoragem, perguntas que abrem loop).
4. **Pergunta de fechamento previsível.** Quase sempre alguma variação de "quer que eu te ajude a finalizar agora?". Falta variedade do playbook (§11).
5. **Sem follow-up planejado.** "Vou pensar e te falo" → o agente respondeu uma vez e parou. Não há cadência de retomada.
6. **Não usa o nome do lead.** Personalização básica ausente.
7. **Falta micro-CTA antes do link.** Joga o link Stripe direto sem o "veja só, é simples: clica, escolhe forma de pagamento, em 1 minuto tá garantido" — atrito mental.

## 5. Métricas-chave a acompanhar

Todas disponíveis nas tabelas existentes (sem trabalho novo de backend):

| Métrica | Fonte | Meta |
|---|---|---|
| % de conversas que recebem link Stripe | `agent_traces` + regex no output | > 80% |
| Tempo até primeiro link (turns) | `agent_traces` ordenado por thread | ≤ 2 turns |
| Tamanho médio da resposta (chars) | `ai_usage.completion_tokens` | < 350 chars |
| Taxa de violação de guardrail (depois da Fase 2) | `agent_traces.reason='guardrail_violation'` | 0% |
| Custo por conversa (USD) | `ai_usage` | acompanhar baseline |
| Conversas que escalaram p/ humano | `agent_traces.reason='transfer_to_human'` | rastrear, sem meta fixa |

Painel sugerido: `/admin/pipeline-health` já tem o esqueleto; um chart por agente em `/ai/agents/:id` resolveria — está na pendência.

## 6. Onde investigar quando algo der errado

| Sintoma | Olhar primeiro |
|---|---|
| Agente não responde | `stage_ai_defaults` (binding ligado?), `ai_target_pipeline_ids`, `ai_agents.silent`, `ai_agents.enabled` |
| Resposta veio do provider errado | Logs de `ai-auto-reply` — campo `ai.provider`. Esperado: `google`. Se vier `lovable`, BYOK não carregou. |
| 429 ou quota | `clinic_secrets.gemini_api_key` válida? Quota Gateway no admin → "Quota Guard" |
| Resposta fora do playbook | `agent_traces` da thread + diff contra `ai_agents.system_prompt` |
| Link Stripe errado | grep no `system_prompt` pelos dois IDs (`9B69AT4ha6iQ0dg78H7Vm1`, `cNi8wP4haaz69NQ3Wv7Vm18`) |

---

# Agente Assistente (Alfred / Support)

> Documentado aqui por enquanto a pedido do dono. Mover para `docs/agents/SUPPORT_AGENT.md` quando o conteúdo crescer.

## A. Identidade

| | |
|---|---|
| **Nome interno** | Alfred / Support Chat |
| **Papel** | Assistente de uso do CRM para o operador (não para lead final) |
| **Escopo** | Tirar dúvida sobre tela, fluxo, configuração, diagnosticar erro runtime |
| **Onde aparece** | FAB de suporte (canto inferior direito) + `src/components/support/SupportChatFab.tsx` |
| **Backend** | `supabase/functions/support-chat/` |
| **Config** | `support_agent_config` (singleton) |

## B. Configuração

- Provider/model/temperature/limites vivem em `support_agent_config` (editável no admin → Support).
- System prompt default: `supabase/functions/_shared/support-prompt.ts` (`DEFAULT_SUPPORT_SYSTEM_PROMPT`).
- KB: manifest gerado por `scripts/docs-sync.mjs` em `supabase/functions/_shared/support-kb-manifest.ts`. Fonte é `docs/support/` + arquivos com frontmatter em `docs/`.
- Cap de gasto mensal: `support_chat_spent_this_month_usd` (RPC).

## C. Regras anti-alucinação críticas (já no prompt)

- Toda rota mencionada (`/...`) tem que vir literal da KB recuperada — proibido inventar.
- Tracking/pixel → sempre `/settings/integration`. Nunca `/tracking`.
- Auditoria → `/tracking-debug` (com hífen).
- Sem resposta na KB → declarar "não tenho essa informação" e oferecer abrir chamado.

## D. Capacidades especiais

- `link_to_route` + `highlight_element` — guia o usuário visualmente para o botão certo.
- `start_step_by_step` — entrega um passo por vez, espera "feito".
- `report_bug` — quando o usuário descreve bug real.
- Lê contexto da tela (rota atual, erros de console, requests falhados) e comenta antes de instruir.

## E. Pontos abertos

- Não há painel de qualidade dele (igual ao do Febracis). Score, latência, custo ainda só via SQL.
- Reembedding manual quando docs mudam — `docs-sync` regenera o manifest, mas re-embed do conteúdo pede ação no admin.
- Não usa as técnicas de copy do framework — é assistente, não vendedor. Tom direto/passo a passo já é o correto para ele.

---

## Para onde ir depois

- **Refinar este agente** → `docs/agents/FEBRACIS_ROADMAP.md` (atualizado na mesma leva)
- **Treinar qualquer agente novo** → `docs/agents/TRAINING_FRAMEWORK.md`
- **Configuração canônica** → `docs/agents/FEBRACIS_PRI.md`
