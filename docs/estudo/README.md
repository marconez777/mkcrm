---
title: Estudo de Conversas — Clínica ÓR
topic: ai
kind: reference
audience: agent
updated: 2026-06-16
summary: Índice do estudo profundo de conversas do funil Agendamentos Novo da Clínica ÓR.
---

# Estudo de Conversas — Clínica ÓR

> ## 🗄️ DOCUMENTO HISTÓRICO — não use como referência de funil
>
> Este estudo foi feito em **2026-06-16** sobre o pipeline **"Agendamentos Novo" (14 colunas)**.
> **No dia seguinte esse pipeline deixou de existir.** A migration `20260617210036` criou o
> pipeline **"Clínica ÓR (novo)"** e a `20260617212408` migrou os leads, colapsando as 14
> colunas nas 11 atuais.
>
> **O conteúdo comportamental continua válido** — como pacientes falam, que objeções levantam,
> que perguntas fazem, transcrições de áudio. Foi para isso que o estudo foi feito e é para
> isso que ele serve.
>
> **O mapa de funil não é mais válido.** Seis destes arquivos descrevem colunas que não
> existem no Kanban:
>
> | Coluna estudada | Colapsou em | Arquivo |
> |---|---|---|
> | Fechamento pendente consulta | Qualificação | `06-…` |
> | Fechamento pendente procedimento | Qualificação | `09-…` |
> | Retorno Tratamento Finalizado | Paciente antigo | `12-…` |
> | Antigo Consulta/procedimento agendado | Consulta agendada | `13-…` |
> | Lead não qualificado | Desqualificado / Fora de escopo | `08-…` |
> | Procedimento pago | *(coluna deletada)* | `11-…` |
>
> Para o estado atual do funil: [`_registry/stages.md`](../pipeline/runtime/_registry/stages.md).
> Para os gatilhos: [`_registry/triggers.md`](../pipeline/runtime/_registry/triggers.md).

Análise profunda das conversas do pipeline **Agendamentos Novo** para alimentar:
- 🤖 O **agente de pipeline** (extractor / B-rules / automações)
- 💬 O futuro **agente de atendimento** (scripts, tom, perguntas-chave)

## Escopo
- Clínica: **ÓR** (`cf038458-457d-4c1a-9ac4-c88c3c8353a1`)
- Pipeline: **Agendamentos Novo**, 14 colunas (excluída _Administrativo_)
- **441 leads · 3.973 mensagens · 306 áudios transcritos** (Gemini multimodal)
- *Paciente antigo* limitado aos 30 primeiros; *Nutrição de Leads Inativos* aos 300 primeiros.

## Metodologia

1. Dump SQL via psql → `/tmp/estudo-or/data/`
2. Transcrição de áudios via Gemini 3 Flash multimodal (`input_audio` base64)
3. Síntese por lead via Gemini com **tool calling** (JSON estruturado)
4. Síntese por coluna agregando as sínteses individuais
5. Cache persistente em bucket privado `estudo-cache` (sobrevive a reciclagem do sandbox)

## Arquivos por coluna

| # | Coluna | Leads | Analisados | Arquivo |
|---|--------|-------|-----------|---------|
| 0 | Leads de entrada | 7 | 6 | [`00-leads-de-entrada.md`](./00-leads-de-entrada.md) |
| 1 | Paciente antigo | 30 | 10 | [`01-paciente-antigo.md`](./01-paciente-antigo.md) |
| 2 | Qualificação | 3 | 3 | [`02-qualificação.md`](./02-qualificação.md) |
| 3 | Consulta Agendada | 1 | 1 | [`03-consulta-agendada.md`](./03-consulta-agendada.md) |
| 5 | Consulta finalizada | 17 | 12 | [`05-consulta-finalizada.md`](./05-consulta-finalizada.md) |
| 6 | Fechamento pendente consulta | 17 | 16 | [`06-fechamento-pendente-consulta.md`](./06-fechamento-pendente-consulta.md) |
| 7 | lead parou de responder | 14 | 12 | [`07-lead-parou-de-responder.md`](./07-lead-parou-de-responder.md) |
| 8 | Lead não qualificado | 8 | 6 | [`08-lead-não-qualificado.md`](./08-lead-não-qualificado.md) |
| 9 | Fechamento pendente procedimento | 6 | 6 | [`09-fechamento-pendente-procedimento.md`](./09-fechamento-pendente-procedimento.md) |
| 10 | Procedimento Agendado | 15 | 15 | [`10-procedimento-agendado.md`](./10-procedimento-agendado.md) |
| 11 | Procedimento pago | 7 | 5 | [`11-procedimento-pago.md`](./11-procedimento-pago.md) |
| 12 | Retorno Tratamento Finalizado | 10 | 0 | [`12-retorno-tratamento-finalizado.md`](./12-retorno-tratamento-finalizado.md) |
| 13 | Antigo Consulta/procedimento agendado | 6 | 5 | [`13-antigo-consultaprocedimento-agendado.md`](./13-antigo-consultaprocedimento-agendado.md) |
| 14 | Nutrição de Leads Inativos | 300 | 6 | [`14-nutrição-de-leads-inativos.md`](./14-nutrição-de-leads-inativos.md) |

## Hub consolidado

👉 Veja [`docs/estudo-geral.md`](../estudo-geral.md) para padrões cross-coluna, cenários canônicos e roadmap priorizado de melhorias.
