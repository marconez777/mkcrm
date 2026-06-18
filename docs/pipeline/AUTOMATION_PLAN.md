---
title: "Pipeline — Plano de automação (priorizado)"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-06-18
summary: "Roadmap em fases para reintroduzir automações no pipeline, sem repetir os erros do agente anterior. Casa cenários do estudo com superfície técnica do banco."
related_docs:
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
---

# Plano de automação — pipeline

Premissa: **começar pequeno, observável e reversível.** O agente anterior foi removido por ser opaco demais. Cada fase abaixo deve poder ser ligada/desligada de forma independente por stage.

## Decisões de arquitetura (a tomar antes de codar)

| Decisão | Opções | Recomendação |
|---|---|---|
| Onde mora a regra | (a) hardcoded em edge function, (b) tabela `pipeline_rules` configurável, (c) prompt para LLM | **(a) na fase 1**, migrar para (b) só depois de 3+ regras estáveis |
| Como dispara | (a) cron tick, (b) trigger no webhook do WhatsApp, (c) trigger Postgres | **(b) para reativo** (mensagem recebida), **(a) para temporal** (inatividade, D-1) |
| Quem move o lead | service_role direto, OU usar mesma RPC do manual | Mesma RPC + `source='auto:<rule>'` — uniformiza histórico |
| Auditoria | `lead_stage_history.source` + `lead_events` | Ambos. `lead_events` para dedup, `lead_stage_history` para timeline |
| Kill switch | flag global, por stage, por regra | **Por regra** em `app_settings` (`automation.<rule>.enabled`) |

## Fase 0 — Pré-requisitos (1 dia)

- [ ] Definir convenção de nomes de regra: `auto:b2b-classifier`, `auto:inactivity-5d`, etc.
- [ ] Criar helper compartilhado `supabase/functions/_shared/pipeline-move.ts` que envolve a RPC de movimentação, valida `manual_lock_until` e `stage.lock_auto_move`, e grava `lead_events` de dedup.
- [ ] Criar página `/admin/pipeline-automations` (read-only inicialmente) que lista regras e seus toggles em `app_settings`.

## Fase 1 — Quick wins de alto volume (1 semana)

Regras simples, alta confiança, alto ROI.

| Regra | Cenário | Trigger | Ação |
|---|---|---|---|
| `auto:inactivity-5d` | C5 | Cron horário | Move leads em stages não-terminais com `last_message_at < now()-5d` para `Sem resposta`. Grava `lead_events.type='inactivity_detected'`. |
| `auto:reactivation` | C6 | `evolution-webhook` (inbound) | Se lead está em `Sem resposta` ou `Nutrição inativa` e recebe mensagem, move para `Qualificação` + tag `reativacao`. |
| `auto:reminder-d1` | C9 | Cron horário | Para cada `appointment` com `scheduled_at` em [+18h, +36h] e status `agendado`, envia template ÚNICO. Dedup via `lead_events.type='reminder_sent'` com `payload.appointment_id`. |
| `auto:modality-guard` | C10 | Pré-envio de template | Bloqueia envio de template que contém `{{endereco}}` se `custom_fields.modalidade='online'`. |

Critério de aceite da fase: cada regra tem teste unitário do happy-path + caso de dedup, e um toggle off-by-default em `app_settings`.

## Fase 2 — Classificação de entrada (2 semanas)

| Regra | Cenário | Trigger | Ação |
|---|---|---|---|
| `auto:b2b-classifier` | C1 | `evolution-webhook` + lead novo | LLM classifica 1ª mensagem (B2B vs paciente vs spam). Se B2B com confidence ≥ 0.85 → move para `B2B/Stakeholders` + tag `b2b_auto`. Caso contrário, fica em `Leads de entrada`. |
| `auto:urgency-flag` | C2 | `evolution-webhook` (toda mensagem) | LLM detecta crise. Se positivo → adiciona tag `urgencia_clinica` + cria `lead_events.type='urgency_flagged'` + notificação real-time para humano. **Não move stage.** |

Requisitos: usar Lovable AI Gateway, prompt versionado em `agent_prompt_versions`, traces em `agent_traces` para auditar.

## Fase 3 — Tarefas administrativas (1 semana)

| Regra | Cenário | Trigger | Ação |
|---|---|---|---|
| `auto:nf-task` | C3 | `evolution-webhook` (inbound) | Se mensagem contém termos de reembolso e lead está em `Consulta finalizada`, cria `lead_tasks` "Emitir NF" com `due_at = +1 dia útil`. Dedup: não criar se já existe task aberta de mesmo título. |
| `auto:payment-confirmed` | C4 | `evolution-webhook` (inbound) OU webhook de pagamento futuro | Move `Procedimento agendado` → `Procedimento pago` quando comprovante detectado. Confidence alta necessária (regex + LLM). |

## Fase 4 — Retenção e nutrição (depois de estabilizar 1–3)

| Regra | Cenário | Trigger |
|---|---|---|
| `auto:judicializacao` | C7 | LLM em inbound |
| `auto:renovacao-receita` | C8 | Cron diário + inbound |
| `auto:objection-suggest` | C12 | Inbound → painel do atendente (não envia sozinho) |

## Coisas que NÃO automatizamos (por enquanto)

- **Desqualificação fora-de-escopo (C11)**: risco de falso positivo, ROI baixo. Deixar manual.
- **Resposta automática genérica**: o agente de auto-reply de WhatsApp já cobre, não criar segunda camada.
- **Reordenação de leads dentro da coluna**: ordem hoje é manual e os atendentes usam isso como sinal próprio.

## Métricas de sucesso (definir antes de ligar cada regra)

Para cada regra criada, registrar:
- Quantos leads tocados / dia.
- Taxa de "humano desfez a movimentação em < 24h" (sinal de falso positivo). Calculável via `lead_stage_history` cruzando `source='auto:X'` seguido de `source='manual'` no mesmo lead.
- Tempo médio entre trigger e ação humana correlata (ex: paciente respondeu ao lembrete D-1).

## Gates de segurança obrigatórios em toda regra

1. Checar `manual_lock_until > now()` → abortar.
2. Checar `stage.lock_auto_move` no stage destino → abortar.
3. Checar `app_settings.automation.<rule>.enabled = true` → abortar se off.
4. Idempotência via `lead_events` antes de agir.
5. `lead_stage_history.source` preenchido com nome da regra.
6. Log de erro em `error_events` se algo der ruim, com `lead_id` e `rule_name`.

## Como começar (sugestão concreta)

Quando quiser executar, peça por uma fase específica — ex: _"vamos fazer a Fase 1, começando pela `auto:inactivity-5d`"_. Aí abrimos: edge function nova + cron + toggle + página de admin para ligar/desligar.
