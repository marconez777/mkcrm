# Plano — Mapear relação Datas ↔ Automações em `docs/skill-datas.md`

Hoje o arquivo já tem seções separadas para datas (§2, §3, §5, §7) e para automações (§4 cron, §8 UI, §11 deterministic). Falta uma **visão consolidada** que cruze: "qual data dispara qual automação, em que momento, com qual janela, gravando em qual coluna".

## O que adicionar

Inserir nova seção **§8b — Relação Datas ↔ Automações (matriz)** logo após §8.5, mantendo o restante do documento intacto. A seção terá 4 blocos:

### 1. Matriz principal (tabela)

Colunas: `Campo/Coluna de data` · `Onde é escrito` · `Quem lê` · `Automação disparada` · `Janela/Offset` · `Resultado`.

Linhas a cobrir (extraídas do código atual):

- `appointments.scheduled_at` (consulta) → `automations-tick` (trigger `before_appointment`, kind=`consulta`) → janela `minutes_before` do `trigger_config` → envia mensagem WA + grava `automation_runs`.
- `appointments.scheduled_at` (procedimento) → idem, kind=`procedimento`.
- `leads.custom_fields.consulta_agendada_em` → `pipeline-deterministic` (ruleFieldChanged) → move card para "Consulta agendada" + dispara binding de sequência via `stage_sequence_bindings`.
- `leads.custom_fields.procedimento_agendado_em` → idem para "Procedimento agendado".
- `leads.custom_fields.consulta_realizada_em` (preenchido manual pela secretária pós-transição humana) → `pipeline-deterministic` → move para "Consulta finalizada".
- `leads.last_inbound_at` → `automations-tick` trigger `lead_inactive` (Xh sem resposta) → mensagem de retomada.
- `leads.created_at` → trigger `lead_created` → boas-vindas.
- `lead_stage_history.entered_at` → trigger `stage_entered` + `sequence-tick` (avanço de steps por `delay_minutes`).
- `scheduled_messages.send_at` → worker próprio (não é automação UI, mas entra no mapa para clareza).
- `message_sequence_enrollments.next_run_at` → `sequence-tick` cron.

### 2. Diagrama ASCII do fluxo temporal

```text
Data registrada ──► Cron tick ──► Avalia janela ──► Ação (msg/move/tag)
                                       │
                                       └─► grava automation_runs / lead_events
```

Mostrando os dois caminhos (Calendário vs custom field) convergindo nos mesmos crons.

### 3. Crons × Datas que consomem

Mini-tabela: `automations-tick (1m)` → lê `appointments.scheduled_at`, `leads.last_inbound_at`, `leads.created_at`. `sequence-tick (1m)` → lê `message_sequence_enrollments.next_run_at`. `pipeline-deterministic` → lê `custom_fields.*_em` via trigger de mudança.

### 4. Invariantes da relação

- Pós-transição humana (jun/2026): IA **não escreve** `*_agendado_em` — só humano/calendário. Logo, triggers `before_appointment` só disparam para datas inseridas manualmente.
- `before_appointment` exige `appointment` row (Porta A); preencher só o custom field (Porta B) **não dispara lembrete** — gap conhecido, já listado em §14.
- Condição por custom field (ex. `Teleconsulta = Sim`) é avaliada no momento do tick, lendo `lead_custom_fields` daquele lead.

## Atualizações de housekeeping

- Atualizar `updated:` no frontmatter para `2026-06-25`.
- Adicionar link da nova seção no índice cruzado (§16) se necessário.
- Rodar `node scripts/docs-sync.mjs` ao final.

## Fora de escopo

- Não criar nova doc separada.
- Não mudar código nem migrar nada.
- Não consertar o gap "Porta B sem lembrete" — só documentar.
