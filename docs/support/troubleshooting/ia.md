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

## Pipeline IA — Lead não está sendo movido automaticamente

Checklist na ordem (primeira causa que resolver, vence):

1. **A regra existe e está ativa?** Vá em **Configurações → IA do Pipeline → Regras de campo**.
2. **Lead tem chip 🔒 Lock manual?** Humano respondeu há pouco — a IA espera 30 min (configurável) antes de mexer.
3. **`custom_fields` está mesmo preenchido?** Abra o Lead Drawer → veja a aba JSON. Se vazio, o **extractor não rodou** — clique em **Rodar texto** no card "Histórico & custos".
4. **A regra tem todas as condições verdadeiras** ao mesmo tempo? (lembre: é AND).
5. **Lead foi atualizado nas últimas 24h?** Mais antigo, field-rules ignora.
6. **Há outra regra de maior prioridade** levando pra outra coluna?
7. **Card já está na coluna destino?** Field-rules é idempotente — não move se já está lá.

Detalhe técnico: [`docs/flows/PIPELINE_DERIVED.md §7`](../../flows/PIPELINE_DERIVED.md).

## Pipeline IA — Comprovante chegou mas não marcou como pago
- Chip do card é **🧾 Comprovante** (não **💰 Pago**) → vision-tick achou a imagem mas não conseguiu validar (foto borrada, recortada).
- Uma tarefa de revisão humana é criada automaticamente. Abra, confirme valor e marque manualmente.

## Pipeline IA — Conta da OpenAI estourou
- **Configurações → IA do Pipeline → Limites & budgets** → abaixe `daily_budget_extractions`, `daily_budget_vision`, `daily_budget_audio_minutes`.
- Reseta meia-noite UTC. Se urgente, vá em **OpenAI dashboard** e seta hard limit mensal.

## Relacionado
- `pages/ai-agents.md`
- `pages/ai-hub.md`
- `pages/metrics.md`
- `journeys/usar-pipeline-ia.md`
- `journeys/criar-field-rule.md`
