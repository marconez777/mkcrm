---
title: "Pipeline — Stages atuais (Clínica ÓR)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Mapa das 12 colunas atuais do pipeline da Clínica ÓR, critério de entrada/saída, flags de automação por stage e correspondência com as 14 colunas analisadas no estudo."
related_docs:
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/estudo/README.md
---

# Stages atuais — pipeline `Clínica ÓR`

Pipeline default da clínica `cf038458-457d-4c1a-9ac4-c88c3c8353a1`, id `17c27f4d-8256-4ea7-b5b9-ed706494f686`. Todas as movimentações hoje são **manuais**.

## Tabela de stages

| # | Stage | Terminal? | `lock_auto_move` (v3) | Entrada via automação | Excluído de scans temporais |
|---|---|---|---|---|---|
| 0 | **Leads de entrada** | não | não | sim (lead novo) | não |
| 1 | **Qualificação** | não | não | sim (reativação default, cancelamento) | não |
| 2 | **Consulta agendada** | não | não | sim (`auto:appointment-agendado` kind=consulta; reativação se tag `no_show`) | não |
| 3 | **Consulta finalizada** | não | não | sim (`auto:appointment-realizado` kind=consulta) | não |
| 4 | **Procedimento agendado** | não | não | sim (`auto:appointment-agendado` kind=procedimento) | não |
| 5 | **Procedimento pago** | não | **sim** | só com sinal real de pagamento (webhook/comprovante+humano) | não |
| 6 | **Em tratamento** | não | não | sim (`auto:procedure-realizado` na 1ª sessão) | não |
| 7 | **Paciente antigo** | não | não | só por humano (ciclo concluído) | **sim** (final state) |
| 8 | **Sem resposta** | não | não | sim (`auto:inactivity-5d`, `auto:appointment-faltou`) | não |
| 9 | **Nutrição inativa** | não | não | só por humano (judicial, crônico) | **sim** (final state) |
| 10 | **B2B / Stakeholders** | **sim** | n/a | sim (`auto:b2b-move` Fase 2) | sim |
| 11 | **Desqualificado / Fora de escopo** | **sim** | n/a | só por humano | sim |

### Notas das flags

- **`lock_auto_move=true` em `Procedimento pago`** (v3): texto "paguei" sozinho **nunca** move pra cá. Só webhook de pagamento, OU comprovante + confirmação humana, OU movimento manual. Texto sozinho gera tag `pagamento_alegado` + task "Confirmar pagamento" (regra `auto:payment-confirmed` na Fase 3).
- **Excluído de scans temporais**: `auto:inactivity-5d` e jobs futuros que varrem o pipeline por tempo **NÃO** processam leads nesses stages. Final states + B2B/Desqualificado consomem custo sem retorno e geram falsos positivos.
- **Exceção do inactivity**: leads com `appointments.scheduled_at > now()` (consulta futura agendada) também são **excluídos** do `auto:inactivity-5d`, mesmo em stages não-finais. Hoje criar appointment NÃO seta `manual_lock_until` — sem essa exceção, lead com consulta marcada pra daqui 10 dias cairia em `Sem resposta`.

## Lock manual vs lock de auto-mover

São coisas **diferentes** — a confusão derrubou o agente anterior:

| Lock | O que bloqueia | O que NÃO bloqueia | Duração |
|---|---|---|---|
| `leads.manual_lock_until` | Movimentação automática de stage (qualquer regra `auto:*`) | Classificador escrevendo `tags`, `custom_fields`, `ai_summary`; criação de tasks | **7 dias** após arraste humano (`MANUAL_LOCK_MS = 7 * 24 * 60 * 60 * 1000`) |
| `pipeline_stages.lock_auto_move` | Entrada automática NESTE stage destino | Saída automática deste stage | Permanente (flag de schema) |

**Implicação:** dentro do lock manual de 7 dias, o classificador continua taggeando, resumindo conversa e sugerindo. Só **não move** o card. Reativação (`auto:reactivation`) durante o lock também respeita — em vez de mover, só taggeia `reativacao_durante_lock` e notifica.

## Correspondência com o estudo (14 colunas → 12 stages)

O estudo original analisou **14 colunas** do pipeline antigo "Agendamentos Novo". A consolidação atual aglutina alguns estados:

| Coluna do estudo | Stage atual |
|---|---|
| `00 - Leads de entrada` | Leads de entrada |
| `02 - Qualificação` | Qualificação |
| `03 - Consulta Agendada` | Consulta agendada |
| `05 - Consulta finalizada` | Consulta finalizada |
| `06 - Fechamento pendente consulta` | Consulta finalizada (sub-estado: aguardando decisão) |
| `09 - Fechamento pendente procedimento` | Consulta finalizada (sub-estado: aguardando NF/agenda) |
| `10 - Procedimento Agendado` | Procedimento agendado |
| `11 - Procedimento pago` | Procedimento pago |
| `12 - Retorno Tratamento Finalizado` | Em tratamento → Paciente antigo |
| `13 - Antigo Consulta/procedimento agendado` | Paciente antigo (em retorno) |
| `01 - Paciente antigo` | Paciente antigo |
| `07 - Lead parou de responder` | Sem resposta |
| `14 - Nutrição de Leads Inativos` | Nutrição inativa |
| `08 - Lead não qualificado` | Desqualificado / Fora de escopo |
| (não havia) | B2B / Stakeholders (criada para resolver problema #1 do estudo) |

> Implicação para automação: ao reler arquivos do estudo, mapear o título da coluna para o stage atual usando esta tabela. Para amostra real de leads em cada stage, ver `LEAD_SAMPLES.md`.

## Migration que a Fase 0 precisa rodar

```sql
UPDATE pipeline_stages
   SET lock_auto_move = true
 WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
   AND name = 'Procedimento pago';
```
