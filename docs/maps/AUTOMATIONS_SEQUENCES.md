---
title: "Mapa: Automations + Sequences"
topic: automations
kind: map
audience: agent
updated: 2026-06-07
summary: "Mensageria automatizada por gatilhos: - **Sequences** — drip de N mensagens espaçadas, iniciado por entrada em stage / tag / evento. - **Automations** — regras `quando X → faça Y` (mover stage, enviar msg, criar task, agendar, etc.). - **Le"
---
# Mapa: Automations + Sequences

> **Para localizar edições.** Para entender *por quê*, leia [`docs/features/SEQUENCES_AUTOMATIONS.md`](../features/SEQUENCES_AUTOMATIONS.md), [`docs/features/APPOINTMENT_REMINDERS.md`](../features/APPOINTMENT_REMINDERS.md), [`docs/features/BROADCASTS.md`](../features/BROADCASTS.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Mensageria automatizada por gatilhos:
- **Sequences** — drip de N mensagens espaçadas, iniciado por entrada em stage / tag / evento.
- **Automations** — regras `quando X → faça Y` (mover stage, enviar msg, criar task, agendar, etc.).
- **Lembretes de agendamento** — `before_appointment` (sem tool dedicada; usa automation).
- **Broadcasts** — envio em massa one-shot para audiência segmentada.

## 2. Rotas / pontos de entrada

| Rota | Componente |
|---|---|
| `/sequences` | `src/pages/Sequences.tsx` |
| `/automations` | `src/pages/Automations.tsx` |
| `/broadcasts` | `src/pages/Broadcasts.tsx` |
| `/templates` | `src/pages/Templates.tsx` |
| `/tasks` | `src/pages/Tasks.tsx` |
| `/scheduled-reports` | `src/pages/ScheduledReports.tsx` |

## 3. Frontend

### Componentes
- `src/components/tasks/TaskDetailDialog.tsx` — detalhe de tarefa.
- `src/components/inbox/ScheduledMessagesPanel.tsx` — mensagens agendadas no inbox.

### Libs
- `src/lib/broadcast-template.ts` — render de template em broadcast.
- `src/lib/template-vars.ts` — variáveis `{{lead.name}}` etc.
- `src/lib/scheduled-messages.ts` — CRUD agendamentos.
- `src/lib/tasks-board.ts` — board de tarefas.
- `src/lib/lead-tasks.ts` — CRUD lead_tasks.

## 4. Edge functions

### Sequences
| Function | Função |
|---|---|
| `sequence-tick/index.ts` | cron: avança runs ativos para próximo step |
| `sequence-trigger/index.ts` | dispara enroll quando evento externo bate |
| `sequence-enroll/index.ts` | enroll manual (UI ou API) |

### Automations
| Function | Função |
|---|---|
| `automations-tick/index.ts` | cron: avalia regras com gatilho temporal |

### Broadcasts
| Function | Função |
|---|---|
| `broadcast-tick/index.ts` | worker que envia broadcast enfileirado |
| `broadcast-control/index.ts` | pause/resume/cancel |

### Agendamento / outros
| Function | Função |
|---|---|
| `scheduled-dispatcher/index.ts` | envia `scheduled_messages` no horário |
| `watch-stale-leads/index.ts` | alerta lead parado N dias |
| `daily-summary/index.ts` | resumo diário |
| `scheduled-report-tick/index.ts` | dispara relatórios agendados |

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `sequences` | definição (steps, gatilho de enroll) |
| `sequence_steps` | passos individuais (delay, template, condição) |
| `message_sequence_runs` | execução por lead (`lead_id`, `current_step`, `replied_at`, `stage_id_at_send`, `stage_position_at_send`) |
| `automations` | regras (trigger + condições + ações) |
| `automation_runs` | histórico de execução |
| `broadcasts` | campanha WhatsApp em massa |
| `broadcast_recipients` | audiência resolvida |
| `scheduled_messages` | mensagens agendadas (Inbox ou tool `schedule_message`) |
| `lead_tasks` | tarefas |
| `scheduled_reports` | relatórios agendados |
| `message_templates` | templates de mensagem WhatsApp |

### pg_cron
- `sequence-tick` (a cada 1-5 min)
- `automations-tick`
- `broadcast-tick`
- `scheduled-dispatcher`
- `watch-stale-leads`
- `daily-summary`
- `scheduled-report-tick`

### Triggers
- `trg_stop_sequences_on_reply` em `messages` — quando lead responde, marca `message_sequence_runs.replied_at` e pausa runs ativos. **Crítico.**
- Trigger em `leads.stage_id` change — dispara `sequence-trigger` se sequence configurada com gatilho `on_stage_enter`.

## 6. Integrações externas

- WhatsApp via `evolution-send` / `evolution-send-media` (ver mapa Inbox).
- Email via `send-email` (ver mapa Email).

## 7. Invariantes — "não toque sem ler"

1. **`trg_stop_sequences_on_reply` é sagrado.** Lead respondeu → sequence para. Quebrar = continuar enviando após resposta = spam.
2. **Snapshot de stage em `message_sequence_runs.stage_id_at_send`** — alimenta engagement por stage. Não preencher = métrica quebrada.
3. **Idempotência de enroll**: 1 lead + 1 sequence = 1 run ativo. Re-enroll só se anterior `completed`/`stopped`.
4. **Cron precisa rodar.** Sem `pg_cron` ligado, nada dispara. Verificar `SELECT * FROM cron.job`.
5. **`scheduled_messages.send_at` em UTC.** Frontend converte para tz da clínica.
6. **`ai_paused=true` no lead** NÃO pausa sequences automaticamente (só agente IA). Lead pausado ainda recebe drip — se não for desejado, regra em `sequence-tick` precisa checar.
7. **Broadcast respeita `suppressed_emails`** (se for email) e `leads.opted_out` (WhatsApp).
8. **Template aprovado** (Meta) obrigatório para mensagens fora da janela 24h no WhatsApp.

## 8. Pegadinhas

- 2 sequences ativos no mesmo lead → ambos disparam (não há lock global). Se conflitar, regra de negócio precisa definir.
- `sequence_steps.delay` em minutos. Erro comum: cadastrar em horas e esperar comportamento de minutos.
- `automation_runs` cresce rápido — TTL/cleanup em `operations/BACKUPS_RECOVERY.md`.
- Trigger de stage change pode disparar várias automations — ordem não garantida.
- `scheduled-dispatcher` roda a cada minuto — agendamento <1min de antecedência pode ser perdido se job atrasou.
- Engagement (`message_sequence_runs.replied_at`) só é setado se resposta vem APÓS o último step enviado dentro de janela X (ver RPC `engagement_sequences_summary`).

## 9. Receitas

### Adicionar novo tipo de ação de automation
1. Schema: enum/string em `automations.actions[].type`.
2. Handler em `automations-tick/index.ts` — case novo no switch.
3. UI: `Automations.tsx` — opção no builder.
4. Se a ação chama edge function nova, criar e documentar.

### Adicionar novo gatilho de sequence
1. `sequences.trigger_type` — novo valor.
2. Onde disparar: trigger SQL (ex: insert em `messages`) ou edge function que chama `sequence-enroll`.
3. UI: `Sequences.tsx` — seletor de trigger.

### Adicionar lembrete N dias antes de evento
1. Não criar tool nova no Builder — usar `automations` com trigger `before_appointment`.
2. `automations-tick` lê `leads.appointment_at` (ou tabela equivalente) e enfileira `scheduled_messages`.
3. `scheduled-dispatcher` envia no horário.

### Criar broadcast novo
1. UI: `Broadcasts.tsx` → wizard (audiência → template → confirmar).
2. Insert em `broadcasts` + resolve `broadcast_recipients`.
3. `broadcast-tick` worker pega e envia respeitando rate limit + suppression + `opted_out`.

### Debug "sequence não avança"
1. `message_sequence_runs` — run existe, `status='active'`, `next_send_at` no passado?
2. Cron `sequence-tick` rodou? (`cron.job_run_details`).
3. Lead respondeu? `replied_at` preenchido → run pausado (esperado).
4. Logs `sequence-tick` — erro de envio Evolution?
5. Template existe e está aprovado se fora da janela 24h?
