---
title: "Framework de Treinamento de Agentes de IA"
topic: ai
kind: reference
audience: agent
updated: 2026-06-30
summary: "Estrutura reutilizável para criar, treinar e refinar qualquer agente de IA da ferramenta — da identidade ao loop de melhoria contínua."
code_refs:
  - supabase/functions/_shared/
  - src/components/agents/
  - src/pages/ai/AgentWizard.tsx
related_docs:
  - docs/agents/FEBRACIS_ATENDIMENTO.md
  - docs/agents/FEBRACIS_ROADMAP.md
---

# Framework de Treinamento de Agentes de IA

Estrutura padrão que **todo agente novo da ferramenta** deve seguir. Pensado a partir do caso Febracis, mas independente de tenant/produto.

Use como checklist ao criar agente no Agent Wizard. Use como roteiro ao refinar agente existente.

---

## Camadas de um agente

Pense em 6 camadas, do mais estável (raro mudar) ao mais volátil (muda toda semana):

```text
┌─────────────────────────────────────────────┐
│ 6. LOOP DE MELHORIA   (eval, A/B, métrica)  │ ← semanal
├─────────────────────────────────────────────┤
│ 5. GUARDRAILS         (validação no envio)  │ ← muda quando descobre buraco
├─────────────────────────────────────────────┤
│ 4. ESTILO + COPY      (frases, tom, gatilhos)│ ← muda com smoke test
├─────────────────────────────────────────────┤
│ 3. CONHECIMENTO       (produto, FAQ, preço) │ ← muda com o produto
├─────────────────────────────────────────────┤
│ 2. PROCESSO           (fluxo, roteamento)   │ ← muda com a operação
├─────────────────────────────────────────────┤
│ 1. IDENTIDADE         (quem é, objetivo)    │ ← praticamente fixo
└─────────────────────────────────────────────┘
```

Treinar um agente é editar essas camadas — não é "ensinar como criança". É escrever, testar, medir.

---

## 1. Identidade (define uma vez)

Resposta curta a 6 perguntas — vai como bloco fixo no topo do system prompt:

1. **Quem você é?** Nome + papel ("vendedor WhatsApp da X").
2. **Para quem você fala?** Perfil do lead.
3. **Qual o único objetivo?** Um verbo + um resultado mensurável ("conduzir o lead até clicar no link Stripe").
4. **O que você NUNCA faz?** Lista curta de proibições absolutas.
5. **Como você fala?** Idioma, registro (formal/informal), comprimento máximo.
6. **Para quem você transfere?** Critério explícito de escalar humano.

## 2. Processo

Mapeia o fluxo do lead — onde o agente atua, onde para.

- **Onde entra?** Stage(s) do pipeline com binding em `stage_ai_defaults`.
- **Onde sai?** Critérios para mover o lead (se `stages_enabled=true`) ou para parar de responder.
- **Quando escala?** Padrões de mensagem → `transfer_to_human`.
- **Quando silencia?** Lista de gatilhos para o agente parar (lead pediu humano, lead xingou, lead pediu cancelamento).

## 3. Conhecimento

Decisão de arquitetura:

| Tamanho do corpus | Estratégia |
|---|---|
| < 10k tokens | Inline no system prompt. Zero RAG. |
| 10k–100k tokens | RAG com `ai_documents` + embeddings. |
| > 100k tokens | RAG + chunk hierárquico + reranker. |

Para inline: cobrir 100% do material, condensado mas sem perder regra de negócio (preço, link, política).
Para RAG: cada documento com `kind` claro (produto / FAQ / objeção / tom).

## 4. Estilo + Copy (a camada mais subestimada)

A diferença entre agente medíocre e agente bom mora aqui. Bloco padrão:

```text
ESTILO:
- Máximo N palavras por frase. N=14 funciona em chat.
- Máximo M frases por balão. M=2.
- Máximo K balões por turn. K=3 em WhatsApp, K=1 em formulário.
- Emoticons: [permitidos | proibidos]. Default proibidos em B2B.
- Use o nome do lead 1x por turn quando disponível.
- Não repita a mesma estrutura de pergunta duas vezes seguidas.

TÉCNICAS DE COPY (use, não cite):
- Escassez quantificada + temporal juntas.
- Ancoragem: valor maior antes do menor.
- Contraste preço/valor: preço sempre colado a entrega concreta.
- Loops abertos: terminar com pergunta que precise ser respondida.
- Prova social leve quando couber.
- Redução de risco (garantia) só sob hesitação.
- Sim fácil: primeiro fechamento é micro-compromisso.
- Micro-CTA antes de qualquer link.

PROIBIÇÕES:
- Não invente preço, data, endereço, benefício, bônus.
- Não ofereça forma de pagamento fora do roteiro.
- Não diga "vou verificar e te retorno".
```

## 5. Guardrails determinísticos

Validador entre o output do modelo e o envio real (`agent-response-validator.ts`). Bloqueia o que o prompt sozinho não garante:

- Whitelist de URLs (links de pagamento, agendamento).
- Whitelist de preços/valores.
- Regex de termos proibidos (moeda errada, forma de pagamento errada, concorrente).
- Limite de comprimento por balão.
- Bloqueio de PII vazada (CPF, cartão).

Quando o validador bloqueia: registra em `agent_traces.reason='guardrail_violation'` e reenvia ao modelo com instrução corretiva — não envia ao lead.

## 6. Loop de melhoria contínua

Sem isso, o agente degrada. Ciclo semanal:

1. **Personas de teste fixas** (3–5). Rodam toda segunda 8h via pg_cron contra o agente em produção. Resultado em `agent_evals`.
2. **Eixos de score**:
   - cobertura do playbook (% das regras tocadas);
   - latência média;
   - % de turns com micro-CTA;
   - % com link entregue corretamente;
   - violações de guardrail.
3. **Painel** em `/ai/agents/:id/evals` com chart semanal + drill-down nos transcripts ruins.
4. **A/B de prompt** via `agent_prompt_versions`. 10% dos leads novos por 7 dias. KPI primário: ação que importa (clique no link, agendamento, resposta humana).
5. **Trigger de re-treino**: alerta no admin quando score cair >15% semana a semana.

---

## Receita prática — agente novo do zero

1. **Briefing** (30 min com o cliente): preencher as 6 perguntas da camada 1.
2. **Conhecimento**: receber material bruto, condensar, decidir inline vs RAG.
3. **Prompt v1**: identidade + estilo padrão + conhecimento + 3 técnicas de copy mais relevantes ao produto. **Sem emoticons por default.**
4. **Personas v1**: 3 perfis (entusiasta · objeção de preço · cético). Rodar no Test Lab.
5. **Smoke test real**: alguém da equipe finge ser lead, conversa por WhatsApp. Anotar tudo que destoa.
6. **Iterar v2** sobre estilo + copy (a camada que mais aparece no smoke test).
7. **Guardrails** baseados no que o modelo errou no smoke (link errado? preço errado? oferta inventada?).
8. **Bind no stage** de entrada, `stages_enabled=false` no início (só responde, não move).
9. **Acompanhar 7 dias** com revisão diária dos transcripts.
10. **Ligar A/B + eval automático** quando o score estabilizar acima do mínimo.

---

## Anti-padrões (não fazer)

- ❌ Despejar PDF de 80 páginas no prompt sem condensar.
- ❌ "Seja simpático e prestativo" como única instrução de estilo.
- ❌ Confiar só no prompt para evitar link errado — use guardrail.
- ❌ Ajustar prompt sem rodar persona de teste antes/depois.
- ❌ Mexer em vários eixos ao mesmo tempo (estilo + copy + conhecimento) — não dá pra atribuir o que melhorou ou piorou.
- ❌ Deixar agente em produção sem eval semanal. Degradação silenciosa.
- ❌ Copiar BYOK key entre tenants sem audit log.

---

## Templates reutilizáveis

Quando criar agente novo, copiar de:

- **Bloco de estilo** → seção 4.1 de `docs/agents/FEBRACIS_ROADMAP.md`.
- **Bloco de copy** → seção 4 deste arquivo.
- **Banco de fechamentos** → seção 4.2 de `docs/agents/FEBRACIS_ROADMAP.md` (adaptar tom).
- **Validador** → `supabase/functions/_shared/agent-response-validator.ts` (quando existir — Fase 2 do roadmap Febracis).

Manter este framework atualizado conforme novos agentes ensinem coisas novas.
