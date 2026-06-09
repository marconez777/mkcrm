# Fila & Logs de envios WhatsApp

Nova aba dentro de **IA → Mensagens** (ao lado de Sequências, Automações, Templates, Engajamento) com controle completo dos envios WhatsApp da clínica.

## O que entra na tela

Visão unificada de 4 fontes de envio já existentes no banco:

| Fonte | Tabela | O que mostra |
|---|---|---|
| Sequências | `message_sequence_runs` + `message_sequence_enrollments` | cada step enviado/falhou/skip + inscrições ativas com `next_run_at` |
| Automações | `automation_runs` | gatilhos executados, success/error + `detail` |
| Agendamentos avulsos | `scheduled_messages` | mensagens com `send_at` futuro, sent, failed |
| Respostas IA pendentes | `pending_replies` | debounce do agente, attempts, last_error |

## Layout

```text
┌─ Fila & Logs ──────────────────────────────────────────────┐
│ [Kill switch: Envios automáticos ATIVOS  ⬤───]            │
│                                                             │
│ ┌─ Cards de resumo (últimas 24h) ───────────────────────┐  │
│ │  Na fila   │  Enviados  │  Falhas  │  Cancelados      │  │
│ │    142     │   1.284    │    37    │      8           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ Sub-tabs:  [ Fila (próximos) ] [ Histórico ] [ Falhas ]    │
│                                                             │
│ Filtros: Origem ▾  Status ▾  Período ▾  Buscar lead...    │
│                                                             │
│ ┌─ Tabela ───────────────────────────────────────────────┐ │
│ │ Quando │ Origem    │ Lead       │ Preview │ Status │ ⋯ │ │
│ │ 14:32  │ Sequência │ Maria S.   │ Olá...  │ ✓ sent │   │ │
│ │ 14:35  │ Auto.     │ João P.    │ Lembr.. │ ✗ err  │ ↻ │ │
│ │ 15:10  │ Agendada  │ Ana L.     │ ...     │ ⏱ queue│ ✕ │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- **Sub-tab "Fila"** = `scheduled_messages.status='pending'` + `pending_replies.status='pending'` + `message_sequence_enrollments` com `next_run_at` futuro. Ordenado por horário de disparo. Botão **✕ Cancelar** por linha.
- **Sub-tab "Histórico"** = união dos `*_runs` + scheduled sent. Ordenado desc por `created_at`.
- **Sub-tab "Falhas"** = só status `failed`/`error`, com `detail`/`last_error` expandível. Sem retry (só visualização — conforme escolha).
- Filtros aplicam em todas as sub-tabs. Paginação 50/página.
- Clicar numa linha abre drawer com payload completo, lead e link para a conversa.

## Ações

- **Cancelar agendado:** UPDATE `scheduled_messages` status→`cancelled` (só pending) e DELETE em `pending_replies` pendentes do lead. Confirm dialog.
- **Kill switch global:** flag em `settings` por clínica (`automations_paused: boolean`). Os workers (`automations-tick`, `sequences-tick`, `scheduled-messages-tick`) passam a checar essa flag no começo do tick e abortam o ciclo da clínica quando true. UI mostra banner amarelo quando pausado.

Sem retry e sem WhatsApp/Email unificado (conforme respostas).

## Detalhes técnicos

**Arquivos novos:**
- `src/pages/QueueLogs.tsx` — página com cards, filtros, 3 sub-tabs.
- `src/components/queue/QueueTable.tsx` — tabela genérica com colunas configuráveis.
- `src/components/queue/CancelButton.tsx`, `KillSwitch.tsx`, `LogDetailDrawer.tsx`.
- `src/hooks/useQueueData.ts` — react-query hooks que fazem 4 queries paralelas e fundem numa lista normalizada `{ source, when, leadId, leadName, preview, status, detail, refId }`.

**Edits:**
- `src/pages/ai/Messages.tsx` — adicionar sub `{ value: "queue", label: "Fila & Logs", paths: ["/ai/messages/queue"] }`.
- `src/lib/features.ts` — feature key `messages_queue` (default on).
- `supabase/functions/automations-tick/index.ts`, `sequences-tick/index.ts`, `scheduled-messages-tick/index.ts` — early-return quando `settings.automations_paused = true` para a clínica.

**Migração:**
1. Adicionar coluna `automations_paused boolean not null default false` em `settings`.
2. Adicionar valor `cancelled` na lista permitida de `scheduled_messages.status` (se houver CHECK constraint) e em `pending_replies.status`.
3. RLS: leitura das 4 tabelas via `clinic_id = current_clinic_id()` já existe; só garantir que `UPDATE` em `scheduled_messages`/`pending_replies` para cancelar respeita a mesma política.

**Performance:** as 4 tabelas têm volume (ex.: 41k automation_runs). Hooks aplicam `limit + order by created_at desc` no banco com índices em `(clinic_id, created_at desc)` e `(clinic_id, status, send_at)` — criar via migration se faltarem.

Nenhuma alteração em emails, dashboards existentes ou lógica de envio em si — só visibilidade, cancelamento e pausa.
