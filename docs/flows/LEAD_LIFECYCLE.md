# Fluxo: Lead Lifecycle (do nascimento ao fechamento)

> **Quando ler:** antes de mexer em stages, scoring, sequences gatilhadas por estágio, ou regras de qualificação.
> **Última atualização:** 2026-05-25

---

## Atores

- Múltiplos canais de origem (Forms, WhatsApp, Tracking, importação manual)
- **Postgres**: `leads`, `lead_events`, `stages`, `appointments`, `lead_tags`
- **Edge functions**: vários (cada canal tem seu entrypoint)
- **Frontend**: Kanban, Inbox, Lead Detail

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
| `created` | INSERT em leads (qualquer canal) |
| `message_in` / `message_out` | WhatsApp/Email |
| `stage_changed` | Trigger ao mudar `stage_id` |
| `tag_added` / `tag_removed` | Tags |
| `appointment_created` / `appointment_confirmed` / `appointment_no_show` | Agendamentos |
| `note_added` | Nota interna |
| `ai_handoff` | IA pediu humano |
| `assigned` | Atribuição de responsável |
| `won` / `lost` | Stage final |

Toda mudança relevante vira `lead_events` → alimenta timeline no Lead Detail e gatilhos de automações.

---

## Fluxo end-to-end

```text
ORIGEM
├── Form externo → forms-ingest ──┐
├── WhatsApp inbound (lead novo) ─┤
├── Importação CSV ───────────────┤──► INSERT leads(stage=inicial)
├── Tracking (identify) ──────────┤        │
└── Manual (botão "novo lead") ───┘        │ trigger tg_lead_after_insert
                                            │   ├─ INSERT lead_events('created')
                                            │   ├─ enqueue sequence_enrollments
                                            │   │   onde trigger='on_lead_create'
                                            │   └─ chama automations 'on_create'
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

- `lead_events.event='stage_changed'` → dispara automations com `trigger='on_stage_enter'` filtrando por `stage_to`.
- `appointments INSERT` → automation `before_appointment` (24h/2h antes, configurável).
- `appointment_no_show` → automation `on_no_show` (reagendamento automático).
- `last_inbound_at` muda → reset do timer `no_reply_after`.

Ver `features/SEQUENCES_AUTOMATIONS.md` para detalhe dos gatilhos.

---

## Atribuição de responsável

- Default: nenhum (`assigned_to=null`).
- Regras em `clinic_settings.assignment_strategy`: `round_robin` | `least_loaded` | `manual`.
- Frontend Kanban tem dropdown manual em cada card.

---

## Deduplicação

- Chave de dedupe: `(clinic_id, normalizePhoneBR(phone))` quando há phone.
- Senão `(clinic_id, lower(email))`.
- `forms-ingest`, `external-lead-capture` e `evolution-webhook` usam helper `findOrCreateLead`.

---

## Pegadinhas

- **Voltar de stage final**: permitido tecnicamente, mas não dispara `created` de novo. Sequences `on_lead_create` **não** reexecutam.
- **Lead sem phone E sem email**: aceitos só via API (não pelo form padrão). Aparecem no Kanban mas sem canal de contato.
- **Merge de leads**: hoje **não existe** UI. Duplicatas só são evitadas na origem. TODO grande.
- **Score**: campo `leads.score` existe mas não há cálculo automático ainda — só set manual via tool IA.
- **Histórico de stage**: derivado de `lead_events`, não há coluna `previous_stage_id`. Para listar tempo em cada stage, agregar eventos.

---

## Melhorias sugeridas

- UI de merge de duplicatas.
- Scoring automático baseado em eventos (model simples regressão logística).
- Stage SLA + alerta quando lead fica parado N dias.
- Workflow "perdido por motivo" com taxonomia.

---

## Arquivos-chave

- `database/SCHEMA.md` (leads, stages, lead_events)
- `database/FUNCTIONS_TRIGGERS.md` (tg_lead_after_insert, tg_pause_ai_on_human_reply)
- `features/SEQUENCES_AUTOMATIONS.md`
- `src/pages/Kanban.tsx`, `src/pages/LeadDetail.tsx`
- `supabase/functions/_shared/lead.ts` (findOrCreateLead)
