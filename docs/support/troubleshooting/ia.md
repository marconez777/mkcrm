---
title: Problemas com IA
topic: ai
kind: troubleshooting
audience: user
updated: 2026-06-07
---
# Problemas com IA

## Agente não responde no WhatsApp
1. Agente está **ativo** em `/ai/agents`?
2. Está vinculado à instância de WhatsApp correta?
3. Lead não está com **IA pausada**? Ver `journeys/pausar-ia-em-lead.md`.
4. Chave de API do provedor está válida e com saldo?
5. Limite de gasto da clínica não estourou (veja banner no topo)?

## "Limite de gasto de IA atingido" (erro 402)
**Causa:** clínica atingiu o teto mensal definido pelo super_admin.
**Solução:**
- Cliente precisa solicitar aumento do limite ao admin da plataforma.
- Super_admin: em `/admin → clínica → Limite de gasto de IA`, aumente o valor.

## Erro do provedor (OpenAI/Google offline ou quota)
- Banner vermelho aparece no topo do `/ai/hub`.
- Aguarde alguns minutos. Se persistir, troque temporariamente para outro provedor em **IA → Agentes → editar agente → Chave**.

## Builder não gera o prompt
**Chave do Builder:** o wizard precisa de uma chave de IA do nível da plataforma. Se faltar, contate o super_admin.
**Solução em sequência:**
1. Verifique se o passo de **Entrevista** foi totalmente preenchido.
2. Tente novamente em 1 minuto (pode ser timeout temporário).
3. Se nada funciona, reduza o tamanho das respostas da entrevista.

## Agente "inventando" coisas (alucinação)
- Refine o **prompt** no wizard ou editor de agente.
- Adicione documentos à **Base de conhecimento** (KB) para o agente buscar fatos.
- Use o **Test Lab** para reproduzir e ajustar.

## Custo de IA muito alto
- Veja **Métricas → Uso de IA** (`/metrics/ai-usage`) para descobrir qual agente/modelo está gastando mais.
- Considere trocar para um modelo mais barato no agente.
- Ajuste o **Limite de gasto** preventivamente.

## Relacionado
- `pages/ai-agents.md`
- `pages/ai-hub.md`
- `pages/metrics.md`
