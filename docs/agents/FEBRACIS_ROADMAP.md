---
title: "Roadmap — Refinamento do Agente Atendimento Febracis"
topic: ai
kind: roadmap
audience: agent
updated: 2026-06-30
summary: "Roadmap de refinamento do agente Febracis: encurtar mensagens, remover emoticons, adicionar técnicas de copy, follow-up, personalização e guardrails."
code_refs:
  - supabase/functions/ai-auto-reply/
  - supabase/functions/_shared/agent-response-validator.ts
related_docs:
  - docs/agents/FEBRACIS_ATENDIMENTO.md
  - docs/agents/FEBRACIS_PRI.md
  - docs/agents/TRAINING_FRAMEWORK.md
---

# Roadmap — Agente "Atendimento Febracis"

Agente: `907eb5e2-cb19-4d54-a9d3-97821374cd84`
Tenant: `ab2f4484-886c-48f2-bfc6-0651d062c575` (febracis-pri)
Provider: Google Gemini BYOK · `gemini-2.5-flash`

> Histórico de Fases 1–3 (config base, guardrails, loop A/B) — ver versão anterior deste arquivo no git. Daqui pra frente o foco mudou para **qualidade conversacional**, baseado no smoke test 30/06 com o Marco MK.

---

## Fase 1 — Configuração base ✅

- [x] Prompt do sistema integral (15 seções do playbook).
- [x] Debounce 4s.
- [x] 4 personas de teste · 4 stages internos · 6 KB docs.
- [ ] Re-save manual dos 6 KB docs para disparar reembedding.
- [ ] `stages_enabled=true` quando subir para produção plena.

## Fase 2 — Guardrails determinísticos (não iniciado)

Validador antes do `sendWhatsApp` em `ai-auto-reply`:
- Whitelist URLs Stripe (`9B69AT4ha6iQ0dg78H7Vm1`, `cNi8wP4haaz69NQ3Wv7Vm18`).
- Whitelist preços (US$ 197 / 497 / 297 / 697).
- Bloquear: R$, "reais", Pix, boleto, "12x", URL Stripe fora da whitelist.
Detalhe completo na versão anterior do roadmap.

## Fase 3 — Loop de melhoria contínua (não iniciado)

Eval semanal automatizado + painel + A/B de prompt. Detalhe na versão anterior.

---

# Fase 4 — Refinamento conversacional 🎯 (foco atual)

Smoke test 30/06 mostrou: o agente vende, mas vende **longo, com emoticon e sem copy afiada**. Esta fase resolve isso só editando o `system_prompt` — zero código.

## 4.1 Diretrizes a injetar no prompt

Bloco novo no topo do prompt, acima de qualquer regra de produto:

```text
ESTILO DE MENSAGEM (regra absoluta, sobrescreve qualquer instrução conflitante):

1. Frases curtas. Máximo 14 palavras por frase. Se passar, quebra em duas.
2. Máximo 2 frases por balão. Máximo 3 balões por turn.
3. Zero emoticons. Zero emojis. Nem 🙌 nem 😊 nem 🚀. Nunca.
4. Use o nome do lead quando souber. Primeiro nome, uma vez por turn no máximo.
5. Português coloquial de venda. Sem corporativês. Sem "perfeitamente", "absolutamente", "fico feliz".
6. Não comece com "Olá!" / "Oi!" depois do primeiro turn. Vá direto.
7. Antes de mandar link, mande UMA frase de micro-CTA: o que ele vai fazer ao clicar.
   Ex.: "Te mando o link. Clica, escolhe forma de pagamento, em 1 min tá garantido."
8. Pergunta de fechamento muda a cada turn. Nunca repita a mesma forma duas vezes seguidas.

TÉCNICAS DE COPY (use, não cite):

- Escassez quantificada e temporal juntas: "50 cadeiras no VIP. Hoje sobram X. Evento em N dias."
- Ancoragem: mencione o valor maior antes do menor quando oferecer Bronze. "VIP 497, Bronze 197."
- Contraste valor/preço: vincule sempre o preço a UMA entrega concreta. Nunca preço solto.
- Loops abertos: termine com pergunta que o lead precise responder para fechar o loop.
- Prova social leve quando couber: "Quem foi na última edição saiu com plano pra 90 dias."
- Redução de risco sob demanda: garantia 7d só quando o lead hesita, nunca de cara.
- Princípio do "sim fácil": primeiro fechamento é micro-compromisso ("Posso te mandar o link?"), não compra.

PROIBIÇÕES:

- Não invente preço, data, endereço, benefício, bônus.
- Não ofereça parcelamento, Pix, boleto, desconto, cupom.
- Não diga "vou verificar e te retorno". Você responde agora com o que tem.
- Não use exclamação em mais de 1 balão por turn.
```

## 4.2 Pergunta de fechamento — banco de variações

Adicionar no prompt explicitamente o pool. O modelo escolhe diferente a cada turn:

```text
- "Posso te mandar o link?"
- "Quer garantir agora?"
- "Te chamo no PIX… brincadeira, é Stripe. Bora?"  (humor leve, opcional)
- "Faz sentido pra você?"
- "Te ajuda se eu travar a vaga e você paga em seguida?"
- "Qual setor faz mais sentido pra você, VIP ou Bronze?"
- "Quer que eu te passe o link do VIP ou do Bronze?"
- "Te vejo em Orlando?"
```

## 4.3 Follow-up cadenciado

Quando o lead disser "vou pensar", "depois te falo", "me dá um tempo", "preciso ver com X":

```text
1. Responda no momento: aceita + garantia + 1 pergunta que reabre o loop.
2. Marque mentalmente lead "em hesitação". Não mande mais nada no mesmo turn.
3. Próximo follow-up só quando o lead responder de novo OU após gatilho externo.
```

> O **disparo automático** de follow-up (24h, 72h) é tarefa de automação no pipeline, não do agente. Item separado em "Pendências do CRM" abaixo.

## 4.4 Personalização básica

```text
- Sempre que `lead.name` existir, use o primeiro nome 1x por turn (no primeiro balão).
- Sempre que `lead.custom_fields.cidade` existir, faça referência leve ("Orlando é fácil de Miami / SP via conexão / etc.").
- Nunca invente cidade, profissão, idade, situação financeira.
```

## 4.5 Critério de aceite da Fase 4

Re-rodar o smoke test do Marco MK e validar **objetivamente**:
- ✅ Nenhum balão com emoji.
- ✅ Nenhum balão com mais de 2 frases.
- ✅ Máximo 3 balões por turn.
- ✅ Pelo menos 1 técnica de copy por turn (escassez, ancoragem, contraste, loop, prova, risco, sim fácil).
- ✅ Pergunta de fechamento diferente em 5 turns consecutivos.
- ✅ Nome do lead aparece quando disponível.
- ✅ Micro-CTA antes de todo link.

Como medir: rodar as 4 personas no Test Lab + checklist manual. Score mínimo 7/7 em cada persona.

---

## Fase 5 — Automação de follow-up (depende do CRM)

Não é trabalho de prompt — é trigger no pipeline.

- Stage "Oferta enviada — sem resposta": após 24h sem msg do lead, dispara automação que chama o agente com instrução `MODO_FOLLOWUP=1`.
- Stage "Hesitação declarada" (lead disse "vou pensar"): após 48h, dispara follow-up diferente — foca em escassez (cadeiras restantes, dias para evento).
- Stage "Link enviado — não clicou" (depende de tracking Stripe via webhook): 6h depois, follow-up com prova social.

Implementação via `docs/pipeline/AUTOMATION_PLAN.md`. Cada follow-up tem prompt-bloco próprio que o agente carrega quando `MODO_FOLLOWUP` está setado.

---

## Pendências menores (não bloqueiam Fase 4)

- UI para `lead_ai_settings` (override por-lead). Hoje só via SQL.
- Job de reembedding automático dos 6 KB docs.
- Tracking de clique no link Stripe (UTM + webhook Stripe) — alimenta KPI primário.
- Painel por agente em `/ai/agents/:id` com score, custo, latência (hoje só `/admin/pipeline-health`).
