---
title: "Matriz de fluxo do lead — trigger → agente → ação → stage"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-23
summary: "Tabela única consolidando cada cenário do lead na Clínica ÓR com o trigger que dispara, o componente que executa (regra determinística ou agente do classifier), a ação tomada, o stage destino, a toggle de feature e o link para a doc detalhada. Use esta tabela como índice navegacional — os detalhes vivem em DETERMINISTIC_RULES, CLASSIFIER e docs/estudo/."
code_refs:
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/pipeline-move.ts
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/GATES.md
  - docs/estudo/README.md
---

# Matriz de fluxo do lead

Índice navegacional. Cada linha responde: **"o que dispara, quem executa, o que acontece, onde vai parar"**. Para o detalhe de cada peça, siga o link.

## Convenções

- **Trigger**: o que origina a execução (trigger Postgres + pg_net, cron, webhook, classifier loop).
- **Executor**:
  - `det:<action>` → uma das 7 actions de `pipeline-deterministic`.
  - `classifier:<agente>` → um dos 5 agentes de `pipeline-classify` V6 (Resumidor, Agendador, Tipificador, Movimentador, Maestro).
  - `hook:A2` → hooks pós-move em `_shared/pipeline-move.ts`.
- **Gates**: regras bloqueantes (G1–G5/G8/G10/D3) — ver `GATES.md`.
- Toggles vivem em `clinic_secrets.payload.automation.*.enabled`.

---

## 1. Entrada do lead

| Cenário | Trigger | Executor | Ação | Stage destino | Toggle | Doc |
|---|---|---|---|---|---|---|
| Lead novo criado (qualquer fonte) | `tg_auto_novo_lead` (INSERT `leads`) | `det:novo-lead` | Move para Novo + `source=auto:novo-lead` | **Novo** (canônico) | `automation.novo_lead.enabled` | [DETERMINISTIC_RULES](./DETERMINISTIC_RULES.md#autonovo-lead) · [estudo/00](../../estudo/00-leads-de-entrada.md) |
| Secretária respondeu pela 1ª vez | `tg_auto_secretary_replied` (INSERT `messages` from_me=true) | `det:secretary-replied` | Move para Qualificação **só se atual=Novo** | **Qualificação** | `automation.secretary_replied.enabled` | [DETERMINISTIC_RULES](./DETERMINISTIC_RULES.md) · [estudo/02](../../estudo/02-qualificação.md) |
| Lead identificado como paciente antigo | webhook Evolution → match por telefone | `det:novo-lead` + override | Move para Paciente antigo, marca `eh_paciente_antigo=true`, lock 90d | **Paciente antigo** | `automation.novo_lead.enabled` | [estudo/01](../../estudo/01-paciente-antigo.md) |

## 2. Qualificação e movimento por LLM

Cron `pipeline-classify-tick` (1/min) processa até 50 leads com `needs_ai_review=true`. Cada execução roda os 5 agentes em série→paralelo→série.

| Cenário | Agente responsável | Saída | Stage destino possível | Doc |
|---|---|---|---|---|
| Resumir histórico recente do lead | `classifier:Resumidor` | `summary` + `mentioned_dates` (cru) | — (input dos próximos) | [CLASSIFIER §Resumidor](./CLASSIFIER.md) |
| Detectar pedido/confirmação de agendamento | `classifier:Agendador` | `is_scheduling_action`, `scheduling_intent` | — | [CLASSIFIER §Agendador](./CLASSIFIER.md) |
| Sugerir tags + patch de custom_fields | `classifier:Tipificador` | `tags_suggested`, `custom_fields_patch` | — (aplica via G10) | [CLASSIFIER §Tipificador](./CLASSIFIER.md) |
| Sugerir movimento de stage | `classifier:Movimentador` | `stage_suggestion`, `intent`, `is_b2b` | qualquer (com gates) | [CLASSIFIER §Movimentador](./CLASSIFIER.md) |
| Validar e decidir o movimento final | `classifier:Maestro` | veredicto final + confiança | move via `pipelineMove` se confiança alta | [CLASSIFIER §Maestro](./CLASSIFIER.md) |
| Lead detectado B2B / stakeholder | `Movimentador.is_b2b=true` → Maestro | tag B2B + move | **B2B / Stakeholders** | [estudo/02](../../estudo/02-qualificação.md) |
| Lead não qualificado | Maestro com `intent=nao_qualificado` | move + tag motivo | **Lead não qualificado** | [estudo/08](../../estudo/08-lead-não-qualificado.md) |

## 3. Agenda — sincronização com `appointments`

| Cenário | Trigger | Executor | Stage destino | Toggle | Doc |
|---|---|---|---|---|---|
| Consulta agendada (kind=consulta, status=scheduled) | `tg_auto_appointment_sync` | `det:appointment-sync` | **Consulta agendada** | `automation.appointment_sync.consulta_scheduled.enabled` | [estudo/03](../../estudo/03-consulta-agendada.md) |
| Consulta finalizada (kind=consulta, status=completed) | idem | `det:appointment-sync` | **1ª Sessão Finalizada** | `automation.appointment_sync.consulta_completed.enabled` | [estudo/05](../../estudo/05-consulta-finalizada.md) |
| Procedimento agendado (kind=procedimento, status=scheduled) | idem | `det:appointment-sync` | **Procedimento agendado** | `automation.appointment_sync.procedimento_scheduled.enabled` | [estudo/10](../../estudo/10-procedimento-agendado.md) |
| Procedimento concluído / pago | idem + webhook pagamento | `det:appointment-sync` + `pipeline-payment-webhook` | **Procedimento pago** | `automation.appointment_sync.procedimento_completed.enabled` | [estudo/11](../../estudo/11-procedimento-pago.md) |

## 4. Custom fields e ciclo

| Cenário | Trigger | Executor | Ação | Toggle | Doc |
|---|---|---|---|---|---|
| Ciclo de tratamento concluído (`ciclo_status` muda) | `tg_auto_field_changed` (UPDATE `leads.custom_fields`) | `det:field-changed → ciclo-concluido` | Move para Paciente antigo + lock auto-move 90d | `automation.ciclo_concluido.enabled` | [DETERMINISTIC_RULES §ciclo](./DETERMINISTIC_RULES.md) · [estudo/12](../../estudo/12-retorno-tratamento-finalizado.md) |
| Modalidade preferida mudou (presencial↔online) | `tg_auto_field_changed` | `det:field-changed → modality-guard` | Só atualiza tag — não move | `automation.modality_guard.enabled` | [DETERMINISTIC_RULES §modality-guard](./DETERMINISTIC_RULES.md) |

## 5. Inatividade e follow-up (cron `*/15 min`)

`pipeline-inactivity-tick` mede `hours_since_last_inbound` e dispara em camadas:

| Tier | Cenário | Source | Stage destino | Toggle | Doc |
|---|---|---|---|---|---|
| 24h | Sem resposta há 1 dia → 1º follow-up | `auto:followup-24h` | — (só task) | `automation.followup_24h.enabled` | [estudo/07](../../estudo/07-lead-parou-de-responder.md) |
| 3d | Sem resposta há 3 dias → 2º follow-up | `auto:followup-3d` | — (só task) | `automation.followup_3d.enabled` | [estudo/07](../../estudo/07-lead-parou-de-responder.md) |
| 7d | Sem resposta há 7 dias | `auto:followup-7d` | **Nutrição inativa** | `automation.followup_7d.enabled` | [estudo/14](../../estudo/14-nutrição-de-leads-inativos.md) |
| 60d | Paciente antigo sem contato há 60d | `auto:inactivity-tick` | **Nutrição Antigos (>60d)** | `automation.inactivity_tick.enabled` | [estudo/14](../../estudo/14-nutrição-de-leads-inativos.md) |

## 6. Sweeps periódicos

| Cron | Cenário | Executor | Ação | Toggle |
|---|---|---|---|---|
| `0 3 1 * *` (dia 1, 03h) | Varredura mensal de pacientes antigos | `det:monthly-sweep-tick` | Move pacientes elegíveis para Paciente antigo + `eh_paciente_antigo=true` | `automation.monthly_sweep_paciente_antigo.enabled` |
| `0 7 * * *` (diário 07h) | Detecta lead inativo que voltou a responder | `det:reactivation-tick` | Marca tag de reativação (não move) | `automation.reactivation.enabled` |
| `0 8 * * *` (diário 08h) | Human reactor — escalar para humano | `det:human-reactor-tick` | Cria task atribuída a humano | `automation.human_reactor.enabled` |

## 7. Fechamento e pagamento

| Cenário | Origem | Stage destino | Doc |
|---|---|---|---|
| Aguardando confirmação de consulta | Movimentador detecta intent | **Fechamento pendente — consulta** | [estudo/06](../../estudo/06-fechamento-pendente-consulta.md) |
| Aguardando confirmação de procedimento | Movimentador detecta intent | **Fechamento pendente — procedimento** | [estudo/09](../../estudo/09-fechamento-pendente-procedimento.md) |
| Comprovante de pagamento recebido | Webhook pagamento (Eduzz ou foto na conversa) | **Procedimento pago** | [estudo/11](../../estudo/11-procedimento-pago.md) |
| Paciente antigo com consulta/proc agendado | Hook A2 + Movimentador | volta ao stage de agenda apropriado | [estudo/13](../../estudo/13-antigo-consultaprocedimento-agendado.md) |

---

## Componentes auxiliares (não movem cards)

- **`hook:A2`** (`_shared/pipeline-move.ts`) — após todo `pipelineMove` ok, dispara stage bindings (mensagens automáticas, tasks, atualizações de campos). Detalhe: [STAGES_LIVE](./STAGES_LIVE.md).
- **`pipeline-position-auditor`** — cron auditor: detecta cards "fora do lugar" e gera evento (não move). Detalhe: [AUDITORS](./AUDITORS.md).
- **`pipeline-post-move-verifier`** — cron pós-move: verifica se hook A2 completou. Detalhe: [AUDITORS](./AUDITORS.md).
- **`pipeline-summarize`** — gera/atualiza `lead.ai_summary` (alimenta o Resumidor). Detalhe: [SUMMARIZER](./SUMMARIZER.md).

## Gates globais (todos os moves passam por aqui)

`pipelineMove()` aplica G1–G5, G8, G10, D3 antes de qualquer movimento (incluindo classifier e determinístico). Veja [GATES.md](./GATES.md) para a tabela completa.

## Como ler esta matriz no debug

1. Olhe `lead_events.type` do lead — ele revela qual `source` rodou (`auto:novo-lead`, `auto:classifier`, etc.).
2. Encontre o `source` na coluna "Executor" ou "Source" acima.
3. Siga o link da última coluna para o detalhe técnico (`runtime/`) ou narrativo (`estudo/`).
