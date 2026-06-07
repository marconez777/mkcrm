---
title: "Fluxo: Lead Lifecycle (do nascimento ao fechamento)"
topic: kanban
kind: flow
audience: agent
updated: 2026-06-07
summary: Ver `features/SEQUENCES_AUTOMATIONS.md` para detalhe dos gatilhos.
---
# Fluxo: Lead Lifecycle (do nascimento ao fechamento)

> **Quando ler:** antes de mexer em stages, scoring, sequences gatilhadas por estágio, ou regras de qualificação.
> **Última atualização:** 2026-06-03

---

## Atores

- Múltiplos canais de origem (Forms, WhatsApp, Tracking, importação manual)
- **Postgres**: `leads`, `lead_events`, `lead_stage_history`, `stages`, `appointments`, `lead_tags`
- **Edge functions**: vários (cada canal tem seu entrypoint — `forms-ingest`, `external-lead-capture`, `evolution-webhook`, etc.)
- **Frontend**: Kanban (`src/pages/Kanban.tsx`), Inbox, Lead Drawer (`src/pages/LeadDrawer.tsx`)

---

## Estados (stages padrão)

```text
[novo] → [contato] → [qualificado] → [agendado] → [compareceu] → [ganho] | [perdido]
```

`stages` é por clínica e configurável. Existe sempre um stage `is_initial=true` e pelo menos um `is_won` / `is_lost`.

---

## Eventos canônicos (lead_events.event)

| Evento | Quando |
|---|---|
| `created` | INSERT em leads (gravado pelo entrypoint do canal, não por trigger) |
| `message_in` / `message_out` | WhatsApp/Email |
| `stage_changed` | Mudança de `stage_id` (gravado por `record_lead_stage_history` em `lead_stage_history` + opcionalmente espelhado em `lead_events`) |
| `tag_added` / `tag_removed` | Tags |
| `appointment_created` / `appointment_confirmed` / `appointment_no_show` | Agendamentos |
| `note_added` | Nota interna |
| `ai_handoff` | IA pediu humano |
| `assigned` | Atribuição de responsável |
| `won` / `lost` | Stage final |

`lead_events` alimenta a timeline no Lead Drawer e gatilhos de automações. Histórico de stage tem tabela dedicada (`lead_stage_history`).

---

## Triggers reais em `public.leads` / `public.messages`

| Trigger | Quando | Função | Efeito |
|---|---|---|---|
| `leads_updated` | BEFORE UPDATE | `set_updated_at()` | mantém `updated_at` |
| `leads_stage_changed` | BEFORE UPDATE | `set_stage_changed_at()` | atualiza `stage_changed_at` |
| `trg_leads_sync_pipeline` | BEFORE INSERT / UPDATE OF `stage_id` | `sync_lead_pipeline_id()` | mantém `pipeline_id` coerente com stage |
| `trg_lead_stage_history` | AFTER UPDATE OF `stage_id` | `record_lead_stage_history()` | grava linha em `lead_stage_history` |
| `trg_enroll_on_stage_change` | AFTER INSERT OR UPDATE OF `stage_id` | `enroll_lead_on_stage_change()` | enfileira `sequence_enrollments` para sequências `trigger='on_stage_enter'` (e `on_lead_create` no INSERT) |
| `log_lead_changes_trg` | AFTER UPDATE | `log_lead_changes()` | espelha mudanças relevantes em `lead_events` |
| `trg_stop_sequences_on_reply` (em `messages`) | AFTER INSERT | `stop_sequences_on_reply()` | pausa sequências do lead quando há mensagem recebida do humano |

> ⚠️ Não existe trigger separado `tg_lead_after_insert` nem `tg_pause_ai_on_human_reply`. O enroll on insert é o mesmo trigger do stage change (`trg_enroll_on_stage_change` cobre INSERT). Pausa de IA por resposta humana usa `trg_stop_sequences_on_reply` em `messages` + lógica de `bot_agent_id` no `evolution-webhook`.

---

## Fluxo end-to-end

```text
ORIGEM
├── Form externo → forms-ingest ──┐
├── WhatsApp inbound (lead novo) ─┤
├── Importação CSV ───────────────┤──► INSERT leads(stage=inicial)
├── Tracking (identify) ──────────┤        │
└── Manual (botão "novo lead") ───┘        │ trg_enroll_on_stage_change (AFTER INSERT)
                                            │   ├─ enrolla sequence_enrollments
                                            │   │   onde trigger='on_lead_create' ou stage_enter
                                            │   └─ entrypoint do canal grava lead_events('created')
                                            ▼
                                   [stage inicial]
                                            │
   usuário/IA atende, qualifica            │
                                            ▼
                                   [contato] → [qualificado]
                                            │
                            create_appointment (tool IA OU UI)
                                            ▼
                                   [agendado]
                                            │
                              dia D: appointment_no_show OU compareceu
                                            ▼
                              [compareceu] → ... → [ganho] / [perdido]
```

---

## Triggers automáticos por evento

- `stage_id` muda → `trg_enroll_on_stage_change` enfileira sequências `trigger='on_stage_enter'` filtrando por `stage_to`.
- `appointments INSERT` → automation `before_appointment` (24h/2h antes, configurável).
- `appointment_no_show` → automation `on_no_show` (reagendamento automático).
- `last_inbound_at` muda → reset do timer `no_reply_after`.

Ver `features/SEQUENCES_AUTOMATIONS.md` para detalhe dos gatilhos.

---

## Atribuição de responsável

- Default: nenhum (`assigned_to=null`).
- Regras em `clinics.settings.assignment_strategy`: `round_robin` | `least_loaded` | `manual` (não existe tabela `clinic_settings`).
- Frontend Kanban tem dropdown manual em cada card.

---

## Deduplicação

- Chave de dedupe: `(clinic_id, phone)` quando há phone (normalizado em `normalizePhone`).
- Senão `(clinic_id, ilike(email))`.
- Lógica está **inline** em cada entrypoint (`forms-ingest`, `external-lead-capture`, `evolution-webhook`) — não há helper compartilhado `findOrCreateLead` em `_shared/`. Refatorar para um helper único é TODO.

---

## Pegadinhas

- **Voltar de stage final**: permitido tecnicamente, mas não dispara `created` de novo. Sequences `on_lead_create` **não** reexecutam.
- **Lead sem phone E sem email**: aceitos só via API (não pelo form padrão). Aparecem no Kanban mas sem canal de contato.
- **Merge de leads**: hoje **não existe** UI. Duplicatas só são evitadas na origem. TODO grande.
- **Score**: campo `leads.score` existe mas não há cálculo automático ainda — só set manual via tool IA.
- **Histórico de stage**: tabela dedicada `lead_stage_history` (preenchida por `record_lead_stage_history`). Use-a para tempo em cada stage; `lead_events` é só timeline visual.

---

## Melhorias sugeridas

- UI de merge de duplicatas.
- Helper `findOrCreateLead` em `_shared/lead.ts` para consolidar dedupe.
- Scoring automático baseado em eventos (model simples regressão logística).
- Stage SLA + alerta quando lead fica parado N dias.
- Workflow "perdido por motivo" com taxonomia.

---

## Arquivos-chave

- `docs/database/SCHEMA.md` (leads, stages, lead_events, lead_stage_history)
- `docs/database/FUNCTIONS_TRIGGERS.md` (`enroll_lead_on_stage_change`, `record_lead_stage_history`, `stop_sequences_on_reply`, `log_lead_changes`)
- `docs/features/SEQUENCES_AUTOMATIONS.md`
- `src/pages/Kanban.tsx`, `src/pages/LeadDrawer.tsx`
- `supabase/functions/forms-ingest/index.ts`, `external-lead-capture/index.ts`, `evolution-webhook/index.ts` (dedupe inline)
